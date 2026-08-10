import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MAX_FIELD = parseInt(process.env.OPENCODE_TRACE_MAX_FIELD ?? "4096", 10);
const MAX_KEYS = parseInt(process.env.OPENCODE_TRACE_MAX_KEYS ?? "40", 10);
const MAX_DEPTH = parseInt(process.env.OPENCODE_TRACE_MAX_DEPTH ?? "6", 10);

// Default: <project>/.ooda/traces/. Resolved per-plugin-instance from
// PluginInput.directory so we land inside the repo's gitignored .ooda/ scratch
// space — no $HOME permission ask, easy to curate (copy out interesting runs,
// gardener cleans the rest).
//
// Env override OPENCODE_TRACE_DIR wins when set (absolute path or relative to
// project directory).
let TRACE_BASE = null; // set lazily on plugin init

// ---------------------------------------------------------------------------
// Module-level broken flag — first write failure silences all subsequent writes
// ---------------------------------------------------------------------------
let broken = false;

// ---------------------------------------------------------------------------
// Per-session state — agent stamp, parentSessionID, system-transform hash,
// tool.execute.before timestamps (for duration_ms pairing).
// ---------------------------------------------------------------------------
const sessionAgent = new Map(); // sessionID -> agent name
const sessionParent = new Map(); // sessionID -> parentSessionID | null
const sessionTransformHash = new Map(); // sessionID -> last-seen transform hash
const toolCallStart = new Map(); // callID -> start ms

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
  "set-cookie",
]);

const SENSITIVE_KEY_RE = /credentials|secret|password|token/i;

const SENSITIVE_VALUE_PATTERNS = [
  /Bearer\s+\S+/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /AKIA[A-Z0-9]{16}/g,
];

function redactString(s) {
  if (typeof s !== "string") return s;
  let out = s;
  for (const re of SENSITIVE_VALUE_PATTERNS) {
    out = out.replace(re, "<redacted:value-pattern>");
  }
  return out;
}

function truncate(s) {
  if (typeof s !== "string") return s;
  if (s.length <= MAX_FIELD) return s;
  const kept = MAX_FIELD;
  const orig = s.length;
  return s.slice(0, kept) + `…<truncated:${orig}→${kept}>`;
}

// Object-size/depth cap: WIDE payloads (many keys, e.g. a 19-model provider
// catalog) blew past MAX_FIELD because truncate() only bounds strings, not
// object width. This caps key count per object level and recursion depth so
// a single wide/deep payload cannot recreate that blowup.
function redact(value, keyName, seen, depth) {
  depth = depth ?? 0;
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    let v = redactString(value);
    v = truncate(v);
    return v;
  }
  if (typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "<redacted:max-depth>";
  // Cycle guard: bail with a marker rather than recursing forever.
  seen = seen ?? new WeakSet();
  if (seen.has(value)) return "<redacted:cycle>";
  seen.add(value);
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_KEYS).map((item) => redact(item, undefined, seen, depth + 1));
    if (value.length > MAX_KEYS) items.push(`<redacted:array-capped:${value.length}→${MAX_KEYS}>`);
    return items;
  }
  const entries = Object.entries(value);
  const out = {};
  let count = 0;
  for (const [k, v] of entries) {
    if (count >= MAX_KEYS) {
      out["<redacted:keys-capped>"] = `${entries.length}→${MAX_KEYS}`;
      break;
    }
    const kLower = k.toLowerCase();
    if (SENSITIVE_HEADERS.has(kLower)) {
      out[k] = "<redacted:header>";
    } else if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = "<redacted:key-match>";
    } else {
      out[k] = redact(v, k, seen, depth + 1);
    }
    count++;
  }
  return out;
}

function hashOf(value) {
  try {
    return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
  } catch {
    return "unhashable";
  }
}

// ---------------------------------------------------------------------------
// Session ID / agent / parent helpers
// ---------------------------------------------------------------------------
function resolveSessionID(input) {
  return input?.sessionID ?? input?.event?.properties?.sessionID ?? "_pre-session";
}

// chat.params is the only hook that reliably carries the agent name
// (input.agent). Cache it here so every other hook can stamp the same
// sessionID with the agent that owns it.
function stampAgent(sid, input) {
  const agent = input?.agent;
  if (agent && !sessionAgent.has(sid)) sessionAgent.set(sid, agent);
  return sessionAgent.get(sid) ?? null;
}

// ---------------------------------------------------------------------------
// JSONL writer
// ---------------------------------------------------------------------------
function getTracePath(sessionID) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const safe = sessionID.replace(/[^a-zA-Z0-9_\-]/g, "_");
  return path.join(TRACE_BASE ?? ".ooda/traces", date, `${safe}.jsonl`);
}

let _loggedOnce = false;
function logOnce(err) {
  if (!_loggedOnce) {
    _loggedOnce = true;
    console.error("[tracer] write failed:", String(err));
  }
}

function writeLine(kind, sessionID, input, output, extra) {
  if (broken) return;
  const agent = stampAgent(sessionID, input);
  const line = JSON.stringify({
    v: 2,
    ts: new Date().toISOString(),
    kind,
    sessionID,
    agent,
    parentSessionID: sessionParent.has(sessionID) ? sessionParent.get(sessionID) : null,
    input: redact(input),
    output: redact(output) ?? null,
    ...extra,
  });
  const filePath = getTracePath(sessionID);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, line + "\n");
  } catch (e) {
    logOnce(e);
    broken = true;
  }
}

// ---------------------------------------------------------------------------
// Hook payload notes (from 2026-05-02 trace audit; U1 SNR overhaul 2026-08-10)
//
// tool.execute.after — input shape: { tool, sessionID, callID, args: {...} }
//   output shape: { title, metadata: { output: <stdout-string>, truncated } }
//   (a) exitCode / stderr are NOT separately exposed in output — upstream limitation.
//       stdout_empty + output_len (below) make the AGENTS.md "empty stdout is
//       Outcome::Surprise" rule machine-checkable without an exit code.
//   (b) args are correctly under input.args (not output) — no issue.
//   (c) tool == "task" carries the child session id in output; used to derive
//       parentSessionID when no hook exposes it directly.
//
// experimental.session.compacting — hook wired; fires only when compaction occurs.
//   No sample available from 2026-05-02 sessions (none compacted). Hook captures
//   both inp and out as-is; signal quality will be assessable once a compacting
//   session is sampled.
//
// permission.ask — ZERO firings across 150 audited files (2026-08-10 sweep).
// Real permission events arrive as event/permission.asked and
// event/permission.replied instead. Hook removed; AGENTS.md § Permission-ask-hang
// already documents the actual event names.
// ---------------------------------------------------------------------------

const FILTERED_EVENT_TYPES = new Set([
  "session.status",
  "message.part.delta",
  "message.part.updated", // duplicates chat.message content
  "message.updated", // churn; payload is only {info, sessionID}
  "plugin.added", // startup noise
  "file.watcher.updated",
  "catalog.updated",
  "integration.updated",
  "connector.updated",
  "reference.updated",
  "session.updated",
]);

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------
export default async function tracerPlugin(input) {
  // Resolve trace directory once per plugin load. Env override beats default.
  // Default is <project>/.ooda/traces — repo-local and gitignored.
  if (TRACE_BASE === null) {
    const envDir = process.env.OPENCODE_TRACE_DIR;
    if (envDir) {
      TRACE_BASE = path.isAbsolute(envDir)
        ? envDir
        : path.join(input?.directory ?? process.cwd(), envDir);
    } else {
      TRACE_BASE = path.join(input?.directory ?? process.cwd(), ".ooda", "traces");
    }
  }

  return {
    event(inp) {
      try {
        const t = inp?.event?.type;
        if (FILTERED_EVENT_TYPES.has(t)) return;
        if (
          t === "session.diff" &&
          Array.isArray(inp?.event?.properties?.diff) &&
          inp.event.properties.diff.length === 0
        ) return;
        const sid = resolveSessionID(inp);
        writeLine("event", sid, inp, null);
      } catch (e) { logOnce(e); }
    },

    async "chat.message"(inp, out) {
      try {
        const sid = resolveSessionID(inp);
        writeLine("chat.message", sid, inp, out);
      } catch (e) { logOnce(e); }
    },

    async "chat.params"(inp, out) {
      try {
        const sid = resolveSessionID(inp);
        // Reduce provider to its id only (was the full 19-model catalog,
        // ~31% of corpus bytes measured 2026-08-10). Trim model to
        // {id, providerID} but KEEP output.options — that carries
        // resolved reasoningEffort, the signal FINDING 2 depends on.
        const trimmedInp = { ...inp };
        if (inp?.input?.provider) {
          trimmedInp.input = {
            ...inp.input,
            provider: { id: inp.input.provider.id ?? inp.input.provider },
          };
        }
        if (inp?.input?.model) {
          trimmedInp.input = {
            ...trimmedInp.input,
            model: { id: inp.input.model.id, providerID: inp.input.model.providerID },
          };
        }
        writeLine("chat.params", sid, trimmedInp, out);
      } catch (e) { logOnce(e); }
    },

    async "command.execute.before"(inp, out) {
      try {
        const sid = resolveSessionID(inp);
        writeLine("command.execute.before", sid, inp, out);
      } catch (e) { logOnce(e); }
    },

    async "tool.execute.before"(inp, out) {
      try {
        const sid = resolveSessionID(inp);
        if (inp?.callID) toolCallStart.set(inp.callID, Date.now());
        writeLine("tool.execute.before", sid, inp, out);
      } catch (e) { logOnce(e); }
    },

    async "tool.execute.after"(inp, out) {
      try {
        const sid = resolveSessionID(inp);
        const extra = {};
        if (inp?.callID && toolCallStart.has(inp.callID)) {
          extra.duration_ms = Date.now() - toolCallStart.get(inp.callID);
          toolCallStart.delete(inp.callID);
        }
        if (inp?.tool === "bash") {
          const stdout = out?.metadata?.output;
          extra.stdout_empty = typeof stdout === "string" ? stdout.trim().length === 0 : null;
          extra.output_len = typeof stdout === "string" ? stdout.length : null;
        }
        if (inp?.tool === "task") {
          const childSID = out?.metadata?.sessionID ?? out?.sessionID ?? null;
          if (childSID) sessionParent.set(childSID, sid);
        }
        writeLine("tool.execute.after", sid, inp, out, extra);
      } catch (e) { logOnce(e); }
    },

    async "shell.env"(inp, out) {
      try {
        const sid = resolveSessionID(inp);
        writeLine("shell.env", sid, inp, out);
      } catch (e) { logOnce(e); }
    },

    async "experimental.chat.system.transform"(inp, out) {
      try {
        const sid = resolveSessionID(inp);
        // Hash-dedupe: this payload is 1 distinct value per session but was
        // logged in full on every call (~11% of corpus bytes measured
        // 2026-08-10). Emit the full payload once per session, then a
        // {hash, ref} pointer on repeats.
        const hash = hashOf(out);
        const prev = sessionTransformHash.get(sid);
        if (prev === hash) {
          writeLine("experimental.chat.system.transform", sid, inp, { hash, ref: "unchanged" });
        } else {
          sessionTransformHash.set(sid, hash);
          writeLine("experimental.chat.system.transform", sid, inp, out, { hash });
        }
      } catch (e) { logOnce(e); }
    },

    async "experimental.session.compacting"(inp, out) {
      try {
        const sid = resolveSessionID(inp);
        writeLine("experimental.session.compacting", sid, inp, out);
      } catch (e) { logOnce(e); }
    },

    async "experimental.text.complete"(inp, out) {
      try {
        const sid = resolveSessionID(inp);
        writeLine("experimental.text.complete", sid, inp, out);
      } catch (e) { logOnce(e); }
    },
  };
}

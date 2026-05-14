import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MAX_FIELD = parseInt(process.env.OPENCODE_TRACE_MAX_FIELD ?? "4096", 10);

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

function redact(value, keyName, seen) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    let v = redactString(value);
    v = truncate(v);
    return v;
  }
  if (typeof value !== "object") return value;
  // Cycle guard: bail with a marker rather than recursing forever.
  seen = seen ?? new WeakSet();
  if (seen.has(value)) return "<redacted:cycle>";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, undefined, seen));
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const kLower = k.toLowerCase();
    if (SENSITIVE_HEADERS.has(kLower)) {
      out[k] = "<redacted:header>";
    } else if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = "<redacted:key-match>";
    } else {
      out[k] = redact(v, k, seen);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Session ID helper
// ---------------------------------------------------------------------------
function resolveSessionID(input) {
  return input?.sessionID ?? input?.event?.properties?.sessionID ?? "_pre-session";
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

function writeLine(kind, sessionID, input, output) {
  if (broken) return;
  const line = JSON.stringify({
    v: 1,
    ts: new Date().toISOString(),
    kind,
    sessionID,
    input: redact(input),
    output: redact(output) ?? null,
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
// Hook payload notes (from 2026-05-02 trace audit)
//
// tool.execute.after — input shape: { tool, sessionID, callID, args: {...} }
//   output shape: { title, metadata: { output: <stdout-string>, truncated } }
//   (a) exitCode / stderr are NOT separately exposed in output — upstream limitation.
//       To recover exit code: parse output.metadata.output for "exit N" or capture
//       it at call time via cargo --message-format=short.
//   (b) args are correctly under input.args (not output) — no issue.
//
// experimental.session.compacting — hook wired; fires only when compaction occurs.
//   (c) No sample available from 2026-05-02 sessions (none compacted). Hook captures
//       both inp and out as-is; signal quality will be assessable once a compacting
//       session is sampled.
//
// event hook filter — (d) message.part.updated duplicates chat.message content;
//   added to filter below alongside message.part.delta.
// ---------------------------------------------------------------------------

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
        if (t === "session.status") return;
        if (t === "message.part.delta") return;
        // message.part.updated fires on every text-part mutation and duplicates
        // content already captured by chat.message; filter as pure churn.
        if (t === "message.part.updated") return;
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
        writeLine("chat.params", sid, inp, out);
      } catch (e) { logOnce(e); }
    },

    async "permission.ask"(inp, out) {
      try {
        const sid = resolveSessionID(inp);
        writeLine("permission.ask", sid, inp, out);
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
        writeLine("tool.execute.before", sid, inp, out);
      } catch (e) { logOnce(e); }
    },

    async "tool.execute.after"(inp, out) {
      try {
        const sid = resolveSessionID(inp);
        writeLine("tool.execute.after", sid, inp, out);
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
        writeLine("experimental.chat.system.transform", sid, inp, out);
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

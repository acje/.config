import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_PATH = path.join(here, 'plugins', 'dramallama-guard.mjs');
const CONFIG_PATH = path.join(here, 'opencode.json');
const CHAT_URL = 'https://aiapi.mattilsynet.no/v1/chat/completions';

const enc = new TextEncoder();

function sseResponse(stream) {
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function emptyStream() {
  return new ReadableStream({ start(controller) { controller.close(); } });
}

function chunked(...lines) {
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(enc.encode(line));
      controller.close();
    },
  });
}

async function installGuard(t, mockFetch) {
  const previous = globalThis.fetch;
  globalThis.fetch = mockFetch;
  t.after(() => { globalThis.fetch = previous; });
  const module = await import(pathToFileURL(PLUGIN_PATH).href);
  const hooks = await module.default({});
  assert.ok(hooks.auth, 'plugin must expose an auth hook');
  const { fetch } = await hooks.auth.loader(async () => ({ type: 'api', key: 'test-key' }), {});
  assert.equal(typeof fetch, 'function');
  return fetch;
}

function streamBody(content) {
  const messages = content === undefined
    ? [{ role: 'user', content: 'hi' }]
    : [{ role: 'user', content }];
  return JSON.stringify({ stream: true, model: 'drama/code-thinking', messages });
}

test('plugin exposes the dramallama auth hook with an api method and a fetch wrapper', async () => {
  const module = await import(pathToFileURL(PLUGIN_PATH).href);
  const hooks = await module.default({});
  assert.equal(hooks.auth.provider, 'dramallama');
  assert.deepEqual(hooks.auth.methods, [{ type: 'api', label: 'API key' }]);
  assert.equal(typeof hooks.auth.loader, 'function');
  const options = await hooks.auth.loader(async () => ({ type: 'api', key: 'k' }), {});
  assert.equal(typeof options.fetch, 'function');
});

test('valid SSE stream with data: chunks passes through intact', async (t) => {
  const source = 'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n';
  const guarded = await installGuard(t, async () =>
    sseResponse(chunked(
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n',
    )));
  const res = await guarded(CHAT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: streamBody() });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
  assert.equal(await res.text(), source);
});

test('SSE with comment lines and cross-chunk data lines still streams intact', async (t) => {
  const source = ': keepalive\n\ndata: {"delta":{"content":"Hello"}}\n\ndata: [DONE]\n\n';
  const guarded = await installGuard(t, async () =>
    sseResponse(new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(': keepalive\n\n'));
        controller.enqueue(enc.encode('data: {"delta":{"content":"Hel'));
        controller.enqueue(enc.encode('lo"}}\n\ndata: [DONE]\n\n'));
        controller.close();
      },
    })));
  const res = await guarded(CHAT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: streamBody() });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), source);
});

test('HTTP 200 empty SSE stream on large payload (>=800KB) returns HTTP 413 context overflow', async (t) => {
  const body = streamBody('x'.repeat(820_000));
  assert.ok(Buffer.byteLength(body, 'utf8') >= 800_000, 'precondition: request body >= 800000 bytes');
  const guarded = await installGuard(t, async () => sseResponse(emptyStream()));
  const res = await guarded(CHAT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  assert.equal(res.status, 413);
  const payload = await res.json();
  assert.equal(payload.error.code, 'context_length_exceeded');
  assert.match(payload.error.message, /request_too_large|context_length_exceeded/i);
});

test('HTTP 200 empty SSE stream on small payload (<800KB) returns HTTP 502', async (t) => {
  const guarded = await installGuard(t, async () => sseResponse(emptyStream()));
  const res = await guarded(CHAT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: streamBody() });
  assert.equal(res.status, 502);
  const payload = await res.json();
  assert.ok(payload.error && payload.error.message.length > 0);
});

test('SSE stream with only comment lines (no data:) is treated as empty', async (t) => {
  const guarded = await installGuard(t, async () =>
    sseResponse(new ReadableStream({
      start(controller) { controller.enqueue(enc.encode(': ping\n\n')); controller.close(); },
    })));
  const res = await guarded(CHAT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: streamBody() });
  assert.equal(res.status, 502);
});

test('HTTP 200 non-SSE bodies convert to 413/502 instead of 200', async (t) => {
  const legacyError = new Response('error', { status: 200, headers: { 'content-type': 'text/plain' } });
  const guardedLegacy = await installGuard(t, async () => legacyError);
  const resLegacy = await guardedLegacy(CHAT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: streamBody() });
  assert.equal(resLegacy.status, 502);

  const overflowJson = new Response(JSON.stringify({ error: { code: 'context_length_exceeded', message: 'too long' } }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
  const guardedJson = await installGuard(t, async () => overflowJson);
  const resJson = await guardedJson(CHAT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: streamBody() });
  assert.equal(resJson.status, 413);
  assert.equal((await resJson.json()).error.code, 'context_length_exceeded');

  const otherJson = new Response(JSON.stringify({ error: { message: 'service hiccup' } }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
  const guardedOther = await installGuard(t, async () => otherJson);
  const resOther = await guardedOther(CHAT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: streamBody() });
  assert.equal(resOther.status, 502);
});

test('non-200 responses (429/503) pass through untouched', async (t) => {
  for (const status of [429, 503]) {
    const original = new Response('rate limited', { status, headers: { 'content-type': 'text/plain' } });
    const guarded = await installGuard(t, async () => original);
    const res = await guarded(CHAT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: streamBody() });
    assert.equal(res, original, `status ${status} response must be returned unchanged`);
    assert.equal(await res.text(), 'rate limited');
  }
});

test('non-streaming requests and non-chat-completions paths pass through untouched', async (t) => {
  const nonStreaming = new Response(JSON.stringify({ id: 'x' }), { status: 200, headers: { 'content-type': 'application/json' } });
  const guardedNonStreaming = await installGuard(t, async () => nonStreaming);
  const resNonStreaming = await guardedNonStreaming(CHAT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stream: false, messages: [] }) });
  assert.equal(resNonStreaming, nonStreaming);

  const otherPath = new Response('ok', { status: 200 });
  const guardedOther = await installGuard(t, async () => otherPath);
  const resOther = await guardedOther('https://aiapi.mattilsynet.no/v1/responses', { method: 'POST', body: streamBody() });
  assert.equal(resOther, otherPath);
});

test('opencode.json limits and plugin registration satisfy the usable=132000 invariant', () => {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  assert.equal(config.compaction.reserved, 60000);
  assert.ok(config.plugin.includes('./plugins/dramallama-guard.mjs'), 'guard plugin must be registered');

  const thinking = config.provider.dramallama.models.thinking.limit;
  const code = config.provider.dramallama.models.code.limit;
  assert.deepEqual(thinking, { context: 192000, input: 192000, output: 32000 });
  assert.deepEqual(code, { context: 192000, input: 192000, output: 8000 });

  const reserved = config.compaction.reserved;
  const usable = (limit) => (limit.input ? Math.max(0, limit.input - reserved) : Math.max(0, limit.context - limit.output));
  assert.equal(usable(thinking), 132000);
  assert.equal(usable(code), 132000);
});

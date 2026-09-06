import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import plugin from './plugins/searxng.mjs';
import { command, createReadiness, probe, readinessHook } from './search-readiness.mjs';

const valid = () => Response.json({ results: [{ title: 'Ping', url: 'https://example.org' }] });
const container = { Name: 'searxng', ImageName: 'docker.io/searxng/searxng:latest', Id: 'a'.repeat(64),
  State: { Status: 'running' }, NetworkSettings: { Ports: { '8080/tcp': [{ HostIp: '127.0.0.1', HostPort: '19217' }] } } };
function recovery(overrides = {}) {
  const { containers = [container], machineState = 'running', connectionPort = 1234,
    machines, connections, freshPort = 5678, freshConnectionPort = freshPort, failAt, ...dependencies } = overrides;
  const calls = [];
  let probes = 0;
  let started = false;
  const ready = createReadiness({ fetcher: async () => ++probes === 1 ? new Response('bad') : valid(),
    run: async args => {
      calls.push(args);
      if (calls.length === failAt) throw new Error('command failed');
      if (args[0] === 'machine' && args[1] === 'start') { started = true; return ''; }
      if (args[0] === 'machine') return JSON.stringify(machines ?? [{ Name: 'searxng', State: started ? 'running' : machineState,
        SSHConfig: { Port: started ? freshPort : 1234, RemoteUsername: 'core' } }]);
      if (args[0] === 'system') return JSON.stringify(connections ?? [{ Name: 'searxng', URI: `ssh://core@127.0.0.1:${started ? freshConnectionPort : connectionPort}/run/user/502/podman/podman.sock` }]);
      return JSON.stringify(containers);
    }, ...dependencies });
  return { ready, calls };
}

test('functional, invalid, empty and oversized bodies', async () => {
  for (const [response, expected] of [[valid(), 'Functional'], [new Response('bad'), 'Invalid'],
    [Response.json({ results: [] }), 'Empty'], [new Response('x'.repeat(1048577)), 'Oversized']]) {
    assert.equal(await probe('http://localhost/search', new AbortController().signal, async () => response), expected);
  }
});

test('slow body remains within probe deadline', async () => {
  const outcome = await createReadiness({ endpoint: 'http://localhost/search', probeMs: 20,
    fetcher: async (_url, { signal }) => new Response(new ReadableStream({ start(c) {
      signal.addEventListener('abort', () => c.error(new Error('aborted')), { once: true });
    } })) })();
  assert.equal(outcome.status, 'Degraded');
});

test('healthy and empty upstream results never mutate', async () => {
  for (const [fetcher, expected] of [[async () => valid(), 'Ready'], [async () => Response.json({ results: [] }), 'Degraded']]) {
    const { ready, calls } = recovery({ fetcher });
    assert.equal((await ready()).status, expected);
    assert.deepEqual(calls, []);
  }
});

test('owned recovery pins ID and explicit connection; never creates/replaces', async () => {
  const { ready, calls } = recovery();
  assert.equal((await ready()).status, 'Recovered');
  assert.deepEqual(calls.at(-1), ['-c', 'searxng', 'restart', container.Id]);
  assert.ok(!calls.flat().some(x => ['run', 'init', '--replace', 'rm'].includes(x)));
});

test('missing, wrong-owned and failed inspection block mutation', async () => {
  for (const bad of [[], [{ ...container, Name: 'unrelated' }], [{ ...container, ImageName: 'wrong' }],
    [{ ...container, NetworkSettings: { Ports: {} } }]]) {
    const { ready, calls } = recovery({ containers: bad });
    assert.equal((await ready()).status, 'Blocked');
    assert.ok(!calls.flat().some(x => ['start', 'restart'].includes(x)));
  }
  assert.equal((await recovery({ run: async () => { throw new Error('private error'); } }).ready()).status, 'Blocked');
});

test('wrong connection and unknown machine state never mutate', async () => {
  for (const config of [{ connectionPort: 9999 }, { machineState: 'unknown' }]) {
    const { ready, calls } = recovery(config);
    assert.equal((await ready()).status, 'Blocked');
    assert.ok(!calls.flat().some(x => ['start', 'restart'].includes(x)));
  }
});

test('stopped machine starts once; stopped container starts rather than restarts', async () => {
  const { ready, calls } = recovery({ machineState: 'stopped', containers: [{ ...container, State: { Status: 'exited' } }] });
  assert.equal((await ready()).status, 'Recovered');
  assert.deepEqual(calls.filter(x => x.includes('start')), [['machine', 'start', 'searxng'], ['-c', 'searxng', 'start', container.Id]]);
  assert.ok(!calls.flat().includes('restart'));
});

test('overrides never mutate and unsafe override blocks without fetch', async () => {
  for (const endpoint of ['https://example.org/search', 'http://example.org/search', 'http://[::1]/search',
    'https://192.168.1.1/search', 'ftp://localhost/search', 'http://user:secret@localhost/search', 'not a URL']) {
    let fetched = false;
    const { ready, calls } = recovery({ endpoint, fetcher: async () => { fetched = true; return valid(); } });
    assert.equal((await ready()).status, 'Blocked', endpoint);
    assert.equal(fetched, false);
    assert.deepEqual(calls, []);
  }
  for (const endpoint of ['http://localhost:19217/search', 'https://127.0.0.1/search']) {
    const { ready, calls } = recovery({ endpoint });
    assert.equal((await ready()).reason, 'OverrideProbeOnly');
    assert.deepEqual(calls, []);
    assert.equal((await recovery({ endpoint, fetcher: async () => valid() }).ready()).status, 'Ready');
  }
});

test('machine start requires fresh machine and connection before container inspection', async () => {
  const { ready, calls } = recovery({ machineState: 'stopped' });
  assert.equal((await ready()).status, 'Recovered');
  assert.deepEqual(calls.slice(2, 6), [['machine', 'start', 'searxng'], ['machine', 'inspect', 'searxng'],
    ['system', 'connection', 'list', '--format', 'json'], ['-c', 'searxng', 'inspect', 'searxng']]);
  for (const options of [{ freshConnectionPort: 1234 }, { failAt: 4 }, { failAt: 5 }]) {
    const bad = recovery({ machineState: 'stopped', ...options });
    assert.equal((await bad.ready()).status, 'Blocked');
    assert.ok(!bad.calls.some(args => args[0] === '-c'));
  }
});

test('cancellation cancels a stalled body even when the body ignores fetch signal', { timeout: 500 }, async () => {
  let cancelled = false;
  const controller = new AbortController();
  const pending = probe('http://localhost/search', controller.signal, async () => new Response(new ReadableStream({
    cancel() { cancelled = true; }
  })));
  setTimeout(() => controller.abort(), 10);
  assert.equal(await pending, 'Timeout');
  assert.equal(cancelled, true);
});

test('command timeout blocks subsequent recovery; concurrent invocation is Busy', async () => {
  const { ready, calls } = recovery({ totalMs: 20, run: async (_args, signal) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')), { once: true });
  }) });
  const first = ready();
  assert.deepEqual(await ready(), { status: 'Degraded', reason: 'Busy' });
  assert.equal((await first).reason, 'CommandTimeout');
  assert.equal((await ready()).reason, 'PriorCommandTimeout');
  assert.deepEqual(calls, []);
});

test('two assignments produce two reports; resolved agent controls routing', async () => {
  let count = 0;
  const hook = readinessHook(async () => { count++; return { status: 'Ready', reason: 'Functional' }; });
  for (const agent of ['moltke', 'hopper', 'moltke']) {
    const output = { message: { agent, id: 'msg_1', sessionID: 'ses_1' }, parts: [] };
    await hook({ agent: 'hopper' }, output);
    assert.equal(output.parts.length, agent === 'moltke' ? 1 : 0);
  }
  assert.equal(count, 2);
});

test('Moltke assignments have a message readiness hook, not a model-turn hook', async () => {
  const hooks = await plugin({});
  assert.equal(typeof hooks['chat.message'], 'function');
  assert.equal(hooks['chat.params'], undefined);
});

function childCommand(source, args = ['machine', 'inspect', 'searxng'], signal = new AbortController().signal) {
  return command(args, signal, (file, actualArgs, options, callback) => {
    assert.equal(file, 'podman');
    assert.deepEqual(actualArgs, args);
    return execFile(process.execPath, ['-e', source], options, callback);
  });
}

test('command wrapper integrates success, nonzero error and stdout/stderr byte bounds', async () => {
  assert.equal(await childCommand('process.stdout.write("ok")'), 'ok');
  await assert.rejects(childCommand('process.exit(7)'), error => error.code === 7);
  for (const stream of ['stdout', 'stderr']) {
    await childCommand(`process.${stream}.write(Buffer.alloc(32768))`);
    await assert.rejects(childCommand(`process.${stream}.write(Buffer.alloc(32769))`),
      error => error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
  }
  assert.equal((await childCommand('process.stdout.write(Buffer.alloc(32768)); process.stderr.write(Buffer.alloc(32768))')).length, 32768);
});

test('actual child timeout latches uncertainty and permits no following command', { timeout: 2000 }, async () => {
  let calls = 0;
  const ready = createReadiness({ totalMs: 60, fetcher: async () => new Response('bad'), run: async (args, signal) => {
    calls++;
    return childCommand('setInterval(() => {}, 1000)', args, signal);
  } });
  assert.equal((await ready()).reason, 'CommandTimeout');
  assert.equal((await ready()).reason, 'PriorCommandTimeout');
  assert.equal(calls, 1);
});

test('actual output overflow stops recovery and latches uncertainty', async () => {
  let calls = 0;
  const ready = createReadiness({ fetcher: async () => new Response('bad'), run: async (args, signal) => {
    calls++;
    return childCommand('process.stdout.write(Buffer.alloc(32769))', args, signal);
  } });
  assert.equal((await ready()).status, 'Blocked');
  assert.equal((await ready()).status, 'Blocked');
  assert.equal(calls, 1);
});

test('total deadline cancels body and prevents any recovery command', { timeout: 500 }, async () => {
  let cancelled = false;
  let calls = 0;
  const outcome = await createReadiness({ totalMs: 20, probeMs: 200,
    fetcher: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })),
    run: async () => { calls++; return '[]'; } })();
  assert.deepEqual(outcome, { status: 'Blocked', reason: 'Deadline' });
  assert.equal(cancelled, true);
  assert.equal(calls, 0);
});

test('probe deadline is independent of the total deadline', { timeout: 500 }, async () => {
  let cancelled = false;
  const start = performance.now();
  const outcome = await createReadiness({ endpoint: 'http://localhost/search', totalMs: 300, probeMs: 10,
    fetcher: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })) })();
  assert.equal(outcome.reason, 'OverrideProbeOnly');
  assert.equal(cancelled, true);
  assert.ok(performance.now() - start < 200);
});

test('missing and ambiguous machine/connection and every inspection failure block mutations', async () => {
  const conn = { Name: 'searxng', URI: 'ssh://core@127.0.0.1:1234/run/user/502/podman/podman.sock' };
  for (const options of [{ machines: [] }, { machines: [{ Name: 'wrong' }] }, { machines: [{ Name: 'searxng' }, { Name: 'searxng' }] }, { connections: [] },
    { connections: [conn, conn] }, { connections: [{ ...conn, URI: conn.URI.replace('127.0.0.1', 'example.org') }] },
    { failAt: 1 }, { failAt: 2 }, { failAt: 3 }]) {
    const { ready, calls } = recovery(options);
    assert.equal((await ready()).status, 'Blocked');
    assert.ok(!calls.flat().some(x => ['start', 'restart'].includes(x)));
  }
});

test('real HTTP body stall is cancelled, and redirect is not followed', { timeout: 2000 }, async () => {
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    if (req.url.startsWith('/redirect')) {
      res.writeHead(302, { Location: '/stall' });
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal(await probe(`${url}/redirect`, AbortSignal.timeout(500)), 'Invalid');
    assert.equal(requests, 1);
    assert.equal(await probe(`${url}/stall`, AbortSignal.timeout(50)), 'Timeout');
    assert.equal(requests, 2);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('machine remains stopped after start: no container action', async () => {
  const { ready, calls } = recovery({ machines: [{ Name: 'searxng', State: 'stopped', SSHConfig: { Port: 1234, RemoteUsername: 'core' } }],
    freshConnectionPort: 1234 });
  assert.equal((await ready()).status, 'Blocked');
  assert.ok(!calls.some(args => args[0] === '-c'));
});

test('wrong loopback port, host, extra mappings and invalid ID block container mutation', async () => {
  for (const c of [{ ...container, Id: 'name-not-id' }, ...[
    { '8080/tcp': [{ HostIp: '0.0.0.0', HostPort: '19217' }] },
    { '8080/tcp': [{ HostIp: '127.0.0.1', HostPort: '1234' }] },
    { ...container.NetworkSettings.Ports, '9090/tcp': [] }
  ].map(Ports => ({ ...container, NetworkSettings: { Ports } }))]) {
    const { ready, calls } = recovery({ containers: [c] });
    assert.equal((await ready()).status, 'Blocked');
    assert.ok(!calls.flat().some(x => ['start', 'restart'].includes(x)));
  }
});

test('at-limit payload is accepted; overflow cancels stream', { timeout: 500 }, async () => {
  const json = JSON.stringify({ results: [{ title: 'Ping', url: 'https://example.org' }] });
  assert.equal(await probe('http://localhost/search', new AbortController().signal,
    async () => new Response(json.padEnd(1048576))), 'Functional');
  let cancelled = false;
  assert.equal(await probe('http://localhost/search', new AbortController().signal, async () => new Response(new ReadableStream({
    start(c) { c.enqueue(new Uint8Array(1048577)); }, cancel() { cancelled = true; }
  }))), 'Oversized');
  assert.equal(cancelled, true);
});

test('HTTP errors, malformed result shapes and nonfunctional results never imply Ready', async () => {
  for (const response of [new Response('', { status: 503 }), Response.json({}), Response.json(null),
    Response.json({ results: 'wrong' }), Response.json({ results: [{ title: 'x', url: 'file:///x' }] }),
    Response.json({ results: [{ title: '', url: 'https://example.org' }] })]) {
    const outcome = await createReadiness({ endpoint: 'http://localhost/search', fetcher: async () => response })();
    assert.equal(outcome.status, 'Degraded');
  }
});

test('hook reports every outcome without changing message identity or existing parts', async () => {
  for (const status of ['Ready', 'Recovered', 'Degraded', 'Blocked']) {
    const original = { type: 'text', text: 'assignment' };
    const output = { message: { agent: 'moltke', id: 'msg_1', sessionID: 'ses_1' }, parts: [original] };
    await readinessHook(async () => ({ status, reason: 'Test' }))({}, output);
    assert.equal(output.parts[0], original);
    assert.equal(output.parts[1].messageID, 'msg_1');
    assert.equal(output.parts[1].sessionID, 'ses_1');
    assert.equal(output.parts[1].synthetic, true);
    assert.match(output.parts[1].text, new RegExp(`SearchReadiness: ${status}`));
    assert.ok(output.parts[1].text.length < 200);
  }
});

test('unsuccessful HTTP response cancels its unused body', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 503 });
  assert.equal(await probe('http://localhost/search', new AbortController().signal, async () => response), 'Unavailable');
  assert.equal(cancelled, true);
});

test('review regression: valid result 21 is invisible to consumer and cannot make Ready', async () => {
  const results = [...Array.from({ length: 20 }, () => ({ title: 'bad', url: 'not-a-url' })),
    { title: 'Ping', url: 'https://example.org' }];
  const outcome = await createReadiness({ endpoint: 'http://localhost/search',
    fetcher: async () => Response.json({ results }) })();
  assert.deepEqual(outcome, { status: 'Degraded', reason: 'OverrideProbeOnly' });
});

test('review regression: HTML-only title is not Functional after consumer normalization', async () => {
  const outcome = await probe('http://localhost/search', new AbortController().signal,
    async () => Response.json({ results: [{ title: '<b></b>  <br>', url: 'https://example.org' }] }));
  assert.equal(outcome, 'Invalid');
});

test('consumer boundary: useful normalized title at result 20 remains Functional', async () => {
  const results = [...Array.from({ length: 19 }, () => ({ title: 'bad', url: 'not-a-url' })),
    { title: '<b>Ping</b>', url: 'https://example.org' }];
  assert.equal(await probe('http://localhost/search', new AbortController().signal,
    async () => Response.json({ results })), 'Functional');
});

test('review regression: total deadline in initial override probe is Blocked Deadline', { timeout: 1000 }, async () => {
  let cancelled = false;
  const { ready, calls } = recovery({ endpoint: 'http://localhost/search', totalMs: 20, probeMs: 200,
    fetcher: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })) });
  assert.deepEqual(await ready(), { status: 'Blocked', reason: 'Deadline' });
  assert.equal(cancelled, true);
  assert.deepEqual(calls, []);
});

test('review regression: total deadline in recovery retest is Blocked Deadline', { timeout: 1000 }, async () => {
  let probes = 0;
  let cancelled = false;
  const { ready, calls } = recovery({ totalMs: 50, probeMs: 300,
    fetcher: async () => ++probes === 1 ? new Response('bad') :
      new Response(new ReadableStream({ cancel() { cancelled = true; } })) });
  assert.deepEqual(await ready(), { status: 'Blocked', reason: 'Deadline' });
  assert.equal(probes, 2);
  assert.equal(cancelled, true);
  assert.deepEqual(calls.filter(args => args.includes('restart')), [['-c', 'searxng', 'restart', container.Id]]);
});

test('probe-only timeout in recovery retest remains Degraded RetestFailed', { timeout: 1000 }, async () => {
  let probes = 0;
  const { ready } = recovery({ totalMs: 500, probeMs: 20,
    fetcher: async () => ++probes === 1 ? new Response('bad') : new Response(new ReadableStream()) });
  assert.deepEqual(await ready(), { status: 'Degraded', reason: 'RetestFailed' });
  assert.equal(probes, 2);
});

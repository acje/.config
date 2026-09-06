import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const DEFAULT = 'http://localhost:19217/search';
const result = (status, reason) => ({ status, reason });

export function command(args, signal, executeFile = execFile) {
  return new Promise((resolve, reject) => {
    executeFile('podman', args, { signal, maxBuffer: 32768, encoding: 'buffer', killSignal: 'SIGKILL' }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout.toString('utf8'));
    });
  });
}

export async function probe(endpoint, signal, fetcher = fetch) {
  let reader;
  let abort;
  const aborted = new Promise((_, reject) => {
    abort = () => {
      reject(new DOMException('aborted', 'AbortError'));
      if (reader) void reader.cancel().catch(() => {});
    };
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    signal.throwIfAborted();
    const url = new URL(endpoint);
    url.searchParams.set('q', 'ping');
    url.searchParams.set('format', 'json');
    const response = await Promise.race([fetcher(url, { signal, redirect: 'error' }), aborted]);
    if (!response.body) return 'Unavailable';
    reader = response.body.getReader();
    if (!response.ok) return 'Unavailable';
    const chunks = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1048576) return 'Oversized';
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'));
    signal.throwIfAborted();
    if (!Array.isArray(body.results)) return 'Invalid';
    if (body.results.length === 0) return 'Empty';
    return body.results.slice(0, 20).some(r => {
      try {
        return typeof r.title === 'string' && r.title.replace(/<[^>]*>/g, '').trim() &&
          ['http:', 'https:'].includes(new URL(r.url).protocol);
      } catch { return false; }
    }) ? 'Functional' : 'Invalid';
  } catch {
    return signal.aborted ? 'Timeout' : 'Invalid';
  } finally {
    signal.removeEventListener('abort', abort);
    if (reader) void reader.cancel().catch(() => {});
  }
}

export function createReadiness({ endpoint = process.env.SEARXNG_ENDPOINT, run = command, fetcher = fetch,
  totalMs = 60000, probeMs = 5000 } = {}) {
  let busy = false;
  let uncertain = false;
  return async () => {
    if (busy) return result('Degraded', 'Busy');
    if (uncertain) return result('Blocked', 'PriorCommandTimeout');
    let url;
    try {
      url = new URL(endpoint || DEFAULT);
      if (url.username || url.password || !['http:', 'https:'].includes(url.protocol) ||
          !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error();
    } catch { return result('Blocked', 'UnsafeEndpoint'); }
    busy = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(totalMs, 60000));
    const signal = controller.signal;
    const check = () => probe(url, AbortSignal.any([signal, AbortSignal.timeout(Math.min(probeMs, 5000))]), fetcher);
    const execute = async args => {
      signal.throwIfAborted();
      try { return await run(args, signal); }
      catch (error) {
        if (signal.aborted || error?.name === 'AbortError' || error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') uncertain = true;
        throw error;
      }
    };
    const inspect = async args => JSON.parse(await execute(args));
    try {
      const initial = await check();
      signal.throwIfAborted();
      if (initial === 'Functional') return result('Ready', 'Functional');
      if (initial === 'Empty') return result('Degraded', 'UpstreamEmpty');
      if (endpoint) return result('Degraded', 'OverrideProbeOnly');
      const ownedMachine = async () => {
        const machines = await inspect(['machine', 'inspect', 'searxng']);
        const connections = await inspect(['system', 'connection', 'list', '--format', 'json']);
        if (!Array.isArray(machines) || machines.length !== 1 || machines[0].Name !== 'searxng') throw new Error();
        const machine = machines[0];
        const matches = connections.filter(c => c.Name === 'searxng');
        if (matches.length !== 1) throw new Error();
        const connection = new URL(matches[0].URI);
        if (connection.protocol !== 'ssh:' || connection.hostname !== '127.0.0.1' ||
            connection.port !== String(machine.SSHConfig?.Port) ||
            connection.username !== machine.SSHConfig?.RemoteUsername || connection.password || connection.search || connection.hash ||
            !/^\/run\/user\/\d+\/podman\/podman.sock$/.test(connection.pathname)) throw new Error();
        if (!['running', 'stopped'].includes(machine.State)) throw new Error();
        return machine;
      };
      const machine = await ownedMachine();
      if (machine.State === 'stopped') {
        await execute(['machine', 'start', 'searxng']);
        if ((await ownedMachine()).State !== 'running') return result('Blocked', 'MachineState');
      }
      const containers = await inspect(['-c', 'searxng', 'inspect', 'searxng']);
      if (containers.length !== 1) return result('Blocked', 'ContainerIdentity');
      const c = containers[0];
      const ports = c.NetworkSettings?.Ports;
      const bindings = ports?.['8080/tcp'];
      if (c.Name !== 'searxng' || c.ImageName !== 'docker.io/searxng/searxng:latest' ||
          !/^[a-f0-9]{64}$/.test(c.Id) || Object.keys(ports || {}).length !== 1 ||
          bindings?.length !== 1 || bindings[0].HostIp !== '127.0.0.1' || bindings[0].HostPort !== '19217') {
        return result('Blocked', 'ContainerIdentity');
      }
      if (!['running', 'exited', 'created'].includes(c.State?.Status)) return result('Blocked', 'ContainerState');
      await execute(['-c', 'searxng', c.State.Status === 'running' ? 'restart' : 'start', c.Id]);
      const final = await check();
      signal.throwIfAborted();
      return final === 'Functional' ? result('Recovered', 'Functional') : result('Degraded', 'RetestFailed');
    } catch {
      return result('Blocked', uncertain ? 'CommandTimeout' : signal.aborted ? 'Deadline' : 'InspectionOrCommandFailed');
    } finally {
      clearTimeout(timer);
      busy = false;
    }
  };
}

export function readinessHook(ready = createReadiness()) {
  return async (_input, output) => {
    if (output.message.agent !== 'moltke') return;
    const outcome = await ready();
    output.parts.push({ type: 'text', id: `prt_${randomUUID().replaceAll('-', '')}`,
      sessionID: output.message.sessionID, messageID: output.message.id, synthetic: true,
      text: `SearchReadiness: ${outcome.status} (${outcome.reason}). Readiness only; research belongs to Copernicus/Feynman.` });
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function configuredPluginPaths() {
  const config = JSON.parse(readFileSync(path.join(here, 'opencode.json'), 'utf8'));
  return (config.plugin ?? []).map((entry) => path.resolve(here, entry));
}

function pluginFactories(module) {
  return Object.values(module).filter((value) => typeof value === 'function');
}

function pluginInput(directory) {
  return { directory, worktree: directory, project: { id: 'test', worktree: directory }, client: {}, $: () => {} };
}

const ORIGINAL_COMMAND = 'git status --short';

function overrideTraceDir(value) {
  const restore = Object.hasOwn(process.env, 'OPENCODE_TRACE_DIR')
    ? (previous) => () => {
        process.env.OPENCODE_TRACE_DIR = previous;
      }
    : () => () => {
        delete process.env.OPENCODE_TRACE_DIR;
      };
  const undo = restore(process.env.OPENCODE_TRACE_DIR);
  process.env.OPENCODE_TRACE_DIR = value;
  return undo;
}

test('no configured plugin mutates bash tool arguments', async (t) => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'plugin-command-preservation-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  mkdirSync(path.join(scratch, 'graphify-out'), { recursive: true });
  writeFileSync(path.join(scratch, 'graphify-out', 'graph.json'), '{"nodes":[],"edges":[]}');
  t.after(overrideTraceDir(path.join(scratch, 'traces')));

  const paths = configuredPluginPaths();
  assert.ok(paths.length > 0, 'expected opencode.json to configure at least one plugin');

  for (const pluginPath of paths) {
    const module = await import(pathToFileURL(pluginPath).href);
    for (const factory of pluginFactories(module)) {
      const hooks = await factory(pluginInput(scratch));
      const before = hooks?.['tool.execute.before'];
      if (typeof before !== 'function') continue;

      for (const attempt of [1, 2]) {
        const output = { args: { command: ORIGINAL_COMMAND, description: 'probe' } };
        await before({ tool: 'bash', sessionID: 'ses_test', callID: `call_${attempt}` }, output);
        assert.equal(
          output.args.command,
          ORIGINAL_COMMAND,
          `${path.basename(pluginPath)} mutated bash command on attempt ${attempt}`,
        );
      }
    }
  }
});

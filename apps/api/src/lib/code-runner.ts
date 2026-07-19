import { spawn } from 'node:child_process';

/**
 * Runs a user's transpiled Code-step JS in a throwaway child process instead of `node:vm`.
 * `vm` shares the host V8 realm with the caller, so a constructor-chain escape
 * (`params.constructor.constructor('return process.env')()`) reaches the API process's own
 * globals and secrets. A child process has its own V8 isolate and, with its env stripped down to
 * just PATH, nothing sensitive to escape to — the same isolation gained by a `spawn` + IPC +
 * stripped-env + hard-timeout pattern.
 * Duplicated in `apps/worker/src/lib/code-runner.ts`: this is a Node-only helper and can't live in
 * `@saasly/shared`, which is also bundled into the browser build.
 */

const CHILD_TIMEOUT_MS = 2000;

const CHILD_BOOTSTRAP = `
process.on('message', (msg) => {
  const { jsCode, params, context } = msg;
  const finish = (payload) => { try { process.send(payload); } finally { process.exit(0); } };
  try {
    const moduleObj = { exports: {} };
    const fn = new Function('module', 'exports', 'params', 'context', jsCode);
    fn(moduleObj, moduleObj.exports, params, context);
    const main = moduleObj.exports.main;
    if (typeof main !== 'function') return finish({ error: 'Code must \`export const main = ...\`' });
    Promise.resolve(main(params))
      .then((out) => finish({ result: out === undefined ? null : JSON.parse(JSON.stringify(out)) }))
      .catch((err) => finish({ error: err instanceof Error ? err.message : String(err) }));
  } catch (err) {
    finish({ error: err instanceof Error ? err.message : String(err) });
  }
});
`;

export interface CodeRunResult {
  result?: unknown;
  error?: string;
}

export function runCodeInChildProcess(
  jsCode: string,
  params: Record<string, unknown>,
  context: Record<string, unknown>,
): Promise<CodeRunResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', CHILD_BOOTSTRAP], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: { PATH: process.env.PATH ?? '' },
    });

    let settled = false;
    const finish = (value: CodeRunResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeAllListeners();
      child.kill('SIGKILL');
      resolve(value);
    };
    const timer = setTimeout(() => finish({ error: 'Code execution timed out' }), CHILD_TIMEOUT_MS);

    child.once('message', (msg) => finish(msg as CodeRunResult));
    child.once('error', (err) => finish({ error: err.message }));
    child.once('exit', (code) => {
      if (!settled) finish({ error: `Code process exited unexpectedly (code ${code})` });
    });

    child.send({ jsCode, params, context });
  });
}

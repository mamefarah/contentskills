// A headless Chrome page showing a project's rough draft, driven over the DevTools protocol.
// Used by the combiner (every frame) and the stills tool (one frame per candidate).
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {start} from '../dashboard/serve.mjs';
import {browserBinary} from './tools.mjs';

/** Delete Chrome's temporary profile. A file still being written (ENOTEMPTY, EBUSY) is retried briefly; a profile that
 *  stays behind is only a temp folder, so it is reported and never fails the render that already finished. */
function removeProfile(profile) {
  for (let attempt = 1; ; attempt++) {
    try { rmSync(profile, {recursive: true, force: true}); return; }
    catch (error) {
      if (attempt >= 10 || !['ENOTEMPTY', 'EBUSY', 'EPERM'].includes(error.code)) { console.warn(`Could not remove Chrome profile ${profile}: ${error.message}`); return; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);      // synchronous 100 ms pause before retrying
    }
  }
}

/**
 * @returns {evaluate(js), screenshot() -> Buffer (JPEG, or PNG with alpha when `transparent`), close()}
 * The page is the draft player in render mode: window.draft.seek(t) and window.draft.view(shot, n).
 */
export async function openDraft(project, {width, height, scale = 1, cut = 'all', transparent = false}) {
  const {server, port} = await start(0);
  const profile = mkdtempSync(join(tmpdir(), 'faceless-chrome-'));
  // Own process group (POSIX), so closing can stop Chrome's helper processes too, not only the main process.
  const posix = process.platform !== 'win32';
  const chrome = spawn(browserBinary(), ['--headless', '--remote-debugging-port=0', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', `--user-data-dir=${profile}`, 'about:blank'], {stdio: ['ignore', 'ignore', 'pipe'], detached: posix});
  const close = async () => {
    server.close(); server.closeAllConnections?.();      // do not wait for the browser's idle connections to time out
    const exited = new Promise(r => chrome.exitCode !== null || chrome.signalCode !== null ? r() : chrome.once('exit', r));
    try { posix ? process.kill(-chrome.pid, 'SIGKILL') : chrome.kill(); } catch {}      // the whole group; ESRCH if it already exited
    await exited;
    removeProfile(profile);
  };
  try {
    const wsUrl = await new Promise((ok, bad) => {
      let log = '';
      chrome.stderr.on('data', chunk => { log += chunk; const m = /DevTools listening on (ws:\/\/\S+)/.exec(log); if (m) ok(m[1]); });
      chrome.on('exit', () => bad(Error('Chrome exited before it was ready:\n' + log)));
      setTimeout(() => bad(Error('Chrome did not start within 20s')), 20000);
    });
    const socket = new WebSocket(wsUrl), pending = new Map();
    let nextId = 0;
    await new Promise((ok, bad) => { socket.onopen = ok; socket.onerror = () => bad(Error('Could not connect to Chrome')); });
    const errors = [];      // uncaught errors on the page, reported if it never gets ready
    socket.onmessage = event => {
      const message = JSON.parse(event.data), waiter = pending.get(message.id);
      if (message.method === 'Runtime.exceptionThrown') { const d = message.params.exceptionDetails; errors.push(d.exception?.description ?? d.text); }
      if (!waiter) return;
      pending.delete(message.id);
      message.error ? waiter.bad(Error(message.error.message)) : waiter.ok(message.result);
    };
    const send = (method, params = {}, sessionId) => new Promise((ok, bad) => { const id = ++nextId; pending.set(id, {ok, bad}); socket.send(JSON.stringify({id, method, params, sessionId})); });
    const {targetId} = await send('Target.createTarget', {url: 'about:blank'});
    const {sessionId} = await send('Target.attachToTarget', {targetId, flatten: true});
    const page = (method, params) => send(method, params, sessionId);
    const evaluate = async expression => {
      const {result, exceptionDetails} = await page('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
      if (exceptionDetails) throw Error(exceptionDetails.exception?.description || exceptionDetails.text);
      return result.value;
    };
    await page('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: scale, mobile: false});
    if (transparent) await page('Emulation.setDefaultBackgroundColorOverride', {color: {r: 0, g: 0, b: 0, a: 0}});
    await page('Runtime.enable');
    await page('Page.navigate', {url: `http://127.0.0.1:${port}/pipeline/draft/?project=${project}&render=1&cut=${cut}`});
    for (let tries = 0; !(await evaluate('window.__ready === true')); tries++) {
      if (errors.length) throw Error(`The draft failed to load: ${errors[0]}`);
      if (tries > 150) throw Error('The draft did not finish loading within 30s.');
      await new Promise(r => setTimeout(r, 200));
    }
    const screenshot = async () => Buffer.from((await page('Page.captureScreenshot', transparent ? {format: 'png'} : {format: 'jpeg', quality: 92})).data, 'base64');
    return {evaluate, screenshot, close: async () => { socket.close(); await close(); }};
  } catch (error) { await close(); throw error; }
}

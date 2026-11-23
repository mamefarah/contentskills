// One render of a project at a time.
//
// `make` and `combine` write shared scratch files under projects/<name>/out (.occupancy/, passes, the sound plan, cut.mp4);
// two runs on the same project at once overwrite each other's files and fail with errors like
// "ENOENT … out/.occupancy/00022.png". So every run takes projects/<name>/out/.make.lock first:
//   - free: take it (created atomically, so two runs starting together cannot both win);
//   - held by a live process: wait for it, saying who holds it (or stop at once with --no-wait);
//   - held by a process that no longer exists (a crash, a killed terminal): take it over.
// The lock is removed when the run exits, however it exits.
import {mkdirSync, openSync, writeSync, closeSync, readFileSync, unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {root} from './check.mjs';

const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const holder = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

/** True while a live run holds the project's render lock (a lock left by a crashed run does not count). */
export function renderBusy(project) {
  const h = holder(join(root, 'projects', project, 'out', '.make.lock'));
  return !!h && alive(h.pid);
}

/** Take the project's render lock, waiting for another run to finish. Resolves once held; released on exit. */
export async function lockProject(project, {wait = !process.argv.includes('--no-wait'), timeoutMinutes = 45} = {}) {
  const out = join(root, 'projects', project, 'out'), file = join(out, '.make.lock');
  mkdirSync(out, {recursive: true});
  const me = {pid: process.pid, command: process.argv.slice(2).join(' '), started: new Date().toISOString()};
  const deadline = Date.now() + timeoutMinutes * 60e3;
  let told = false;
  for (;;) {
    try {
      const fd = openSync(file, 'wx'); writeSync(fd, JSON.stringify(me) + '\n'); closeSync(fd);
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const h = holder(file);
    if (!h || !alive(h.pid) || h.pid === process.pid) {          // stale (or half-written by a run that died at once): take it over
      if (h?.pid !== process.pid) console.log(`Taking over a stale render lock on ${project}${h ? ` (pid ${h.pid}, no longer running)` : ''}.`);
      try { unlinkSync(file); } catch {}
      continue;
    }
    const who = `another render of ${project} is running (pid ${h.pid}: ${h.command || 'make'}, started ${h.started})`;
    if (!wait) throw Error(`Stopped: ${who}. Wait for it to finish, or stop it, then run this again.`);
    if (Date.now() > deadline) throw Error(`Stopped after waiting ${timeoutMinutes} min: ${who}.`);
    if (!told) { console.log(`Waiting: ${who}. Two renders of one project at once break each other's files. (--no-wait stops instead.)`); told = true; }
    await sleep(2000);
  }
  const release = () => { if (holder(file)?.pid === process.pid) try { unlinkSync(file); } catch {} };
  process.on('exit', () => release());
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(sig, () => { release(); process.exit(130); });
  return release;
}

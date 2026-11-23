// Segments: working on one section of a footage video at a time, several at once, with undo.
//
//   - Which storyboard entries belong to a section: an entry of a timed track (zooms, effects, overlays, sounds, layouts,
//     captionTrack, transitions …) belongs to the section its start ("start", else "at") falls in. The "sections" list
//     itself and settings (theme, captions, style, music …) belong to no section.
//   - Job status, one small file per section being worked on: projects/<name>/out/jobs/<section>.json
//     {section, state, marks, started, updated, step?, error?, pid?}. States: queued (waiting its turn), editing (Claude is
//     changing the storyboard), rendering (drawing its frames), assembling (splicing it into out/cut.mp4), done, failed.
//     The review page and the dashboard show them. A finished job's file stays a short while so the page can show "done".
//   - History, for undo: projects/<name>/out/history/<id>/ holds the video as it was before a section was changed
//     (cut.mp4, a hard link: no copy), the record of what it was made from (manifest.json, which includes the storyboard),
//     and entry.json {id, section, start, end, label, made}. The last HISTORY entries are kept.
import {existsSync, linkSync, copyFileSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './tools.mjs';

const HISTORY = 12;
const out = project => join(root, 'projects', project, 'out');
const read = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const writeJson = (file, data) => { const tmp = `${file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(data, null, 1) + '\n'); renameSync(tmp, file); };

// ---------- which entries belong to a section ----------
const SETTINGS = new Set(['sections']);
const timeOf = item => item && typeof item === 'object' ? (typeof item.start === 'number' ? item.start : typeof item.at === 'number' ? item.at : null) : null;
const timedTracks = storyboard => Object.keys(storyboard).filter(k => !SETTINGS.has(k) && Array.isArray(storyboard[k]) && storyboard[k].some(i => timeOf(i) !== null));
const inside = (item, range) => { const t = timeOf(item); return t !== null && t >= range.start - 1e-6 && t < range.end - 1e-6; };

/** The storyboard with every entry of `range` taken from `source` instead (the rest stays as in `current`). Order is kept: the
 *  source's entries go where the current ones of that range were. */
export function withRangeFrom(current, source, range) {
  const next = structuredClone(current);
  for (const track of new Set([...timedTracks(current), ...timedTracks(source)])) {
    const mine = Array.isArray(current[track]) ? current[track] : [], theirs = (Array.isArray(source[track]) ? source[track] : []).filter(i => inside(i, range));
    const at = mine.findIndex(i => inside(i, range)), kept = mine.filter(i => !inside(i, range));
    const where = at < 0 ? kept.findIndex(i => (timeOf(i) ?? -1) >= range.start) : mine.slice(0, at).filter(i => !inside(i, range)).length;
    const list = [...kept]; list.splice(where < 0 ? list.length : where, 0, ...structuredClone(theirs));
    if (list.length || track in current) next[track] = list;
  }
  return next;
}

// ---------- job status ----------
const jobsDir = project => join(out(project), 'jobs');
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
/** Set (merge into) the status of the job on one section. */
export function setJob(project, section, patch) {
  mkdirSync(jobsDir(project), {recursive: true});
  const file = join(jobsDir(project), `${section}.json`), now = Date.now(), before = read(file) ?? {section, started: now};
  writeJson(file, {...before, ...patch, section, updated: now});
}
/** Every section's job. A job whose process is gone without finishing shows as failed; finished ones are dropped after 10 minutes. */
export function readJobs(project) {
  const dir = jobsDir(project), jobs = {};
  for (const name of existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')) : []) {
    const job = read(join(dir, name)); if (!job?.section) continue;
    const finished = job.state === 'done' || job.state === 'failed';
    if (finished && Date.now() - job.updated > 10 * 60e3) { rmSync(join(dir, name), {force: true}); continue; }
    if (!finished && job.pid && !alive(job.pid)) { job.state = 'failed'; job.error ??= 'The job stopped without finishing.'; }
    jobs[job.section] = job;
  }
  return jobs;
}
export const busy = (project, section) => { const job = readJobs(project)[section]; return Boolean(job && job.state !== 'done' && job.state !== 'failed'); };

// ---------- history ----------
const historyDir = project => join(out(project), 'history');
/** Keep the current cut.mp4 and its manifest as a history entry before a section of it is replaced. Returns the entry or null. */
export function remember(project, {section, start, end, label}) {
  const cut = join(out(project), 'cut.mp4'), manifest = join(out(project), 'cut.manifest.json');
  if (!existsSync(cut) || !existsSync(manifest)) return null;
  const id = `${new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '')}-${section}`, dir = join(historyDir(project), id);
  mkdirSync(dir, {recursive: true});
  try { linkSync(cut, join(dir, 'cut.mp4')); } catch { copyFileSync(cut, join(dir, 'cut.mp4')); }      // the new cut is renamed over cut.mp4, so the link keeps the old file
  copyFileSync(manifest, join(dir, 'manifest.json'));
  const entry = {id, section, start, end, label: label || `changed ${section}`, made: new Date().toISOString()};
  writeJson(join(dir, 'entry.json'), entry);
  const all = history(project);
  for (const old of all.slice(HISTORY)) rmSync(join(historyDir(project), old.id), {recursive: true, force: true});
  return entry;
}
/** History entries, newest first. */
export function history(project) {
  const dir = historyDir(project);
  return (existsSync(dir) ? readdirSync(dir) : []).map(id => read(join(dir, id, 'entry.json'))).filter(Boolean).sort((a, b) => b.id.localeCompare(a.id));
}
export const historyManifest = (project, id) => read(join(historyDir(project), id, 'manifest.json'));
export const readManifest = project => read(join(out(project), 'cut.manifest.json'));
export const writeManifest = (project, manifest) => writeJson(join(out(project), 'cut.manifest.json'), manifest);

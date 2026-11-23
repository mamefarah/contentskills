#!/usr/bin/env node
// Re-make one section of a finished footage video and splice it into out/cut.mp4, leaving the rest of the video exactly
// as it is. Several sections can be patched at once (one run each): drawing runs side by side, and only the splice takes
// the project's render lock, for about half a minute. Every patch can be undone (npm run undo).
//   node pipeline/patch.mjs <project> <section> [--label "what changed"] [--marks m3,m4] [--jobs 4] [--no-cache]
// <section> is a section id (`npm run check <project>` lists them) or a range in seconds (18.2-20.4). It is re-made from
// the storyboard as it is now: change only that section's entries first (pipeline/segments.mjs says which are its).
// Needs a full make of the video at full size first (it writes out/cut.manifest.json, the record a patch splices into).
// The section's progress is shown on the review page and the dashboard (out/jobs/<section>.json).
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root, readStoryboard} from './check.mjs';
import {combineFootage} from './combine.mjs';
import {readManifest, setJob} from './segments.mjs';

const args = process.argv.slice(2), value = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const valued = ['--label', '--marks', '--jobs'], [project, section] = args.filter((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1]));
let jobId = section;
try {
  if (!project || !section) throw Error('Usage: npm run patch <project> <section> [--label "what changed"] [--marks m3,m4]');
  // a trim from the review page moves every time after it: wait for it, then read the storyboard (pipeline/trim.mjs)
  const trimming = join(root, 'projects', project, 'edit', '.trimming'), trimPid = () => { try { const pid = JSON.parse(readFileSync(trimming, 'utf8')).pid; process.kill(pid, 0); return pid; } catch { return null; } };
  for (let told = false; existsSync(trimming) && trimPid();) { if (!told) { console.log('Waiting for a trim of this video to finish…'); told = true; } await new Promise(r => setTimeout(r, 1000)); }
  const storyboard = readStoryboard(project);
  if (!storyboard.footage) throw Error(`${project} is a shot storyboard: patches work on footage videos. Use npm run make ${project}.`);
  if (existsSync(join(root, 'projects', project, 'edit', '.footage-stale'))) throw Error(`${project} was trimmed since the last make: run npm run make ${project} once first.`);
  if (!readManifest(project)) throw Error(`out/cut.mp4 has no record of how it was made yet. Run npm run make ${project} once (full size); after that, sections can be patched.`);
  const marks = (value('--marks') || '').split(',').filter(Boolean);
  const state = s => setJob(project, jobId, {state: s, pid: process.pid, ...(marks.length ? {marks} : {}), ...(value('--label') ? {label: value('--label')} : {})});
  state('rendering');
  console.log('— Check storyboard');
  if (spawnSync(process.execPath, [join(root, 'pipeline', 'check.mjs'), project], {stdio: ['inherit', 'ignore', 'inherit']}).status !== 0) throw Error('Stopped at: Check storyboard');
  const result = await combineFootage(project, storyboard, 1, {patch: {section, label: value('--label'), onState: state}, noCache: args.includes('--no-cache'), jobs: Number(value('--jobs')) || undefined});
  setJob(project, jobId, {state: 'done', pid: null, history: result.history, finished: Date.now()});
  console.log('\nThe rest of the video was not re-made. The quality check of the whole video runs when it is finished (npm run make, or "Finish video").');
} catch (error) {
  console.error(error.message); process.exitCode = 1;
  if (project && jobId) try { setJob(project, jobId, {state: 'failed', pid: null, error: error.message.split('\n')[0]}); } catch {}
}

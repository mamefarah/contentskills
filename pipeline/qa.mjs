#!/usr/bin/env node
// Quality check of a finished video (pipeline/qa.py with the pipeline's own Python).
//   node pipeline/qa.mjs <project> [--json] [--no-sheet]     the finished out/cut.mp4
//   node pipeline/qa.mjs <project> --preview                  placement, caption and text checks before making the video
import {spawnSync} from 'node:child_process';
import {existsSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {root, effectsPython} from './tools.mjs';
import {inspect} from './inspect.mjs';

const check = args => spawnSync(effectsPython(), [join(root, 'pipeline/qa.py'), ...args], {stdio: 'inherit'}).status ?? 1;
/** Checks the finished video; first records what is on screen in every frame (out/layout.json) if the video is newer than that record. Returns 0 = PASS, 1 = FAIL. */
export async function qa(args) {
  const project = args.find(a => !a.startsWith('--')), out = join(root, 'projects', project ?? '', 'out'), video = join(out, 'cut.mp4'), log = join(out, 'layout.json');
  if (project && /^[a-z0-9-]+$/.test(project) && existsSync(video) && (!existsSync(log) || statSync(log).mtimeMs < statSync(video).mtimeMs)) {
    const {fps} = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'json', video], {encoding: 'utf8'}).stdout).streams[0].r_frame_rate.split('/').reduce((a, b) => ({fps: a / b}));
    await inspect(project, {rate: Math.round(fps) || 30, file: 'layout.json'});
  }
  return check(args);
}
/** The preview check: step through the draft (pipeline/inspect.mjs), then check what it recorded. */
export async function preview(project) { console.log('\n— Quality check (preview)'); await inspect(project); return check([project, '--preview']); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { const args = process.argv.slice(2); process.exitCode = args.includes('--preview') ? await preview(args.find(a => !a.startsWith('--'))) : await qa(args); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

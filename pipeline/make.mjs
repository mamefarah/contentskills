#!/usr/bin/env node
// The whole pipeline in one command: check the storyboard, narrate it, combine the video, check the result (npm run qa).
//   node pipeline/make.mjs <project> [--scale 1] [--section <id|start-end>] [--no-cache] [--jobs 4]
// The final video needs the user's approval of the storyboard first (npm run sketch, then npm run approve); a
// --section preview does not. It always produces a video. A shot nobody has reviewed yet shows its first candidate that is
// not rejected, and is listed at the end so it can be reviewed and the video remade.
// A re-make draws only the frames that changed (pipeline/cache.mjs). --section makes one section
// into out/sections/<id>.mp4 for a quick look and leaves out/cut.mp4 alone.
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {root, readStoryboard} from './check.mjs';
import {combine, options} from './combine.mjs';
import {qa} from './qa.mjs';
import {requireApproval} from './approve.mjs';
import {lockProject} from './lock.mjs';

try {
  const {project, ...rest} = options(process.argv.slice(2));
  // a full make writes out/cut.mp4, the video they watch: full size unless --scale is given. Sections stay draft size.
  if (!rest.section && !process.argv.includes('--scale')) rest.scale = 1;
  if (project) await lockProject(project);     // one render of a project at a time (pipeline/lock.mjs)
  const step = (label, script) => {
    console.log(`\n— ${label}`);
    if (spawnSync(process.execPath, [join(root, 'pipeline', script), project], {stdio: rest.section ? ['inherit', 'ignore', 'inherit'] : 'inherit'}).status !== 0) throw Error(`Stopped at: ${label}`);
  };
  // out/make-status.json tells the storyboard page that a full make is running or how it ended, wherever it was started
  // (the page's button or a terminal). qa: 'PASS' | 'FAIL' once the quality check has run.
  if (!rest.section) {
    const out = join(root, 'projects', project, 'out'), file = join(out, 'make-status.json'), state = {running: true, started: Date.now(), pid: process.pid, scale: rest.scale ?? null, qa: null};
    mkdirSync(out, {recursive: true}); writeFileSync(file, JSON.stringify(state) + '\n');
    process.on('exit', code => { try { writeFileSync(file, JSON.stringify({...state, running: false, finished: Date.now(), code: process.exitCode ?? code, qa: state.qa}) + '\n'); } catch {} });
    globalThis.__makeState = state;
  }
  // A trim from the review page (pipeline/trim.mjs) cuts edit/clean.mp4 and out/cut.mp4 at once but leaves footage.mp4
  // for later: prepare it now, before anything reads it.
  const stale = join(root, 'projects', project, 'edit', '.footage-stale');
  if (existsSync(stale)) {
    const P = join(root, 'projects', project), theme = JSON.parse(readFileSync(join(P, 'storyboard.json'), 'utf8')).theme;
    console.log('\n— Prepare the trimmed footage');
    if (spawnSync(process.execPath, [join(root, 'pipeline/footage.mjs'), project, join(P, 'edit/clean.mp4'), join(P, 'edit/words.json'), ...(theme ? ['--theme', theme] : [])], {stdio: 'inherit'}).status !== 0) throw Error('Stopped at: Prepare the trimmed footage');
    rmSync(stale);
  }
  step('Check storyboard', 'check.mjs');
  if (!rest.section) requireApproval(project);      // the user signs off on the storyboard before the final video
  if (!readStoryboard(project).footage) step('Narrate', 'voice.mjs');      // footage brings its own voice
  console.log(`\n— ${rest.section ? 'Section preview' : 'Combine'}`);
  const result = await combine(project, {...rest, all: true});
  if (!rest.section) console.log(result.unreviewed.length
    ? `\nDone, with ${result.unreviewed.length} shot(s) not reviewed yet (showing a first candidate): ${result.unreviewed.join(', ')}.\nReview them (npm run stills ${project}) and run this again.`
    : '\nDone. Every shot uses a reviewed, usable piece.');
  if (!rest.section) {
    console.log('\n— Quality check');
    const failed = await qa([project]) !== 0; if (globalThis.__makeState) globalThis.__makeState.qa = failed ? 'FAIL' : 'PASS';
    if (failed) { console.log(`\nThe quality check FAILED. Apply each fix above to the storyboard and run: npm run make ${project}`); process.exitCode = 1; }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }

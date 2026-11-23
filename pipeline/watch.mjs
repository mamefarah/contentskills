#!/usr/bin/env node
// The user's feedback, delivered to the agent as they give it, so they never have to say "I left notes".
//
// Feedback is whatever they do on the dashboard pages, all of it saved into the project's files:
//   - a review mark (review page: notes on the finished video; storyboard page: notes on a scene)   projects/<name>/review.json
//   - a candidate marked usable / rejected / picked (storyboard page)                                projects/<name>/storyboard.json
//   - the storyboard approved                                                                         projects/<name>/approval.json
// Each piece of feedback is one self-contained line:
//   MARK <project> <id> <kind> <stage> <ref> :: <note>  [screenshots: projects/<name>/review-shots/…]
//                                                              (CHANGED … when they edit a note or adds a screenshot)
//   PICK <project> <shot> <A|B|…> <status|pick>
//   APPROVED <project> (via …)
//
// Two ways in, both automatic:
//   node pipeline/watch.mjs [project]   Live: watches the files and prints each line the moment they save.
//                                       Run it in the background with a tool that turns lines into events
//                                       (Claude Code: Monitor). `npm run watch`.
//   node pipeline/watch.mjs --hook      Claude Code hook (.claude/settings.json, SessionStart and UserPromptSubmit).
//                                       Reads the hook's JSON on stdin, prints only what this session has not been
//                                       told yet, so every message they send carries the feedback queued since the
//                                       last one, even if no live watch is running.
// What a session has been told is kept per session in .cache/feedback/<session>.json (not in git).
// At the start (first call of a session, or the live watch starting), only open marks are listed, not old history.
import {existsSync, mkdirSync, readdirSync, readFileSync, renameSync, watch, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {readReview} from './review-store.mjs';

const root = join(import.meta.dirname, '..'), projectsDir = join(root, 'projects');
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const read = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const isProject = name => /^[a-z0-9-]+$/.test(name) && existsSync(join(projectsDir, name, 'storyboard.json'));

/** Every piece of feedback in one project now: key -> {print (fingerprint), line, open (worth listing at the start)}. */
export function feedback(project) {
  const out = new Map();
  let review = null; try { review = readReview(root, project); } catch { /* half-written; the next save retries */ }
  for (const mark of review?.marks ?? []) {
    const note = (mark.note || '').replace(/\s+/g, ' ').trim();
    const shots = (mark.shots ?? []).map(shot => `projects/${project}/${shot}`).join(' ');
    out.set(`mark/${mark.id}`, {print: [note, mark.kind, shots].join('\u0000'), open: mark.status === 'open', done: mark.status === 'done',
      line: `${project} ${mark.id} ${mark.kind} ${mark.stage ?? 'video'} ${mark.ref ?? mark.section ?? ''} :: ${note}${shots ? `  [screenshots: ${shots}]` : ''}`});
  }
  for (const shot of read(join(projectsDir, project, 'storyboard.json'))?.shots ?? []) {
    (shot.candidates ?? []).forEach((candidate, index) => {
      const state = shot.pick === index ? 'pick' : candidate.status;
      if (!state || state === 'draft') return;
      out.set(`pick/${shot.id}/${index}`, {print: state, open: false, line: `${project} ${shot.id} ${LETTERS[index] ?? index} ${state}`});
    });
  }
  const approval = read(join(projectsDir, project, 'approval.json'));
  if (approval?.storyboard) out.set('approved', {print: approval.storyboard, open: false, line: `${project} (via ${approval.via ?? '?'})`});
  return out;
}

/** Lines for what changed between `seen` (key -> print) and `now`; updates `seen`. `first`: only open marks. */
function changes(project, now, seen, first) {
  const lines = [];
  for (const [key, item] of now) {
    const id = `${project}/${key}`, before = seen[id];
    if (before === item.print) continue;
    seen[id] = item.print;
    if (first) { if (key.startsWith('mark/') && item.open) lines.push('MARK ' + item.line); continue; }
    if (key.startsWith('mark/')) { if (before === undefined) lines.push('MARK ' + item.line); else if (!item.done) lines.push('CHANGED ' + item.line); }
    else if (key.startsWith('pick/')) lines.push('PICK ' + item.line);
    else lines.push('APPROVED ' + item.line);
  }
  return lines;
}

const projects = () => readdirSync(projectsDir).filter(isProject);

if (process.argv[2] === '--hook') {
  // Claude Code hook: stdin is {session_id, hook_event_name, …}; stdout is added to the agent's context.
  let input = {}; try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* run by hand */ }
  const session = String(input.session_id || 'manual').replace(/[^\w-]/g, '');
  const dir = join(root, '.cache', 'feedback'), file = join(dir, `${session}.json`);
  const VERSION = 2;   // bump when the fingerprint changes: an older record is re-based silently, not re-announced
  const state = read(file), stale = state && state.v !== VERSION, seen = stale ? {} : state?.seen ?? {}, first = !state;
  let lines = projects().flatMap(project => changes(project, feedback(project), seen, first));
  if (stale) lines = [];
  mkdirSync(dir, {recursive: true});
  writeFileSync(file + '.tmp', JSON.stringify({v: VERSION, seen}) + '\n'); renameSync(file + '.tmp', file);
  if (lines.length) {
    console.log(`The user's feedback from the dashboard${first ? ' (open review marks)' : ', saved since their last message'}:`);
    for (const line of lines) console.log('  ' + line);
    console.log('Queue these (AGENTS.md, "Listen while they edit"): say in a line that you have them; apply them together once they are done marking. Work only on projects this session owns, and ask before taking marks that look like another session\'s.');
  }
  if (input.hook_event_name === 'SessionStart')
    console.log('While the user reviews or edits (after you send a review or storyboard link, or they say so), run `npm run watch <project>` with Monitor so each mark arrives the moment they save it; re-arm it when it expires.');
} else {
  const only = process.argv[2];
  if (only && !isProject(only)) { console.error(`No project "${only}".`); process.exit(1); }
  const list = only ? [only] : projects(), seen = {};
  for (const project of list) for (const line of changes(project, feedback(project), seen, true)) console.log(line);
  console.log(`Watching ${only ? `projects/${only}` : `${list.length} projects`} for the user's feedback…`);
  const timers = new Map();
  watch(projectsDir, {recursive: true}, (event, file) => {
    if (!file || !/(^|[\\/])(review|storyboard|approval)\.json$/.test(file)) return;
    const project = file.split(/[\\/]/)[0];
    if ((only && project !== only) || !isProject(project)) return;
    clearTimeout(timers.get(project));
    timers.set(project, setTimeout(() => { for (const line of changes(project, feedback(project), seen, false)) console.log(line); }, 300));
  });
}

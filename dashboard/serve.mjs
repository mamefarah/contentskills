#!/usr/bin/env node
// Zero-dependency local server for the dashboard and the rough-draft player.
//   node dashboard/serve.mjs [port]      (default 4600)
// Serves only dashboard/, gallery/, library/, pipeline/, projects/ and style/ — never dotfiles or anything else.
// Small JSON endpoints: the draft player lists projects and saves the review of a candidate piece; the review page
// (/pipeline/review/) reads and writes a project's marks (projects/<name>/review.json) and asks for thumbnails of its video.
//   GET    /api/settings                                  the user's settings (settings/defaults.json + settings/user.json, merged)
//   GET    /api/projects                                  every project, for the lists
//   POST   /api/projects/<name>/shots/<id>/candidates/<n> {status} or {pick: true}
//   GET    /api/projects/<name>/review                    {project, marks, versions: [the videos in out/]}
//   POST   /api/projects/<name>/review/marks              {start, end, note, kind?, status?, section?, ref?, video?, shots?} -> the new mark
//   PATCH  /api/projects/<name>/review/marks/<id>         any of {note, kind, status, reply, start, end, section, ref, shots} -> the mark
//   POST   /api/projects/<name>/review/shots              {image: data URL, at: seconds} -> {path}: a screenshot saved in review-shots/
//   DELETE /api/projects/<name>/review/marks/<id>
//   POST   /api/projects/<name>/review/marks/<id>/apply   Claude applies just that note to its section and splices it in (npm run patch);
//                                                         several sections at once. GET …/review also returns {jobs, history}
//   POST   /api/projects/<name>/review/undo              {id}: undo one section change (npm run undo), in the background
//   POST   /api/projects/<name>/thumbnails                {file: "cut.mp4", times: [seconds]} -> small stills in projects/<name>/thumbnails/
// The storyboard page (/pipeline/storyboard/) is where the user signs off before the video is made:
//   GET    /api/projects/<name>/storyboard                {modified, approval, notes: open storyboard notes, make: the make run, video}
//   POST   /api/projects/<name>/approve                   record the user's approval (refused while storyboard notes are open)
//   POST   /api/projects/<name>/make                      {scale: 0.5|1} run `node pipeline/make.mjs` (needs the approval); log in out/make.log
// The review page's "Make a new version" button:
//   GET    /api/projects/<name>/apply                     {apply: the run, open: open video notes, prompt}
// Finishing a video (the review page's "Finish video"; status Final in My videos):
//   GET    /api/projects/<name>/final                     {final: {file, finished, qa} | null}
//   POST   /api/projects/<name>/final                     {file: "cut.mp4"|"cut-v<n>.mp4"} copy it to out/final.mp4 and record projects/<name>/final.json
//   DELETE /api/projects/<name>/final                     reopen: forget the final mark (out/final.mp4 is kept)
//   POST   /api/projects/<name>/apply                     run `claude -p` to apply the open notes and re-make; log in out/apply.log (501 + prompt without Claude Code)
// Everything that writes checks the request came from a page of this server, and project names are plain folder names.
import {createServer} from 'node:http';
import {execFile, spawn, spawnSync} from 'node:child_process';
import {createReadStream, statSync, readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, appendFileSync, copyFileSync, rmSync} from 'node:fs';
import {dirname, extname, join, normalize, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readReview, writeReview, addMark, updateMark, removeMark, saveShot} from '../pipeline/review-store.mjs';
import {busy, history, readJobs, setJob} from '../pipeline/segments.mjs';
import {onCurrentTimeline, trimRounds} from '../pipeline/trim.mjs';
import {readStoryboard, readProjectJson} from '../pipeline/check.mjs';
import {sectionsOf} from '../pipeline/sections.js';
import {approvalStatus, approve} from '../pipeline/approve.mjs';
import {readSettingsSafe} from '../pipeline/settings.mjs';
import {themeFile} from '../pipeline/tools.mjs';
import {renderBusy} from '../pipeline/lock.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const allowed = ['dashboard', 'gallery', 'library', 'pipeline', 'projects', 'style'];
const statuses = ['draft', 'usable', 'rejected'];
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
const sendJson = (res, code, body) => res.writeHead(code, {'content-type': types['.json'], 'cache-control': 'no-store'}).end(JSON.stringify(body));

/** Only pages served by this server may change files (blocks requests from other sites). */
const foreign = req => { const origin = req.headers.origin; return Boolean(origin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin); };
/** Read a small JSON body, then call `use(data)`; whatever it throws is reported as a 400. */
function body(req, res, limit, use) {
  let text = '', over = false;
  req.on('data', chunk => { text += chunk; if (text.length > limit && !over) { over = true; sendJson(res, 413, {error: 'Request too large'}); req.destroy(); } });
  req.on('end', async () => { if (over) return; try { await use(text ? JSON.parse(text) : {}); } catch (error) { if (!res.headersSent) sendJson(res, 400, {error: error.message}); } });
}
/** The finished videos of a project the review page may show: out/cut.mp4 and its kept earlier versions out/cut-v<n>.mp4. */
const VIDEO = /^cut(-v\d+)?\.mp4$/;
function versions(project) {
  const dir = join(root, 'projects', project, 'out');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => VIDEO.test(n)).map(file => { const stat = statSync(join(dir, file)); return {file, size: stat.size, modified: Math.round(stat.mtimeMs)}; })
    .sort((a, b) => (a.file === 'cut.mp4' ? -1 : b.file === 'cut.mp4' ? 1 : b.file.localeCompare(a.file, 'en', {numeric: true})));
}
/** Small stills of a video at the given moments, made once with FFmpeg and kept in projects/<name>/thumbnails/ until the video changes. */
async function thumbnails(project, file, times) {
  if (!VIDEO.test(file || '')) throw Error('"file" must be cut.mp4 or cut-v<n>.mp4.');
  if (!Array.isArray(times) || times.length > 240 || times.some(t => typeof t !== 'number' || !(t >= 0 && t < 36000))) throw Error('"times" must be a list of up to 240 moments in seconds.');
  const video = join(root, 'projects', project, 'out', file);
  if (!existsSync(video)) throw Error(`No projects/${project}/out/${file} yet.`);
  const made = statSync(video).mtimeMs, dir = join(root, 'projects', project, 'thumbnails'), base = file.replace(/\.mp4$/, '');
  mkdirSync(dir, {recursive: true});
  const jobs = [...new Set(times.map(t => Math.round(t * 100)))].map(n => ({t: n / 100, name: `${base}-${String(n).padStart(6, '0')}.jpg`}));
  const one = job => new Promise(done => {
    const target = join(dir, job.name), result = error => done({t: job.t, url: error ? null : `/projects/${project}/thumbnails/${job.name}?v=${Math.round(made)}`});
    try { if (statSync(target).mtimeMs >= made) return result(); } catch {}
    const tmp = join(dir, `.${job.name}.${process.pid}.jpg`);          // dotfiles are never served, so a half-written still is never shown
    execFile('ffmpeg', ['-v', 'error', '-y', '-ss', String(job.t), '-i', video, '-frames:v', '1', '-vf', 'scale=216:-2', '-q:v', '5', tmp], {timeout: 20000}, error => {
      if (!error) try { renameSync(tmp, target); } catch (failed) { error = failed; }
      result(error);
    });
  });
  const out = []; let next = 0;
  await Promise.all(Array.from({length: Math.min(4, jobs.length)}, async () => { while (next < jobs.length) { const job = jobs[next++]; out.push(await one(job)); } }));
  return out.sort((first, second) => first.t - second.t);
}

// ---------- the storyboard page: approval and making the video ----------
/** One make at a time per project, started from the storyboard page: {child, started, finished, code, scale, lines}. */
const makes = new Map();
const openNotes = project => readReview(root, project).marks.filter(m => m.stage === 'storyboard' && m.status !== 'done');
function makeState(project) {
  const m = makes.get(project), mem = m ? {running: !m.finished, started: m.started, finished: m.finished ?? null, code: m.code ?? null, scale: m.scale, qa: null, log: m.lines.slice(-60)} : null;
  // A make started from a terminal (or by Claude) is not in `makes`: pipeline/make.mjs records every full make in
  // out/make-status.json, so the page shows the latest one, wherever it was started.
  const out = join(root, 'projects', project, 'out'); let f = null;
  try { f = JSON.parse(readFileSync(join(out, 'make-status.json'), 'utf8')); } catch {}
  if (!f || (mem && f.started < mem.started - 2000)) return mem;
  if (f.running) { try { process.kill(f.pid, 0); } catch { f = {...f, running: false, finished: f.finished ?? Date.now(), code: 1}; } }      // it died without saying so
  let log = [];
  try { log = readFileSync(join(out, 'make.log'), 'utf8').split('\n').map(l => l.split('\r').filter(Boolean).at(-1)?.trimEnd()).filter(Boolean).slice(-60); } catch {}
  return {running: Boolean(f.running), started: f.started, finished: f.finished ?? null, code: f.running ? null : (f.code ?? null), scale: f.scale, qa: f.qa ?? null, log};
}
function startMake(project, scale) {
  if (makes.get(project) && !makes.get(project).finished) throw Error('A make is already running for this project.');
  if (!approvalStatus(project).approved) throw Error('The storyboard is not approved yet.');
  const log = join(root, 'projects', project, 'out', 'make.log');
  mkdirSync(join(root, 'projects', project, 'out'), {recursive: true});
  writeFileSync(log, `# node pipeline/make.mjs ${project} --scale ${scale}   (${new Date().toISOString()}, from the storyboard page)\n`);
  const run = {started: Date.now(), scale, lines: []};
  const child = spawn(process.execPath, [join(root, 'pipeline/make.mjs'), project, '--scale', String(scale)], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  const take = chunk => {
    const text = String(chunk); appendFileSync(log, text);
    // progress bars rewrite one line with \r: keep only the latest state of such a line
    for (const part of text.split('\n')) { const line = part.split('\r').filter(Boolean).at(-1)?.trimEnd(); if (line) run.lines.push(line); }
    if (run.lines.length > 400) run.lines.splice(0, run.lines.length - 400);
  };
  child.stdout.on('data', take); child.stderr.on('data', take);
  child.on('close', code => { run.finished = Date.now(); run.code = code; });
  run.child = child; makes.set(project, run);
  return makeState(project);
}

// ---------- Trims from the review page (pipeline/trim.mjs, no re-make), logged to out/make.log ----------
// Trims queue per project: they can cut one scene, move on and cut another while the first runs. Each trim keeps the
// timeline it was marked on ("round"); they run one after another (each takes seconds) and pipeline/trim.mjs moves a
// later trim's times onto the timeline the earlier ones left (--round), so marking order never matters.
const trims = new Map();      // project -> [run]: every trim since the server started, oldest first
/** A note's times are on the timeline the page was loaded with ("round": trims before it); a trim since then moves them. */
const onTimeline = (project, mark, round) => { const rounds = trimRounds(project); Object.assign(mark, onCurrentTimeline({...mark, round: Number.isInteger(round) ? round : rounds.length}, rounds)); };
const trimRuns = project => trims.get(project) ?? [];
const trimActive = project => trimRuns(project).some(r => r.state === 'running' || r.state === 'queued');
function trimState(project) {
  const runs = trimRuns(project), t = runs.at(-1);
  if (!t) return null;
  const last = r => (r.lines ?? []).filter(l => !/^\s*drawing|Deprecation|trace-deprecation/.test(l)).at(-1) ?? '';
  return {running: trimActive(project), started: t.started, finished: t.finished ?? null, code: t.code ?? null, seconds: t.seconds, sections: t.sections, cut: t.cut, log: t.lines.slice(-40),
    runs: runs.slice(-30).map(r => ({id: r.id, state: r.state, cut: r.cut, round: r.round, sections: r.sections, code: r.code ?? null, finished: r.finished ?? null, last: last(r)}))};
}
// A trim belongs to the sections it cuts: only those show as busy; every other section can be noted, changed and patched
// meanwhile (pipeline/trim.mjs waits for sections mid-splice and keeps the footage and cut.mp4's record up to date).
function startTrim(project, cut, round, id) {
  if ((makes.get(project) && !makes.get(project).finished) || makeState(project)?.running) throw Error('The whole video is being made again right now: wait for it to finish, then trim.');
  if (applies.get(project) && !applies.get(project).finished) throw Error('Claude is re-making the whole video with your notes right now: wait for it to finish, then trim.');
  const sb = readStoryboard(project), touched = sectionsOf(sb, {words: readProjectJson(project, 'words.json')?.words ?? []}).filter(s => cut.some(([a, b]) => Math.min(a, b) < s.end - 1e-3 && Math.max(a, b) > s.start + 1e-3)).map(s => s.id);
  const held = touched.find(sid => busy(project, sid) && readJobs(project)[sid]?.state !== 'trimming');      // another trim there is fine: it queues
  if (held) throw Error(`Section ${held} is being worked on right now: cut it when that finishes (other sections can be cut now).`);
  const spec = cut.map(([a, b]) => `${(+a).toFixed(3)}-${(+b).toFixed(3)}`).join(',');
  const run = {id: /^[\w-]{1,40}$/.test(id ?? '') ? id : `t${Date.now()}`, state: 'queued', cut, round, spec, started: Date.now(), seconds: cut.reduce((n, [a, b]) => n + Math.abs(b - a), 0), lines: [], sections: touched};
  trims.set(project, [...trimRuns(project), run].slice(-100));
  for (const sid of touched) setJob(project, sid, {state: 'trimming', note: `cut ${spec}`, step: 'waiting for the cut before it', pid: null, started: Date.now(), error: null, marks: []});
  if (!trimRuns(project).some(r => r.state === 'running')) launchTrim(project, run);
  return {...trimState(project), id: run.id, queued: run.state === 'queued'};
}
function launchTrim(project, run) {
  const out = join(root, 'projects', project, 'out'), log = join(out, 'make.log');
  mkdirSync(out, {recursive: true});
  writeFileSync(log, `# node pipeline/trim.mjs ${project} --cut ${run.spec}${Number.isInteger(run.round) ? ` --round ${run.round}` : ''}   (${new Date().toISOString()}, from the review page; no re-make)\n`);
  run.state = 'running'; run.started = Date.now();
  const child = spawn(process.execPath, [join(root, 'pipeline/trim.mjs'), project, '--cut', run.spec, ...(Number.isInteger(run.round) ? ['--round', String(run.round)] : [])], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  for (const sid of run.sections) setJob(project, sid, {state: 'trimming', note: `cut ${run.spec}`, step: null, pid: child.pid, started: Date.now(), error: null, marks: []});
  const take = chunk => {
    const text = String(chunk); appendFileSync(log, text);
    for (const part of text.split('\n')) { const line = part.split('\r').filter(Boolean).at(-1)?.trimEnd(); if (line) run.lines.push(line); }
    if (run.lines.length > 400) run.lines.splice(0, run.lines.length - 400);
  };
  child.stdout.on('data', take); child.stderr.on('data', take);
  child.on('error', error => run.lines.push(`Could not start the trim: ${error.message}`));
  child.on('close', code => {
    run.finished = Date.now(); run.code = code; run.state = code === 0 ? 'done' : 'failed';
    const waiting = trimRuns(project).filter(r => r.state === 'queued');
    for (const sid of run.sections) if (!waiting.some(r => r.sections.includes(sid)))
      setJob(project, sid, {state: code === 0 ? 'done' : 'failed', pid: null, step: null, error: code === 0 ? null : (run.lines.at(-1) ?? 'The trim failed.')});
    console.log(`Trim ${run.spec} on ${project}: ${run.state}`);
    if (waiting.length) launchTrim(project, waiting[0]);      // the next one, on the timeline this one left
  });
  console.log(`\n\x1b[1mTrimming ${project}: ${run.spec}\x1b[0m  (log: projects/${project}/out/make.log)`);
}

// stream-json from `claude -p`: one event per line; tell `say` what Claude says and which commands it runs, in plain words
function narrate(child, say) {
  let pending = '';
  child.stdout.on('data', chunk => {
    pending += chunk; const lines = pending.split('\n'); pending = lines.pop();
    for (const line of lines) {
      let event; try { event = JSON.parse(line); } catch { continue; }
      for (const part of event.type === 'assistant' ? event.message?.content ?? [] : []) {
        if (part.type === 'text' && part.text.trim()) say(part.text.trim());
        else if (part.type === 'tool_use') say(`→ ${part.input?.command ?? `${part.name} ${part.input?.file_path ?? ''}`.trim()}`);
      }
      if (event.type === 'result' && event.is_error) say(`Error: ${event.result ?? event.subtype}`);
    }
  });
}
const CLAUDE_TOOLS = 'Read,Edit,Write,Glob,Grep,Skill,Bash(npm run *),Bash(node *),Bash(python3 *),Bash(cp *),Bash(ls *),Bash(ffprobe *)';

// ---------- one note, one section: Claude changes just that section and splices it into the video (npm run patch) ----------
// Several run at once, one per section; the review page and the dashboard show each section's state (out/jobs/).
const segmentPrompt = (project, mark, section) => `Apply my video note ${mark.id} on ${project}, and only that note. `
  + `It is on section "${section}" (${mark.start.toFixed(2)}–${mark.end.toFixed(2)} s): "${mark.note}". `
  + (mark.shots?.length ? `Open my screenshots first: ${mark.shots.map(x => `projects/${project}/${x}`).join(', ')}. ` : '')
  + `Run \`npm run review ${project}\` to see what is on screen there. `
  + `Change only this section's storyboard entries (an entry belongs to the section its "start" or "at" falls in). Other notes on other sections are being applied at the same time by other runs: never touch their entries, and re-read storyboard.json right before every edit. `
  + `Then run \`npm run patch ${project} ${section} -- --marks ${mark.id} --label "<a few words on what changed>"\`: it re-makes only this section and splices it into out/cut.mp4. Do not run npm run make. `
  + `Look at the result (\`npm run frames ${project} <seconds in the section> -- --sheet\`) and fix it if it is wrong. `
  + `Finish with \`npm run review ${project} -- --done ${mark.id} "<what you changed>"\`.`;
const segmentRuns = new Map();      // "<project>/<section>" -> run
function startSegmentApply(project, id) {
  const data = readReview(root, project), mark = data.marks.find(m => m.id === id);
  if (!mark) throw Error(`No note ${id}.`);
  if (mark.status === 'done') throw Error('That note is already done.');
  if (!readStoryboard(project).footage) throw Error('Per-section changes work on talking-head (footage) videos. Use "Make a new version".');
  if (applies.get(project) && !applies.get(project).finished) throw Error('Claude is applying all the notes to this video right now.');
  const section = mark.section || `${mark.start}-${mark.end}`, key = `${project}/${section}`;
  if (busy(project, section) || (segmentRuns.get(key) && !segmentRuns.get(key).finished)) throw Error(`Section ${section} is already being worked on. Add the note and apply it when that finishes.`);
  updateMark(data, id, {status: 'in-progress'}); writeReview(root, project, data);
  const log = join(root, 'projects', project, 'out', 'jobs', `${section}.log`);
  mkdirSync(dirname(log), {recursive: true});
  writeFileSync(log, `# claude -p (apply note ${id} to section ${section})   (${new Date().toISOString()})\n`);
  const run = {started: Date.now(), lines: []}, tag = `\x1b[35m[${project} · ${section}]\x1b[0m`;
  const say = line => { run.lines.push(line); appendFileSync(log, line + '\n'); if (run.lines.length > 100) run.lines.shift(); setJob(project, section, {step: line.slice(0, 160)}); console.log(`${tag} ${line.length > 200 ? line.slice(0, 200) + '…' : line}`); };
  const child = spawn(CLAUDE, ['-p', segmentPrompt(project, mark, section), '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--allowedTools', CLAUDE_TOOLS], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  setJob(project, section, {state: 'editing', marks: [id], note: mark.note.slice(0, 200), pid: child.pid, started: Date.now(), error: null, step: null});
  narrate(child, say);
  child.stderr.on('data', chunk => say(String(chunk).trim()));
  child.on('error', error => say(`Could not start Claude Code: ${error.message}`));
  child.on('close', code => {
    run.finished = Date.now(); run.code = code;
    const job = readJobs(project)[section];
    if (code !== 0 || job?.state !== 'done') setJob(project, section, {state: code === 0 && job?.state === 'done' ? 'done' : 'failed', pid: null, error: code === 0 ? (job?.state === 'done' ? null : 'Claude finished without splicing the section in (no npm run patch).') : `Claude stopped (exit ${code}).`});
    console.log(`${tag} \x1b[1m${code === 0 ? 'finished' : `stopped (exit ${code})`}\x1b[0m after ${Math.round((run.finished - run.started) / 1000)} s`);
  });
  run.child = child; segmentRuns.set(key, run);
  return {section, state: 'editing'};
}
// Undo a section change (npm run undo), in the background; the section shows as busy meanwhile.
function startUndo(project, id) {
  const entry = history(project).find(e => e.id === id);
  if (!entry) throw Error(`No history entry ${id}.`);
  if (busy(project, entry.section)) throw Error(`Section ${entry.section} is being worked on right now.`);
  const child = spawn(process.execPath, [join(root, 'pipeline/undo.mjs'), project, id], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  setJob(project, entry.section, {state: 'rendering', note: `undo: ${entry.label}`, pid: child.pid, started: Date.now(), error: null, marks: []});
  const log = join(root, 'projects', project, 'out', 'jobs', `${entry.section}.log`);
  writeFileSync(log, `# npm run undo ${project} ${id}\n`);
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => appendFileSync(log, chunk));
  return {section: entry.section, state: 'rendering'};
}

// ---------- "Make a new version": Claude Code applies the user's open video notes and re-makes, started from the review page ----------
// Runs `claude -p` headless at the repository root with edits allowed and Bash limited to the project's own commands. Without Claude Code
// installed the endpoint answers 501 with the prompt, and the page copies it to paste into any coding agent.
const applies = new Map();
const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const applyPrompt = project => `Apply my open video notes for ${project} and make a new version of the video. `
  + `Run \`npm run review ${project}\` to list them. Before re-making, copy projects/${project}/out/cut.mp4 to the next free out/cut-v<n>.mp4 so I keep the current version. `
  + `Change only what the notes ask (no new storyboard approval is needed at this stage), then \`npm run make ${project}\` and follow the quality-check skill until it passes. `
  + `Finish by marking each note done: \`npm run review ${project} -- --done <id> "<what you changed>"\`.`;
const openVideoNotes = project => readReview(root, project).marks.filter(m => m.stage !== 'storyboard' && m.kind !== 'keep' && m.status !== 'done');
const hasClaude = () => { try { return spawnSync(CLAUDE, ['--version'], {timeout: 10000}).status === 0; } catch { return false; } };
function applyState(project) {
  const a = applies.get(project);
  return a ? {running: !a.finished, started: a.started, finished: a.finished ?? null, code: a.code ?? null, steps: a.steps, log: a.lines.slice(-40)} : null;
}
function startApply(project) {
  if (applies.get(project) && !applies.get(project).finished) throw Error('Claude is already working on this video.');
  if (makes.get(project) && !makes.get(project).finished) throw Error('A make is already running for this project.');
  if (!openVideoNotes(project).length) throw Error('There are no open notes to apply.');
  const log = join(root, 'projects', project, 'out', 'apply.log');
  mkdirSync(join(root, 'projects', project, 'out'), {recursive: true});
  writeFileSync(log, `# claude -p (apply video notes)   (${new Date().toISOString()}, from the review page)\n`);
  const run = {started: Date.now(), lines: [], steps: 0};
  // every step also goes to this server's terminal (where `npm run dashboard` runs), so they can watch it there
  const tag = `\x1b[35m[${project}]\x1b[0m`;
  const say = line => {
    run.lines.push(line); appendFileSync(log, line + '\n'); if (run.lines.length > 300) run.lines.splice(0, run.lines.length - 300);
    if (line.startsWith('→')) run.steps++;
    console.log(`${tag} ${line.length > 220 ? line.slice(0, 220) + '…' : line}`);
  };
  console.log(`\n${tag} \x1b[1mClaude is applying ${openVideoNotes(project).length} note(s) from the review page\x1b[0m  (log: projects/${project}/out/apply.log)`);
  const child = spawn(CLAUDE, ['-p', applyPrompt(project), '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits',
    '--allowedTools', CLAUDE_TOOLS],
    {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  narrate(child, say);
  child.stderr.on('data', chunk => say(String(chunk).trim()));
  child.on('error', error => say(`Could not start Claude Code: ${error.message}`));
  child.on('close', code => {
    run.finished = Date.now(); run.code = code;
    console.log(`${tag} \x1b[1m${code === 0 ? 'Done: new version ready' : `Stopped (exit ${code})`}\x1b[0m after ${Math.round((run.finished - run.started) / 60000)} min\n`);
  });
  run.child = child; applies.set(project, run);
  return applyState(project);
}

// ---------- finishing: the version they are happy with, frozen as out/final.mp4 so later re-makes never change it ----------
const finalFile = project => join(root, 'projects', project, 'final.json');
const finalOf = project => { try { return JSON.parse(readFileSync(finalFile(project), 'utf8')); } catch { return null; } };
function finish(project, file = 'cut.mp4') {
  if (!VIDEO.test(file)) throw Error('"file" must be cut.mp4 or cut-v<n>.mp4.');
  const out = join(root, 'projects', project, 'out'), source = join(out, file);
  if (!existsSync(source)) throw Error(`There is no ${file} to finish yet.`);
  if (renderBusy(project)) throw Error('This video is being made right now. Finish it when the make is done.');
  // The quality check counts only when it was run on these exact bytes: qa.json must be newer than the video it names.
  // An earlier version (cut-v<n>.mp4) has no check of its own, so it is recorded as "unchecked", never as a pass.
  let qa = 'unchecked';
  if (file === 'cut.mp4') {
    try {
      const report = join(out, 'qa.json');
      qa = statSync(report).mtimeMs >= statSync(source).mtimeMs ? JSON.parse(readFileSync(report, 'utf8')).status ?? 'unchecked' : 'stale';
    } catch {}
  }
  const before = statSync(source);
  copyFileSync(source, join(out, '.final.mp4.tmp'));
  const after = statSync(source);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) { rmSync(join(out, '.final.mp4.tmp'), {force: true}); throw Error(`${file} changed while it was being copied. Try again.`); }
  renameSync(join(out, '.final.mp4.tmp'), join(out, 'final.mp4'));
  const record = {file, finished: new Date().toISOString(), qa, bytes: after.size};
  writeFileSync(finalFile(project), JSON.stringify(record, null, 2) + '\n');
  return record;
}

function api(req, res, path) {
  if (path === '/api/whoami') return sendJson(res, 200, {app: 'contentskills', root});      // lets `npm run link` tell this server from another on the same port
  const fin = /^\/api\/projects\/([a-z0-9-]+)\/final$/.exec(path);
  if (fin) {
    const [, project] = fin;
    if (!existsSync(join(root, 'projects', project, 'storyboard.json'))) return sendJson(res, 404, {error: `No project "${project}"`});
    if (req.method === 'GET') return sendJson(res, 200, {final: finalOf(project)});
    if (foreign(req)) return sendJson(res, 403, {error: 'Forbidden origin'});
    if (req.method === 'POST') return body(req, res, 1000, ({file} = {}) => sendJson(res, 200, {final: finish(project, file)}));
    if (req.method === 'DELETE') { rmSync(finalFile(project), {force: true}); return sendJson(res, 200, {final: null}); }
    return sendJson(res, 405, {error: 'Method not allowed'});
  }
  const apply = /^\/api\/projects\/([a-z0-9-]+)\/apply$/.exec(path);
  if (apply) {
    const [, project] = apply;
    if (!existsSync(join(root, 'projects', project, 'storyboard.json'))) return sendJson(res, 404, {error: `No project "${project}"`});
    if (req.method === 'GET') return sendJson(res, 200, {apply: applyState(project), open: openVideoNotes(project).length, prompt: applyPrompt(project)});
    if (req.method !== 'POST') return sendJson(res, 405, {error: 'Method not allowed'});
    if (foreign(req)) return sendJson(res, 403, {error: 'Forbidden origin'});
    if (!hasClaude()) return sendJson(res, 501, {error: 'Claude Code is not installed here.', prompt: applyPrompt(project)});
    try { return sendJson(res, 202, {apply: startApply(project)}); } catch (error) { return sendJson(res, 409, {error: error.message}); }
  }
  if (req.method === 'GET' && path === '/api/settings') return sendJson(res, 200, readSettingsSafe());   // settings/defaults.json + settings/user.json
  if (req.method === 'GET' && path === '/api/projects') {
    const dir = join(root, 'projects');
    const names = existsSync(dir) ? readdirSync(dir).filter(n => /^[a-z0-9-]+$/.test(n) && existsSync(join(dir, n, 'storyboard.json'))) : [];
    return sendJson(res, 200, names.map(name => {
      try {
        const s = JSON.parse(readFileSync(join(dir, name, 'storyboard.json'), 'utf8')), modified = statSync(join(dir, name, 'storyboard.json')).mtimeMs, video = versions(name), marks = readReview(root, name).marks;
        const archived = existsSync(join(dir, name, 'archived.json'));      // tests and theme trials: folded away in My videos
        const jobs = Object.values(readJobs(name)), review = {video: video.some(v => v.file === 'cut.mp4'), versions: video.length, marks: marks.length, open: marks.filter(m => m.status !== 'done').length, final: finalOf(name)?.finished ?? null,
          working: jobs.filter(j => j.state !== 'done' && j.state !== 'failed').map(j => ({section: j.section, state: j.state})), failed: jobs.filter(j => j.state === 'failed').length};
        if (s.footage) return {name, title: s.title, modified, archived, footage: true, duration: s.footage.duration, graphics: (s.overlays ?? []).length, shots: 0, usable: 0, review};
        return {name, title: s.title, modified, archived, shots: s.shots.length, usable: s.shots.filter(x => x.candidates?.some(c => c.status === 'usable')).length, review};
      }
      catch (error) { return {name, error: error.message}; }
    }));
  }
  // The review page: a project's marks (plain file, projects/<name>/review.json) and thumbnails of its finished video.
  const review = /^\/api\/projects\/([a-z0-9-]+)\/(review|review\/marks|review\/marks\/(m\d+)|review\/marks\/(m\d+)\/apply|review\/shots|review\/undo|thumbnails)$/.exec(path);
  if (review) {
    const [, project, what, markId, applyId] = review, id = markId, write = req.method !== 'GET';
    if (!existsSync(join(root, 'projects', project, 'storyboard.json'))) return sendJson(res, 404, {error: `No project "${project}"`});
    if (write && foreign(req)) return sendJson(res, 403, {error: 'Forbidden origin'});
    try {
      if (what === 'review' && req.method === 'GET') return sendJson(res, 200, {...readReview(root, project), versions: versions(project), jobs: readJobs(project), history: history(project)});
      if (applyId && req.method === 'POST') { if (!hasClaude()) return sendJson(res, 501, {error: 'Claude Code is not installed here.'}); try { return sendJson(res, 202, startSegmentApply(project, applyId)); } catch (error) { return sendJson(res, 409, {error: error.message}); } }
      if (what === 'review/undo' && req.method === 'POST') return body(req, res, 1000, ({id: entry}) => { try { sendJson(res, 202, startUndo(project, entry)); } catch (error) { sendJson(res, 409, {error: error.message}); } });
      // A section Claude is changing is locked: no new notes there, no edits to its notes' words or range, no deletes
      // (status and reply updates still go through: that is how the run closes them).
      const lockedSection = sec => sec && busy(project, sec);
      if (what === 'review/marks' && req.method === 'POST') return body(req, res, 20000, input => { if (input.stage !== 'storyboard' && lockedSection(input.section)) return sendJson(res, 423, {error: `Claude is changing ${input.section} right now: notes there are locked until it is done.`}); const data = readReview(root, project), mark = addMark(data, input); onTimeline(project, mark, input.round); writeReview(root, project, data); sendJson(res, 201, mark); });
      if (id && (req.method === 'PATCH' || req.method === 'POST')) return body(req, res, 20000, patch => { const data = readReview(root, project), was = data.marks.find(m => m.id === id); if (was && lockedSection(was.section) && ['note', 'start', 'end', 'section', 'kind', 'shots'].some(k => k in patch)) return sendJson(res, 423, {error: `Claude is changing ${was.section} right now: this note is locked until it is done.`}); const mark = updateMark(data, id, patch); if (!mark) return sendJson(res, 404, {error: `No mark ${id}`}); if ('start' in patch || 'end' in patch) onTimeline(project, mark, patch.round); writeReview(root, project, data); sendJson(res, 200, mark); });
      if (id && req.method === 'DELETE') { const data = readReview(root, project), was = data.marks.find(m => m.id === id); if (was && lockedSection(was.section) && was.status !== 'done') return sendJson(res, 423, {error: `Claude is changing ${was.section} right now: this note is locked until it is done.`}); if (!removeMark(data, id)) return sendJson(res, 404, {error: `No mark ${id}`}); writeReview(root, project, data); return sendJson(res, 200, {deleted: id}); }
      if (what === 'review/shots' && req.method === 'POST') return body(req, res, 8e6, ({image, at}) => sendJson(res, 201, {path: saveShot(root, project, image, Number(at))}));
      if (what === 'thumbnails' && req.method === 'POST') return body(req, res, 20000, async ({file, times}) => sendJson(res, 200, {file, thumbs: await thumbnails(project, file, times)}));
    } catch (error) { return sendJson(res, 400, {error: error.message}); }
    return sendJson(res, 405, {error: 'Method not allowed'});
  }
  // Trims from the review page's trim buttons: cut those stretches out of the clip and the finished video (pipeline/trim.mjs),
  // keep every graphic on its word. Seconds, not a re-make: they ask for a re-make when they want one. GET -> {trim: the run}; POST {cut: [[a, b], ...]} (video seconds).
  const trimPath = /^\/api\/projects\/([a-z0-9-]+)\/trim$/.exec(path);
  if (trimPath) {
    const project = trimPath[1];
    if (!existsSync(join(root, 'projects', project, 'edit', 'edl.json'))) return sendJson(res, 404, {error: `projects/${project} has no edit/edl.json to trim.`});
    if (req.method === 'GET') return sendJson(res, 200, {trim: trimState(project)});
    if (req.method === 'POST') {
      if (foreign(req)) return sendJson(res, 403, {error: 'Forbidden origin'});
      return body(req, res, 20000, ({cut, round, id} = {}) => {
        if (!Array.isArray(cut) || !cut.length || !cut.every(r => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite))) throw Error('"cut" must be a list of [start, end] pairs in seconds.');
        sendJson(res, 202, {trim: startTrim(project, cut, round, id)});
      });
    }
    return sendJson(res, 405, {error: 'Method not allowed'});
  }
  const board = /^\/api\/projects\/([a-z0-9-]+)\/(storyboard|approve|make)$/.exec(path);
  if (board) {
    const [, project, what] = board, file = join(root, 'projects', project, 'storyboard.json');
    if (!existsSync(file)) return sendJson(res, 404, {error: `No project "${project}"`});
    if (req.method !== 'GET' && foreign(req)) return sendJson(res, 403, {error: 'Forbidden origin'});
    try {
      if (what === 'storyboard' && req.method === 'GET') {
        const video = versions(project).find(v => v.file === 'cut.mp4') ?? null;
        return sendJson(res, 200, {modified: Math.round(statSync(file).mtimeMs), approval: approvalStatus(project), notes: openNotes(project).length, make: makeState(project), video});
      }
      if (what === 'approve' && req.method === 'POST') {
        const open = openNotes(project).length;
        if (open) return sendJson(res, 409, {error: `${open} note(s) on the storyboard are still open. Ask Claude Code to apply them, or delete them, first.`});
        approve(project, 'storyboard page');
        return sendJson(res, 200, {approval: approvalStatus(project)});
      }
      if (what === 'make' && req.method === 'POST') return body(req, res, 1000, ({scale = 1} = {}) => {
        if (![.5, 1].includes(scale)) throw Error('"scale" must be 0.5 or 1.');
        sendJson(res, 202, {make: startMake(project, scale)});
      });
    } catch (error) { return sendJson(res, 400, {error: error.message}); }
    return sendJson(res, 405, {error: 'Method not allowed'});
  }
  // POST {status} marks one candidate; POST {pick: true} also chooses it for the cut.
  const match = /^\/api\/projects\/([a-z0-9-]+)\/shots\/([a-z0-9-]+)\/candidates\/(\d+)$/.exec(path);
  if (req.method === 'POST' && match) {
    if (foreign(req)) return sendJson(res, 403, {error: 'Forbidden origin'});
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1000) req.destroy(); });
    req.on('end', () => {
      try {
        const {status, pick} = JSON.parse(body), index = Number(match[3]);
        if (!pick && !statuses.includes(status)) return sendJson(res, 400, {error: `status must be one of ${statuses.join(', ')}`});
        const file = join(root, 'projects', match[1], 'storyboard.json'), storyboard = JSON.parse(readFileSync(file, 'utf8'));
        const shot = storyboard.shots.find(s => s.id === match[2]), candidate = shot?.candidates?.[index];
        if (!candidate) return sendJson(res, 404, {error: 'No such shot or candidate'});
        if (pick) { candidate.status = 'usable'; shot.pick = index; }
        else { candidate.status = status; if (status !== 'usable' && shot.pick === index) delete shot.pick; }
        writeFileSync(file, JSON.stringify(storyboard, null, 2) + '\n');
        sendJson(res, 200, {id: shot.id, candidate: index, status: candidate.status, pick: shot.pick ?? null});
      } catch (error) { sendJson(res, 400, {error: error.message}); }
    });
    return;
  }
  sendJson(res, 404, {error: 'Not found'});
}

function handle(req, res) {
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (path.startsWith('/api/')) return api(req, res, path);
  if (path === '/') { res.writeHead(302, {location: '/dashboard/'}).end(); return; }
  if (path === '/favicon.ico') { res.writeHead(204).end(); return; }      // no icon; answered so browsers do not log an error on every page
  if (path.endsWith('/')) path += 'index.html';
  const asked = normalize(join(root, path));
  const top = asked.slice(root.length + 1).split(sep)[0];
  const hidden = asked.slice(root.length).split(sep).some(part => part.startsWith('.'));
  if (!asked.startsWith(root + sep) || !allowed.includes(top) || hidden) { res.writeHead(403).end('Forbidden'); return; }
  const file = themeFile(asked);      // a theme that extends another serves the parent's piece at its own address (pipeline/tools.mjs)
  let stat;
  try { stat = statSync(file); } catch { res.writeHead(404).end('Not found'); return; }
  if (stat.isDirectory()) { res.writeHead(302, {location: path + '/'}).end(); return; }
  const headers = {'content-type': types[extname(file).toLowerCase()] || 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': 'no-cache'};
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : stat.size - 1;
    start = Math.max(0, start); end = Math.min(end, stat.size - 1);
    if (start > end) { res.writeHead(416, {'content-range': `bytes */${stat.size}`}).end(); return; }
    res.writeHead(206, {...headers, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'content-length': end - start + 1});
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file, {start, end}).pipe(res);
    return;
  }
  res.writeHead(200, {...headers, 'content-length': stat.size});
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
}

/** Start the server. Port 0 picks a free port. Resolves with {server, port}. */
export function start(port = 4600) {
  return new Promise((ok, bad) => {
    // one bad request (a broken settings file, an unreadable project) answers 500; it never stops the server
    const safe = (req, res) => { const fail = error => { console.error(`${req.method} ${req.url}: ${error.stack ?? error}`); if (!res.headersSent) sendJson(res, 500, {error: String(error.message ?? error)}); else res.end(); };
      // Only this machine's own pages may talk to the server: it can start renders and an agent. A request whose Host is
      // not local (DNS rebinding) or that comes from a page on another site (Origin) is refused.
      const local = value => { try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname); } catch { return false; } };
      if (!local('http://' + (req.headers.host ?? '')) || (req.headers.origin && !local(req.headers.origin))) return sendJson(res, 403, {error: 'This server only answers pages opened on this computer.'});
      try { Promise.resolve(handle(req, res)).catch(fail); } catch (error) { fail(error); } };
    const server = createServer(safe).on('error', bad);
    server.listen(port, '127.0.0.1', () => ok({server, port: server.address().port}));
  });
}

/** Which server answers on a port: 'ours' (this folder's dashboard), 'other' (something else), or 'free'. */
export async function whoIsOn(port) {
  try {
    const answer = await fetch(`http://127.0.0.1:${port}/api/whoami`, {signal: AbortSignal.timeout(1500)});
    const body = answer.ok ? await answer.json().catch(() => null) : null;
    return body?.root === root ? 'ours' : 'other';
  } catch (error) { return error.cause?.code === 'ECONNREFUSED' ? 'free' : 'other'; }
}
/** Where this folder's dashboard last started ({port, pid}), for `npm run link`. */
export const serverNote = join(root, '.cache', 'dashboard.json');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // The usual port is 4600. When another program (or another copy of this project) already has it, take the next free
  // one instead of failing, and say so: links must come from `npm run link`, never from a remembered port number.
  const wanted = Number(process.env.PORT || process.argv[2] || 4600);
  let port = wanted, running = false;
  for (; port < wanted + 20; port++) {
    const who = await whoIsOn(port);
    if (who === 'ours') { running = true; break; }
    if (who === 'free') break;
  }
  if (running) console.log(`Already running:   http://localhost:${port}/dashboard/`);
  else {
    ({port} = await start(port));
    mkdirSync(dirname(serverNote), {recursive: true}); writeFileSync(serverNote, JSON.stringify({port, pid: process.pid}) + '\n');
    if (port !== wanted) console.log(`Port ${wanted} is used by another program, so this dashboard is on ${port}.`);
    console.log(`Master dashboard:  http://localhost:${port}/dashboard/\nStoryboards:       http://localhost:${port}/pipeline/storyboard/\nRough drafts:      http://localhost:${port}/pipeline/draft/\nReview videos:     http://localhost:${port}/pipeline/review/`);
  }
}

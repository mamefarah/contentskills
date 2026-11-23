#!/usr/bin/env node
// Trim the cut from the editor: take short stretches out of the video (a clip's head or tail, a breath, a blooper)
// and keep every graphic, caption, sound and section on the same words.
//   node pipeline/trim.mjs <project> --cut 3.20-3.45,12.0-12.2 [--make]
// Times are on the current video's timeline, as the review page shows them (out/cut.mp4 = edit/clean.mp4 = footage.mp4).
// 1. edit/clean.mp4 loses those stretches: jump cuts on whole frames with an 8 ms audio fade either side (the audio is
//    already levelled and normalised by `npm run cut`, so it is not touched otherwise). The first trim keeps the
//    untouched clip in edit/before-trims/.
// 2. edit/words.json and edit/edl.json move onto the new timeline (edl.json gains `trims`).
// 3. The round is added to edit/trims.json. A project built by build-storyboard.py applies that file itself (it calls
//    apply_trims from pipeline/trims.py, so re-running the generator keeps the trims); the generator is re-run. A
//    project without a generator has its storyboard.json moved directly.
// 4. footage.mp4, faces.json and words.json lose the same stretches (no new face pass), so the footage is never stale.
// 5. out/cut.mp4 has the same stretches cut out directly (the old one is kept as out/cut-v<n>.mp4) and its record
//    (out/cut.manifest.json) is rebuilt from it, so any other section can still be changed on its own (npm run patch)
//    straight after a trim: a trim never makes the user wait for a full re-make. --make re-makes everything as well.
// 6. The user's notes (review.json) and the undo history move onto the new timeline too.
// The CLI waits for sections being drawn or spliced (their frames are on the old timeline), then takes the render lock;
// edit/.trimming tells a patch starting meanwhile to wait for it. Only the trimmed sections are busy (dashboard jobs).
// The review page's trim buttons (cut a scene's start to the playhead, or the playhead to its end) call this through POST /api/projects/<name>/trim (dashboard/serve.mjs).
import {spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {root} from './check.mjs';
import {measureLoudness} from './cut.mjs';
import {effectsPython} from './tools.mjs';
import {frameStore} from './cache.mjs';
import {lockProject} from './lock.mjs';
import {readJobs, readManifest, writeManifest} from './segments.mjs';
import {readReview, writeReview} from './review-store.mjs';

const FADE = .008, r3 = x => Math.round(x * 1000) / 1000;
const run = (command, args, what, opts = {}) => {
  const r = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 1 << 28, cwd: root, ...opts});
  if (r.status !== 0) throw Error(`${what} failed.\n${(r.stderr || r.stdout || '').slice(-1500)}`);
  return r;
};

/** Removed stretches [[a, b], ...] (sorted, merged) -> a function moving a time on the old timeline to the new one.
 * A time inside a removed stretch lands where that stretch was (the next kept frame). */
export function mover(ranges) {
  return t => {
    let shift = 0;
    for (const [a, b] of ranges) { if (t >= b) shift += b - a; else if (t > a) return r3(a - shift); else break; }
    return r3(t - shift);
  };
}
/** Move a storyboard onto the new timeline (the same fields pipeline/trims.py moves). */
export function moveStoryboard(sb, move) {
  const span = x => ({...x, start: move(x.start), end: move(x.end)});
  for (const k of ['overlays', 'captionTrack', 'zooms']) if (sb[k]) sb[k] = sb[k].map(span).filter(x => x.end - x.start > .05);
  for (const k of ['layouts', 'transitions', 'sounds']) if (sb[k]) sb[k] = sb[k].map(x => ({...x, at: move(x.at)}));
  for (const x of sb.effects ?? []) {
    const a = move(x.at), b = move(x.at + x.seconds); x.at = a; x.seconds = r3(b - a);
    if (x.props && 'seconds' in x.props) x.props.seconds = x.seconds;
  }
  sb.effects = (sb.effects ?? []).filter(x => x.seconds > .05);
  if (sb.sections) sb.sections = sb.sections.map(span).filter(x => x.end - x.start > .05);
  if (sb.footage?.duration) sb.footage.duration = move(sb.footage.duration);
  const m = sb.music;
  if (m?.parts) m.parts = m.parts.map(q => ({...q, at: move(q.at)}));      // the music's cue points move with the words they were set on
  if (m?.drops) m.drops = m.drops.map(([a, b]) => [move(a), move(b)]).filter(([a, b]) => b - a > .05);
  return sb;
}

/** Rebuild out/cut.manifest.json from the trimmed out/cut.mp4: its picture cut into the same half-second chunks a make
 *  uses (stored in the chunk cache under the hash of their content), its sounds moved, its transitions already in the
 *  picture. A patch then takes every other section from these chunks, exactly as after a full make. */
function rechunk(project, cut, move, ranges, storyboard, log) {
  const manifest = readManifest(project);
  if (!manifest?.size || !manifest.fps) return log('No record of how out/cut.mp4 was made: the next section change needs one npm run make first.');
  const [W, H] = manifest.size, fps = manifest.fps, SIZE = Math.max(1, Math.round(fps / 2));
  const frames = Math.floor((storyboard.footage?.duration ?? 0) * fps + 1e-6), count = Math.ceil(frames / SIZE);
  const store = frameStore(project, W, H, 'mp4', 'chunks'), tmp = join(root, 'projects', project, 'out', `.rechunk-${process.pid}`);
  rmSync(tmp, {recursive: true, force: true}); mkdirSync(tmp, {recursive: true});
  try {
    const at = Array.from({length: count - 1}, (_, i) => (i + 1) * SIZE);
    run('ffmpeg', ['-v', 'error', '-y', '-i', cut, '-an', '-frames:v', String(frames), '-r', String(fps), '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      '-force_key_frames', `expr:eq(mod(n,${SIZE}),0)`, '-f', 'segment', '-segment_frames', at.join(',') || String(frames + 1), '-reset_timestamps', '1', join(tmp, '%05d.mp4')], 'Cutting the video into chunks');
    const files = readdirSync(tmp).filter(f => f.endsWith('.mp4')).sort();
    if (files.length !== count) throw Error(`expected ${count} chunks, got ${files.length}`);
    const keys = files.map(f => {
      const data = readFileSync(join(tmp, f)), key = 'trim' + createHash('sha256').update(data).digest('hex').slice(0, 36);
      if (!store.has(key)) { mkdirSync(join(store.dir, key.slice(0, 2)), {recursive: true}); renameSync(join(tmp, f), store.path(key)); }
      return key;
    });
    const gone = t => ranges.some(([a, b]) => t >= a && t < b);
    writeManifest(project, {fps, frames, size: [W, H], chunks: keys, cuts: [],      // transitions are already in the chunks' picture
      sounds: (manifest.sounds ?? []).filter(x => !gone(x.at)).map(x => ({...x, at: move(x.at)})), storyboard, made: new Date().toISOString(), trimmed: true});
    log(`Rebuilt the record of out/cut.mp4 (${count} chunks): other sections can be changed on their own right away.`);
  } catch (error) {
    rmSync(join(root, 'projects', project, 'out', 'cut.manifest.json'), {force: true});
    log(`Could not rebuild the record of out/cut.mp4 (${error.message.split('\n')[0]}): the next section change needs one npm run make first.`);
  } finally { rmSync(tmp, {recursive: true, force: true}); }
}

/** The trim rounds so far (edit/trims.json). */
export const trimRounds = project => { try { return JSON.parse(readFileSync(join(root, 'projects', project, 'edit', 'trims.json'), 'utf8')).rounds ?? []; } catch { return []; } };
/** Move a note's times from the timeline after `round` trims onto the current one. A note keeps the round it is on ("round"). */
export function onCurrentTimeline(mark, rounds) {
  const from = Number.isInteger(mark.round) ? mark.round : rounds.length - 1;
  if (from >= rounds.length) return {...mark, round: rounds.length};
  let {start, end} = mark;
  for (const r of rounds.slice(Math.max(0, from))) { const m = mover(r); start = m(start); end = m(end); }
  if (end - start < .05) end = r3(start + .05);
  return {...mark, start, end, round: rounds.length};
}
/** Every note not yet on the current timeline is moved onto it. */
function moveNotes(project, log) {
  const rounds = trimRounds(project), data = readReview(root, project);
  let n = 0;
  data.marks = data.marks.map(m => { if (m.round === rounds.length) return m; n++; return onCurrentTimeline(m, rounds); });
  if (n) { writeReview(root, project, data); log(`Moved ${n} note(s) onto the trimmed timeline.`); }
}
/** Undo entries keep working after a trim: their section's times and stored storyboard move too. */
function moveHistory(project, move) {
  const dir = join(root, 'projects', project, 'out', 'history');
  for (const id of existsSync(dir) ? readdirSync(dir) : []) {
    const ef = join(dir, id, 'entry.json'), mf = join(dir, id, 'manifest.json');
    try {
      const e = JSON.parse(readFileSync(ef, 'utf8')); writeFileSync(ef, JSON.stringify({...e, start: move(e.start), end: move(e.end)}, null, 1) + '\n');
      const m = JSON.parse(readFileSync(mf, 'utf8')); if (m.storyboard) { m.storyboard = moveStoryboard(m.storyboard, move); writeFileSync(mf, JSON.stringify(m) + '\n'); }
    } catch {}
  }
}

export function trim(project, wanted, {make = false, log = console.log} = {}) {
  const P = join(root, 'projects', project), E = join(P, 'edit'), edlFile = join(E, 'edl.json');
  if (!existsSync(edlFile)) throw Error(`projects/${project} has no edit/edl.json: trimming works on a cut made by npm run cut.`);
  const edl = JSON.parse(readFileSync(edlFile, 'utf8')), fps = edl.fps ?? 30, D = edl.duration.after;
  const frame = t => Math.round(t * fps) / fps;
  // whole frames, inside the clip, merged; anything under one frame is no trim at all
  const ranges = wanted.map(([a, b]) => [frame(Math.max(0, Math.min(a, b))), frame(Math.min(D, Math.max(a, b)))]).filter(([a, b]) => b - a >= 1 / fps - 1e-6)
    .sort((x, y) => x[0] - y[0]).reduce((out, r) => { const l = out.at(-1); if (l && r[0] <= l[1] + 1e-6) l[1] = Math.max(l[1], r[1]); else out.push([...r]); return out; }, []);
  if (!ranges.length) throw Error('Nothing to trim (each stretch must be at least one frame).');
  const removed = ranges.reduce((s, [a, b]) => s + b - a, 0);
  if (D - removed < 1) throw Error('That would leave less than a second of video.');
  const keep = []; let t = 0;
  for (const [a, b] of ranges) { if (a > t) keep.push([t, a]); t = b; }
  if (t < D) keep.push([t, D]);
  log(`Trimming ${ranges.length} stretch(es), ${removed.toFixed(2)} s: ${ranges.map(([a, b]) => `${a.toFixed(2)}-${b.toFixed(2)}`).join(', ')}`);

  // 1. the clip
  const B = join(E, 'before-trims'), clean = join(E, 'clean.mp4'), tmp = join(E, '.trimmed.mp4');
  if (!existsSync(B)) { mkdirSync(B); for (const f of ['clean.mp4', 'words.json', 'edl.json']) if (existsSync(join(E, f))) copyFileSync(join(E, f), join(B, f)); }
  const graph = keep.map(([a, b], i) => `[0:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS,afade=t=in:d=${FADE},afade=t=out:st=${(b - a - FADE).toFixed(4)}:d=${FADE}[a${i}]`).join(';')
    + `;${keep.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${keep.length}:v=1:a=1[v][a]`;
  run('ffmpeg', ['-v', 'error', '-y', '-i', clean, '-filter_complex', graph, '-map', '[v]', '-map', '[a]', '-r', String(fps), '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp], 'Cutting the clip');
  renameSync(tmp, clean);
  if (existsSync(join(E, 'clean-before-relevel.mp4'))) rmSync(join(E, 'clean-before-relevel.mp4'));      // stale now: --relevel starts from the trimmed clip

  // 2. words and the edit decision list
  const move = mover(ranges), inside = (a, b) => ranges.reduce((s, [x, y]) => s + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0);
  const wf = join(E, 'words.json'), wd = JSON.parse(readFileSync(wf, 'utf8')), words = wd.words ?? wd;
  const kept = words.filter(w => inside(w.start, w.end) < .5 * Math.max(.01, w.end - w.start)).map(w => ({...w, start: move(w.start), end: Math.max(move(w.end), move(w.start) + .02)}));
  const gone = words.length - kept.length, after = r3(D - removed);
  writeFileSync(wf, JSON.stringify(Array.isArray(wd) ? kept : {...wd, duration: after, words: kept}, null, 1) + '\n');
  const segments = [];
  for (const s of edl.segments ?? []) for (const [a, b] of keep) {
    const x = Math.max(a, s.at), y = Math.min(b, s.at + s.length);
    if (y - x > 1e-3) segments.push({...s, in: r3(s.in + x - s.at), out: r3(s.in + y - s.at), at: move(x), length: r3(y - x)});
  }
  const loud = measureLoudness(clean);
  Object.assign(edl, {duration: {...edl.duration, after}, segments, cuts: segments.slice(1).map(s => s.at),
    trims: [...(edl.trims ?? []), {when: new Date().toISOString(), removed: ranges}],
    audio: {...edl.audio, after: {lufs: Number(loud.input_i), truePeak: Number(loud.input_tp), range: Number(loud.input_lra)}}});
  writeFileSync(edlFile, JSON.stringify(edl, null, 1) + '\n');

  // 3. the storyboard
  const tf = join(E, 'trims.json'), rounds = existsSync(tf) ? JSON.parse(readFileSync(tf, 'utf8')).rounds : [];
  rounds.push(ranges); writeFileSync(tf, JSON.stringify({note: 'Stretches cut from the video in the editor, one list per round, each on the timeline left by the rounds before it (pipeline/trim.mjs).', rounds}, null, 1) + '\n');
  const gen = join(P, 'build-storyboard.py'), sbFile = join(P, 'storyboard.json');
  if (existsSync(gen) && readFileSync(gen, 'utf8').includes('apply_trims')) { log(run(effectsPython(), [gen], 'Re-running build-storyboard.py').stdout.trim()); }
  else {
    if (existsSync(gen)) log(`Note: build-storyboard.py does not call apply_trims (pipeline/trims.py), so re-running it would undo this trim. storyboard.json was moved directly.`);
    writeFileSync(sbFile, JSON.stringify(moveStoryboard(JSON.parse(readFileSync(sbFile, 'utf8')), move), null, 1) + '\n');
  }
  log(`Cut ${D.toFixed(2)} s -> ${after.toFixed(2)} s${gone ? `; ${gone} word(s) removed with the trim` : ''}.`);

  // 4. the finished video: the same stretches cut straight out of out/cut.mp4, in seconds. No re-make: the user asked
  //    for trims to be instant and for the full video to be made again only when they say so ("you shouldn't remake
  //    the full video until I tell you to", 2026-11-21). Graphics are pinned to words, so this matches a re-make except
  //    right at the cut (a sound or animation running across it is clipped there, not shifted).
  //    The footage the video is drawn from loses the same stretches, so it is never stale and sections can be patched at once.
  const footage = join(P, 'footage.mp4');
  if (existsSync(footage)) {
    const ft = join(P, '.trimmed-footage.mp4');
    run('ffmpeg', ['-v', 'error', '-y', '-i', footage, '-filter_complex', graph, '-map', '[v]', '-map', '[a]', '-r', String(fps), '-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', ft], 'Trimming the footage');
    renameSync(ft, footage);
    const ff = join(P, 'faces.json');
    if (existsSync(ff)) {
      const faces = JSON.parse(readFileSync(ff, 'utf8'));
      faces.track = (faces.track ?? []).filter(([t]) => !ranges.some(([x, y]) => t >= x && t < y)).map(([t, ...rest]) => [move(t), ...rest]);
      faces.duration = after; writeFileSync(ff, JSON.stringify(faces) + '\n');
    }
    copyFileSync(wf, join(P, 'words.json'));
    rmSync(join(E, '.footage-stale'), {force: true});
    log('Trimmed footage.mp4, faces.json and words.json to match.');
  } else writeFileSync(join(E, '.footage-stale'), `edit/clean.mp4 was trimmed ${new Date().toISOString()}; npm run make runs npm run footage first.\n`);
  const out = join(P, 'out'), cut = join(out, 'cut.mp4');
  if (existsSync(cut)) {
    let n = 1; while (existsSync(join(out, `cut-v${n}.mp4`))) n++;
    copyFileSync(cut, join(out, `cut-v${n}.mp4`)); log(`Kept the previous video as out/cut-v${n}.mp4.`);
    const fin = join(out, '.trimmed.mp4');
    run('ffmpeg', ['-v', 'error', '-y', '-i', cut, '-filter_complex', graph, '-map', '[v]', '-map', '[a]', '-r', String(fps), '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', fin], 'Trimming the video');
    renameSync(fin, cut); log(`Trimmed out/cut.mp4 (${after.toFixed(2)} s). The full re-make is not run: ask for it when you want one.`);
    rechunk(project, cut, move, ranges, JSON.parse(readFileSync(sbFile, 'utf8')), log);
  }
  moveNotes(project, log);
  moveHistory(project, move);
  if (make) {
    const r = spawnSync(process.execPath, [join(root, 'pipeline/make.mjs'), project, '--scale', '1'], {cwd: root, stdio: 'inherit'});
    if (r.status !== 0) throw Error('The make failed: see out/make.log.');
  }
  return {ranges, removed, before: D, after};
}

if (process.argv[1] === new URL(import.meta.url).pathname) try {
  const argv = process.argv.slice(2), project = argv[0], spec = argv[argv.indexOf('--cut') + 1];
  if (!/^[a-z0-9-]+$/.test(project || '') || !argv.includes('--cut') || !spec) throw Error('Usage: node pipeline/trim.mjs <project> --cut 3.20-3.45,12.0-12.2 [--make] [--round <n>]');
  let wanted = spec.split(',').map(p => p.split('-').map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite));
  // --round n: the times are on the timeline after n trims (a review page loaded before a later trim): move them on
  const roundAt = argv.indexOf('--round');
  if (roundAt >= 0) { const rounds = trimRounds(project); for (const r of rounds.slice(Number(argv[roundAt + 1]) || 0)) { const m = mover(r); wanted = wanted.map(([a, b]) => [m(a), m(b)]); } }
  const marker = join(root, 'projects', project, 'edit', '.trimming');
  writeFileSync(marker, JSON.stringify({pid: process.pid, started: new Date().toISOString()}) + '\n');
  process.on('exit', () => rmSync(marker, {force: true}));
  // sections being drawn or spliced in were made on the old timeline: let them land first (a Claude still editing is fine)
  let told = false;
  for (const deadline = Date.now() + 15 * 60e3; Date.now() < deadline;) {
    const drawing = Object.values(readJobs(project)).filter(j => ['rendering', 'queued', 'assembling'].includes(j.state));
    if (!drawing.length) break;
    if (!told) { console.log(`Waiting for ${drawing.map(j => j.section).join(', ')} to finish splicing in…`); told = true; }
    await new Promise(r => setTimeout(r, 1500));
  }
  await lockProject(project);
  trim(project, wanted, {make: argv.includes('--make')});
} catch (error) { console.error(error.message); process.exitCode = 1; }

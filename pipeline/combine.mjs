#!/usr/bin/env node
// Stage 3: combine the usable pieces into one video file.
//   node pipeline/combine.mjs <project> [--partial] [--all] [--scale 0.5] [--section <id|start-end>] [--no-cache] [--jobs 4]
// Steps the rough draft frame by frame in headless Chrome; then applies any storyboard effects and shader
// transitions and lays the narration (or, for footage, the clip's own audio and the sound effects) under it.
// Output: projects/<project>/out/cut.mp4
// Every shot must have a usable piece; the cut takes each shot's pick.
//   --partial  leave out shots that have no usable piece yet
//   --all      include every shot; one with no usable piece shows its first candidate that is not rejected
//   --scale    output size relative to the storyboard format (default 0.5 = 540x960, quick to make)
//   --section  make only one section (or a range in seconds) into out/sections/<id>.mp4, for a quick look; cut.mp4 is not touched
//   --no-cache draw every frame again and redo every pass, whatever is in projects/<project>/.cache
//   --jobs     how many browsers draw at once (default 4, or CONTENTSKILLS_JOBS)
// Drawing is the slow part, so drawn frames are kept (pipeline/cache.mjs): a re-make draws only what changed.
import {houseLufs, settings} from './settings.mjs';
import {spawn, spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {themePath} from '../library/_shared/themes.js';
import {cpus} from 'node:os';
import {fileURLToPath} from 'node:url';
import {DEFAULT_THEME, buildTimeline, effectPlan, transitionPlan, pickOf, buildFootageTimeline, zoomAt, panesAt} from './timeline.js';
import {sectionsOf, resolveRange, secs} from './sections.js';
import {root, problemsOf, readStoryboard, readVoice, readProjectJson, sfxDir} from './check.mjs';
import {effectsPython, browserBinary} from './tools.mjs';
import {openDraft} from './browser.mjs';
import {cacheDir, effectStamps, fileStamp, fingerprint, footageFrameKeys, frameStore, passStamp, prune, readStyle, sha, shotFrameKeys} from './cache.mjs';
import {requireApproval} from './approve.mjs';
import {lockProject} from './lock.mjs';
import {readManifest, writeManifest, remember, withRangeFrom} from './segments.mjs';

const run = (command, argv, what) => { if (spawnSync(command, argv, {stdio: 'inherit'}).status !== 0) throw Error(what + ' failed.'); };
const since = t0 => `${((performance.now() - t0) / 1000).toFixed(1)} s`;
const timed = (label, work) => { const t = performance.now(), result = work(); console.log(`${label[0].toUpperCase() + label.slice(1)}: ${since(t)}`); return result; };
const DEFAULT_JOBS = Math.max(1, Math.min(8, Number(process.env.CONTENTSKILLS_JOBS) || 4));
const COMPOSITORS = Math.max(1, Math.min(8, Number(process.env.CONTENTSKILLS_COMPOSITORS) || Math.max(2, cpus().length - 4)));      // compositing processes at once (each is one core of numpy plus an encoder)
const PAD = .5;      // a section preview starts this long before the section and runs this long after it, so the transitions at its edges are whole
/** Shader transitions: a pass over the finished picture (GPU, pipeline/transitions.py). Audio in `from` is carried over. */
function applyTransitions(plan, from, to, planFile) {
  writeFileSync(planFile, JSON.stringify(plan));
  try { run(effectsPython(), [join(root, 'pipeline/transitions.py'), from, to, planFile], 'The transitions pass'); } finally { rmSync(planFile, {force: true}); }
}
const checked = storyboard => { const problems = problemsOf(storyboard); if (problems.length) throw Error('Fix the storyboard first:\n' + problems.map(p => '  - ' + p).join('\n')); };

/**
 * Draw the frames that are not in the cache yet, several browsers at a time, and keep them.
 * @param wanted  frame numbers needed     @param keys  cache key of every frame     @param open  () -> a draft page
 * @param shoot   (draft, frame) -> {'': Buffer, '.u'?: Buffer}: the picture(s) of one frame     @param layers  frame -> the layer names it must have
 * @returns {drawn, reused}: frames drawn now, frames taken from the cache
 */
async function drawFrames({wanted, keys, store, open, shoot, layers = () => [''], noCache = false, jobs = DEFAULT_JOBS, quiet = false, total = wanted.length}) {
  const first = new Map();                                           // frames that share a key share a picture: draw it once
  for (const frame of wanted) if (!first.has(keys[frame])) first.set(keys[frame], frame);
  const todo = [...first.values()].filter(frame => noCache || !layers(frame).every(layer => store.has(keys[frame], layer)));
  const drafts = [], t0 = performance.now();
  let done = 0;
  try {
    if (todo.length) {
      const workers = Math.max(1, Math.min(jobs, Math.ceil(todo.length / 20))), share = Math.ceil(todo.length / workers);
      const report = () => { if (!quiet) process.stdout.write(`\r  drawing ${done}/${todo.length}`); };
      await Promise.all(Array.from({length: workers}, async (_, w) => {
        const mine = todo.slice(w * share, (w + 1) * share), draft = await open(); drafts.push(draft);
        for (const frame of mine) {
          const pictures = await shoot(draft, frame);
          for (const [layer, data] of Object.entries(pictures)) store.put(keys[frame], data, layer);
          if (++done % 10 === 0) report();
        }
      }));
      if (!quiet) process.stdout.write('\r' + ' '.repeat(40) + '\r');
    }
  } finally { await Promise.all(drafts.map(d => d.close())); }
  for (const frame of wanted) for (const layer of layers(frame)) store.touch(keys[frame], layer);
  const drawn = todo.length;
  if (!quiet) console.log(`Graphics: drew ${drawn} of ${total} frames (${total - drawn} reused)${todo.length ? ` in ${since(t0)}` : ''}`);
  return {drawn, reused: total - drawn};
}

/**
 * First pass for footage projects: screenshot only the graphics captions must avoid, 5 times a second at a small size,
 * and map where they are drawn (out/occupancy.json). The draft reads it so captions keep clear of them (library/_shared/placement.js).
 * Reused until the storyboard, the face track or the words change.
 */
export async function mapOccupancy(project, timeline, outDir) {
  // One scratch folder per run: patches draw side by side and a make may run at the same time (each removed the
  // others' frames when they shared out/.occupancy: "ENOENT … .occupancy/00176.png"). The map is written to a temp file
  // and renamed, so a reader never sees half of it.
  const {width, height} = timeline.format, shots = join(outDir, `.occupancy-${process.pid}`), rate = 5, map = join(outDir, 'occupancy.json'), dir = join(outDir, '..');
  if (existsSync(map) && ['storyboard.json', 'faces.json', 'words.json'].every(f => !existsSync(join(dir, f)) || statSync(join(dir, f)).mtimeMs < statSync(map).mtimeMs)) return;
  mkdirSync(outDir, {recursive: true}); rmSync(shots, {recursive: true, force: true}); mkdirSync(shots, {recursive: true});
  let draft;
  try {
    draft = await openDraft(project, {width, height, scale: .2, transparent: true});
    await draft.evaluate('window.draft.occupancyMode(true)');
    for (let i = 0; i / rate < timeline.duration; i++) {
      await draft.evaluate(`window.draft.seek(${i / rate})`);
      writeFileSync(join(shots, String(i).padStart(5, '0') + '.png'), await draft.screenshot());
    }
  } finally { await draft?.close(); }
  const part = `${map}.${process.pid}.tmp`;
  try { run(effectsPython(), [join(root, 'pipeline/occupancy.py'), shots, part, String(rate), String(width), String(height)], 'Mapping the graphics'); renameSync(part, map); }
  finally { rmSync(shots, {recursive: true, force: true}); rmSync(part, {force: true}); }
}

/**
 * Footage projects: render the graphics with a transparent background, then composite them over the clip.
 * The picture is made in half-second chunks, each kept in the cache under a key of everything its frames are made from,
 * so only the chunks that changed are drawn and composited again; the chunks are then joined with the clip's audio,
 * and the transitions and sound-effects passes run over the joined video.
 */
export async function combineFootage(project, storyboard, scale, {only = null, section = null, patch = null, noCache = false, jobs = DEFAULT_JOBS} = {}) {
  if (!only && !section) requireApproval(project);   // a full render writes out/cut.mp4: only from an approved storyboard
  checked(storyboard);
  const themeDir = theme => join(root, 'library', themePath(theme ?? storyboard.theme ?? DEFAULT_THEME));
  const dir = join(root, 'projects', project), outDir = join(dir, 'out'), output = join(outDir, 'cut.mp4');
  const words = readProjectJson(project, 'words.json')?.words ?? [], faces = readProjectJson(project, 'faces.json');
  const timeline = buildFootageTimeline(storyboard, words, faces), {width, height, fps} = timeline.format, frames = Math.floor(timeline.duration * fps);
  const W = Math.round(width * scale), H = Math.round(height * scale), store = frameStore(project, W, H, 'png'), t0 = performance.now();
  const edl = storyboard.overlays?.some(o => o.props?.use === 'project') ? readProjectJson(project, 'edit/edl.json') : null;      // as pipeline/draft/footage.js does
  if (storyboard.captions && storyboard.captionPlacement !== 'fixed') {
    // a patch runs beside other patches: the caption map is shared scratch, so it is made under the project's render lock
    const release = patch ? await lockProject(project) : null;
    try { await mapOccupancy(project, timeline, outDir); } finally { release?.(); }
  }      // where captions must not go; part of the frame keys
  const {keys, under, person} = await footageFrameKeys(project, storyboard, timeline, {scale, frames, words: timeline.words, edl, browser: browserBinary()});
  mkdirSync(outDir, {recursive: true});

  const round = n => Math.round(n * 1000) / 1000;
  // With "layouts", the clip's windows for every frame (null where it simply fills the frame).
  const layout = timeline.layouts ? Array.from({length: frames}, (_, i) => { const {panes, backdrop, full, zoom} = panesAt(storyboard, timeline.track, i / fps, timeline.format); return full && zoom.scale <= 1.001 ? null : {backdrop, full, panes: panes.map(p => ({x: round(p.x), y: round(p.y), width: round(p.width), height: round(p.height), rotate: round(p.rotate), radius: round(p.radius), shadow: round(p.shadow), border: round(p.border), k: round(p.k), raw: p.raw, m: p.m.map(v => Math.round(v * 1e5) / 1e5)}))}; }) : null;
  const accents = [...new Set(timeline.events.map(e => e.theme).filter(Boolean))].map(themeDir), footage = join(dir, storyboard.footage.file);
  const plan = {themeDir: themeDir(), accentThemeDirs: accents, fps, frames, width: W, height: H, formatWidth: width, footage,
    // a style's grade ("style" in the storyboard, library/_shared/style.js) takes the place of the theme's look
    look: readStyle(storyboard)?.grade ? {name: 'style_grade', amount: 1, props: readStyle(storyboard).grade} : storyboard.footage.look ?? null, events: timeline.events, layout, zoom: Array.from({length: frames}, (_, i) => { const z = zoomAt(storyboard, timeline.track, i / fps); return [z.scale, z.cx, z.cy]; })};
  const draw = (wanted, total = wanted.length) => drawFrames({wanted, keys, store, noCache, jobs, quiet: Boolean(only), total, layers: frame => ['', ...(under[frame] ? ['.u'] : []), ...(person[frame] ? ['.p'] : [])], open: () => openDraft(project, {width, height, scale, transparent: true}),
    shoot: async (draft, frame) => {
      await draft.evaluate(`window.draft.seek(${frame / fps})`);
      if (!under[frame] && !person[frame]) return {'': await draft.screenshot()};
      const pictures = {};
      // graphics marked "behind" go under the clip's windows: a second picture for this frame
      if (under[frame]) { await draft.evaluate(`window.draft.layer('under')`); pictures['.u'] = await draft.screenshot(); }
      // graphics marked "behind": "person" go over the clip but under the person (pipeline/composite.py masks them): a third picture
      if (person[frame]) { await draft.evaluate(`window.draft.layer('person')`); pictures['.p'] = await draft.screenshot(); }
      await draft.evaluate(`window.draft.layer(${under[frame] ? "'over'" : "'top'"})`); pictures[''] = await draft.screenshot();
      await draft.evaluate(`window.draft.layer('both')`);
      return pictures;
    }});
  const layersFor = wanted => { const need = new Set(wanted); return {layers: keys.map((key, frame) => need.has(frame) ? store.path(key) : null), under: keys.map((key, frame) => need.has(frame) && under[frame] ? store.path(key, '.u') : null), person: keys.map((key, frame) => need.has(frame) && person[frame] ? store.path(key, '.p') : null)}; };
  const planFile = extra => { const file = join(outDir, `.composite-${process.pid}-${extra.n ?? 0}.json`); writeFileSync(file, JSON.stringify({...plan, ...extra})); return file; };

  if (only) {            // stills for review (pipeline/frames.mjs): the composited picture of single frames, before transitions
    const counts = await draw(only), stills = join(outDir, 'frames'), file = planFile({...layersFor(only), only}); mkdirSync(stills, {recursive: true});
    try { run(effectsPython(), [join(root, 'pipeline/composite.py'), file, stills], 'Compositing'); } finally { rmSync(file, {force: true}); }
    return {output: stills, frames: only, ...counts};
  }

  // The chunks: what each is made from, frame by frame. A frame's picture depends on its number (the clip's own frame, and the
  // grain of effects), its graphics, where the clip's windows are, and the look and effects on it at that moment.
  const SIZE = Math.max(1, Math.round(fps / 2)), chunkStore = frameStore(project, W, H, 'mp4', 'chunks');
  // Each chunk is keyed on the code of the effects actually on it (pipeline/effect_stamps.py), not the whole effects files,
  // so editing one effect re-makes only the chunks that effect is on. Without the per-effect fingerprints: the whole files.
  const fx = effectStamps(project, [themeDir(), ...accents], effectsPython()), fxStamp = name => fx ? fx.effects[name] ?? fx.builtin : null;
  const engine = fx ? sha([W, H, fps, width, footage, fileStamp(footage), plan.look, plan.look && fxStamp(plan.look.name), fx.base, accents])
    : sha([W, H, fps, width, footage, fileStamp(footage), plan.look, passStamp(['pipeline/composite.py', 'library/_shared/effects_engine.py', 'library/_shared/lighting.py', 'library/_shared/signature.py', 'library/_shared/signature_kit.py'], [themeDir(), ...accents]), accents]);
  const chunks = Array.from({length: Math.ceil(frames / SIZE)}, (_, n) => {
    const first = n * SIZE, end = Math.min(frames, first + SIZE), made = [];
    for (let i = first; i < end; i++) made.push([i, keys[i], under[i], layout ? layout[i] : plan.zoom[i], timeline.events.filter(e => e.start <= i && i < e.end).map(e => [e, fxStamp(e.effect)])]);
    const key = sha([engine, made]);
    return {n, first, end, key, file: chunkStore.path(key)};
  });
  const range = section ? resolveRange(sectionsOf(storyboard, {words}), section, timeline.duration) : null;
  // A section preview is made of whole chunks: the section with PAD either side, widened to the chunks it touches.
  const mine = range ? chunks.filter(c => c.end > (range.start - PAD) * fps + 1e-6 && c.first < (range.end + PAD) * fps - 1e-6) : chunks, from = mine[0].first, to = mine.at(-1).end, count = to - from;
  const passes = join(cacheDir(project), 'passes', `${W}x${H}`), stampOf = name => { try { return JSON.parse(readFileSync(join(passes, name + '.json'), 'utf8')); } catch { return {}; } };
  const cuts = {fps, cuts: timeline.cuts.map(c => c.theme ? {...c, themeDir: themeDir(c.theme)} : c), themeDir: themeDir()}, cutThemes = [themeDir(), ...new Set(timeline.cuts.map(c => c.theme).filter(Boolean).map(themeDir))];
  const joinedStamp = sha([chunks.map(c => c.key), fileStamp(footage)]);
  const transitionStamp = sha([joinedStamp, cuts, passStamp(['pipeline/transitions.py', 'library/_shared/shader_transitions.py'], cutThemes)]);
  const voiceLufs = timeline.voiceLufs ?? houseLufs();   // house mix: the voice at the user's level (settings audio.voiceLufs), always the loudest thing (pipeline/sounds.py)
  // everything the mixer is given, and nothing else: the stamp below hashes this same object, so a field added to the mix
  // (music, voiceEq, ...) can never be left out of the "nothing changed" test
  const mixPlan = {sfxDir: sfxDir(), sounds: timeline.sounds, ...(timeline.music ? {music: {...timeline.music, dir: join(root, 'library/_shared/music')}} : {}), voiceLufs, voiceEq: timeline.voiceEq ?? null, ...(timeline.voiceGains?.length ? {voiceGains: timeline.voiceGains} : {})};
  const soundStamp = sha([transitionStamp, {...mixPlan, sfxDir: null, music: mixPlan.music && {...mixPlan.music, dir: null}}, fingerprint(['library/_shared/sfx', 'library/_shared/music', 'pipeline/sounds.py']), settings().audio ?? null]);   // the mixer reads settings audio.* itself (ducking, peak ceiling, default levels): part of the key
  if (!range && !noCache && !patch) {
    const last = stampOf('final'); let stat = null; try { stat = statSync(output); } catch {}
    if (stat && last.stamp === soundStamp && last.size === stat.size && last.mtimeMs === Math.round(stat.mtimeMs)) {
      console.log(`Nothing changed since projects/${project}/out/cut.mp4 was made: drew 0 of ${frames} frames (${frames} reused), every pass skipped. (--no-cache makes it again from scratch.)`);
      return {output, shots: 1, total: 1, unreviewed: [], drawn: 0, reused: frames, upToDate: true};
    }
  }

  if (!patch) console.log(`${range ? `Section ${range.id} (${secs(range.start)}–${secs(range.end)} s; shown from ${secs(from / fps)} to ${secs(to / fps)} s)` : 'Rendering'} · ${(count / fps).toFixed(1)}s · ${count} frames at ${W}x${H}`);
  // 1. Draw the graphics of the chunks that have to be made, 2. composite those chunks, several at a time.
  /** Draw and composite the chunks of `list` that are not in the cache yet. */
  const makeChunks = async list => {
    const todo = list.filter(c => noCache || !chunkStore.has(c.key)), wanted = todo.flatMap(c => Array.from({length: c.end - c.first}, (_, i) => c.first + i));
    const counts = await draw(wanted, list.reduce((n, c) => n + c.end - c.first, 0));
    if (todo.length) {
      const t = performance.now(), workers = Math.min(COMPOSITORS, todo.length), share = Math.ceil(todo.length / workers), layers = layersFor(wanted);
      const files = Array.from({length: workers}, (_, n) => planFile({...layers, n, chunks: todo.slice(n * share, (n + 1) * share).map(c => ({first: c.first, end: c.end, file: c.file}))}));
      try {
        const codes = await Promise.all(files.map(file => new Promise(done => spawn(effectsPython(), [join(root, 'pipeline/composite.py'), file], {stdio: 'inherit'}).on('exit', done).on('error', () => done(1)))));
        if (codes.some(code => code !== 0)) throw Error('Compositing failed.');
      } finally { for (const file of files) rmSync(file, {force: true}); }
      console.log(`Compositing: made ${todo.length} of ${list.length} half-second chunks (${list.length - todo.length} reused) in ${since(t)}`);
    } else console.log(`Compositing: made 0 of ${list.length} half-second chunks (${list.length} reused)`);
    for (const c of list) chunkStore.touch(c.key);
    return {...counts, made: todo.length};
  };
  const {made: madeChunks, ...counts} = patch ? {made: 0} : await makeChunks(mine);
  /** Join chunks into one video with the matching stretch of the clip's own audio (copied, not encoded again, so its loudness and peaks stay as prepared). Every frame is kept; the audio stops with the picture. */
  const joinChunks = (list, target, audio = []) => {
    const listFile = `${target}.txt`; writeFileSync(listFile, list.map(c => `file '${c.file.replaceAll("'", "'\\''")}'\n`).join(''));
    try { run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, ...audio, '-i', footage, '-map', '0:v', '-map', '1:a?', '-c', 'copy', '-t', (list.reduce((n, c) => n + c.end - c.first, 0) / fps).toFixed(6), '-movflags', '+faststart', target], 'Joining the chunks'); } finally { rmSync(listFile, {force: true}); }
  };

  /**
   * Patch: re-make one section and splice it into out/cut.mp4, keeping every other part of the video exactly as it is
   * (its chunks, transitions and sound effects come from the record of how cut.mp4 was made, out/cut.mp4's manifest), so
   * other sections being edited at the same time do not leak in. Drawing runs beside other patches; only the splice (join,
   * transitions, sound) takes the project's render lock, for about half a minute.
   */
  async function patchSection() {
    const range = resolveRange(sectionsOf(storyboard, {words}), patch.section, timeline.duration);
    const fa = Math.round(range.start * fps), fb = Math.round(range.end * fps), own = chunks.filter(c => c.end > fa && c.first < fb);
    const inRange = (frame, a = fa, b = fb) => frame >= a && frame < b;
    patch.onState?.('rendering');
    console.log(`Patching section ${range.id} (${secs(range.start)}–${secs(range.end)} s) · ${own.length} half-second chunks at ${W}x${H}`);
    const counts = await makeChunks(own);
    patch.onState?.('queued');
    const release = await lockProject(project);
    try {
      patch.onState?.('assembling');
      const t = performance.now(), manifest = readManifest(project);
      if (!manifest || manifest.frames !== frames || manifest.size?.[0] !== W || manifest.size?.[1] !== H || manifest.chunks?.length !== chunks.length)
        throw Error(`out/cut.mp4 has no matching record of how it was made (out/cut.manifest.json, written by every full make at this size). Run \`npm run make ${project}\` once; after that, sections can be patched.`);
      const mineSet = new Set(own.map(c => c.n));
      const list = chunks.map(c => mineSet.has(c.n) ? c : {...c, key: manifest.chunks[c.n], file: chunkStore.path(manifest.chunks[c.n])});
      const gone = list.filter(c => !existsSync(c.file));
      if (gone.length) throw Error(`${gone.length} chunk(s) of the current video are no longer in the cache. Run \`npm run make ${project}\` once, then patch again.`);
      const ta = fa / fps, tb = fb / fps;
      const cutsNow = [...manifest.cuts.filter(c => !inRange(c.frame)), ...cuts.cuts.filter(c => inRange(c.frame))].sort((x, y) => x.frame - y.frame);
      const soundsNow = [...manifest.sounds.filter(x => !(x.at >= ta && x.at < tb)), ...timeline.sounds.filter(x => x.at >= ta && x.at < tb)].sort((x, y) => x.at - y.at);
      // voice boosts ("voiceGains") belong to the section their start falls in, like sounds: other sections keep the ones they were made with
      // (by the section's own start and end, not its frame-rounded ones: a gain starting on the section's start is its own)
      const ownGain = g => g.start >= range.start - .5 / fps && g.start < range.end - .5 / fps;
      const gainsNow = [...(manifest.voiceGains ?? []).filter(g => !ownGain(g)), ...(timeline.voiceGains ?? []).filter(ownGain)].sort((x, y) => x.start - y.start);
      const work = n => join(outDir, `.patch-${range.id}-${process.pid}-${n}.mp4`), scratch = [work(1)];
      try {
        joinChunks(list, work(1)); let picture = work(1);
        if (cutsNow.length) { scratch.push(work(2)); applyTransitions({...cuts, cuts: cutsNow}, picture, work(2), join(outDir, `.patch-${range.id}-${process.pid}-transitions.json`)); picture = work(2); }
        const fresh = work(3); scratch.push(fresh);
        if (soundsNow.length || mixPlan.music || voiceLufs !== null) {
          const soundPlan = join(outDir, `.patch-${range.id}-${process.pid}-sounds.json`);
          writeFileSync(soundPlan, JSON.stringify({...mixPlan, sounds: soundsNow, voiceGains: gainsNow, report: join(outDir, 'sound-report.json')}));
          try { run(effectsPython(), [join(root, 'pipeline/sounds.py'), picture, fresh, soundPlan], 'The sound-effects mix'); } finally { rmSync(soundPlan, {force: true}); }
        } else copyFileSync(picture, fresh);
        const entry = remember(project, {section: range.id, start: range.start, end: range.end, label: patch.label});
        renameSync(fresh, output);
        writeManifest(project, {fps, frames, size: [W, H], chunks: list.map(c => c.key), cuts: cutsNow, sounds: soundsNow, voiceGains: gainsNow,
          storyboard: withRangeFrom(manifest.storyboard ?? storyboard, storyboard, range), made: new Date().toISOString()});
        rmSync(join(passes, 'final.json'), {force: true});      // the next full make must not think cut.mp4 is still its own
        console.log(`Spliced section ${range.id} into projects/${project}/out/cut.mp4 in ${since(t)} (total ${since(t0)})${entry ? `. Undo: npm run undo ${project} ${entry.id}` : ''}`);
        patch.onState?.('done');
        return {output, shots: 1, total: 1, unreviewed: [], ...counts, history: entry?.id ?? null};
      } finally { for (const file of scratch) rmSync(file, {force: true}); }
    } finally { release(); }
  }

  if (patch) return patchSection();
  if (range) {           // a quick look at one section: its own small file, with the clip's audio and the sound effects in that stretch
    const folder = join(outDir, 'sections'), target = join(folder, range.id + '.mp4'), tmp = n => join(folder, `.${range.id}-${process.pid}-${n}.mp4`);
    mkdirSync(folder, {recursive: true});
    let picture = tmp(1); const scratch = [picture];
    try {
      joinChunks(mine, picture, ['-ss', (from / fps).toFixed(6), '-t', (count / fps).toFixed(6)]);
      const inside = cuts.cuts.map(c => ({...c, frame: c.frame - from})).filter(c => c.frame > 0 && c.frame < count);
      if (inside.length) { const next = tmp(2); scratch.push(next); timed('transitions', () => applyTransitions({...cuts, cuts: inside}, picture, next, join(folder, `.${range.id}-${process.pid}-transitions.json`))); picture = next; }
      const sounds = timeline.sounds.map(s => ({...s, at: round(s.at - from / fps)})).filter(s => s.at > -3 && s.at < count / fps);      // one that began just before the range is heard from where the range starts
      if (sounds.length || voiceLufs !== null) {
        const next = tmp(3), soundPlan = join(folder, `.${range.id}-${process.pid}-sounds.json`); scratch.push(next);
        const voiceGains = (timeline.voiceGains ?? []).map(g => ({...g, start: g.start - from / fps, end: g.end - from / fps})).filter(g => g.end > 0);
        writeFileSync(soundPlan, JSON.stringify({sfxDir: sfxDir(), sounds, voiceLufs, voiceEq: timeline.voiceEq ?? null, voiceGains}));
        try { timed('sound effects', () => run(effectsPython(), [join(root, 'pipeline/sounds.py'), picture, next, soundPlan], 'The sound-effects mix')); } finally { rmSync(soundPlan, {force: true}); }
        picture = next;
      }
      renameSync(picture, target);
    } finally { for (const file of scratch) rmSync(file, {force: true}); }
    console.log(`Wrote projects/${project}/out/sections/${range.id}.mp4 · ${(count / fps).toFixed(1)}s (${secs(from / fps)}–${secs(to / fps)} s of the video) in ${since(t0)}. out/cut.mp4 was not touched.`);
    return {output: target, shots: 1, total: 1, unreviewed: [], ...counts};
  }

  // The whole video. The joined picture and the transitions pass keep their result in .cache/passes/, with a stamp of what it was made from.
  mkdirSync(passes, {recursive: true});
  const pass = (name, stamp, label, make) => {
    const file = join(passes, name + '.mp4');
    if (!noCache && stampOf(name).stamp === stamp && existsSync(file)) { console.log(`${label}: nothing it depends on changed, reused`); return file; }
    const t = performance.now(), tmp = join(passes, `.${name}-${process.pid}.mp4`);
    rmSync(join(passes, name + '.json'), {force: true});
    try { make(tmp); renameSync(tmp, file); } finally { rmSync(tmp, {force: true}); }
    writeFileSync(join(passes, name + '.json'), JSON.stringify({stamp, made: new Date().toISOString()}) + '\n');
    console.log(`${label}: ${since(t)}`);
    return file;
  };
  let picture = pass('joined', joinedStamp, 'Joining the chunks', tmp => joinChunks(chunks, tmp));
  if (timeline.cuts.length) picture = pass('transitioned', transitionStamp, 'Transitions', tmp => applyTransitions(cuts, picture, tmp, join(passes, `.transitions-${process.pid}.json`)));
  let mixed = '';
  const fresh = join(outDir, `.cut-${process.pid}.mp4`);
  try {
    // the storyboard's "music" bed ({name, gain?, duck?, start?}) rides under the voice, like on a shot video
    if (timeline.sounds.length || mixPlan.music || voiceLufs !== null) {   // the voice to the house level, then timed effects (and the music bed) laid under it (pipeline/sounds.py)
      const t = performance.now(), soundPlan = join(outDir, `.sounds-${process.pid}.json`), report = join(outDir, 'sound-report.json');
      writeFileSync(soundPlan, JSON.stringify({...mixPlan, report}));
      try { run(effectsPython(), [join(root, 'pipeline/sounds.py'), picture, fresh, soundPlan], 'The sound-effects mix'); } finally { rmSync(soundPlan, {force: true}); }
      mixed = ` · ${timeline.sounds.length} sound effect(s)`; console.log(`Sound effects: ${since(t)}`);
    } else copyFileSync(picture, fresh);
    renameSync(fresh, output);
  } finally { rmSync(fresh, {force: true}); }
  const stat = statSync(output);
  writeFileSync(join(passes, 'final.json'), JSON.stringify({stamp: soundStamp, size: stat.size, mtimeMs: Math.round(stat.mtimeMs), made: new Date().toISOString()}) + '\n');
  // what out/cut.mp4 is made of, chunk by chunk: a patch (npm run patch) replaces one section of it and keeps the rest exactly
  writeManifest(project, {fps, frames, size: [W, H], chunks: chunks.map(c => c.key), cuts: cuts.cuts, sounds: timeline.sounds, voiceGains: timeline.voiceGains ?? [], storyboard, made: new Date().toISOString()});
  prune(project, new Set([...keys.flatMap((key, i) => [store.path(key), under[i] && store.path(key, '.u'), person[i] && store.path(key, '.p')]), ...chunks.map(c => c.file)].filter(Boolean)));
  console.log(`Wrote projects/${project}/out/cut.mp4 · ${timeline.overlays.length} graphics · ${timeline.events.length} effect(s) · ${timeline.cuts.length} transition(s)${mixed} · original ${mixed ? 'voice' : 'audio'} · ${since(t0)}`);
  return {output, shots: 1, total: 1, unreviewed: [], ...counts, chunks: {made: madeChunks, total: chunks.length}};
}

/** @returns {output, shots, total, unreviewed: [shot ids shown without a usable piece]} */
export async function combine(project, {all = false, partial = false, scale = .5, section = null, noCache = false, jobs = DEFAULT_JOBS} = {}) {
  if (!section) requireApproval(project);      // out/cut.mp4 only from a storyboard the user approved (pipeline/approve.mjs)
  const storyboard = readStoryboard(project);
  if (storyboard.footage) return combineFootage(project, storyboard, scale, {section, noCache, jobs});
  checked(storyboard);
  const timeline = buildTimeline(storyboard, all ? 'all' : 'usable', readVoice(project));
  const missing = storyboard.shots.filter(shot => pickOf(shot) < 0).map(shot => shot.id);
  if (missing.length && !all && !partial) throw Error(`No usable piece yet for: ${missing.join(', ')}.\nReview those shots (npm run stills ${project}), or pass --partial to leave them out, or --all to use their first candidate.`);
  if (!timeline.shots.length) throw Error('No shot has a usable piece yet. Review the candidates first, or pass --all.');
  const {width, height, fps} = timeline.format, total = Math.ceil(timeline.duration * fps), W = Math.round(width * scale), H = Math.round(height * scale);
  const outDir = join(root, 'projects', project, 'out'), scratch = [], t0 = performance.now();
  // A section of a shot storyboard is always whole shots (a range in seconds grows to the shots it touches), so narration and effects stay intact.
  const range = section ? resolveRange(sectionsOf(storyboard, {timeline}), section, timeline.duration) : null;
  const shots = range ? timeline.shots.filter(shot => shot.start < range.end - 1e-6 && shot.end > range.start + 1e-6) : timeline.shots;
  const from = range ? Math.round(shots[0].start * fps) : 0, to = range ? Math.min(total, Math.round(shots.at(-1).end * fps)) : total, frames = to - from;
  const output = range ? join(outDir, 'sections', range.id + '.mp4') : join(outDir, 'cut.mp4'), tag = `${range ? range.id + '-' : ''}${process.pid}`;
  mkdirSync(range ? join(outDir, 'sections') : outDir, {recursive: true});
  const store = frameStore(project, W, H, 'jpg'), {keys} = await shotFrameKeys(project, storyboard, timeline, {scale, frames: total, browser: browserBinary()});
  const wanted = Array.from({length: frames}, (_, i) => from + i);
  try {
    console.log(`${range ? `Section ${range.id}: ` : ''}Combining ${shots.length} of ${storyboard.shots.length} shots · ${(frames / fps).toFixed(1)}s · ${frames} frames at ${W}x${H}`);
    const counts = await drawFrames({wanted, keys, store, noCache, jobs, open: () => openDraft(project, {width, height, scale, cut: all ? 'all' : 'usable'}),
      shoot: async (draft, frame) => { await draft.evaluate(`window.draft.seek(${frame / fps})`); return {'': await draft.screenshot()}; }});
    let picture = join(outDir, `.picture-${tag}.mp4`); scratch.push(picture);
    const ffmpeg = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', picture], {stdio: ['pipe', 'inherit', 'inherit']});
    const encoded = new Promise((ok, bad) => ffmpeg.on('exit', code => code === 0 ? ok() : bad(Error('FFmpeg failed with code ' + code))));
    for (const frame of wanted) if (!ffmpeg.stdin.write(readFileSync(store.path(keys[frame])))) await new Promise(r => ffmpeg.stdin.once('drain', r));
    ffmpeg.stdin.end(); await encoded;

    // Effects: a second pass over the picture, touching only each shot's visual region.
    const plan = effectPlan(timeline, scale), events = plan.events.filter(e => e.end > from && e.start < to);
    if (events.length) {
      const planFile = join(outDir, `.effects-${tag}.json`), treated = join(outDir, `.treated-${tag}.mp4`); scratch.push(planFile, treated);
      writeFileSync(planFile, JSON.stringify({...plan, events, first: from, themeDir: join(root, 'library', themePath(storyboard.theme ?? DEFAULT_THEME))}));
      run(effectsPython(), [join(root, 'pipeline/effects.py'), picture, treated, planFile], 'The effects pass');
      picture = treated;
    }

    // Transitions: a third pass, across the cuts, over the whole frame.
    const cuts = transitionPlan(timeline), inside = cuts.cuts.map(c => ({...c, frame: c.frame - from, ...(c.theme ? {themeDir: join(root, 'library', themePath(c.theme))} : {})})).filter(c => c.frame > 0 && c.frame < frames);   // a borrowed transition draws in its own theme's colours
    if (inside.length) {
      const blended = join(outDir, `.blended-${tag}.mp4`); scratch.push(blended);
      applyTransitions({...cuts, cuts: inside, themeDir: join(root, 'library', themePath(storyboard.theme ?? DEFAULT_THEME))}, picture, blended, join(outDir, `.transitions-${tag}.json`));
      picture = blended;
    }

    // Narration: each shot's recording starts where the timeline says it does.
    const voiced = shots.filter(shot => shot.audio);
    if (voiced.length) {
      const inputs = voiced.flatMap(shot => ['-i', join(root, 'projects', project, 'voice', shot.audio.file)]);
      const delays = voiced.map((shot, i) => `[${i + 1}:a]adelay=${Math.max(0, Math.round((shot.audio.at - from / fps) * 1000))}:all=1[a${i}]`).join(';');
      const mix = `${delays};${voiced.map((_, i) => `[a${i}]`).join('')}amix=inputs=${voiced.length}:normalize=0[voice]`;
      const voicedFile = join(outDir, `.voiced-${tag}.mp4`); scratch.push(voicedFile);
      run('ffmpeg', ['-v', 'error', '-y', '-i', picture, ...inputs, '-filter_complex', mix, '-map', '0:v', '-map', '[voice]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', String(frames / fps), '-movflags', '+faststart', voicedFile], 'Adding the narration');
      picture = voicedFile;
    }
    // Sound effects (shot "sounds" and the storyboard's own), laid under the narration without touching it (pipeline/sounds.py).
    const sounds = (timeline.sounds ?? []).map(s => ({...s, at: +(s.at - from / fps).toFixed(3)})).filter(s => s.at > -.5 && s.at < frames / fps);
    // the storyboard's "music" bed ({name, gain?, duck?, start?}) rides on the same mix, from the section's start
    const music = timeline.music ? {...timeline.music, dir: join(root, 'library/_shared/music'), offset: +(from / fps).toFixed(3)} : null;
    // the voice is normalised to the storyboard's voiceLufs (default: settings audio.voiceLufs) in the same pass
    const voiceLufs = timeline.voiceLufs ?? houseLufs();
    if (sounds.length || music || voiceLufs !== null) {
      const mixedFile = join(outDir, `.sfx-${tag}.mp4`), soundPlan = join(outDir, `.sounds-${tag}.json`); scratch.push(mixedFile);
      writeFileSync(soundPlan, JSON.stringify({sfxDir: sfxDir(), sounds, ...(music ? {music} : {}), ...(voiceLufs !== null ? {voiceLufs} : {}), voiceEq: timeline.voiceEq ?? null, ...(range ? {} : {report: join(outDir, 'sound-report.json')})}));
      try { run(effectsPython(), [join(root, 'pipeline/sounds.py'), picture, mixedFile, soundPlan], 'The sound-effects mix'); } finally { rmSync(soundPlan, {force: true}); }
      picture = mixedFile;
    }
    renameSync(picture, output);
    if (!range) prune(project, new Set(keys.map(key => store.path(key))));
    const silent = shots.length - voiced.length, where = range ? `sections/${range.id}.mp4` : 'cut.mp4';
    console.log(`Wrote projects/${project}/out/${where} · ${events.length} effect(s) · ${inside.length} transition(s) · ${voiced.length ? `narration on ${voiced.length} shot(s)` : 'no narration yet (npm run voice ' + project + ')'}${voiced.length && silent ? `, ${silent} silent` : ''} · ${since(t0)}${range ? '. out/cut.mp4 was not touched.' : ''}`);
    return {output, shots: timeline.shots.length, total: storyboard.shots.length, unreviewed: all ? missing : [], ...counts};
  } finally {
    for (const file of scratch) rmSync(file, {force: true});
  }
}

/** Command-line options shared with make.mjs: {project, scale, section, noCache, jobs, all, partial}. */
export function options(args) {
  const valued = ['--scale', '--section', '--jobs'], value = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  if (args.includes('--section') && !value('--section')) throw Error('--section needs a section id (npm run check <project> lists them) or a range in seconds, e.g. --section 18.2-20.4');
  return {project: args.find((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1])), scale: Number(value('--scale')) || .5, section: value('--section') ?? null,
    noCache: args.includes('--no-cache'), jobs: Math.max(1, Math.min(8, Number(value('--jobs')) || DEFAULT_JOBS)), all: args.includes('--all'), partial: args.includes('--partial')};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { const {project, ...rest} = options(process.argv.slice(2)); if (project) await (await import('./lock.mjs')).lockProject(project); await combine(project, rest); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

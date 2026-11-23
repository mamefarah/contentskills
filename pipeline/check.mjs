#!/usr/bin/env node
// Stage 1 check: does this storyboard only use pieces that exist, and how long will it run?
//   node pipeline/check.mjs <project>
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {themePath, COMMON} from '../library/_shared/themes.js';
import {SAFE} from '../library/_shared/placement.js';
import {houseLufs} from './settings.mjs';
import {describe, buildTimeline, buildFootageTimeline, checkStoryboard, checkFootageStoryboard, pickOf, soundCues, DEFAULT_THEME, LAYOUT_PRESETS} from './timeline.js';
import {checkSections, sectionsOf, secs} from './sections.js';

export const root = fileURLToPath(new URL('..', import.meta.url));

/** Every catalog a theme can use: its own folders, then the shared pieces every theme wears (library/_shared/common). */
function catalogFiles(theme) {
  const out = [];
  for (const dir of [join(root, 'library', themePath(theme)), join(root, 'library', COMMON)]) {
    for (const category of existsSync(dir) ? readdirSync(dir) : []) {
      const file = join(dir, category, 'catalog.json');
      if (existsSync(file)) out.push({category, file});
    }
  }
  return out;
}

/** Everything a storyboard may reference, read from the library catalogs. */
export function readLibrary(theme = DEFAULT_THEME) {
  const pieces = new Set(), captions = new Set(), effects = new Set(), transitions = new Set(), dir = join(root, 'library', themePath(theme));
  if (!existsSync(dir)) throw Error(`No such theme "${theme}". Themes: ${readdirSync(join(root, 'library', 'themes')).filter(n => !n.includes('.')).join(', ')}`);
  for (const {category, file} of catalogFiles(theme)) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    for (const item of [...data.items, ...(data.retired ?? [])]) {      // retired: off the menu for new storyboards, still valid in old ones
      if (item.piece) pieces.add(item.piece);
      if (category === 'captions') captions.add(item.id);
      // Effects that change one frame at a time; the time-bending ones and the footage demos are not wired in.
      if (category === 'effects' && !['Time', 'On footage'].includes(item.group)) effects.add(item.id);
      if (category === 'transitions') transitions.add(item.id);      // shader transitions; a theme may have none
    }
  }
  // Moments (gta6_poster, reel_flythrough, …) are effects shared by every theme, with their own catalog.
  const moments = join(root, 'library', '_shared', 'signature', 'catalog.json');
  if (existsSync(moments)) for (const item of JSON.parse(readFileSync(moments, 'utf8')).items) effects.add(item.id);
  return {pieces, captions, effects, transitions};
}

const libraries = {};
/** readLibrary, remembered per theme (a storyboard may borrow single pieces from a second theme). */
export const libraryOf = theme => libraries[theme] ??= readLibrary(theme);
export const sfxDir = () => join(root, 'library', '_shared', 'sfx');
/** Names of the sound effects in library/_shared/sfx (empty if they have not been generated). */
function readSounds() {
  const file = join(sfxDir(), 'catalog.json');
  return new Set(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).items.map(item => item.id) : []);
}

export function readStoryboard(project) {
  if (!/^[a-z0-9-]+$/.test(project || '')) throw Error('Usage: node pipeline/check.mjs <project>   (a folder name inside projects/)');
  const file = join(root, 'projects', project, 'storyboard.json');
  if (!existsSync(file)) {
    const made = join(root, 'projects', project, 'template.json');     // a "direct" template renders the video itself: no storyboard
    if (existsSync(made)) { const m = JSON.parse(readFileSync(made, 'utf8')); throw Error(`projects/${project} was rendered directly by the "${m.template}" template (see templates/${m.template}/): there is no storyboard to check. Rebuild it with npm run template ${m.template} <spec> ${project}.`); }
    throw Error(`No storyboard at projects/${project}/storyboard.json`);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** A project's json file (words.json, faces.json, edit/edl.json …), or null if it is not there. */
export function readProjectJson(project, file) {
  const path = join(root, 'projects', project, file);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

/** Pieces whose whole job is words on screen (a text category, or a Word / Labels / Type group): captions already carry the words. */
function wordPieces(theme) {
  const words = new Set();
  for (const {category, file} of catalogFiles(theme)) {
    for (const item of JSON.parse(readFileSync(file, 'utf8')).items ?? []) if (item.piece && (category === 'text' || ['Word', 'Labels', 'Type', 'Title cards'].includes(item.group))) words.add(item.piece);
  }
  return words;
}

const PLAN_KINDS = ['talk', 'text', 'ui', 'diagram', 'chart', 'object', 'demo', 'footage'];
const PICTURE = ['ui', 'diagram', 'chart', 'object', 'demo'];
/**
 * The visual plan (projects/<name>/plan.json), written BEFORE the storyboard and without looking at the library:
 * for each beat, the idea the viewer must get and the picture that explains it; then each beat is matched to a piece
 * in the base theme, or a new piece is built in that theme. Required when the storyboard says "plan": "plan.json"
 * (every new project: npm run footage writes it). The point is a varied, engaging rhythm: big text behind the speaker, then just
 * the speaker talking, then a visual that explains, then text again. Checks: every beat is complete; no kind runs more than
 * twice in a row (a visual spanning several phrase beats counts once); six or more beats use at least three kinds; at least
 * a quarter are explanatory pictures; no stretch over 3 s without something new (talk beats up to ~3 s excepted); every
 * non-talk beat names a piece that exists, a picture is not drawn with a words-only piece, and the storyboard shows it.
 */
function planProblems(project, storyboard) {
  if (!storyboard.plan) return [];
  const plan = readProjectJson(project, storyboard.plan), where = `projects/${project}/${storyboard.plan}`;
  if (!plan) return [`No visual plan at ${where}. Write it first (AGENTS.md, "The visual plan"): one beat per idea, with what is said, the idea and the visual that explains it.`];
  const beats = plan.beats ?? [], problems = [];
  if (!beats.length) return [`${where} has no "beats".`];
  const sfx = readSounds(), cues = storyboard.footage ? soundCues(storyboard, storyboard.footage.duration) : [];
  const words = wordPieces(storyboard.theme ?? DEFAULT_THEME), overlays = [...(storyboard.overlays ?? []), ...(storyboard.shots ?? []).flatMap(s => [s.candidates?.[0]?.visual].filter(Boolean))];
  beats.forEach((b, i) => {
    const name = `Plan beat ${i + 1}${b.said ? ` ("${String(b.said).slice(0, 40)}")` : ''}`;
    for (const key of b.kind === 'talk' ? ['said'] : ['said', 'idea', 'visual']) if (!b[key]) problems.push(`${name}: needs "${key}".`);
    if (!PLAN_KINDS.includes(b.kind)) problems.push(`${name}: "kind" must be one of ${PLAN_KINDS.join(', ')}.`);
    // Sound design, planned with the picture: {"cue": "riser", "why": "suspense into the reveal"} (cue null = silence on purpose).
    const cue = b.sound?.cue;
    if (b.sound && !('cue' in b.sound)) problems.push(`${name}: "sound" needs "cue" (a sound from library/_shared/sfx, or null) and "why".`);
    if (cue && !sfx.has(cue)) problems.push(`${name}: sound "${cue}" is not in library/_shared/sfx. Options: ${[...sfx].join(', ')}.`);
    else if (cue && b.at != null && storyboard.footage && !cues.some(x => x.name === cue && x.at >= b.at - 2.5 && x.at <= b.at + 1))
      problems.push(`${name}: the plan wants "${cue}" here (${b.sound.why ?? 'no reason given'}) but the storyboard has none around ${b.at}s. Set "sound": "${cue}" on that beat's overlay, or add it to "sounds".`);
    if (b.kind === 'talk') return;      // just the speaker, talking: no graphic
    if (!b.piece) { problems.push(`${name}: no "piece" yet. Use a piece from the "${storyboard.theme ?? DEFAULT_THEME}" theme that shows "${b.visual ?? '…'}", or build one in that theme (library/themes/BUILDING-A-THEME.md).`); return; }
    let lib; try { lib = b.theme ? libraryOf(b.theme) : readLibrary(storyboard.theme); } catch (error) { problems.push(`${name}: ${error.message.split('\n')[0]}`); return; }
    if (!lib.pieces.has(b.piece)) problems.push(`${name}: piece "${b.piece}" does not exist${b.theme ? ` in ${b.theme}` : ''}. Build it in the theme first.`);
    if (b.kind !== 'text' && !b.theme && words.has(b.piece)) problems.push(`${name}: "${b.visual}" is a picture, but "${b.piece}" only sets words. Show the idea, not the sentence.`);
    if (b.at != null && storyboard.footage && !overlays.some(o => o.piece === b.piece && o.start <= b.at + 1.5 && o.end >= b.at - .5)) problems.push(`${name}: the storyboard does not show "${b.piece}" around ${b.at}s.`);
  });
  // Variety: the plan exists to keep the video moving between kinds of moment. A beat is a phrase, so one visual can span
  // two or three beats: consecutive beats with the same piece count as one moment here.
  const groups = beats.reduce((g, b, i) => { const last = g.at(-1); if (last && b.piece && b.piece === beats[i - 1].piece) last.n.push(i + 1); else g.push({kind: b.kind, n: [i + 1], at: b.at}); return g; }, []);
  for (let i = 2; i < groups.length; i++) if (groups[i].kind && groups[i].kind === groups[i - 1].kind && groups[i].kind === groups[i - 2].kind)
    problems.push(`Plan beats ${groups[i - 2].n[0]}-${groups[i].n.at(-1)} are three "${groups[i].kind}" moments in a row. Mix it up: big text, just talking, an explainer visual, then text again.`);
  // Pace (with the beat and moment times): something new lands about every 1-1.5 s; a "talk" beat is a short breather.
  const times = beats.flatMap(b => [b.at, ...(b.moments ?? []).map(m => m.at)]).filter(t => typeof t === 'number').sort((a, b) => a - b);
  beats.forEach((b, i) => (b.moments ?? []).forEach((m, k) => { if (!(m.at >= 0) || !m.what) problems.push(`Plan beat ${i + 1}: moment ${k + 1} needs "at" (seconds) and "what" lands then.`); }));
  if (times.length > 2) {
    const talking = (t0, t1) => beats.some((b, i) => b.kind === 'talk' && b.at != null && b.at <= t0 + .05 && (beats[i + 1]?.at ?? Infinity) >= t1 - .05);
    let worst = null; for (let i = 1; i < times.length; i++) { const gap = times[i] - times[i - 1]; if (!talking(times[i - 1], times[i]) && (!worst || gap > worst.gap)) worst = {gap, at: times[i - 1]}; }
    if (worst && worst.gap > 3) problems.push(`Nothing new lands for ${worst.gap.toFixed(1)} s after ${worst.at}s. Split that sentence into phrase beats, or give the beat moments ("at" on the stressed words), about every 1-1.5 s.`);
    beats.forEach((b, i) => { const next = beats[i + 1]?.at; if (b.kind === 'talk' && b.at != null && next != null && next - b.at > 4) problems.push(`Plan beat ${i + 1} is ${(next - b.at).toFixed(1)} s of just talking. A breather works up to about 3 s; then something should land.`); });
  }
  const kinds = new Set(beats.map(b => b.kind)), pictures = beats.filter(b => PICTURE.includes(b.kind)).length;
  if (beats.length >= 6 && kinds.size < 3) problems.push(`The plan uses only ${[...kinds].join(' and ')}. Use at least three kinds of moment (talk, text, ui, diagram, chart, object, demo).`);
  if (beats.length >= 4 && pictures < Math.ceil(beats.length / 4)) problems.push(`Only ${pictures} of ${beats.length} beats explain with a picture (ui, diagram, chart, object, demo). Give the key ideas a visual that clarifies them.`);
  return problems;
}

/**
 * A footage project must be built on the clean-up cut (npm run cut: silences, fillers and false starts gone, at the house voice level):
 * edit/edl.json exists, the footage is as long as the cut it made, and the cut reached the loudness target.
 * `"footage": {"uncut": true}` (npm run footage --uncut) is the recorded exception for clips already edited or too short.
 * `npm run make` runs check first, so a video cannot be made on a raw take by accident.
 */
function cutProblems(project, storyboard) {
  if (!storyboard.footage || storyboard.footage.uncut) return [];
  const edl = readProjectJson(project, 'edit/edl.json');
  if (!edl) return [`The footage was never cut (no edit/edl.json): run npm run cut ${project} <raw video>, then npm run footage ${project} projects/${project}/edit/clean.mp4 projects/${project}/edit/words.json. Only for an already edited or very short clip: set "footage": {"uncut": true}.`];
  // faces.json is measured on footage.mp4 itself (the storyboard's duration may end earlier on purpose).
  const problems = [], after = edl.duration?.after, length = readProjectJson(project, 'faces.json')?.duration, lufs = edl.audio?.after?.lufs, target = edl.settings?.targetLufs ?? houseLufs();
  if (after && length && Math.abs(after - length) > .25) problems.push(`footage.mp4 (${length}s) is not the clean cut (${after}s in edit/edl.json): run npm run footage ${project} projects/${project}/edit/clean.mp4 projects/${project}/edit/words.json.`);
  if (lufs != null && Math.abs(lufs - target) > 1) problems.push(`The cut's loudness is ${lufs} LUFS, not ${target}: run npm run cut again.`);
  return problems;
}

/** Captions that will not be readable: plain light letters over a bright picture (a white top, a pale wall). `npm run footage`
 * measures the picture where captions sit (faces.json `captionBand.light`: the share of the clip too bright for white
 * letters); a style with its own box or outline (`"backed": true` in the theme's captions catalog) is always fine. Caught
 * here so the storyboard the user approves is the video they get, instead of failing the quality check after the make. */
function captionProblems(project, storyboard) {
  const light = storyboard.footage && readProjectJson(project, 'faces.json')?.captionBand?.light;
  if (!light || light <= .15) return [];
  let styles = []; try { styles = JSON.parse(readFileSync(join(root, 'library', themePath(storyboard.theme ?? DEFAULT_THEME), 'captions/catalog.json'), 'utf8')).items; } catch { return []; }
  const used = [storyboard.captions, ...(storyboard.captionTrack ?? []).filter(c => !c.theme).map(c => c.style)].filter(Boolean);
  const backed = styles.filter(i => i.backed).map(i => i.id);
  const weak = [...new Set(used)].filter(id => styles.some(i => i.id === id && !i.backed));
  return weak.length && backed.length ? [`captions "${weak.join('", "')}": plain letters with no box, and the picture behind the captions is bright for ${Math.round(light * 100)}% of the clip, so they would fail the contrast check after the make. Use a style with its own box or outline: ${backed.join(', ')}.`] : [];
}

/** Every problem `npm run check` reports: pieces, effects, transitions, sounds and the storyboard's own sections. */
export function problemsOf(storyboard) {
  const problems = storyboard.footage ? checkFootageStoryboard(storyboard, readLibrary(storyboard.theme), libraryOf, readSounds()) : checkStoryboard(storyboard, readLibrary(storyboard.theme), readSounds(), libraryOf);
  problems.push(...overuseProblems(storyboard));
  if (storyboard.music?.name) {                                         // a bed that is not in the catalog would fail late, in the mix
    let beds = []; try { beds = JSON.parse(readFileSync(join(root, 'library/_shared/music/catalog.json'), 'utf8')).items.map(i => i.id); } catch {}
    if (!beds.includes(storyboard.music.name)) problems.push(`music "${storyboard.music.name}" is not in library/_shared/music/catalog.json (${beds.length ? 'beds: ' + beds.join(', ') : 'no music beds are installed'}). Remove "music", or add your own mp3 and a catalog entry.`);
  }
  problems.push(...safeZoneProblems(storyboard));
  return problems.length ? problems : checkSections(storyboard);      // sections are judged once the rest is sound (they need a duration, or the shots)
}

/**
 * The app safe zone, decided in the storyboard (it kept coming up in edit notes). TikTok, Reels
 * and Shorts draw their search bar over the top 220 px and the caption, name and buttons over the bottom 450 px, so a
 * graphic placed there is hidden, and the face there sits under the search field. Checked here on the boxes the
 * storyboard sets; pipeline/qa.py measures every word drawn in the finished video (text-safe-zone, face-top-bar).
 * A full-frame scene (a region about the size of the frame) and a cutaway are left to that measurement.
 */
function safeZoneProblems(storyboard) {
  if (!storyboard.footage) return [];
  const tol = 10, out = [], fmtBox = r => `y ${Math.round(r.y)} to ${Math.round(r.y + r.height)}`;
  for (const o of storyboard.overlays ?? []) {
    const r = o.region; if (!r || o.cutaway || o.behind) continue;
    if (r.width >= 1000 && r.height >= 1700) continue;                                      // a whole-frame scene, not a box
    const where = `overlay "${o.piece}" at ${o.start}s (region ${fmtBox(r)})`;
    if (r.y < SAFE.top - tol) out.push(`${where} starts under the app's top bar and search field (above y ${SAFE.top}). Move the region down to y ${SAFE.top}+ or make it smaller.`);
    else if (r.y + r.height > SAFE.bottom + tol) out.push(`${where} runs into the app's caption and buttons (below y ${SAFE.bottom}). Raise it or make it shorter so it ends by y ${SAFE.bottom}.`);
    else if (r.x < SAFE.left - 30 || r.x + r.width > SAFE.right + 30) out.push(`${where} runs off the side margin (x ${SAFE.left} to ${SAFE.right}). Bring it in from the edge.`);
  }
  // the face sits at "face" [u, v] of the clip's window; with the forehead, its top is about 15% of the window above that
  for (const l of storyboard.layouts ?? []) {
    const m = {...LAYOUT_PRESETS.full, ...(LAYOUT_PRESETS[l.to ?? 'full'] ?? {}), ...l}, fy = (l.face ?? LAYOUT_PRESETS[l.to ?? 'full']?.face ?? m.face)[1];
    const top = m.y + (fy - .15 * (m.zoom ?? 1)) * m.height;
    if (top < SAFE.top - tol) out.push(`layout at ${l.at}s puts the face at about y ${Math.round(top)}, under the app's top bar and search field: keep it below y ${SAFE.top}. Lower the window ("y") or the face in it ("face" v).`);
  }
  return out;
}

/** Pieces whose catalog entry has "maxPerVideo" (e.g. the big centred icon, glow-icon: 2) used in more shots than that. */
function overuseProblems(storyboard) {
  const limits = {}, used = {};
  for (const theme of new Set([storyboard.theme ?? DEFAULT_THEME])) {
    for (const {file} of catalogFiles(theme)) {
      for (const item of JSON.parse(readFileSync(file, 'utf8')).items ?? []) if (item.maxPerVideo && item.piece) limits[item.piece] = item.maxPerVideo;
    }
  }
  for (const shot of storyboard.shots ?? []) {
    const pick = (shot.candidates ?? []).find(c => c.status !== 'rejected') ?? shot.candidates?.[0];
    for (const slot of ['background', 'visual', 'overlay']) { const piece = pick?.[slot]?.theme ? null : pick?.[slot]?.piece; if (piece) (used[piece] ??= []).push(shot.id); }
  }
  return Object.entries(used).filter(([piece, ids]) => limits[piece] && ids.length > limits[piece])
    .map(([piece, ids]) => `"${piece}" is used in ${ids.length} shots (${ids.join(', ')}); at most ${limits[piece]} per video. Give the other lines their own picture.`);
}

/** The timeline and sections of a project as it stands on disk: {storyboard, timeline, sections, words}. */
export function readSections(project, storyboard = readStoryboard(project), cut = 'all') {
  const words = storyboard.footage ? readProjectJson(project, 'words.json')?.words ?? [] : [];
  const timeline = storyboard.footage ? buildFootageTimeline(storyboard, words, readProjectJson(project, 'faces.json')) : buildTimeline(storyboard, cut, readVoice(project));
  return {storyboard, timeline, words, sections: sectionsOf(storyboard, {words, timeline})};
}
const printSections = (project, storyboard) => {
  const {sections} = readSections(project, storyboard);
  console.log(`\n${sections.length} section(s)${sections[0]?.derived ? ' (derived — add "sections" to the storyboard to name them)' : ''}:`);
  for (const s of sections) console.log(`  ${secs(s.start).padStart(5)}s – ${secs(s.end).padStart(4)}s  ${s.id.padEnd(16)} ${s.job ? `[${s.job}] ` : ''}${s.title}`);
};

/** Narration generated by `npm run voice`, or null if there is none yet. */
export function readVoice(project) {
  const file = join(root, 'projects', project, 'voice', 'voice.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const storyboard = readStoryboard(process.argv[2]), problems = [...cutProblems(process.argv[2], storyboard), ...captionProblems(process.argv[2], storyboard), ...planProblems(process.argv[2], storyboard), ...problemsOf(storyboard)];
    if (problems.length) { console.error(`${problems.length} problem(s) in projects/${process.argv[2]}/storyboard.json:\n` + problems.map(p => '  - ' + p).join('\n')); process.exit(1); }
    if (storyboard.footage) {
      console.log(`"${storyboard.title}" · footage, ${storyboard.footage.duration}s · ${(storyboard.overlays ?? []).length} overlays · ${(storyboard.zooms ?? []).length} zooms · ${(storyboard.effects ?? []).length} effects · ${(storyboard.transitions ?? []).length} transitions${storyboard.layouts ? ` · ${storyboard.layouts.length} layout changes` : ''}${(() => { const c = soundCues(storyboard, storyboard.footage.duration), auto = c.filter(x => x.auto).length; return c.length ? ` · ${c.length} sounds${auto ? ` (${auto} automatic)` : ''}` : ''; })()}\n`);
      for (const o of [...(storyboard.overlays ?? [])].sort((a, b) => a.start - b.start)) console.log(`  ${o.start.toFixed(1).padStart(5)}s – ${o.end.toFixed(1).padStart(4)}s  ${o.piece}${o.theme ? `  [${o.theme}]` : ''}${o.cutaway ? '  (full screen)' : ''}${o.behind === 'person' ? '  (behind the person)' : o.behind ? '  (behind the clip)' : ''}${o.exit ? '  (slice exit)' : ''}`);
      for (const t of [...(storyboard.transitions ?? [])].sort((a, b) => a.at - b.at)) console.log(`  ${t.at.toFixed(1).padStart(5)}s  ⇄ ${t.name} (${t.seconds ?? .4}s)${t.theme ? `  [${t.theme}]` : ''}`);
      for (const k of [...(storyboard.layouts ?? [])].sort((a, b) => a.at - b.at)) console.log(`  ${k.at.toFixed(1).padStart(5)}s  ▣ ${k.to ?? 'custom'}`);
      printSections(process.argv[2], storyboard);
      console.log('\nStoryboard is valid.'); process.exit(0);
    }
    const timeline = buildTimeline(storyboard, 'all', readVoice(process.argv[2]));
    const basis = timeline.estimated === 0 ? 'timed to the recorded voiceover' : `${timeline.estimated} shot(s) not narrated yet, estimated from word count`;
    console.log(`"${storyboard.title}" · ${timeline.shots.length} shots · ${timeline.duration.toFixed(1)}s (${basis})\n`);
    for (const shot of timeline.shots) {
      console.log(`  ${shot.start.toFixed(1).padStart(5)}s  ${shot.id}${shot.transition ? `   ⇄ ${shot.transition.name} (${shot.transition.seconds ?? .5}s) from the shot before` : ''}`);
      shot.candidates.forEach((candidate, n) => console.log(`          ${n === pickOf(shot) ? '→' : ' '} ${(candidate.status ?? 'draft').padEnd(8)}  ${describe(candidate)}`));
    }
    printSections(process.argv[2], storyboard);
    const ready = storyboard.shots.filter(shot => pickOf(shot) >= 0).length;
    console.log(`\n${ready} of ${storyboard.shots.length} shots have a usable piece (→ marks the one that goes in the cut). Storyboard is valid.`);
  } catch (error) { console.error(error.message); process.exit(1); }
}

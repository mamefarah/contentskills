// Storyboard -> timeline. Shared by the checker (Node), the rough-draft player (browser)
// and the combiner, so all three agree on when every shot and word happens.
//
// A shot has one narration line and several CANDIDATES: alternative pieces that could
// illustrate it. Each candidate is marked draft, usable or rejected in the rough draft.
// The cut uses one usable candidate per shot: the one named by "pick", else the first usable.
//
// Before a voiceover exists, timing is an ESTIMATE from word counts. Once `npm run voice`
// has narrated a shot (and its line has not changed since), the real audio length and
// word timings are used instead.

export const STATUSES = ['draft', 'usable', 'rejected'];
/** The theme a storyboard uses when it does not name one ("theme": "horror"). */
export const DEFAULT_THEME = 'modern';
/** Short name of a candidate for lists: its visual, and/or the full-frame background behind it. */
export const describe = c => [c.visual?.piece, c.background?.piece && (c.visual ? `over ${c.background.piece}` : c.background.piece), c.effect && `+ ${c.effect.name}`].filter(Boolean).join(' ');
export const DEFAULT_FORMAT = {width: 1080, height: 1920, fps: 30};
/** Where a shot's visual sits in a 1080x1920 frame. Keep in step with .visual in draft/player.css. */
// ---------- sound design: sounds follow what happens on screen ----------
// Every event brings its own sound: a whoosh into each cut and transition, a swish on a layout change, a sound for each
// graphic as it lands (picked from its name: a slam stamps, a counter ticks, a card pops, money chimes). Claude places
// nothing by hand unless a moment needs a specific sound: "sounds" in the storyboard are kept as they are, on top.
//   "autoSounds": false        no event sounds (only the storyboard's own "sounds")
//   "sound": "<sfx id>" | null on an overlay, effect, transition or layout: that sound instead (always plays; a riser
//                              starts 1.6 s early and peaks on the moment), or none
// Default: on when the storyboard has no "sounds" list, off when it has one (older storyboards placed every sound by
// hand), unless "autoSounds" says otherwise. Then a taste filter keeps it sparse (event sounds only; hand-placed ones
// always play): TOP (cuts, slams) always; MID needs 0.25 s clear after any sound; LIGHT (pops, ticks, typing) needs
// 0.35 s clear and at most one a second. The same sound is never repeated within 0.25 s (0.12 s for ticks and clicks).
const SOUND_KEYS = [['stamp', /slam|stamp|punch|verdict|stop/], ['coin', /money|cash|coin|price|\$|dollar|revenue/], ['tick', /count|number|stat|meter|timer|clock|progress/],
  ['key_run', /type|typing|prompt|chat|terminal|search|command/], ['ding', /check|success|done|win|approve|tick-?box/], ['swish', /chart|graph|bar|line|arrow|swipe|slide|scroll/],
  ['shutter', /photo|camera|screenshot|snap|poster/], ['notif', /notif|dm|message|comment|bell/], ['glitch', /glitch|tear|rgb|static|vhs/],
  ['impact', /flash|shake|impact|hit|boom/], ['riser', /reveal|fly|zoom|build|rise/], ['pop', /./]];
const SOUND_TIER = {whoosh: 'top', whoosh_fast: 'top', whoosh_low: 'top', impact: 'top', stamp: 'top', trailer_hit: 'top', sub_drop: 'top', punch: 'top',
  swish: 'mid', thump: 'mid', ding: 'mid', coin: 'mid', riser: 'mid', win: 'mid', glitch: 'mid', shutter: 'mid', siren: 'mid', reject: 'mid'};
const soundFor = name => SOUND_KEYS.find(([, re]) => re.test(String(name).toLowerCase()))[0];
const pick = (entry, fallback) => entry.sound === null ? null : entry.sound ?? fallback;

/** Event sounds for a storyboard, already thinned by the taste filter, plus its own "sounds"; sorted by time. */
export function soundCues(storyboard, duration, cutTimes = []) {
  const own = (storyboard.sounds ?? []).map(x => ({name: x.name, at: x.at, ...(x.gain != null ? {gain: x.gain} : {})}));   // no gain: the mixer's default (settings audio.effects.gain)
  const autoOn = storyboard.autoSounds ?? !storyboard.sounds;      // off: only sounds chosen on an entry play, besides "sounds"
  const auto = [];
  // A sound named on purpose ("sound" on an entry, usually from the visual plan) always plays; a build-up sound starts
  // early so it peaks on its moment (a riser builds for ~1.6 s into the reveal).
  const LEAD = {riser: 1.6};
  const add = (name, at, trim = 0, chosen = false) => {   // trim: dB against the default effect level (settings audio.effects.gain)
    if (!name || (!autoOn && !chosen)) return; at -= chosen ? LEAD[name] ?? 0 : 0;
    if (at >= -.5 && at < duration) auto.push({name, at: +Math.max(0, at).toFixed(3), ...(trim ? {trim} : {}), auto: true, ...(chosen ? {chosen} : {})});
  };
  const own_ = (entry, fallback) => [pick(entry, fallback), entry.sound !== undefined && entry.sound !== null];
  for (const at of cutTimes) add('whoosh', at - .08);
  for (const t of storyboard.transitions ?? []) { const [n, c] = own_(t, 'whoosh'); add(n, c ? t.at : t.at - .08, 0, c); }
  (storyboard.layouts ?? []).filter(l => l.at > .2).forEach((l, i) => { const [n, c] = own_(l, ['swish', 'whoosh_low'][i % 2]); add(n, l.at, 0, c); });   // alternate, so a run of moves does not repeat one sound
  for (const o of storyboard.overlays ?? []) {
    if (o.end - o.start > 8 && !o.cutaway && o.sound === undefined) continue;      // furniture that stays up (corner labels, a frame): no sound
    const [n, c] = own_(o, o.cutaway ? 'whoosh' : soundFor(o.piece)); add(n, o.start, o.cutaway || c ? 0 : -2, c);
  }
  for (const e of storyboard.effects ?? []) { const [n, c] = own_(e, /glitch|flash|shake|impact|tear|poster|fly|slice/.test(e.name) ? soundFor(e.name) : null); add(n, e.at, 0, c); }
  const kept = [], last = {}, light = [], own_at = own.map(x => x.at);
  let lastAny = -9;
  for (const c of auto.sort((a, b) => a.at - b.at)) {
    const tier = SOUND_TIER[c.name] ?? 'light', t = c.at;
    if (c.chosen) { last[c.name] = t; lastAny = t; kept.push(c); continue; }        // chosen on purpose: always plays
    if (own_at.some(a => Math.abs(a - t) < .25)) continue;                       // a hand-placed sound already marks this moment
    if (t - (last[c.name] ?? -9) < (['tick', 'click', 'key_run'].includes(c.name) ? .12 : .25)) continue;
    if (tier === 'mid' && t - lastAny < .25) continue;
    if (tier === 'light') { while (light.length && t - light[0] >= 1) light.shift(); if (t - lastAny < .35 || light.length) continue; light.push(t); }
    last[c.name] = t; lastAny = t; kept.push(c);
  }
  return [...own, ...kept].sort((a, b) => a.at - b.at);
}

export const VISUAL_REGION = {x: 60, y: 380, width: 960, height: 960};
const EFFECT_PLACES = ['in', 'out', 'all', 'pulse'];
const LEAD = .1;      // silence before a shot's narration starts
const TAIL = .3;      // breathing room after it ends

/** Index of the candidate that goes into the cut, or -1 if the shot has no usable candidate yet. */
export function pickOf(shot) {
  if (Number.isInteger(shot.pick) && shot.candidates[shot.pick]?.status === 'usable') return shot.pick;
  return shot.candidates.findIndex(candidate => candidate.status === 'usable');
}

/**
 * @param storyboard  parsed storyboard.json
 * @param cut         'all' (every shot, showing its pick or else its first candidate that is not rejected) or
 *                    'usable' (only shots that have a usable candidate, showing the pick)
 * @param voice       parsed voice/voice.json if narration has been generated, else null
 * @param viewing     {shotId: candidateIndex} to look at a specific candidate (cut 'all' only)
 */
export function buildTimeline(storyboard, cut = 'all', voice = null, viewing = {}) {
  const wpm = storyboard.wordsPerMinute ?? 160;
  // "lead": seconds of silence before each shot's narration (default LEAD). 0 for tight, fast edits: the cut lands on the first word.
  const lead = storyboard.lead ?? LEAD;
  const chosen = storyboard.shots.filter(shot => cut === 'usable' ? pickOf(shot) >= 0 : true);
  let cursor = 0;
  const shots = chosen.map(shot => {
    // With nothing usable yet, show the first candidate that has not been rejected.
    const fallback = Math.max(0, shot.candidates.findIndex(candidate => candidate.status !== 'rejected'));
    const pick = pickOf(shot), index = cut === 'usable' ? pick : viewing[shot.id] ?? (pick >= 0 ? pick : fallback);
    const candidate = shot.candidates[index];
    const tokens = (shot.narration || '').split(/\s+/).filter(Boolean);
    const spoken = voice?.shots?.[shot.id], narrated = Boolean(spoken && spoken.text === (shot.narration || '').trim());
    let duration, words, audio = null;
    if (narrated) {
      duration = shot.duration ?? Math.max(1.5, lead + spoken.duration + TAIL);
      words = spoken.words.map(w => ({text: w.text, start: cursor + lead + w.start, end: cursor + lead + w.end}));
      audio = {file: spoken.file, at: cursor + lead, duration: spoken.duration};
    } else {
      const speech = tokens.length / wpm * 60;
      duration = shot.duration ?? Math.max(1.5, speech + lead + TAIL);
      // Longer words take longer to say: share the speech time by letter count.
      const weights = tokens.map(word => word.length + 2), total = weights.reduce((a, b) => a + b, 0) || 1;
      let at = cursor + lead;
      words = tokens.map((text, i) => { const start = at; at += speech * weights[i] / total; return {text, start, end: at}; });
    }
    for (const word of words) word.shotEnd = cursor + duration;   // captions never linger across the cut
    // Optional caption marks per shot: "emphasis": {"word": level} (matched without punctuation, any case) and
    // "tone": "light" (the picture is light, so a style may draw dark type). Styles that ignore them are unaffected.
    const marks = Object.fromEntries(Object.entries(shot.emphasis ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    for (const word of words) {
      const level = marks[word.text.replace(/[^\p{L}\p{N}'+-]/gu, '').toLowerCase()];
      if (level) word.emph = level;
      if (shot.tone) word.tone = shot.tone;
    }
    const placed = {...shot, visual: candidate.visual, background: candidate.background, effect: candidate.effect, status: candidate.status ?? 'draft',
      candidateIndex: index, picked: index === pick, start: cursor, end: cursor + duration, words, audio, narrated};
    cursor += duration;
    return placed;
  });
  const estimated = shots.filter(shot => shot.narration && !shot.narrated).length;
  // Sound effects: the storyboard's own ("at" = seconds into the video) and each shot's ("at" = seconds into that shot).
  const sounds = [...soundCues(storyboard, cursor, shots.slice(1).map(shot => shot.start)),
    ...shots.flatMap(shot => (shot.sounds ?? []).map(x => ({name: x.name, at: +(shot.start + x.at).toFixed(3), ...(x.gain != null ? {gain: x.gain} : {})})))]
    .filter(x => x.at >= 0 && x.at < cursor).sort((a, b) => a.at - b.at);
  return {duration: cursor, shots, words: shots.flatMap(shot => shot.words), sounds, music: storyboard.music ?? null, voiceLufs: storyboard.voiceLufs, voiceEq: storyboard.voiceEq ?? null, format: {...DEFAULT_FORMAT, ...storyboard.format}, estimated};
}

/**
 * Effect events for the combiner, in whole frames. An effect touches only the visual
 * region, so captions and headlines stay readable.
 */
export function effectPlan(timeline, scale = 1) {
  const {fps} = timeline.format, events = [];
  for (const shot of timeline.shots) {
    if (!shot.effect) continue;
    const where = shot.effect.where ?? 'in', length = where === 'all' ? shot.end - shot.start : Math.min(shot.effect.seconds ?? .5, shot.end - shot.start);
    const from = where === 'out' ? shot.end - length : where === 'pulse' ? (shot.start + shot.end - length) / 2 : shot.start;
    // With no square visual, the shot is a full-frame card, so the effect covers the whole frame.
    events.push({effect: shot.effect.name, amount: shot.effect.amount ?? .5, where, full: !shot.visual, start: Math.round(from * fps), end: Math.round((from + length) * fps), ...(shot.effect.props ? {props: shot.effect.props} : {})});
  }
  const roi = Object.fromEntries(Object.entries(VISUAL_REGION).map(([key, value]) => [key, Math.round(value * scale)]));
  return {fps, roi, events};
}

/**
 * Shader transitions for the combiner, in whole frames. A shot's "transition" is the one INTO it
 * from the shot before; unlike an effect it covers the whole frame, since everything changes at a cut.
 */
export function transitionPlan(timeline) {
  const {fps} = timeline.format, cuts = [];
  timeline.shots.forEach((shot, i) => {
    const before = timeline.shots[i - 1];
    if (!shot.transition || !before) return;
    const seconds = Math.min(shot.transition.seconds ?? .5, shot.end - shot.start, before.end - before.start);   // at most half of it falls in either shot
    cuts.push({name: shot.transition.name, frame: Math.round(shot.start * fps), frames: Math.max(2, Math.round(seconds * fps)), params: shot.transition.params, ...(shot.transition.theme ? {theme: shot.transition.theme} : {})});
  });
  return {fps, cuts};
}
/** Problems with one {"name", "seconds"} transition. */
function checkTransition(transition, label, library) {
  const problems = [], names = [...(library.transitions ?? [])];
  if (!names.includes(transition?.name)) problems.push(`${label}: transition "${transition?.name}" is not in the theme. ${names.length ? 'Options: ' + names.join(', ') + '.' : 'This theme has no transitions.'}`);
  if (transition?.seconds != null && !(transition.seconds >= .1 && transition.seconds <= 3)) problems.push(`${label}: transition "seconds" must be between 0.1 and 3.`);
  return problems;
}

/** "sound" names on overlays, effects, transitions and layouts must be in library/_shared/sfx (or null for none). */
function eventSoundProblems(storyboard, sfx) {
  const problems = [];
  for (const kind of ['overlays', 'effects', 'transitions', 'layouts']) (storyboard[kind] ?? []).forEach((x, i) => {
    if (x.sound && sfx && sfx.size && !sfx.has(x.sound)) problems.push(`${kind} ${i + 1}: "sound": "${x.sound}" is not in library/_shared/sfx. Options: ${[...sfx].join(', ')}, or null for none.`);
  });
  return problems;
}

/** Problems that would stop a storyboard from playing. `library` = {pieces, captions, effects, transitions: Sets}. */
export function checkStoryboard(storyboard, library, sfx = null, libraryOf = null) {
  // a piece or transition may name a second theme ("theme"): it is checked against that theme's library
  const libFor = theme => theme && libraryOf ? libraryOf(theme) : library;
  const problems = [];
  // Sound effects: the storyboard's ("at" in seconds into the video) and each shot's ("at" into the shot).
  const soundSets = [['', storyboard.sounds ?? []], ...(storyboard.shots ?? []).map(shot => [`Shot "${shot.id}": `, shot.sounds ?? []])];
  for (const [where, list] of soundSets) list.forEach((x, i) => {
    if (sfx && sfx.size && !sfx.has(x.name)) problems.push(`${where}sound ${i + 1}: "${x.name}" is not in library/_shared/sfx. Options: ${[...sfx].join(', ')}.`);
    if (!(x.at >= (where ? -1 : 0))) problems.push(`${where}sound ${i + 1} (${x.name}): needs "at" in seconds.`);
    if (x.gain != null && !(x.gain <= 0 && x.gain >= -60)) problems.push(`${where}sound ${i + 1} (${x.name}): "gain" is in dB, between -60 and 0.`);
  });
  problems.push(...eventSoundProblems(storyboard, sfx));
  for (const shot of storyboard.shots ?? []) for (const k of shot.camera?.kicks ?? []) if (!(k.at >= 0)) problems.push(`Shot "${shot.id}": camera kick needs "at" in seconds into the shot.`);
  if (!storyboard.title) problems.push('Missing "title".');
  if (!Array.isArray(storyboard.shots) || storyboard.shots.length === 0) return [...problems, 'A storyboard needs at least one shot in "shots".'];
  if (storyboard.captions && !library.captions.has(storyboard.captions)) problems.push(`Unknown caption style "${storyboard.captions}". Options: ${[...library.captions].join(', ')}.`);
  const seen = new Set();
  storyboard.shots.forEach((shot, i) => {
    const name = shot.id ? `Shot "${shot.id}"` : `Shot ${i + 1}`;
    if (!shot.id || !/^[a-z0-9-]+$/.test(shot.id)) problems.push(`${name}: needs an "id" made of lowercase letters, digits and dashes.`);
    else if (seen.has(shot.id)) problems.push(`${name}: duplicate id.`);
    seen.add(shot.id);
    if (!shot.narration && !shot.duration) problems.push(`${name}: needs "narration" (to estimate its length) or an explicit "duration".`);
    if (shot.transition) problems.push(...(i === 0 ? [`${name}: the first shot has no shot before it to transition from.`] : checkTransition(shot.transition, name, libFor(shot.transition.theme))));
    if (!Array.isArray(shot.candidates) || shot.candidates.length === 0) { problems.push(`${name}: needs "candidates", a list of one or more pieces to try for this line.`); return; }
    if (shot.pick != null && !(Number.isInteger(shot.pick) && shot.pick >= 0 && shot.pick < shot.candidates.length)) problems.push(`${name}: "pick" must be the position of one of its candidates (0 is the first).`);
    shot.candidates.forEach((candidate, n) => {
      const label = `${name}, candidate ${n + 1}`;
      if (candidate.status && !STATUSES.includes(candidate.status)) problems.push(`${label}: status must be one of ${STATUSES.join(', ')}.`);
      if (candidate.effect) {
        if (!library.effects.has(candidate.effect.name)) problems.push(`${label}: effect "${candidate.effect.name}" cannot be used in a storyboard. Options: ${[...library.effects].join(', ')}.`);
        if (candidate.effect.amount != null && !(candidate.effect.amount >= 0 && candidate.effect.amount <= 1)) problems.push(`${label}: effect amount must be between 0 and 1.`);
        if (candidate.effect.where && !EFFECT_PLACES.includes(candidate.effect.where)) problems.push(`${label}: effect "where" must be one of ${EFFECT_PLACES.join(', ')}.`);
      }
      for (const slot of ['visual', 'background']) {
        const piece = candidate[slot]?.piece;
        // A full-frame background card can stand on its own; otherwise the shot needs a visual.
        if (slot === 'visual' && !piece && !candidate.background?.piece) problems.push(`${label}: needs a "visual" (or a full-frame "background") with a "piece" id from the library.`);
        if (piece && !libFor(candidate[slot].theme).pieces.has(piece)) problems.push(`${label}: ${slot} piece "${piece}" is not in the ${candidate[slot].theme ?? 'storyboard'} theme.`);
      }
    });
  });
  return problems;
}

// ---------- footage mode: one recorded clip with graphics superimposed ----------
// {"footage": {"file", "duration", "look"}, "zooms": [...], "overlays": [...], "effects": [...], "transitions": [...]}

const smoothstep = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
/** The face box at time t from a faces.json track ([[t, x, y, w, h], ...], 0..1 of the frame). */
export function faceAt(track, t) {
  if (!track?.length) return {x: .3, y: .2, w: .4, h: .25};
  let i = track.findIndex(s => s[0] > t); if (i < 0) i = track.length - 1;
  const a = track[Math.max(0, i - 1)], b = track[i], q = b[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))) : 0;
  const mix = k => a[k] + (b[k] - a[k]) * q;
  return {x: mix(1), y: mix(2), w: mix(3), h: mix(4)};
}
/** Whether the tracker saw a face near time t. Where the footage shows no face (black under an app screen, a cutaway
 *  clip) the track has no samples or only held boxes (age [5] > 0.2 s), and faceAt holds the nearest face across them, which is right for steering a
 *  zoom but wrong for checking what covers the face. */
export function faceSeen(track, t, gap = .3) {
  if (!track?.length) return true;          // no track at all: the placeholder face stands in
  let lo = 0, hi = track.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (track[m][0] < t) lo = m + 1; else hi = m; }
  const near = lo > 0 && Math.abs(track[lo - 1][0] - t) < Math.abs(track[lo][0] - t) ? track[lo - 1] : track[lo];
  return Math.abs(near[0] - t) <= gap && !(near[5] > .2);     // [5]: seconds since a real detection (a held box; QA only, so strict)
}
/** Punch-in at time t: {scale, cx, cy}. Zooms ease in and out and push toward the speaker's face. */
export function zoomAt(storyboard, track, t) {
  let scale = 1;
  for (const zoom of storyboard.zooms ?? []) {
    // "ramp" eases both ends; "rampIn" / "rampOut" set one end, and 0 is a hard punch (for a zoom that starts or stops on a jump cut).
    const half = (zoom.end - zoom.start) / 2, into = Math.min(zoom.rampIn ?? zoom.ramp ?? .22, zoom.rampIn != null ? 2 * half : half), out = Math.min(zoom.rampOut ?? zoom.ramp ?? .22, zoom.rampOut != null ? 2 * half - (zoom.rampIn != null ? into : 0) : half);
    if (t < zoom.start - 1e-6 || t >= zoom.end - 1e-6) continue;
    const edge = (x, ramp) => ramp > 0 ? smoothstep(x / ramp) : 1;
    scale = Math.max(scale, 1 + (zoom.scale - 1) * Math.min(edge(t - zoom.start, into), edge(zoom.end - t, out)));
  }
  const face = faceAt(track, t);
  return {scale, cx: face.x + face.w / 2, cy: face.y + face.h / 2};
}
/** Where a point (0..1) of the footage lands once the zoom at time t is applied. */
export const zoomed = (zoom, x, y) => ({x: (x - zoom.cx) * zoom.scale + zoom.cx, y: (y - zoom.cy) * zoom.scale + zoom.cy});

export function buildFootageTimeline(storyboard, words = [], faces = null) {
  const format = {...DEFAULT_FORMAT, ...storyboard.format}, duration = storyboard.footage.duration;
  // An overlay that ends after the clip does is simply still up on the last frame (it does not play its exit).
  const overlays = (storyboard.overlays ?? []).map((o, i) => ({...o, index: i, life: o.end - o.start, end: Math.min(o.end, duration)}));
  // Effects change the footage only, so captions and graphics stay sharp and in place. "layer": "all" opts an effect into hitting everything.
  const events = (storyboard.effects ?? []).map(e => ({effect: e.name, amount: e.amount ?? .6, where: e.where ?? 'pulse', layer: e.layer === 'all' ? 'all' : 'footage', start: Math.round(e.at * format.fps), end: Math.round((e.at + (e.seconds ?? .3)) * format.fps), ...(e.theme ? {theme: e.theme} : {}), ...(e.props ? {props: e.props} : {})}));
  // Shader transitions sit on a cut in the picture, e.g. where a full-screen cutaway starts or ends.
  const cuts = (storyboard.transitions ?? []).map(t => ({name: t.name, frame: Math.round(t.at * format.fps), frames: Math.max(2, Math.round((t.seconds ?? .4) * format.fps)), params: t.params, ...(t.theme ? {theme: t.theme} : {})}));
  // Caption words may be marked from the storyboard: "emphasis" (word numbers, or {number: level}; level 2 stands alone) and "captionBreaks" (a new phrase starts at these words).
  const levels = Array.isArray(storyboard.emphasis) ? Object.fromEntries(storyboard.emphasis.map(i => [i, 1])) : storyboard.emphasis ?? {}, breaks = new Set(storyboard.captionBreaks ?? []);
  const marked = Object.keys(levels).length || breaks.size ? words.map((w, i) => ({...w, ...(levels[i] ? {emph: levels[i], solo: levels[i] >= 2} : {}), ...(breaks.has(i) ? {breakBefore: true} : {})})) : words;
  const sounds = soundCues(storyboard, duration);
  return {footage: true, duration, format, words: marked.filter(w => w.start < duration - .02), overlays, events, cuts, sounds, music: storyboard.music ?? null, voiceLufs: storyboard.voiceLufs, voiceEq: storyboard.voiceEq ?? null, voiceGains: storyboard.voiceGains ?? [], layouts: Boolean(storyboard.layouts), track: faces?.track ?? null, estimated: 0};
}

// ---------- footage layouts: the clip as a card, in half the frame, picture-in-picture, or side by side ----------
// "layouts": [{"at": 3.2, "to": "card", "ramp": 0.3}, {"at": 5.5, "to": "full"}]   — each one holds until the next.
// All numbers are frame pixels (1080x1920). A layout is where the clip's window sits; the clip always fills
// its window (cropped, never stretched), and "face": [u, v] says where in the window the speaker's face should sit.

/** The named layouts. Any field can be overridden on a keyframe: x, y, width, height, rotate (degrees), radius, shadow (0..1), border (px), face, zoom, second. */
export const LAYOUT_PRESETS = {
  full: {x: 0, y: 0, width: 1080, height: 1920, rotate: 0, radius: 0, shadow: 0, border: 0, focus: 0, face: [.5, .45], zoom: 1},
  card: {x: 120, y: 190, width: 840, height: 1200, shadow: 1, focus: 1, face: [.5, .46]},
  top: {x: 0, y: 0, width: 1080, height: 960, focus: 1, face: [.5, .52]},
  bottom: {x: 0, y: 960, width: 1080, height: 960, focus: 1, face: [.5, .5]},
  pip: {x: 680, y: 1150, width: 330, height: 440, shadow: 1, focus: 1, face: [.5, .48]},
  split: {x: 48, y: 480, width: 480, height: 800, shadow: 1, focus: 1, face: [.5, .46], second: {x: 552, y: 480, width: 480, height: 800, raw: true}},
};
const EASES = {glide: x => 1 - Math.pow(1 - x, 4), smooth: smoothstep, linear: x => x, back: x => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }};
const NUMS = ['x', 'y', 'width', 'height', 'rotate', 'radius', 'shadow', 'border', 'focus', 'fx', 'fy', 'zoom'];
/** A keyframe as a full state: preset, then its own overrides. */
function layoutTarget(key) {
  const preset = LAYOUT_PRESETS[key.to ?? 'full'] ?? LAYOUT_PRESETS.full, m = {...LAYOUT_PRESETS.full, ...preset, ...key}, face = key.face ?? preset.face ?? LAYOUT_PRESETS.full.face;
  const state = {fx: face[0], fy: face[1]}; for (const k of NUMS) state[k] ??= m[k];
  const second = key.second === false ? null : key.second || preset.second ? {...preset.second, ...(key.second === true ? {} : key.second)} : null;
  state.second = second ? {x: second.x, y: second.y, width: second.width, height: second.height, rotate: second.rotate ?? 0, raw: second.raw !== false, k: 1} : null;
  state.backdrop = key.backdrop ?? null;
  return state;
}
const mixState = (a, b, q) => {
  const out = {backdrop: b.backdrop ?? a.backdrop}; for (const k of NUMS) out[k] = a[k] + (b[k] - a[k]) * q;
  const s = a.second ?? (b.second && {...b.second, k: 0}), e = b.second ?? (a.second && {...a.second, k: 0});
  out.second = s && e ? {x: s.x + (e.x - s.x) * q, y: s.y + (e.y - s.y) * q, width: s.width + (e.width - s.width) * q, height: s.height + (e.height - s.height) * q, rotate: s.rotate + (e.rotate - s.rotate) * q, raw: (b.second ?? a.second).raw, k: s.k + (e.k - s.k) * q} : null;
  if (out.second && out.second.k < .002) out.second = null;
  return out;
};
const prepared = new WeakMap();
function layoutKeys(storyboard) {
  if (prepared.has(storyboard)) return prepared.get(storyboard);
  const keys = [...(storyboard.layouts ?? [])].sort((a, b) => a.at - b.at).map(key => ({at: key.at, ramp: key.ramp ?? .3, ease: EASES[key.ease] ?? EASES.glide, target: layoutTarget(key)}));
  let from = layoutTarget({to: 'full'}), last = 'blur';
  keys.forEach((key, i) => {
    key.target.backdrop ??= last; last = key.target.backdrop;
    key.from = from;
    const next = keys[i + 1]; if (next) from = mixState(key.from, key.target, key.ramp > 0 ? key.ease(Math.min(1, (next.at - key.at) / key.ramp)) : 1);
  });
  prepared.set(storyboard, keys); return keys;
}
/** The layout state at time t: {x, y, width, height, rotate, radius, shadow, border, focus, fx, fy, zoom, second, backdrop, full}. */
function layoutAt(storyboard, t) {
  let state = layoutTarget({to: 'full'});
  for (const key of layoutKeys(storyboard)) { if (t < key.at - 1e-6) break; state = mixState(key.from, key.target, key.ramp > 0 ? key.ease(Math.min(1, (t - key.at) / key.ramp)) : 1); }
  state.full = !state.second && Math.abs(state.x) < .01 && Math.abs(state.y) < .01 && Math.abs(state.width - 1080) < .01 && Math.abs(state.height - 1920) < .01 && Math.abs(state.rotate) < .001;
  return state;
}
/**
 * The clip's windows ("panes") at time t, with the zoom folded in. Each: {x, y, width, height, rotate, radius, shadow, border, k, raw,
 * s, tx, ty (the clip inside its window: scale and offset, window pixels), m: [a, b, c, d, e, f] (clip pixel -> frame pixel, CSS matrix order)}.
 * Shared by the draft player and the combiner so both place the picture identically.
 */
export function panesAt(storyboard, track, t, format = DEFAULT_FORMAT) {
  const state = layoutAt(storyboard, t), zoom = zoomAt(storyboard, track, t), W = format.width, H = format.height;
  const pane = (r, extra) => {
    const s0 = Math.max(r.width / W, r.height / H), s = s0 * zoom.scale * state.zoom, fcx = zoom.cx * W, fcy = zoom.cy * H;
    const nx = r.width / 2 + (fcx - W / 2) * s0, ny = r.height / 2 + (fcy - H / 2) * s0, px = nx + (state.fx * r.width - nx) * state.focus, py = ny + (state.fy * r.height - ny) * state.focus;
    const tx = Math.min(0, Math.max(r.width - W * s, px - fcx * s)), ty = Math.min(0, Math.max(r.height - H * s, py - fcy * s));
    const a = (r.rotate ?? 0) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), cx = r.x + r.width / 2, cy = r.y + r.height / 2, lx = tx - r.width / 2, ly = ty - r.height / 2;
    return {x: r.x, y: r.y, width: r.width, height: r.height, rotate: r.rotate ?? 0, s, tx, ty, m: [s * cos, s * sin, -s * sin, s * cos, cx + cos * lx - sin * ly, cy + sin * lx + cos * ly], ...extra};
  };
  const panes = [pane(state, {radius: state.radius, shadow: state.shadow, border: state.border, k: 1, raw: false})];
  if (state.second) panes.push(pane(state.second, {radius: state.radius, shadow: state.shadow, border: state.border, k: state.second.k, raw: state.second.raw}));
  return {panes, backdrop: state.backdrop ?? 'blur', full: state.full, zoom};
}
/** Where the face is in the finished frame at time t (0..1 of the frame), after zooms and layouts. */
export function faceInFrame(storyboard, track, t, format = DEFAULT_FORMAT) {
  const face = faceAt(track, t), {panes} = panesAt(storyboard, track, t, format), [a, b, c, d, e, f] = panes[0].m, W = format.width, H = format.height;
  const cx = (face.x + face.w / 2) * W, cy = (face.y + face.h / 2) * H, s = panes[0].s, w = face.w * s, h = face.h * s;
  return {x: (a * cx + c * cy + e) / W - w / 2, y: (b * cx + d * cy + f) / H - h / 2, w, h};
}
/**
 * The authored changes of a footage edit, in seconds: jump cuts (from the edit decision list), zoom changes, effects,
 * transitions, layout changes, graphics arriving and the cues inside them (items ticking, lines typing, cards landing).
 * Changes closer together than `merge` count once. This is what "changes per second" means everywhere it is shown.
 */
export function authoredEvents(storyboard, edl = null, merge = .15) {
  const D = storyboard.footage?.duration ?? 0, ts = [...(edl?.cuts ?? [])];
  for (const z of storyboard.zooms ?? []) ts.push(z.start); for (const e of storyboard.effects ?? []) ts.push(e.at);
  for (const t of storyboard.transitions ?? []) ts.push(t.at); for (const l of storyboard.layouts ?? []) ts.push(l.at);
  for (const o of storyboard.overlays ?? []) {
    if (/scrim/.test(o.piece)) continue;
    ts.push(o.start); const p = o.props ?? {};
    const list = v => Array.isArray(v) ? v : [];      // a prop of the same name can be a number in another piece (hud/data-stream rows: 11)
    const cues = [...list(p.times), ...list(p.lines).map(l => l?.at), ...list(p.items).map(i => i?.at), ...list(p.rows).map(i => i?.at), p.typeAt, p.sendAt, p.postAt, p.pressAt, p.cutAt, p.sortAt, p.bAt, p.swapAt, p.note?.at];
    for (const c of cues) if (typeof c === 'number') ts.push(o.start + c - (o.offset ?? 0));
  }
  const all = ts.filter(t => t >= 0 && t < D).sort((a, b) => a - b), out = [];
  for (const t of all) if (!out.length || t - out.at(-1) > merge) out.push(t);
  return out;
}
/** Whole-edit numbers a piece may show (always true of this very storyboard): passed to every overlay as props.project. */
export function projectStats(storyboard, edl = null) {
  const o = storyboard.overlays ?? [], events = authoredEvents(storyboard, edl), D = storyboard.footage?.duration ?? 0;
  return {duration: D, graphics: o.filter(x => !/scrim|backdrop/.test(x.piece)).length, effects: (storyboard.effects ?? []).length, transitions: (storyboard.transitions ?? []).length, zooms: (storyboard.zooms ?? []).length,
    layouts: (storyboard.layouts ?? []).length, sounds: (storyboard.sounds ?? []).length,
    changes: events.length, pace: Array.from({length: Math.ceil(D)}, (_, i) => events.filter(t => t >= i && t < i + 1).length),      // authored changes in each second of the clip
    edl: edl ? {before: edl.duration?.before, after: edl.duration?.after, cuts: (edl.cuts ?? []).length, segments: (edl.segments ?? []).map(s => ({in: s.in, out: s.out, at: s.at, length: s.length})), pauses: (edl.pauses ?? []).map(p => ({from: p.from, to: p.to}))} : null};
}

/** `library` = the storyboard theme's {pieces, captions, effects, transitions}; `libraryOf(theme)` reads another theme's, for overlays, effects and transitions that name their own ("theme": "gta6"); `sfx` = Set of sound names. */
export function checkFootageStoryboard(storyboard, library, libraryOf = () => library, sfx = null) {
  const problems = eventSoundProblems(storyboard, sfx), duration = storyboard.footage?.duration;
  if (!storyboard.footage?.file || !(duration > 0)) return ['"footage" needs "file" and "duration". Start footage projects with: npm run footage <project> <video>'];
  const lib = (item, label) => { if (!item.theme) return library; try { return libraryOf(item.theme); } catch (error) { problems.push(`${label}: ${error.message.split('\n')[0]}`); return null; } };
  if (storyboard.captions && !library.captions.has(storyboard.captions)) problems.push(`Unknown caption style "${storyboard.captions}". Options: ${[...library.captions].join(', ')}.`);
  (storyboard.overlays ?? []).forEach((o, i) => {
    const name = `Overlay ${i + 1} (${o.piece})`, from = lib(o, name);
    if (from && !from.pieces.has(o.piece)) problems.push(`${name}: not in the ${o.theme ?? 'storyboard'} theme. Pieces: ${[...from.pieces].join(', ')}.`);
    if (!(o.start >= 0 && o.end > o.start)) problems.push(`${name}: needs "start" and a later "end", in seconds.`);
    if (o.start >= duration) problems.push(`${name}: starts after the footage ends (${duration}s).`);
    // "behind": true = under the clip's windows (layouts); "person" = over the clip but behind the person (cut out per frame when the video is made)
    if (o.behind !== undefined && ![true, false, 'person'].includes(o.behind)) problems.push(`${name}: "behind" is true (under the clip's windows) or "person" (behind the person), got ${JSON.stringify(o.behind)}.`);
    // "exit": "slice" or {"type": "slice", "at": seconds into the overlay, "angle": degrees, "y": 0..1 down the overlay's box}
    if (o.exit !== undefined) {
      const x = o.exit === 'slice' ? {type: 'slice'} : o.exit;
      if (x?.type !== 'slice' || typeof x !== 'object') problems.push(`${name}: "exit" is "slice" or {"type": "slice", "at": <seconds into the overlay>, "angle": <degrees>}, got ${JSON.stringify(o.exit)}.`);
      else {
        const unknown = Object.keys(x).filter(k => !['type', 'at', 'angle', 'y'].includes(k));
        if (unknown.length) problems.push(`${name}: "exit" does not take ${unknown.map(k => `"${k}"`).join(', ')} (it takes "type", "at", "angle", "y").`);
        if (x.at !== undefined && !(typeof x.at === 'number' && x.at >= 0 && x.at < o.end - o.start)) problems.push(`${name}: "exit" "at" is seconds into the overlay, from 0 to under its length (${+(o.end - o.start).toFixed(2)}s), got ${JSON.stringify(x.at)}.`);
        if (x.angle !== undefined && !(typeof x.angle === 'number' && Math.abs(x.angle) <= 80)) problems.push(`${name}: "exit" "angle" is the cut line's tilt in degrees, between -80 and 80, got ${JSON.stringify(x.angle)}.`);
        if (x.y !== undefined && !(typeof x.y === 'number' && x.y >= 0 && x.y <= 1)) problems.push(`${name}: "exit" "y" is where the cut line crosses the overlay's middle, 0 (top) to 1 (bottom), got ${JSON.stringify(x.y)}.`);
      }
    }
  });
  for (const e of [...(storyboard.effects ?? []), ...(storyboard.footage.look ? [storyboard.footage.look] : [])]) { const from = lib(e, `Effect "${e.name}"`); if (from && !from.effects.has(e.name)) problems.push(`Effect "${e.name}" is not in the ${e.theme ?? 'storyboard'} theme. Options: ${[...from.effects].join(', ')}.`); if (e.where !== undefined && !EFFECT_PLACES.includes(e.where)) problems.push(`Effect "${e.name}" at ${e.at}s: "where" must be one of ${EFFECT_PLACES.join(', ')} (got "${e.where}").`); }
  (storyboard.transitions ?? []).forEach((t, i) => {
    const from = lib(t, `Transition ${i + 1}`); if (from) problems.push(...checkTransition(t, `Transition ${i + 1}`, from));
    if (!(t.at > 0 && t.at < duration)) problems.push(`Transition ${i + 1}: needs "at", the cut it sits on, in seconds inside the footage (${duration}s).`);
  });
  for (const z of storyboard.zooms ?? []) if (!(z.end > z.start && z.scale >= 1 && z.scale <= 2)) problems.push('Each zoom needs start < end and a scale between 1 and 2.');
  (storyboard.layouts ?? []).forEach((k, i) => {
    const name = `Layout ${i + 1}`;
    if (!(k.at >= 0 && k.at < duration)) problems.push(`${name}: needs "at", in seconds inside the footage.`);
    if (k.to != null && !LAYOUT_PRESETS[k.to]) problems.push(`${name}: unknown layout "${k.to}". Options: ${Object.keys(LAYOUT_PRESETS).join(', ')}.`);
    if (k.ease && !EASES[k.ease]) problems.push(`${name}: unknown ease "${k.ease}". Options: ${Object.keys(EASES).join(', ')}.`);
    if (k.backdrop && k.backdrop !== 'blur' && !/^#[0-9a-fA-F]{6}$/.test(k.backdrop)) problems.push(`${name}: "backdrop" is "blur" or a "#rrggbb" colour.`);
    const t = layoutTarget(k); for (const r of [t, t.second].filter(Boolean)) if (!(r.width >= 40 && r.height >= 40)) problems.push(`${name}: the window needs a width and height of at least 40.`);
  });
  (storyboard.captionTrack ?? []).forEach((c, i) => {
    const name = `Caption track ${i + 1}`, from = lib(c, name);
    if (!(c.start >= 0 && c.end > c.start)) problems.push(`${name}: needs "start" and a later "end".`);
    if (c.style && from && !from.captions.has(c.style)) problems.push(`${name}: unknown caption style "${c.style}". Options: ${[...from.captions].join(', ')}.`);
  });
  (storyboard.sounds ?? []).forEach((s, i) => {
    if (sfx && !sfx.has(s.name)) problems.push(`Sound ${i + 1}: "${s.name}" is not in library/_shared/sfx. Options: ${[...sfx].join(', ')}.`);
    if (!(s.at >= 0 && s.at < duration)) problems.push(`Sound ${i + 1} (${s.name}): needs "at", in seconds inside the footage.`);
    if (s.gain != null && !(s.gain <= 0 && s.gain >= -60)) problems.push(`Sound ${i + 1} (${s.name}): "gain" is in dB, between -60 and 0.`);
  });
  return problems;
}

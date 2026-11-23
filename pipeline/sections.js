// Sections: the named parts of a video ("hook", "reels", …), and what is on screen in each.
// Plain ES module with no dependencies beyond timeline.js, so the checker, the combiner, the review
// command (Node) and the review page (browser) all agree on where every section starts and ends.
//
// A storyboard may name its sections:
//   footage:  "sections": [{"id": "hook", "title": "Hook", "start": 0, "end": 1.7, "job": "hook"}, …]
//             seconds into the clip, covering it from 0 to the end with no gaps and no overlaps
//   shots:    "sections": [{"id": "open", "title": "The problem", "shots": ["hook", "pipeline"], "job": "hook"}, …]
//             every shot in exactly one section, in running order (times follow the narration)
// A storyboard without "sections" still has them: they are derived (sectionsOf) — one per shot, or for
// footage from the cuts in the picture (transitions, layout changes, full-screen cutaways).
import {effectPlan, soundCues, transitionPlan} from './timeline.js';

const ID = /^[a-z0-9-]+$/, EPS = 2e-3;
const r3 = x => Math.round(x * 1000) / 1000;
/** Seconds for people: 18.2 */
export const secs = t => (Math.round(t * 10) / 10).toFixed(1);

/** Problems with a storyboard's own "sections" (none if it has none: they are derived then). */
export function checkSections(storyboard) {
  const list = storyboard.sections, problems = [];
  if (list == null) return problems;
  if (!Array.isArray(list) || !list.length) return ['"sections" must be a list with at least one section (or leave it out and sections are derived).'];
  const seen = new Set();
  const basics = (s, name) => {
    if (!s || typeof s !== 'object') { problems.push(`${name}: must be an object.`); return false; }
    if (!ID.test(s.id || '')) problems.push(`${name}: needs an "id" made of lowercase letters, digits and dashes.`);
    else if (seen.has(s.id)) problems.push(`${name}: duplicate id.`);
    seen.add(s.id);
    if (s.title != null && typeof s.title !== 'string') problems.push(`${name}: "title" must be text.`);
    if (s.job != null && typeof s.job !== 'string') problems.push(`${name}: "job" must be text (hook, proof, demo, payoff, ask …).`);
    return true;
  };
  if (storyboard.footage) {
    const duration = storyboard.footage.duration;
    let cursor = 0;
    list.forEach((s, i) => {
      const name = `Section ${i + 1}${s?.id ? ` "${s.id}"` : ''}`;
      if (!basics(s, name)) return;
      if (!(typeof s.start === 'number' && typeof s.end === 'number' && s.end > s.start)) { problems.push(`${name}: needs "start" and a later "end", in seconds.`); return; }
      if (s.start > cursor + EPS) problems.push(`${name}: leaves a gap — ${i ? 'the section before ends' : 'the video starts'} at ${r3(cursor)}s but this one starts at ${s.start}s.`);
      else if (s.start < cursor - EPS) problems.push(`${name}: overlaps the section before (starts at ${s.start}s, before ${r3(cursor)}s).`);
      cursor = s.end;
    });
    if (duration > 0 && !problems.length && Math.abs(cursor - duration) > .05) problems.push(`Sections must cover the whole clip: the last one ends at ${r3(cursor)}s but the footage is ${duration}s long.`);
  } else {
    const order = (storyboard.shots ?? []).map(shot => shot.id);
    let next = 0;
    list.forEach((s, i) => {
      const name = `Section ${i + 1}${s?.id ? ` "${s.id}"` : ''}`;
      if (!basics(s, name)) return;
      if (!Array.isArray(s.shots) || !s.shots.length) { problems.push(`${name}: needs "shots", the ids of the shots it covers, in order.`); return; }
      for (const id of s.shots) {
        if (order[next] === id) next++;
        else problems.push(`${name}: expected shot "${order[next] ?? '(no more shots)'}" here, found "${id}". Sections list every shot once, in running order.`);
      }
    });
    if (!problems.length && next < order.length) problems.push(`Sections must cover every shot: "${order.slice(next).join('", "')}" ${order.length - next > 1 ? 'are' : 'is'} in no section.`);
  }
  return problems;
}

const lead = (words, start, end, n = 5) => {
  const said = words.filter(w => w.start >= start - .05 && w.start < end - .05);
  if (!said.length) return '';
  return said.slice(0, n).map(w => w.text).join(' ').replace(/[,.;:!?…]+$/, '') + (said.length > n ? '…' : '');
};

/**
 * The sections of a storyboard: [{id, title, start, end, job, shots?, derived}], in order, covering the video.
 * @param words     footage: the words of words.json (used only to title derived sections)
 * @param timeline  shot storyboards: the buildTimeline() result (sections follow the narration's real timing)
 */
export function sectionsOf(storyboard, {words = [], timeline = null} = {}) {
  if (!storyboard.footage) {
    const shots = timeline?.shots ?? [], placed = new Map(shots.map(s => [s.id, s]));
    if (Array.isArray(storyboard.sections) && storyboard.sections.length) {
      return storyboard.sections.map(s => {
        const mine = (s.shots ?? []).map(id => placed.get(id)).filter(Boolean);        // shots left out of this cut are simply not there
        return mine.length ? {id: s.id, title: s.title ?? s.id, job: s.job ?? '', shots: mine.map(m => m.id), start: mine[0].start, end: mine.at(-1).end, derived: false} : null;
      }).filter(Boolean);
    }
    return shots.map(shot => ({id: shot.id, title: shot.title || lead(shot.words ?? [], shot.start, shot.end) || shot.id, job: '', shots: [shot.id], start: shot.start, end: shot.end, derived: true}));
  }
  const D = storyboard.footage.duration;
  if (Array.isArray(storyboard.sections) && storyboard.sections.length) return storyboard.sections.map(s => ({id: s.id, title: s.title ?? s.id, job: s.job ?? '', start: s.start, end: s.end, derived: false}));
  // Derived: first the cuts in the picture, then any stretch still longer than LONG is split where a graphic arrives or a sentence ends.
  const MIN = 1.2, LONG = 6, AIM = 4, inside = t => typeof t === 'number' && t > 0 && t < D;
  const cuts = [...(storyboard.transitions ?? []).map(t => t.at), ...(storyboard.layouts ?? []).map(l => l.at), ...(storyboard.overlays ?? []).filter(o => o.cutaway).flatMap(o => [o.start, o.end])].filter(inside).sort((a, b) => a - b);
  let bounds = [0];
  for (const t of cuts) if (t - bounds.at(-1) >= MIN && D - t >= MIN) bounds.push(t);
  bounds.push(D);
  const soft = [...(storyboard.overlays ?? []).filter(o => !/scrim|backdrop/.test(o.piece)).map(o => o.start), ...words.filter((w, i) => i && /[.!?…]$/.test(words[i - 1].text)).map(w => w.start)].filter(inside).sort((a, b) => a - b);
  const out = [0];
  for (let i = 1; i < bounds.length; i++) {
    let a = bounds[i - 1]; const b = bounds[i];
    while (b - a > LONG) {
      const options = soft.filter(t => t >= a + MIN && t <= b - MIN), target = a + AIM;
      a = options.length ? options.reduce((best, t) => Math.abs(t - target) < Math.abs(best - target) ? t : best) : Math.min(target, b - MIN);
      out.push(a);
    }
    out.push(b);
  }
  bounds = out.map(r3); bounds[bounds.length - 1] = D;
  return bounds.slice(1).map((end, i) => {
    const start = bounds[i], main = (storyboard.overlays ?? []).filter(o => !/scrim|backdrop/.test(o.piece) && o.start < end && o.end > start).sort((x, y) => (Math.min(y.end, end) - Math.max(y.start, start)) - (Math.min(x.end, end) - Math.max(x.start, start)))[0];
    return {id: 's' + String(i + 1).padStart(2, '0'), title: lead(words, start, end) || (main ? main.piece.split('/')[1] : `Part ${i + 1}`), job: '', start, end, derived: true};
  });
}

/** The sections a range touches. Less than a frame of overlap does not count (marks are stored to the millisecond, cuts fall on thirds of one). */
const SLACK = .02;
export const touching = (sections, start, end) => sections.filter(s => s.start < end - SLACK && s.end > start + SLACK);

/** The section a moment falls in (the last one for the very end). */
export const sectionAt = (sections, t) => sections.find(s => t >= s.start - 1e-6 && t < s.end - 1e-6) ?? (t < (sections[0]?.start ?? 0) ? sections[0] : sections.at(-1));

/**
 * A range named on the command line or in a mark: a section id ("reels"), two ids ("reels..follow"), or seconds ("18.2-20.4").
 * @returns {id (safe for a file name), start, end, sections: [the sections it touches]}
 */
export function resolveRange(sections, spec, duration) {
  const text = String(spec ?? '').trim();
  const one = sections.find(s => s.id === text);
  if (one) return {id: one.id, start: one.start, end: one.end, sections: [one]};
  const pair = /^([a-z0-9-]+)\.\.([a-z0-9-]+)$/.exec(text), from = pair && sections.find(s => s.id === pair[1]), to = pair && sections.find(s => s.id === pair[2]);
  if (from && to && to.end > from.start) return {id: `${from.id}--${to.id}`, start: from.start, end: to.end, sections: touching(sections, from.start, to.end)};
  const times = /^(\d+(?:\.\d+)?)\s*(?:-|–|\.\.|:)\s*(\d+(?:\.\d+)?)$/.exec(text);
  if (times) {
    const start = Math.max(0, Number(times[1])), end = Math.min(duration, Number(times[2]));
    if (!(end > start)) throw Error(`"${text}" is not a range inside the video (0–${secs(duration)} s).`);
    return {id: `${start.toFixed(2)}-${end.toFixed(2)}`.replaceAll('.', '_'), start, end, sections: touching(sections, start, end)};
  }
  throw Error(`No section "${text}". Sections: ${sections.map(s => `${s.id} (${secs(s.start)}–${secs(s.end)})`).join(', ')}. Or give seconds: 18.2-20.4`);
}

/** The short reference people paste into a message: `talking-head-2-fashion · reels (18.2–20.4 s)`. */
export function referenceOf(project, sections, start, end) {
  const hit = touching(sections, start, end);
  const name = !hit.length ? '' : hit.length === 1 ? hit[0].id : `${hit[0].id}→${hit.at(-1).id}`;
  return `${project} · ${name ? name + ' ' : ''}(${secs(start)}–${secs(end)} s)`;
}

/**
 * What is where: the lanes of a timeline, read from the storyboard. Each lane: {id, label, items: [{start, end, label, detail?, at?}]}.
 * @param timeline  buildFootageTimeline() or buildTimeline() result
 */
export function lanesOf(storyboard, timeline) {
  const D = timeline.duration, lanes = [], lane = (id, label, items) => { items = items.filter(i => i.end > i.start && i.start < D).map(i => ({...i, start: Math.max(0, i.start), end: Math.min(D, i.end)})).sort((a, b) => a.start - b.start); if (items.length) lanes.push({id, label, items}); };
  const fps = timeline.format?.fps ?? 30;
  if (storyboard.footage) {
    lane('graphics', 'Graphics', (storyboard.overlays ?? []).map((o, index) => ({start: o.start, end: o.end, label: o.piece, index,
      detail: [o.theme && `theme ${o.theme}`, o.cutaway && 'full screen', o.behind && 'behind the clip', o.region && `in ${o.region.width}×${o.region.height} at ${o.region.x},${o.region.y}`].filter(Boolean).join(' · ')})));
    const keys = [...(storyboard.layouts ?? [])].sort((a, b) => a.at - b.at);
    lane('layouts', 'Layout', keys.map((k, i) => ({start: k.at, end: keys[i + 1]?.at ?? D, label: k.to ?? (k.width ? `window ${k.width}×${k.height}` : 'custom'),
      detail: [k.backdrop && `backdrop ${k.backdrop}`, k.ramp === 0 ? 'hard switch' : `${k.ramp ?? .3}s move`].filter(Boolean).join(' · ')})));
    lane('zooms', 'Zooms', (storyboard.zooms ?? []).map(z => ({start: z.start, end: z.end, label: `×${z.scale}`})));
    lane('effects', 'Effects', (storyboard.effects ?? []).map(e => ({start: e.at, end: e.at + (e.seconds ?? .3), label: e.name, detail: [e.layer === 'all' && 'whole picture', e.theme && `theme ${e.theme}`, `amount ${e.amount ?? .6}`].filter(Boolean).join(' · ')})));
    lane('transitions', 'Transitions', (storyboard.transitions ?? []).map(t => ({start: t.at - (t.seconds ?? .4) / 2, end: t.at + (t.seconds ?? .4) / 2, at: t.at, label: t.name, detail: [`${t.seconds ?? .4}s`, t.theme && `theme ${t.theme}`].filter(Boolean).join(' · ')})));
    lane('sounds', 'Sounds', (timeline.sounds ?? soundCues(storyboard, D)).map(s => ({start: s.at, end: s.at + .12, at: s.at, label: s.name, detail: `${s.gain != null ? s.gain + ' dB' : 'default level' + (s.trim ? ` ${s.trim} dB` : '')}${s.auto ? ' · automatic' : ''}`, point: true})));
    const spans = [...(storyboard.captionTrack ?? [])].sort((a, b) => a.start - b.start), captions = [], base = storyboard.captions ?? null, name = c => c.hide ? 'hidden' : (c.style ?? base ?? 'none');
    let at = 0;
    for (const c of spans) { if (c.start > at + 1e-6 && base) captions.push({start: at, end: c.start, label: base}); captions.push({start: c.start, end: c.end, label: name(c), detail: [c.theme && `theme ${c.theme}`, c.dy && `moved ${c.dy}px`].filter(Boolean).join(' · '), hidden: Boolean(c.hide)}); at = Math.max(at, c.end); }
    if (at < D - 1e-6 && base) captions.push({start: at, end: D, label: base});
    lane('captions', 'Captions', captions);
  } else {
    lane('graphics', 'Graphics', timeline.shots.flatMap(shot => [shot.visual?.piece && {start: shot.start, end: shot.end, label: shot.visual.piece, detail: `shot ${shot.id}`}, shot.background?.piece && {start: shot.start, end: shot.end, label: shot.background.piece, detail: `shot ${shot.id} · background`}].filter(Boolean)));
    lane('effects', 'Effects', effectPlan(timeline).events.map(e => ({start: e.start / fps, end: e.end / fps, label: e.effect, detail: `${e.where} · amount ${e.amount}`})));
    lane('transitions', 'Transitions', transitionPlan(timeline).cuts.map(c => ({start: (c.frame - c.frames / 2) / fps, end: (c.frame + c.frames / 2) / fps, at: c.frame / fps, label: c.name, detail: `${r3(c.frames / fps)}s`})));
    if (storyboard.captions) lane('captions', 'Captions', [{start: 0, end: D, label: storyboard.captions}]);
  }
  lane('words', 'Words', (timeline.words ?? []).map((w, i) => ({start: w.start, end: Math.max(w.end, w.start + .02), label: w.text, index: i, emph: w.emph ?? 0})));
  return lanes;
}

/** What is on screen between two moments, lane by lane (items that overlap the range). */
export const within = (lanes, start, end) => lanes.map(l => ({...l, items: l.items.filter(i => i.start < end - SLACK && i.end > start + SLACK)})).filter(l => l.items.length);

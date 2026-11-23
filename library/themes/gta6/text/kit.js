// GTA6 text-effects kit. Title cards and text overlays in the theme's comic look: chunky
// gradient lettering with a heavy ink outline and hard drop shadow, angled panels with pale gutters,
// halftone and ink. Every `text/` piece draws with this file; everything style-specific — fonts,
// colour fields, how the names used by other themes map onto this one — lives in `theme` below.
// Everything here is a pure function of its inputs: pieces set every animated value from t.
import {C, F, GRADS, P, defineGradients, poly, quad, panel, inked, halftone, rays, sun, burst, tab, clamp, span, mix, easeOut, easeBack, hash, noise} from '../coast.js';
export {C, F, P, poly, quad, panel, inked, halftone, rays, sun, burst, clamp, span, mix, easeOut, easeBack, hash, noise};

// ---------------------------------------------------------------- theme
export const theme = {
  fonts: {head: F.display, sub: F.caps, script: F.script, comic: F.comic, body: F.body},
  /** A backdrop and the fills that sit on it. bg/head/alt/panel are gradient or palette names from coast.js. */
  fields: {
    sunset: {bg: 'sunset', dots: C.plum, head: 'hot', alt: 'paper', panel: 'dusk', tab: 'pink', accent: 'yellow', sun: true},
    dusk: {bg: 'dusk', dots: C.violet, head: 'hot', alt: 'cool', panel: 'candy', tab: 'pink', accent: 'yellow'},
    candy: {bg: 'candy', dots: C.plum, head: 'gold', alt: 'paper', panel: 'dusk', tab: 'yellow', accent: 'aqua'},
    sea: {bg: 'sea', dots: C.paper, head: 'gold', alt: 'paper', panel: 'dusk', tab: 'pink', accent: 'yellow'},
    gold: {bg: 'gold', dots: C.orange, head: 'candy', alt: 'paper', panel: 'dusk', tab: 'night', accent: 'pink'},
    paper: {bg: 'paper', dots: C.pink, head: 'hot', alt: 'candy', panel: 'dusk', tab: 'pink', accent: 'teal'},
  },
  /** Field and colour names other themes use, so a storyboard can switch themes without editing props. */
  fieldAlias: {blue: 'dusk', black: 'dusk', red: 'sunset', lime: 'gold', white: 'paper', magenta: 'candy', violet: 'dusk', sky: 'sea'},
  toneAlias: {lime: 'yellow', blue: 'violet', red: 'pink', magenta: 'pink', black: 'night', white: 'paper'},
  light: ['yellow', 'paper', 'aqua', 'gold', 'cool', 'white', 'hot'],      // fills that take dark text
  gutter: 30, slant: 34, margin: 84,
};
export const fieldOf = name => theme.fields[name] ?? theme.fields[theme.fieldAlias[name]] ?? theme.fields.sunset;
/** A fill name in this theme for a colour name from any theme ('lime' -> 'yellow'); CSS colours pass through. */
export const tone = c => theme.toneAlias[c] ?? c;
/** Readable text colour on a fill. */
export const inkOn = fill => theme.light.includes(fill) ? C.ink : C.paper;
export const up = s => String(s ?? '').toUpperCase();
export const oneLine = s => String(s ?? '').replace(/\s*\n\s*/g, ' ');

let stages = 0;
/**
 * An SVG stage.
 *   overlay: true -> transparent 1080x1920, to sit on footage.
 *   otherwise     -> a full-frame card: 1080 wide and as tall as the element it is mounted in
 *                    (1080 square up to 1920 portrait), so lay out from W and H. The card gets its
 *                    field's backdrop, halftone and rays, and a comic-page gutter frame on top.
 * Draw into `root`; `burstG` is the turning rays behind everything (spin it from seek).
 */
export function textStage(el, {overlay = false, field = 'sunset', frame = true} = {}) {
  const d3 = window.d3, id = `tx${++stages}`, W = 1080, cw = el.clientWidth || 1080, ch = el.clientHeight || 1920;
  const H = overlay ? 1920 : Math.round(clamp(W * ch / cw, 1080, 1920)), ink = fieldOf(field);
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet').style('overflow', 'hidden');
  const defs = svg.append('defs'); defineGradients(svg, defs, id);
  const back = svg.append('g'), root = svg.append('g'), front = svg.append('g'), stage = {svg, defs, root, back, front, id, W, H, ink, k: H / 1920, sq: H < 1500, n: 0};
  el.style.background = overlay ? 'transparent' : C.night;
  if (!overlay) {
    backdrop(back, stage, ink, 0, 0, W, H);
    if (frame) pageFrame(front, stage);
  }
  return stage;
}
/** A field's backdrop in a box: gradient, turning rays, halftone and (on the sunset field) a sun. Returns the rays. */
export function backdrop(g, stage, ink, x, y, w, h) {
  g.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', h).attr('fill', P(g, ink.bg));
  const spin = g.append('g').attr('transform', `translate(${x + w / 2} ${y + h * .5})`).append('g'); rays(spin, 0, 0, Math.hypot(w, h), 16, C.paper, .13);
  if (ink.sun) sun(g, x + w / 2, y + h * .8, Math.min(w, h) * .34).attr('opacity', .55);
  halftone(g, x, y, w, h * .5, {color: ink.dots, from: 'top', cell: 38, opacity: .4});
  halftone(g, x, y + h * .62, w, h * .38, {color: ink.dots, from: 'bottom', cell: 38, opacity: .3});
  stage.burstG ??= spin; return spin;
}
/** The comic-page border of a card: a pale gutter round the edge with ink keylines and slanted top and bottom. */
export function pageFrame(g, stage) {
  const {W, H} = stage, m = theme.gutter, s = theme.slant, inner = [[m, m + s], [W - m, m], [W - m, H - m - s], [m, H - m]];
  g.append('path').attr('d', `M0 0H${W}V${H}H0Z${poly(inner)}`).attr('fill-rule', 'evenodd').attr('fill', C.paper);
  g.append('path').attr('d', poly(inner)).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 9);
}
const uid = stage => `${stage.id}-${++stage.n}`;
export function clipBox(stage, x, y, w, h) { const id = uid(stage); stage.defs.append('clipPath').attr('id', id).append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', h); return `url(#${id})`; }
export function clipPoly(stage, pts) { const id = uid(stage); stage.defs.append('clipPath').attr('id', id).append('path').attr('d', poly(pts)); return `url(#${id})`; }

// ---------------------------------------------------------------- text: measuring, fitting, splitting
const ctx = document.createElement('canvas').getContext('2d'), caps = {};
const css = (size, {font = theme.fonts.head, weight = 400} = {}) => `${weight} ${size}px ${font}`;
export function measure(str, size, o = {}) { ctx.font = css(100, o); return (ctx.measureText(str).width + (o.spacing ?? .01) * 100 * [...str].length) * size / 100; }
export function capH(size, o = {}) { const key = css(100, o); if (!caps[key]) { ctx.font = key; caps[key] = ctx.measureText('H').actualBoundingBoxAscent || 72; } return caps[key] * size / 100; }
/** The largest size (up to max) at which every line fits the width. */
export const fit = (lines, width, max, o = {}) => Math.min(max, ...[].concat(lines).map(l => 100 * width / Math.max(1, measure(l, 100, o))));
export function wrap(str, size, width, o = {}) {
  const lines = []; let line = '';
  for (const word of String(str).split(/\s+/).filter(Boolean)) { const next = line ? line + ' ' + word : word; if (line && measure(next, size, o) > width) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line); return lines;
}
/** The largest size (max down to min) at which the sentence wraps inside a width x height box. */
export function flow(str, width, height, max, min = 30, o = {}, leading = 1.2) {
  for (let size = max; ; size -= 4) { const lines = wrap(str, size, width, o); if (size <= min || (lines.length * capH(size, o) * leading * 1.25 <= height && lines.every(l => measure(l, size, o) <= width))) return {size, lines, pitch: capH(size, o) * leading * 1.25}; }
}
/** Plain text; '\n' starts a new line. */
export function txt(g, x, y, str, {size = 30, color = C.paper, font = theme.fonts.sub, weight = 400, anchor = 'start', spacing = .05, leading = 1.15, ink = 0} = {}) {
  const node = g.append('text').attr('x', x).attr('y', y).attr('fill', P(g, color)).attr('text-anchor', anchor).style('font', css(size, {font, weight})).style('letter-spacing', `${spacing}em`);
  if (ink) node.attr('stroke', C.ink).attr('stroke-width', ink).attr('stroke-linejoin', 'round').attr('paint-order', 'stroke');
  String(str ?? '').split('\n').forEach((line, i) => node.append('tspan').attr('x', x).attr('dy', i ? `${leading}em` : 0).text(line));
  return node;
}
/**
 * A line of chunky lettering split into separately animated units: by 'letter', 'word' or 'all'.
 * Shadows, outlines and faces are drawn in three passes so one letter's outline never covers its
 * neighbour's face. Returns [{parts, cx, y, w, cap, i, n}]; move a unit with pose().
 */
export function glyphs(g, str, x, y, size, {by = 'letter', anchor = 'start', fill = 'hot', font = theme.fonts.head, weight = 400, spacing = .01, outline = null, shadow = null, rim = 0} = {}) {
  const o = {font, weight, spacing}, total = measure(str, size, o) - spacing * size, x0 = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x, cap = capH(size, o);
  const ol = outline ?? Math.max(5, size * .07), sh = shadow ?? Math.max(4, size * .065), layers = [g.append('g'), g.append('g'), g.append('g')];
  const parts = by === 'letter' ? [...str].map((c, i) => [c, i]) : by === 'word' ? [...str.matchAll(/\S+/g)].map(m => [m[0], m.index]) : [[str, 0]];
  return parts.filter(([c]) => c.trim()).map(([c, at], i, all) => {
    const w = measure(c, size, o) - spacing * size, cx = x0 + measure(str.slice(0, at), size, o) + w / 2;
    const make = (layer, attrs) => { const inner = layer.append('g').attr('transform', `translate(${cx} ${y})`).append('g'), t = inner.append('text').attr('text-anchor', 'middle').style('font', css(size, o)).style('letter-spacing', by === 'letter' ? null : `${spacing}em`).attr('stroke-linejoin', 'round').text(c); for (const [k, v] of Object.entries(attrs)) t.attr(k, v); return inner; };
    const ps = [make(layers[0], {fill: C.ink, stroke: C.ink, 'stroke-width': (ol + rim) * 2, transform: `translate(${sh} ${sh})`}), make(layers[1], {fill: rim ? C.paper : C.ink, stroke: C.ink, 'stroke-width': (ol + rim) * 2}), make(layers[2], {fill: P(g, fill), stroke: rim ? C.paper : 'none', 'stroke-width': rim * 2, 'paint-order': 'stroke'})];
    return {parts: ps, cx, y, w, cap, size, i, n: all.length, str: c};
  });
}
/** Move, scale (about the middle of the cap height), rotate, skew and fade one unit from glyphs(). */
export function pose(u, {x = 0, y = 0, sx = 1, sy = sx, rot = 0, skew = 0, o = 1} = {}) {
  const tr = `translate(${x} ${y - u.cap / 2}) rotate(${rot}) skewX(${skew}) scale(${sx || .0001} ${sy || .0001}) translate(0 ${u.cap / 2})`;
  for (const p of u.parts) p.attr('transform', tr).attr('opacity', o);
}

// ---------------------------------------------------------------- motion
export const spring = x => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(10 * x); };
/** Speed of an ease-out move at progress q (0 when resting): use it to stretch things that move fast. */
export const vel = q => q <= 0 || q >= 1 ? 0 : 3 * (1 - q) * (1 - q);
export const easeIn = x => { x = clamp(x); return x * x * x; };
/** 0 while an overlay is up, rising to 1 over its last `len` seconds when the storyboard gives it a `life`. */
export const leave = (t, life, len = .3) => life ? easeIn(span(t, life - len, len)) : 0;
/** The standard slam: a unit drops in oversized, overshoots and settles, stretched while it moves; `x` is the leave amount. */
export function slam(u, q, x = 0, {from = 2.4, drop = 0, rot = 0} = {}) {
  const s = spring(q), sc = 1 + (from - 1) * (1 - s);
  pose(u, {y: -drop * (1 - s) + x * u.cap * 1.6, sx: sc * (1 - x * .3), sy: sc * (1 + vel(q) * .14) * (1 - x * .3), rot: rot * (1 - s) + x * 8, o: q <= 0 ? 0 : 1 - x});
}
/** A unit rising into place from below with a stretch. */
export function rise(u, q, x = 0, dist = 120) { const e = easeOut(q); pose(u, {y: dist * (1 - e) - x * 90, sy: 1 + vel(q) * .18, sx: 1 - vel(q) * .05, rot: (1 - e) * 5, o: clamp(q * 4) * (1 - x)}); }
/** Scale for a thing that pops: 0, overshoot, 1. */
export const pop = (t, start, length = .32) => t < start ? 0 : easeBack(span(t, start, length));
/** A decaying shake offset after an impact at `start`. */
export const shake = (t, start, amp = 14) => { const k = t - start; if (k < 0 || k > .5) return [0, 0]; const e = amp * Math.exp(-k * 9); return [Math.sin(k * 70) * e, Math.cos(k * 53) * e]; };
export const place = (sel, x, y, scale = 1, rot = 0) => sel.attr('transform', `translate(${x} ${y}) rotate(${rot}) scale(${Math.max(.0001, scale)})`);

// ---------------------------------------------------------------- marks
/** A slanted label tab; '\n' in the label becomes a space. Origin at its left-middle. Returns {g, w, h}. */
export const label = (g, str, {size = 34, fill = 'pink', spacing = .08, font = theme.fonts.sub} = {}) => tab(g, 0, 0, up(oneLine(str)), {size, fill, color: inkOn(fill), spacing, font});
/**
 * The small labels most cards carry in their corners (the `labels` prop: top-left, top-right,
 * bottom-left, bottom-right). Returns seek(t, start) which pops them in.
 */
export function cornerLabels(stage, labels = [], {size = null, fills = ['pink', 'yellow', 'night', 'aqua']} = {}) {
  const {W, H, front} = stage, m = theme.margin - 14, s = size ?? 30 + 6 * stage.k, tabs = labels.slice(0, 4).map((l, i) => l ? label(front, l, {size: s, fill: fills[i % fills.length]}) : null);
  return (t, start = .5) => tabs.forEach((tb, i) => { if (!tb) return; const right = i % 2 === 1, bottom = i > 1; place(tb.g, right ? W - m - tb.w : m, bottom ? H - m - 26 : m + 58, pop(t, start + i * .1), right ? 2 : -3); });
}
/**
 * A marquee strip: the text repeated end to end with a burst between copies. set(offset) scrolls it
 * (px, either sign). Draw the band behind it yourself. `y` is the baseline.
 */
export function strip(g, stage, str, y, size, {color = C.paper, mark = C.yellow, font = theme.fonts.head, ink = null} = {}) {
  const unit = up(oneLine(str)), o = {font, spacing: .02}, gap = size * 1.1, w = measure(unit, size, o) + gap, n = Math.ceil(stage.W / w) + 3, group = g.append('g');
  for (let i = -1; i < n; i++) {
    group.append('text').attr('x', i * w + gap / 2).attr('y', y).attr('fill', P(g, color)).style('font', css(size, o)).style('letter-spacing', '.02em').attr('stroke', C.ink).attr('stroke-width', ink ?? size * .16).attr('stroke-linejoin', 'round').attr('paint-order', 'stroke').text(unit);
    group.append('path').attr('d', burst(i * w, y - capH(size, o) / 2, size * .3, size * .13, 6)).attr('fill', P(g, mark)).attr('stroke', C.ink).attr('stroke-width', Math.max(3, size * .05)).attr('stroke-linejoin', 'round');
  }
  return {g: group, width: w, set(offset, skew = 0) { group.attr('transform', `translate(${-((offset % w) + w) % w} 0) skewX(${skew})`); }};
}

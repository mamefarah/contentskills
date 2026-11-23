// Kit for shared pieces (library/_shared/common): pieces drawn once and worn by every theme.
// A shared piece draws only with `look` (the theme's theme.json "look", passed by the loader as mount's third argument):
//   surface, ink, dim, line   card fill, text on it, secondary text, hairlines
//   accent, accent2           the theme's highlight colours
//   head, headWeight, body, mono   font families (head = display)
//   card                      'flat' | 'glass' | 'paper' | 'outline': how a card surface is drawn
//   radius                    corner radius of cards, px
// Never hard-code a colour or font in a shared piece: if the theme needs something special, it overrides the piece
// with its own file of the same name.
import {clamp, span, easeOut, easeInOut, easeBack, mix} from '../kit.js';
export {clamp, span, easeOut, easeInOut, easeBack, mix};

export const glide = x => 1 - Math.pow(1 - clamp(x), 4);
/** Opacity of something that fades up starting at `start`. */
export const fade = (t, start, length = .3) => easeInOut(span(t, start, length));
/** 0 while a piece is up, rising to 1 over its last `len` seconds when the storyboard gives it a `life`. */
export const leave = (t, life, len = .3) => life ? easeInOut(span(t, life - len, len)) : 0;

let stages = 0;
/** A transparent 1080x1920 SVG over the footage. Returns {svg, defs, root, id, look}. */
export function stage(el, look) {
  const d3 = window.d3, id = `cm${++stages}`;
  const svg = d3.select(el).append('svg').attr('viewBox', '0 0 1080 1920').attr('preserveAspectRatio', 'xMidYMid meet').style('overflow', 'hidden');
  el.style.background = 'transparent';
  const defs = svg.append('defs'), root = svg.append('g');
  const f = defs.append('filter').attr('id', `${id}-lift`).attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%');
  f.append('feDropShadow').attr('dx', 0).attr('dy', 18).attr('stdDeviation', 28).attr('flood-color', '#000').attr('flood-opacity', .35);
  const b = defs.append('filter').attr('id', `${id}-blur`); b.append('feGaussianBlur').attr('stdDeviation', 18);
  return {svg, defs, root, id, look, lift: `url(#${id}-lift)`};
}

/** CSS font for a role: 'head' (display), 'body', 'mono'. */
export function font(look, role, size, weight) {
  const family = role === 'head' ? look.head : role === 'mono' ? look.mono : look.body;
  return `${weight ?? (role === 'head' ? look.headWeight : 600)} ${size}px "${String(family).replace(/"/g, '')}"`;
}

/** Text in the look. Returns the d3 node. */
export function text(g, x, y, str, {size = 40, role = 'body', color, anchor = 'start', weight, opacity} = {}, look) {
  const node = g.append('text').attr('x', x).attr('y', y).attr('text-anchor', anchor).attr('fill', color ?? look.ink).style('font', font(look, role, size, weight));
  if (opacity != null) node.attr('opacity', opacity);
  node.text(String(str ?? ''));
  return node;
}

/** Width of a string in the look's font (for sizing cards to their words). */
const ctx = document.createElement('canvas').getContext('2d');
export function measure(str, look, role, size, weight) { ctx.font = font(look, role, size, weight); return ctx.measureText(String(str ?? '')).width; }

/** Words broken into lines no wider than `max` px in the look's font. */
export function wrap(str, max, look, role, size, weight) {
  const lines = [];
  let line = '';
  for (const word of String(str ?? '').split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, look, role, size, weight) > max) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Readable text colour on a fill: near-white on dark or saturated fills, the look's ink colour on light ones. */
export function on(fill, look) {
  const n = parseInt(String(fill).replace('#', '').slice(0, 6), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const lum = (.2126 * r + .7152 * g + .0722 * b) / 255;
  return lum > .62 ? (lightness(look.ink) < .5 ? look.ink : '#111111') : '#FFFFFF';
}
const lightness = hex => { const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16); return ((n >> 16 & 255) * .2126 + (n >> 8 & 255) * .7152 + (n & 255) * .0722) / 255; };
/** A colour moved toward white (amount > 0) or black (amount < 0), 0..1. */
export function shade(hex, amount) {
  const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16), to = amount > 0 ? 255 : 0, k = Math.abs(amount);
  const c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => Math.round(v + (to - v) * k));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
/** A quiet fill one step off the card (rows, the other person's bubbles), lighter on dark cards and darker on light ones. */
export const raised = look => shade(look.surface, darkCards(look) ? .1 : -.06);
/** True when the look's cards are dark (light text on them). */
export const darkCards = look => lightness(look.surface) < .5;

/** A card surface in the theme's card style, appended to g. Returns the group (draw on it). */
export function card(g, st, x, y, w, h) {
  const {look} = st, r = look.radius ?? 24, c = g.append('g');
  if (look.card === 'glass') {
    c.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', h).attr('rx', r).attr('fill', look.surface).attr('fill-opacity', .9).attr('filter', st.lift);
    c.append('rect').attr('x', x + 1).attr('y', y + 1).attr('width', w - 2).attr('height', h - 2).attr('rx', r).attr('fill', 'none').attr('stroke', '#fff').attr('stroke-opacity', .5).attr('stroke-width', 2);
  } else if (look.card === 'outline') {
    c.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', h).attr('rx', r).attr('fill', look.surface).attr('fill-opacity', .9).attr('stroke', look.line).attr('stroke-width', 4);
  } else if (look.card === 'paper') {
    c.append('rect').attr('x', x + 10).attr('y', y + 12).attr('width', w).attr('height', h).attr('rx', r).attr('fill', look.ink).attr('fill-opacity', .18);
    c.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', h).attr('rx', r).attr('fill', look.surface).attr('stroke', look.line).attr('stroke-width', 2);
  } else {
    c.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', h).attr('rx', r).attr('fill', look.surface).attr('filter', st.lift);
  }
  return c;
}

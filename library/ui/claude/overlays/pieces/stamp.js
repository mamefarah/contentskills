import {C, F, stage, group, rr, node} from '../../ui.js';

// A small "Edited by Claude" pill on a full-screen result, so every payoff (and every screenshot of it) carries the credit.
// The last word is in the Claude orange. Fades up over 0.15 s. Transparent: only the pill is drawn.
export const meta = {duration: 1, live: true};
export const defaults = {text: 'Edited by Claude', y: 1380};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el, null), g = group(svg);
  const words = String(p.text).trim().split(' '), last = words.pop(), head = words.join(' ');
  const w = (head.length + last.length + 1) * 21 + 84, x0 = 540 - w / 2;
  rr(g, x0, p.y - 40, x0 + w, p.y + 40, 40, 'rgba(20,20,20,.55)', {stroke: 'rgba(255,255,255,.18)', 'stroke-width': 2});
  const t = node(g, 'text', {x: 540, y: p.y, 'font-family': F, 'font-size': 38, 'font-weight': 600, fill: '#f4f2ec', 'text-anchor': 'middle', 'dominant-baseline': 'central'});
  if (head) node(t, 'tspan', {}, head + ' ');
  node(t, 'tspan', {fill: C.orangeHot}, last);
  return {seek(time) { g.setAttribute('opacity', Math.max(0, Math.min(1, time / .15))); }};
}

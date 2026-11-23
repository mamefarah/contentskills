import {C, P, theme, textStage, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A sentence set straight on the footage in outlined capitals; an inked marker bar swipes in behind
// the words you name in `mark`, which pop as it passes. `y` is the centre of the block.
export const meta = {duration: 4, live: true};
export const defaults = {text: 'This is the part that matters', mark: 'the part', y: 330, color: 'pink', width: 920, maxSize: 150};

export function mount(el, props = defaults) {
  const stage = textStage(el, {overlay: true}), {root, W} = stage, fill = tone(props.color);
  const {size, lines, pitch} = flow(up(props.text), props.width, 420, props.maxSize, 44), cap = capH(size), top = props.y - (lines.length * pitch - (pitch - cap)) / 2, g = root.append('g'), bars = g.append('g');
  const words = lines.flatMap((line, i) => glyphs(g, line, W / 2, top + cap + i * pitch, size, {by: 'word', anchor: 'middle', fill: 'paper'}).map(u => ({...u, line: i})));
  const want = up(props.mark).split(/\s+/).filter(Boolean), seq = words.map(u => u.str.replace(/[^A-Z0-9']/g, '')); let start = -1;
  for (let i = 0; i + want.length <= seq.length && start < 0; i++) if (want.every((wd, j) => seq[i + j] === wd.replace(/[^A-Z0-9']/g, ''))) start = i;
  const marked = start < 0 ? [] : words.slice(start, start + want.length), byLine = [...new Set(marked.map(u => u.line))].map(line => { const us = marked.filter(u => u.line === line), x0 = us[0].cx - us[0].w / 2 - 26, x1 = us.at(-1).cx + us.at(-1).w / 2 + 26, y = top + cap + line * pitch;
    const bg = bars.append('g').attr('transform', `translate(${x0} ${y - cap / 2})`), inner = bg.append('g'); inked(inner, poly(quad(0, -cap / 2 - 22, x1 - x0, cap + 44, 8, 8, 22)), {fill, ink: 7, shadow: 11, join: 'miter'}); return {inner, w: x1 - x0}; });
  return {seek(t) {
    const x = leave(t, props.life); root.attr('opacity', span(t, 0, .06)); g.attr('transform', `translate(0 ${x * 60})`).attr('opacity', 1 - x);
    words.forEach(u => rise(u, span(t, .05 + u.i * .06 + u.line * .1, .4), 0, 90));
    const at = .5 + words.length * .06; byLine.forEach(({inner}, i) => { const q = span(t, at + i * .18, .3); inner.attr('transform', `scale(${Math.max(.0001, easeOut(q))} 1) skewX(${-vel(q) * 14})`); });
    marked.forEach((u, i) => { const q = span(t, at + .08 + i * .06, .4); if (q > 0) pose(u, {sx: 1 + .18 * Math.sin(Math.min(1, q) * Math.PI), rot: -2 * spring(q)}); });
  }};
}

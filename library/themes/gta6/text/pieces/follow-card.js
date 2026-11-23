import {C, P, textStage, clipPoly, up, oneLine, measure, capH, fit, glyphs, slam, spring, vel, leave, pop, shake, place, label, poly, quad, inked, halftone, burst, span, easeOut} from '../kit.js';
import {sun} from '../../coast.js';

// A follow button being pressed, in the GTA6 comic look: a slanted dusk plate with an ink outline and hard
// shadow, a striped sun with the monogram, the handle in chunky gradient lettering, the sub-line on a tag,
// and a pink FOLLOW tab that is punched at `pressAt` (burst + shake) and turns into a yellow FOLLOWING ✓.
// Props: handle, sub, initial, label, done, pressAt, x (centre), y (top), w, color (plate gradient), life.
export const meta = {duration: 2.4, live: true};
export const defaults = {handle: 'yourhandle', sub: 'Daily notes', initial: 'Y', label: 'Follow', done: 'Following', pressAt: .7, x: 540, y: 270, w: 1000, color: 'dusk'};

export function mount(el, props = defaults) {
  const stage = textStage(el, {overlay: true}), {root} = stage, w = props.w ?? 1000, h = 190, x0 = (props.x ?? 540) - w / 2, y0 = props.y ?? 270, cy = h / 2;
  const g = root.append('g'), plate = g.append('g');
  const shape = quad(0, 0, w, h, 14, 14, 30);
  inked(plate, poly(shape), {fill: props.color ?? 'dusk', ink: 8, shadow: 14, join: 'miter'});
  halftone(plate.append('g').attr('clip-path', clipPoly(stage, shape)), 0, -10, w, h * .6, {color: C.violet, from: 'top', cell: 26, opacity: .35});
  // monogram: striped sun with the initial over it
  const mono = plate.append('g');
  sun(mono, 0, 0, 64, {fill: 'gold', ink: 6, stripes: 3});
  const initial = glyphs(mono, up(props.initial ?? 'Y'), 0, 26, 74, {anchor: 'middle', fill: 'paper', outline: 6, shadow: 4});
  // handle + sub tag
  const bw = 330, tx = 186, room = w - tx - bw - 50, handle = String(props.handle ?? ''), hs = fit(handle, room, 66);
  const name = glyphs(plate, handle, tx, cy + (props.sub ? -2 : capH(hs) / 2), hs, {fill: 'hot', by: 'letter'});
  const sub = props.sub ? label(plate, oneLine(props.sub), {size: 34, fill: 'pink'}) : null;
  // button: two tabs (FOLLOW / FOLLOWING ✓) swapped at the press, plus a burst behind it
  const bx = w - 44 - bw, btn = plate.append('g').attr('transform', `translate(${bx + bw / 2} ${cy})`);
  const flash = btn.append('path').attr('d', burst(0, 0, 150, 92, 12)).attr('fill', C.yellow).attr('stroke', C.ink).attr('stroke-width', 6).attr('stroke-linejoin', 'round');
  const mk = (str, fill, color) => { const o = btn.append('g'), s = Math.min(40, 100 * (bw - 70) / measure(str, 100)); const t = label(o, str, {size: s, fill}); t.g.attr('transform', `translate(${-t.w / 2} 0)`); return o; };
  const before = mk(up(props.label ?? 'Follow'), 'pink'), after = mk('✓ ' + up(props.done ?? 'Following'), 'yellow');
  const life = props.life ?? meta.duration, pa = props.pressAt ?? .7;
  return {seek(t) {
    // fast in (all readable by ~0.25 s): the card is often on screen well under a second
    const x = leave(t, life, .18), q = span(t, 0, .2), e = spring(q), [sx, sy] = shake(t, pa, 10);
    root.attr('opacity', span(t, 0, .04));
    plate.attr('transform', `translate(${x0 - (1 - e) * 1150 - x * 1250 + sx} ${y0 + sy}) rotate(-1.5) skewX(${vel(q) * 14})`);
    place(mono, 96, cy, pop(t, .04, .22), -6 + 6 * easeOut(span(t, .04, .25)));
    initial.forEach(u => slam(u, span(t, .08, .2), 0, {from: 1.6}));
    name.forEach(u => slam(u, span(t, .05 + u.i * .006, .2), 0, {from: 1.5}));
    if (sub) place(sub.g, tx + 4, cy + 54, pop(t, .1, .22), -2);
    const done = t >= pa, k = span(t, pa - .08, .08), punch = done ? 1 + .22 * (1 - spring(span(t, pa, .4))) : 1 - .1 * k;
    btn.attr('transform', `translate(${bx + bw / 2} ${cy}) scale(${(pop(t, .02, .2) * punch).toFixed(3)}) rotate(${done ? -3 : 2})`);
    before.attr('opacity', done ? 0 : 1); after.attr('opacity', done ? 1 : 0);
    const fq = span(t, pa, .35); flash.attr('opacity', done && fq < 1 ? 1 - fq : 0).attr('transform', `scale(${(.5 + fq * .7).toFixed(3)}) rotate(${fq * 30})`);
  }};
}

import {C, P, theme, textStage, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';
import {sun} from '../../coast.js';

// Introduces the speaker: the name in chunky lettering on a slanted plate with a small sun, the
// role on a tag beneath. `y` is the plate's centre line.
export const meta = {duration: 4, live: true};
export const defaults = {name: 'ALEX RIVERA', role: 'MAKES THINGS MOVE', y: 1540, color: 'candy', second: 'yellow'};

export function mount(el, props = defaults) {
  const stage = textStage(el, {overlay: true}), {root, W} = stage, y = props.y, x0 = 56, fill = tone(props.color), second = tone(props.second), name = up(props.name);
  const size = fit(name, 720, 92), cap = capH(size), w = measure(name, size) + 220, g = root.append('g'), plate = g.append('g');
  inked(plate, poly(quad(0, -70, w, 140, 12, 12, 36)), {fill: P(root, fill) === fill && !C[fill] ? fill : fill, ink: 7, shadow: 14, join: 'miter'}); sun(plate, 82, 4, 42, {fill: 'gold', ink: 6, stripes: 3});
  const letters = glyphs(plate, name, 160, cap / 2, size, {fill: 'paper'}), role = props.role ? label(g, props.role, {size: 40, fill: second}) : null;
  return {seek(t) {
    const x = leave(t, props.life), q = span(t, 0, .4), e = spring(q); root.attr('opacity', span(t, 0, .06));
    plate.attr('transform', `translate(${x0 - (1 - e) * 1100 - x * 1200} ${y}) rotate(-2) skewX(${vel(q) * 16})`);
    letters.forEach(u => slam(u, span(t, .25 + u.i * .03, .4), 0, {from: 1.8})); if (role) place(role.g, x0 + 130 - x * 1300, y + 104, pop(t, .5), -2);
  }};
}

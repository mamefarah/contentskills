import {C, P, theme, textStage, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A sign running up one edge of the picture: a slanted strip with the text in outlined lettering
// reading along the edge, and a small tag at its end. `top` and `bottom` set how far it runs.
export const meta = {duration: 4, live: true};
export const defaults = {text: 'BEHIND THE SCENES', sub: 'PART 02 / UNCUT', side: 'left', color: 'hot', band: 'dusk', top: 300, bottom: 1560, edge: 36};

export function mount(el, props = defaults) {
  const stage = textStage(el, {overlay: true}), {root, W} = stage, len = props.bottom - props.top, left = props.side !== 'right', text = up(props.text), fill = tone(props.color), band = tone(props.band);
  const size = fit(text, len - 120, 96), cap = capH(size), bw = cap + 64;
  // Local x runs along the edge (upward on the left, downward on the right); local y runs into the frame.
  const g = root.append('g').attr('transform', left ? `translate(${props.edge} ${props.bottom}) rotate(-90)` : `translate(${W - props.edge} ${props.top}) rotate(90)`), inner = g.append('g');
  panel(inner, quad(0, 0, len, bw, 0, 0, 24), {fill: band, gutter: 10, shadow: 12}); halftone(inner, len * .5, 4, len * .5, bw - 8, {color: C.pink, from: 'right', cell: 24, opacity: .4});
  const letters = glyphs(inner, text, len / 2, bw / 2 + cap / 2, size, {anchor: 'middle', fill}), sub = props.sub ? label(g, props.sub, {size: 34, fill: 'yellow'}) : null;
  return {seek(t) {
    const x = leave(t, props.life), q = span(t, 0, .4); root.attr('opacity', span(t, 0, .06));
    inner.attr('transform', `translate(0 ${-(bw + 80) * (1 - spring(q)) - x * (bw + 120)})`);
    letters.forEach(u => slam(u, span(t, .25 + u.i * .03, .45), 0, {from: 2}));
    if (sub) place(sub.g, len - sub.w - 30, bw + 44 - x * 300, pop(t, .7), 0);
  }};
}

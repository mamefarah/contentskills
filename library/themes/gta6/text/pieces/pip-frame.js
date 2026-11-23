import {C, P, theme, textStage, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A comic-panel frame for a picture-in-picture area: a pale gutter with ink keylines around an empty
// window (put a screen recording or image under it), a label tab on top and a caption tab below.
// `box` is the window, 0..1 of the frame; `fill` darkens the window (0 = fully see-through).
export const meta = {duration: 4, live: true};
export const defaults = {box: {x: .52, y: .075, w: .42, h: .2}, label: 'EXHIBIT A', caption: 'SCREEN RECORDING', fill: 0, color: 'pink'};

export function mount(el, props = defaults) {
  const stage = textStage(el, {overlay: true}), {root, W, H} = stage, b = props.box, bw = b.w * W, bh = b.h * H, cx = b.x * W + bw / 2, cy = b.y * H + bh / 2, fill = tone(props.color), gt = 16;
  const g = root.append('g'), inner = quad(-bw / 2, -bh / 2, bw, bh, 0), outer = quad(-bw / 2 - gt, -bh / 2 - gt, bw + gt * 2, bh + gt * 2, 10, -8, 8);
  g.append('path').attr('d', poly(outer) + poly(inner)).attr('fill-rule', 'evenodd').attr('fill', C.ink).attr('stroke', C.ink).attr('stroke-width', 12).attr('stroke-linejoin', 'miter').attr('transform', 'translate(14 14)');
  g.append('path').attr('d', poly(inner)).attr('fill', C.ink).attr('fill-opacity', props.fill);
  g.append('path').attr('d', poly(outer) + poly(inner)).attr('fill-rule', 'evenodd').attr('fill', C.paper).attr('stroke', C.ink).attr('stroke-width', 7).attr('stroke-linejoin', 'miter');
  const dots = halftone(g, bw / 2 - 200, bh / 2 + gt + 6, 220, 150, {color: fill, from: 'tr', cell: 26, max: .8, opacity: .8});
  const top = props.label ? label(g, props.label, {size: 42, fill}) : null, cap = props.caption ? label(g, props.caption, {size: 32, fill: 'night'}) : null;
  return {seek(t) {
    const x = leave(t, props.life), s = spring(span(t, 0, .5)); root.attr('opacity', span(t, 0, .06) * (1 - x));
    g.attr('transform', `translate(${cx + x * 500} ${cy}) rotate(${(1 - s) * 8 + x * 10}) scale(${.2 + .8 * s})`); dots.attr('opacity', .8 * span(t, .4, .3));
    if (top) place(top.g, -bw / 2 - 10, -bh / 2 - gt - 22, pop(t, .35), -3); if (cap) place(cap.g, -bw / 2 + 10, bh / 2 + gt + 36, pop(t, .5), -2);
  }};
}

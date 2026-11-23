import {C, P, theme, textStage, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// Small labels in the four corners of the picture, each on a slanted tab, with halftone wedges
// behind the top-left and bottom-right and a round mark. Leave a label empty to drop it.
export const meta = {duration: 4, live: true};
export const defaults = {
  topLeft: 'EP. 12\nBEHIND THE BUILD', topRight: 'UNSCRIPTED\nONE TAKE', bottomLeft: 'KEEP\nWATCHING', bottomRight: 'PT. 01\nOF 03',
  mark: 'R', color: 'pink', inset: 48,
};

export function mount(el, props = defaults) {
  const stage = textStage(el, {overlay: true}), {root, W} = stage, H = 1920, m = props.inset, fill = tone(props.color), fills = [fill, 'yellow', 'night', 'aqua'];
  const wedge = flip => { const g = root.append('g'), pts = [[0, 0], [430, 0], [0, 360]], inner = g.append('g').attr('clip-path', clipPoly(stage, pts)); inner.append('path').attr('d', poly(pts)).attr('fill', P(root, flip ? 'teal' : fill)).attr('opacity', .25); halftone(inner, -10, -10, 440, 380, {color: flip ? 'teal' : fill, from: 'tl', cell: 30, max: .95, opacity: .95});
    g.append('path').attr('d', 'M430 0L0 360').attr('stroke', C.paper).attr('stroke-width', 12); g.append('path').attr('d', 'M442 0L0 370').attr('stroke', C.ink).attr('stroke-width', 5); return {g, flip}; };
  const wedges = [wedge(false), wedge(true)];
  const corners = [props.topLeft, props.topRight, props.bottomLeft, props.bottomRight].map((text, i) => String(text ?? '').split('\n').filter(Boolean).map((line, j) => ({tb: label(root, line, {size: j ? 32 : 42, fill: j ? 'night' : fills[i]}), i, j})));
  const badge = root.append('g'); if (props.mark) { inked(badge, burst(0, 0, 50, 39, 12), {fill: 'yellow', ink: 6, shadow: 6}); txt(badge, 0, 17, props.mark, {size: 48, font: theme.fonts.head, color: C.ink, anchor: 'middle', spacing: 0}); }
  return {seek(t) {
    const x = leave(t, props.life); root.attr('opacity', span(t, 0, .06) * (1 - x));
    wedges.forEach(({g, flip}, i) => { const off = (1 - easeOut(span(t, i * .12, .4))) * -460 - x * 460; g.attr('transform', flip ? `translate(${W - off} ${H - off}) rotate(180)` : `translate(${off} ${off})`); });
    corners.forEach(lines => lines.forEach(({tb, i, j}) => { const right = i % 2 === 1, bottom = i > 1, n = lines.length; place(tb.g, right ? W - m - tb.w : m, bottom ? H - m - 34 - (n - 1 - j) * 62 : m + 44 + j * 62, pop(t, .3 + i * .1 + j * .08), right ? 2 : -3); }));
    place(badge, W - m - 60, m + 220, props.mark ? pop(t, .8) : 0, Math.sin(t * 2) * 8);
  }};
}

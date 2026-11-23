import {C, P, theme, textStage, backdrop, fieldOf, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, cornerLabels, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A sentence that rises word by word over the backdrop while the rays turn; the words you list in
// `accent` come up larger in the hot gradient. A tag above, a brush sign-off below.
export const meta = {duration: 5, live: true};
export const defaults = {
  statement: 'Good ideas get better the moment you ship them', accent: ['SHIP'], tag: 'FIELD NOTE 07',
  labels: ['OBSERVED', 'IN THE WILD', '', 'KEEP GOING'], foot: 'Ship it, then fix it', field: 'sunset',
};

export function mount(el, props = defaults) {
  const stage = textStage(el, {field: props.field}), {root, W, H, ink, k} = stage, m = theme.margin + 20, hot = (props.accent ?? []).map(up);
  const {size, lines, pitch} = flow(up(props.statement), W - m * 2, H * .5, 170, 50), cap = capH(size), top = H * .5 - lines.length * pitch / 2;
  const words = lines.flatMap((line, i) => glyphs(root, line, W / 2, top + i * pitch + cap + (pitch - cap) / 2, size, {by: 'word', anchor: 'middle', fill: 'paper'}).map(u => ({...u, line: i})));
  // Accent words are redrawn in the hot gradient on top; the plain copy underneath is hidden by them.
  const hotWords = lines.flatMap((line, i) => glyphs(root, line, W / 2, top + i * pitch + cap + (pitch - cap) / 2, size, {by: 'word', anchor: 'middle', fill: ink.head, rim: 4}).map(u => ({...u, line: i}))).filter(u => { const on = hot.some(h => u.str.replace(/[^A-Z0-9]/g, '') === h); if (!on) u.parts.forEach(p => p.remove()); return on; });
  let order = 0; const all = words.map(u => ({u, at: .3 + (order++) * .16}));
  const tag = props.tag ? label(root, props.tag, {size: 40, fill: ink.tab}) : null, foot = props.foot ? glyphs(root, oneLine(props.foot), W / 2, top + lines.length * pitch + 130 * (.6 + .4 * k), fit(oneLine(props.foot), W * .7, 80), {by: 'all', anchor: 'middle', font: theme.fonts.script, fill: ink.accent}) : [], corners = cornerLabels(stage, props.labels);
  return {seek(t) {
    stage.burstG.attr('transform', `rotate(${t * 6})`);
    all.forEach(({u, at}, i) => { const q = span(t, at, .5); rise(u, q, 0, 150); const h = hotWords.find(x => x.line === u.line && Math.abs(x.cx - u.cx) < 1); if (h) { const s = spring(span(t, at + .1, .6)); pose(h, {y: 150 * (1 - easeOut(q)), sx: .8 + .26 * s, rot: -3 * s, o: clamp(q * 4)}); } });
    if (tag) place(tag.g, W / 2 - tag.w / 2, top - 90 * (.6 + .4 * k), pop(t, .1), -3); foot.forEach(u => rise(u, span(t, .5 + all.length * .16, .5), 0, 60)); corners(t, .8);
  }};
}

import {C, P, theme, textStage, backdrop, fieldOf, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, cornerLabels, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// One enormous figure slammed onto a turning inked burst, with a kicker tab above and a label and
// note below. `value` is text, so it can be a year, a price or a percentage.
export const meta = {duration: 4.5, live: true};
export const defaults = {
  value: '2026', kicker: 'MARK THE YEAR', label: 'EVERYTHING CLICKS', note: 'SMALL STEPS, STACKED DAILY,\nLOOK LIKE LUCK FROM OUTSIDE',
  labels: ['DATA POINT', 'NO. 01', '', 'COUNT IT UP'], field: 'candy',
};

export function mount(el, props = defaults) {
  const stage = textStage(el, {field: props.field}), {root, W, H, ink, k} = stage, m = theme.margin, value = String(props.value), cy = H * .44;
  const size = fit(value, W - m * 2 - 40, H * .3), cap = capH(size), flare = root.append('g'), r = Math.min(W * .56, H * .3);
  inked(flare, burst(0, 0, r, r * .66, 18), {fill: ink.panel, ink: 9, shadow: 0}); flare.append('path').attr('d', burst(0, 0, r * .72, r * .5, 18)).attr('fill', C.pink).attr('opacity', .55);
  const num = glyphs(root, value, W / 2, cy + cap / 2, size, {anchor: 'middle', fill: ink.head, rim: Math.max(4, size * .02)}), kick = props.kicker ? label(root, props.kicker, {size: 46, fill: ink.tab}) : null;
  const lsize = fit(up(props.label), W - m * 2 - 40, 96), lab = glyphs(root, up(props.label), W / 2, cy + cap / 2 + 150 + 60 * k, lsize, {by: 'word', anchor: 'middle', fill: 'paper'});
  const note = txt(root, W / 2, cy + cap / 2 + 240 + 90 * k, props.note, {size: 32 + 8 * k, anchor: 'middle', ink: 9, leading: 1.25}), corners = cornerLabels(stage, props.labels);
  return {seek(t) {
    const [sx, sy] = shake(t, .55, 18); root.attr('transform', `translate(${sx} ${sy})`); stage.burstG.attr('transform', `rotate(${t * 5})`);
    flare.attr('transform', `translate(${W / 2} ${cy}) rotate(${t * 10}) scale(${pop(t, .1, .4) || .0001})`);
    num.forEach(u => slam(u, span(t, .3 + u.i * .08, .55), 0, {from: 3, rot: (u.i % 2 ? 1 : -1) * 18})); num.forEach(u => t > 1.4 && pose(u, {y: Math.sin(t * 3 + u.i * .7) * 6, rot: Math.sin(t * 2 + u.i) * 1.5}));
    if (kick) place(kick.g, W / 2 - kick.w / 2, cy - cap / 2 - 90 - 30 * k, pop(t, .15), -3);
    lab.forEach(u => rise(u, span(t, 1 + u.i * .1, .4), 0, 80)); note.attr('opacity', span(t, 1.5, .3)); corners(t, 1.2);
  }};
}

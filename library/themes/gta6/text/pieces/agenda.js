import {C, P, theme, textStage, backdrop, fieldOf, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, cornerLabels, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A numbered plan: the title lands, then each item is dealt in as a slanted strip with a numbered
// burst, `step` seconds apart, the newest one highlighted.
export const meta = {duration: 6, live: true};
export const defaults = {
  title: 'THE PLAN', kicker: 'FOUR MOVES', items: ['FIND THE HOOK', 'WRITE IT SHORT', 'CUT THE FLUFF', 'POST IT TODAY'],
  labels: ['AGENDA', 'TODAY', '', 'IN THIS ORDER'], step: .8, field: 'dusk',
};

export function mount(el, props = defaults) {
  const stage = textStage(el, {field: props.field}), {root, W, H, ink, k} = stage, m = theme.margin, n = props.items.length, top = H * .14 + 60;
  const tsize = fit(up(props.title), W - m * 2 - 40, 190 * (.7 + .3 * k)), tcap = capH(tsize), title = glyphs(root, up(props.title), m + 10, top + tcap, tsize, {fill: ink.head, rim: 4}), kick = props.kicker ? label(root, props.kicker, {size: 42, fill: ink.tab}) : null;
  const y0 = top + tcap + 150, rowH = Math.min(170, (H - y0 - m - 80) / n), fills = ['paper', 'yellow', 'aqua', 'paper', 'pink'], o = {font: theme.fonts.sub, spacing: .04};
  const rows = props.items.map((item, i) => {
    const g = root.append('g'), h = rowH * .72, size = fit(up(item), W - m * 2 - 160 - h * .62, h * .62, o), fill = fills[i % fills.length];
    inked(g, poly(quad(60, -h / 2, W - m * 2 - 60, h, 10, 10, 26)), {fill, ink: 7, shadow: 12, join: 'miter'}); txt(g, 100 + h * .62, capH(size, o) / 2, up(item), {size, color: inkOn(fill), spacing: .04});
    const badge = g.append('g'); inked(badge, burst(0, 0, h * .62, h * .48, 10), {fill: 'pink', ink: 7, shadow: 7}); txt(badge, 0, h * .2, String(i + 1), {size: h * .58, font: theme.fonts.head, anchor: 'middle', spacing: 0});
    return {g, badge};
  }), corners = cornerLabels(stage, props.labels);
  return {seek(t) {
    stage.burstG.attr('transform', `rotate(${t * 5})`);
    title.forEach(u => slam(u, span(t, .1 + u.i * .04, .5), 0, {rot: 10})); if (kick) place(kick.g, m + 20, top + tcap + 62, pop(t, .5), -3);
    rows.forEach(({g, badge}, i) => { const at = .9 + i * props.step, q = span(t, at, .4), e = spring(q), cur = t >= at && t < at + props.step;
      g.attr('transform', `translate(${m - (1 - e) * (W + 200)} ${y0 + i * rowH + rowH / 2}) rotate(${-2 + (1 - e) * -8}) skewX(${vel(q) * 16}) scale(${cur ? 1.03 : 1})`).attr('opacity', q > 0 ? 1 : 0);
      place(badge, 70, 0, pop(t, at + .15), Math.sin(t * 2 + i) * 7); });
    corners(t, .7);
  }};
}

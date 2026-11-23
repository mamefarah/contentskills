import {C, P, theme, textStage, backdrop, fieldOf, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, cornerLabels, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A chapter opener: a giant numeral drops in, "chapter" is brushed across it, and the title lands
// on a slanted band underneath.
export const meta = {duration: 4.5, live: true};
export const defaults = {number: '02', kicker: 'Chapter', title: 'THE BUILD', note: 'WHERE THE IDEA\nBECOMES A THING', labels: ['SECTION', 'KEEP WATCHING', '', 'PT. 02'], mark: 'N', field: 'dusk'};

export function mount(el, props = defaults) {
  const stage = textStage(el, {field: props.field}), {root, W, H, ink, k} = stage, m = theme.margin, number = String(props.number), title = up(props.title);
  const nsize = fit(number, W * .7, H * .42), ncap = capH(nsize), tsize = fit(title, W - m * 2 - 60, H * .13), tcap = capH(tsize), total = ncap + 110 + tcap, base = (H - total) / 2 + ncap, ty = base + 110 + tcap;
  const num = glyphs(root, number, W / 2, base, nsize, {anchor: 'middle', fill: ink.head, rim: 6}), ksize = fit(oneLine(props.kicker), W * .6, nsize * .34), kick = glyphs(root, oneLine(props.kicker), W / 2, base - ncap * .38, ksize, {by: 'all', anchor: 'middle', font: theme.fonts.script, fill: 'paper'});
  const tiltG = root.append('g').attr('transform', `rotate(-3.2 ${W / 2} ${ty})`), bandG = tiltG.append('g'); panel(bandG, quad(-80, ty - tcap - 40, W + 160, tcap + 80, 0), {fill: 'candy', gutter: 12, shadow: 16}); const ttl = glyphs(tiltG, title, W / 2, ty, tsize, {anchor: 'middle', fill: 'paper'});
  const note = txt(root, W / 2, ty + 130 + 30 * k, props.note, {size: 34 + 8 * k, anchor: 'middle', ink: 9, leading: 1.25}), corners = cornerLabels(stage, props.labels);
  return {seek(t) {
    const [sx, sy] = shake(t, .45, 18); root.attr('transform', `translate(${sx} ${sy})`); stage.burstG.attr('transform', `rotate(${t * 5})`);
    num.forEach(u => slam(u, span(t, .1 + u.i * .12, .6), 0, {from: 3.2, drop: 200, rot: u.i % 2 ? 12 : -12})); kick.forEach(u => { const s = spring(span(t, .6, .5)); pose(u, {sx: s, rot: -8, o: t > .6 ? 1 : 0}); });
    bandG.attr('transform', `translate(${(W + 300) * (1 - easeOut(span(t, .7, .35)))} 0) skewX(${vel(span(t, .7, .35)) * 14})`);
    ttl.forEach(u => slam(u, span(t, .95 + u.i * .04, .45), 0, {from: 1.8}));
    note.attr('opacity', span(t, 1.6, .3)); corners(t, 1.3);
  }};
}

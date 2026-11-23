import {C, P, theme, textStage, backdrop, fieldOf, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, cornerLabels, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A headline that slams in letter by letter on a slanted panel band, with a brush kicker, a note
// and small corner labels. `lines` is one to three short lines; everything is a prop.
export const meta = {duration: 4.5, live: true};
export const defaults = {
  lines: ['MAKE IT', 'LOUD'], kicker: 'One idea. Full volume.', note: 'SAY THE THING YOU MEAN\nAND SAY IT BIG',
  labels: ['VOL. 01', 'A SHORT SERIES', '', 'NO. 26'], foot: ['PLAY IT LOUD'], field: 'sunset',
};

export function mount(el, props = defaults) {
  const stage = textStage(el, {field: props.field}), {root, W, H, ink, k} = stage, m = theme.margin, lines = props.lines.map(up), n = lines.length;
  const size = fit(lines, W - m * 2 - 30, H * .3 / Math.max(1.4, n * .8)), cap = capH(size), pitch = cap * 1.36, cy = H * .5, top = cy - (n * pitch) / 2;
  const tilt = root.append('g').attr('transform', `rotate(-4 ${W / 2} ${cy})`), bandG = tilt.append('g');
  const band = panel(bandG, quad(-80, top - 46, W + 160, n * pitch + 70, 0), {fill: ink.panel, gutter: 14, shadow: 18}); halftone(bandG.append('g').attr('clip-path', band.clip), W * .4, top - 60, W * .7, n * pitch + 120, {color: C.ink, from: 'right', cell: 34, opacity: .25});
  const rows = lines.map((line, i) => glyphs(tilt, line, W / 2, top + i * pitch + cap + (pitch - cap) / 2 - 12, size, {anchor: 'middle', fill: i % 2 ? ink.alt : ink.head, rim: Math.max(3, size * .02)}));
  const kick = props.kicker ? glyphs(root, oneLine(props.kicker), m + 20, top - 110 * (.7 + .3 * k), fit(oneLine(props.kicker), W * .7, 84), {by: 'word', font: theme.fonts.script, fill: 'paper'}) : [];
  const note = txt(root, W - m - 10, top + n * pitch + 150 * (.6 + .4 * k), props.note, {size: 34 + 8 * k, anchor: 'end', ink: 9, leading: 1.25});
  const foot = props.foot?.[0] ? label(root, props.foot[0], {size: 40, fill: ink.tab}) : null, corners = cornerLabels(stage, props.labels);
  return {seek(t) {
    const [sx, sy] = shake(t, .5, 16); root.attr('transform', `translate(${sx} ${sy})`); stage.burstG.attr('transform', `rotate(${t * 5})`);
    bandG.attr('transform', `translate(${-(W + 300) * (1 - easeOut(span(t, 0, .35)))} 0) skewX(${-vel(span(t, 0, .35)) * 14})`);
    rows.forEach((row, r) => row.forEach(u => slam(u, span(t, .3 + r * .32 + u.i * .035, .55), 0, {rot: (u.i % 2 ? 1 : -1) * 14})));
    kick.forEach(u => rise(u, span(t, .15 + u.i * .08, .4), 0, 60)); note.attr('opacity', span(t, 1.1 + n * .3, .3));
    if (foot) place(foot.g, W / 2 - foot.w / 2, H - m - 110 * k - 40, pop(t, 1.3 + n * .3), -3); corners(t, .9);
  }};
}

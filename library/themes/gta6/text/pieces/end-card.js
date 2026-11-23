import {C, P, theme, textStage, backdrop, fieldOf, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, cornerLabels, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A sign-off: the closing lines slam in, the call to action and handle follow on plates, and a
// marquee strip keeps running along the bottom.
export const meta = {duration: 5, live: true};
export const defaults = {
  lines: ['FOLLOW', 'FOR MORE'], action: 'NEW VIDEO EVERY WEEK', handle: '@YOURNAME', strip: 'SEE YOU NEXT TIME',
  labels: ['THE END', 'OR IS IT'], field: 'sunset',
};

export function mount(el, props = defaults) {
  const stage = textStage(el, {field: props.field}), {root, W, H, ink, k} = stage, m = theme.margin, lines = props.lines.map(up), n = lines.length;
  const size = fit(lines, W - m * 2 - 30, H * .15), cap = capH(size), pitch = cap * 1.4, top = H * (stage.sq ? .33 : .4) - n * pitch / 2, tilt = root.append('g').attr('transform', `rotate(-4 ${W / 2} ${H * .4})`);
  const rows = lines.map((line, i) => glyphs(tilt, line, W / 2, top + i * pitch + cap, size, {anchor: 'middle', fill: i % 2 ? ink.alt : ink.head, rim: 4}));
  const action = props.action ? label(root, props.action, {size: 44, fill: ink.tab}) : null, hs = fit(props.handle, W * .7, 60 + 50 * k), hw = measure(props.handle, hs) + 110, plate = root.append('g');
  inked(plate, poly(quad(-hw / 2, -hs * .75, hw, hs * 1.5, 14, 14, 30)), {fill: 'dusk', ink: 8, shadow: 14, join: 'miter'}); glyphs(plate, props.handle, 0, capH(hs) / 2, hs, {by: 'all', anchor: 'middle', fill: 'cool'});
  const bh = 120 + 30 * k, by = H - theme.gutter - theme.slant - bh - 30, bandG = root.append('g').attr('transform', `rotate(-1.8 ${W / 2} ${by})`), band = bandG.append('g'); band.append('rect').attr('x', -100).attr('y', by).attr('width', W + 200).attr('height', bh).attr('fill', P(root, 'pink')).attr('stroke', C.ink).attr('stroke-width', 9);
  const ssize = bh * .5 / capH(1), run = strip(band, stage, props.strip, by + bh / 2 + capH(ssize) / 2, ssize, {color: 'paper', mark: 'yellow'}), corners = cornerLabels(stage, props.labels);
  return {seek(t) {
    const [sx, sy] = shake(t, .4, 14); root.attr('transform', `translate(${sx} ${sy})`); stage.burstG.attr('transform', `rotate(${t * 5})`);
    rows.forEach((row, r) => row.forEach(u => slam(u, span(t, .15 + r * .3 + u.i * .035, .55), 0, {rot: (u.i % 2 ? 1 : -1) * 14})));
    if (action) place(action.g, W / 2 - action.w / 2, top + n * pitch + 70, pop(t, .9 + n * .3), -3);
    place(plate, W / 2, Math.min(by - hs - 30, top + n * pitch + 200 + 50 * k), pop(t, 1.1 + n * .3, .4), 2 + Math.sin(t * 2) * 1.5);
    band.attr('transform', `translate(0 ${(1 - easeOut(span(t, .5, .4))) * 400})`); run.set(t * 170); corners(t, 1);
  }};
}

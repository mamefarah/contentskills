import {C, P, theme, textStage, backdrop, fieldOf, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, cornerLabels, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A countdown: each number slams in on its own colour field with a burst, then the go word.
// One beat per count, evenly spread over the piece.
export const meta = {duration: 4};
export const defaults = {from: 3, go: 'GO', label: 'STARTING IN', note: 'GET READY', labels: ['STAND BY', 'ON AIR SOON', '', 'TAKE 01'], fields: ['dusk', 'sea', 'candy', 'sunset']};

export function mount(el, props = defaults) {
  const stage = textStage(el, {field: props.fields[0]}), {root, W, H, k} = stage, steps = props.from + 1, step = meta.duration / steps, cy = H * .5;
  const beats = Array.from({length: steps}, (_, i) => {
    const ink = fieldOf(props.fields[i % props.fields.length]), last = i === steps - 1, value = last ? up(props.go) : String(props.from - i), g = root.append('g'), spin = backdrop(g, stage, ink, 0, 0, W, H);
    const r = Math.min(W * .47, H * .3), flare = g.append('g'); inked(flare, burst(0, 0, r, r * .7, 16), {fill: ink.panel, ink: 10, shadow: 0});
    const size = fit(value, W * .72, H * .34), cap = capH(size), num = glyphs(g, value, W / 2, cy + cap / 2, size, {anchor: 'middle', fill: ink.head, rim: 6});
    const lab = !last && props.label ? label(g, props.label, {size: 50, fill: ink.tab}) : null; if (lab) place(lab.g, W / 2 - lab.w / 2, cy - r - 60, 1, -3);
    if (props.note) txt(g, W / 2, cy + r + 110, last ? '' : props.note, {size: 44, anchor: 'middle', ink: 10, spacing: .14});
    return {g, spin, flare, num};
  }), corners = cornerLabels(stage, props.labels);
  return {seek(t) {
    const i = Math.min(steps - 1, Math.floor(t / step)), local = t - i * step;
    beats.forEach((b, j) => b.g.attr('visibility', j === i ? 'visible' : 'hidden'));
    const b = beats[i], [sx, sy] = shake(local, .16, 20); root.attr('transform', `translate(${sx} ${sy})`); b.spin.attr('transform', `rotate(${t * 8})`);
    b.flare.attr('transform', `translate(${W / 2} ${cy}) rotate(${t * 14}) scale(${.6 + .4 * spring(span(local, 0, .45))})`);
    b.num.forEach(u => { const q = span(local, .02 + u.i * .05, .45), out = i < steps - 1 ? span(local, step - .14, .14) : 0; slam(u, q, 0, {from: 3.4, rot: (i % 2 ? 1 : -1) * 16}); if (out) pose(u, {sx: 1 - out * .5, o: 1 - out}); });
    corners(t, .2);
  }};
}

import {C, P, theme, textStage, backdrop, fieldOf, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, cornerLabels, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// Two words facing off across a slanted gutter, each on its own backdrop: they charge in from
// opposite sides and a badge bursts on the seam.
export const meta = {duration: 4.5, live: true};
export const defaults = {a: 'FAST', b: 'PERFECT', mark: 'VS', aNote: 'SHIPS TODAY', bNote: 'SHIPS SOMEDAY', labels: ['ROUND ONE', 'PICK A SIDE', '', 'NO TIES'], fields: ['sea', 'sunset']};

export function mount(el, props = defaults) {
  const stage = textStage(el, {field: props.fields[1]}), {root, W, H, k} = stage, m = theme.margin, A = fieldOf(props.fields[0]), B = fieldOf(props.fields[1]), s = 80, mid = H / 2;
  const upper = [[-20, -20], [W + 20, -20], [W + 20, mid - s], [-20, mid + s]], top = root.append('g'), topIn = top.append('g').attr('clip-path', clipPoly(stage, upper)); const spinA = backdrop(topIn, stage, A, 0, 0, W, mid + s);
  const seam = `M-20 ${mid + s}L${W + 20} ${mid - s}`; root.append('path').attr('d', seam).attr('stroke', C.ink).attr('stroke-width', 46); root.append('path').attr('d', seam).attr('stroke', C.paper).attr('stroke-width', 30);
  const size = fit([up(props.a), up(props.b)], W - m * 2 - 30, H * .17), cap = capH(size);
  const a = glyphs(root, up(props.a), W / 2, mid * .52 + cap / 2, size, {anchor: 'middle', fill: A.head, rim: 4}), b = glyphs(root, up(props.b), W / 2, mid + mid * .5 + cap / 2, size, {anchor: 'middle', fill: B.head, rim: 4});
  const an = props.aNote ? label(root, props.aNote, {size: 42, fill: A.tab}) : null, bn = props.bNote ? label(root, props.bNote, {size: 42, fill: B.tab}) : null;
  const r = 130 * (.7 + .3 * k), badge = root.append('g'); inked(badge, burst(0, 0, r, r * .74, 14), {fill: 'yellow', ink: 10, shadow: 14}); const ms = fit(up(props.mark), r * 1.2, r * .9); const mk = glyphs(badge, up(props.mark), 0, capH(ms) / 2, ms, {by: 'all', anchor: 'middle', fill: 'candy'}), corners = cornerLabels(stage, props.labels);
  return {seek(t) {
    const [sx, sy] = shake(t, .75, 18); root.attr('transform', `translate(${sx} ${sy})`); stage.burstG.attr('transform', `rotate(${t * 5})`); spinA.attr('transform', `rotate(${-t * 5})`);
    [a, b].forEach((row, i) => row.forEach(u => { const q = span(t, .15 + i * .15 + (i ? u.n - u.i : u.i) * .03, .5), e = spring(q), dir = i ? 1 : -1; pose(u, {x: dir * (W + 300) * (1 - e), skew: -dir * vel(q) * 24, sx: 1 + vel(q) * .25, o: q > 0 ? 1 : 0}); }));
    place(badge, W / 2, mid, pop(t, .7, .4), -10 + Math.sin(t * 2.2) * 5);
    if (an) place(an.g, m + 20, mid * .52 + cap / 2 + 90, pop(t, 1.1), -3); if (bn) place(bn.g, m + 20, mid + mid * .5 + cap / 2 + 90, pop(t, 1.25), -3); corners(t, 1.2);
  }};
}

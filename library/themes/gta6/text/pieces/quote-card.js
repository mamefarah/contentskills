import {C, P, theme, textStage, backdrop, fieldOf, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, cornerLabels, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';
import {bubble} from '../../coast.js';

// A quotation in a comic speech bubble: the bubble pops, the words land one at a time, and the
// speaker is named on a plate under its tail.
export const meta = {duration: 5, live: true};
export const defaults = {
  quote: 'Done beats perfect every single time', by: 'NOTE TO SELF', role: 'PINNED SINCE DAY ONE',
  labels: ['QUOTED', 'WORDS TO KEEP', '', 'NO. 12'], mark: 'Q', field: 'sea',
};

export function mount(el, props = defaults) {
  const stage = textStage(el, {field: props.field}), {root, W, H, ink, k} = stage, m = theme.margin + 10, bw = W - m * 2, bh = H * (stage.sq ? .44 : .42), by = H * (stage.sq ? .17 : .2), o = {font: theme.fonts.comic, spacing: .03};
  const g = root.append('g'), d = bubble(m, by, bw, bh, W * .3, by + bh + 120 + 40 * k, 70); inked(g, d, {fill: 'paper', ink: 11, shadow: 18});
  halftone(g.append('g').attr('clip-path', clipBox(stage, m, by, bw, bh)), m, by + bh * .4, bw, bh * .6, {color: C.pink, from: 'br', cell: 32, opacity: .5});
  const {size, lines, pitch} = flow(up(props.quote), bw - 130, bh - 110, 190, 50, o, 1.05), cap = capH(size, o), top = by + (bh - lines.length * pitch) / 2;
  const words = lines.flatMap((line, i) => { const y = top + i * pitch + cap + (pitch - cap) / 2, total = measure(line, size, o); return [...line.matchAll(/\S+/g)].map(mt => { const w = measure(mt[0], size, o), cx = W / 2 - total / 2 + measure(line.slice(0, mt.index), size, o) + w / 2, inner = g.append('g').attr('transform', `translate(${cx} ${y - cap / 2})`).append('g'); txt(inner, 0, cap / 2, mt[0], {size, font: theme.fonts.comic, color: C.ink, anchor: 'middle', spacing: .03}); return inner; }); });
  const q1 = glyphs(root, '“', m + 40, by + 70, 300, {by: 'all', fill: 'candy'}), bySize = fit(up(props.by), W * .6, 76), who = glyphs(root, up(props.by), W * .42, by + bh + 150 + 110 * k, bySize, {by: 'all', fill: ink.head}), role = props.role ? label(root, props.role, {size: 36, fill: ink.tab}) : null, corners = cornerLabels(stage, props.labels);
  return {seek(t) {
    stage.burstG.attr('transform', `rotate(${t * 5})`);
    const s = spring(span(t, 0, .6)); g.attr('transform', `translate(${W * .3} ${by + bh}) scale(${s || .0001}) rotate(${(1 - s) * -8}) translate(${-W * .3} ${-by - bh})`);
    words.forEach((w, i) => { const q = span(t, .45 + i * .14, .3), e = spring(q); w.attr('transform', `scale(${q <= 0 ? .0001 : 1.6 - .6 * e}) rotate(${(1 - e) * (i % 2 ? 6 : -6)})`).attr('opacity', q > 0 ? 1 : 0); });
    q1.forEach(u => slam(u, span(t, .3, .5), 0, {rot: -20})); who.forEach(u => rise(u, span(t, .7 + words.length * .14, .4), 0, 70));
    if (role) place(role.g, W * .42, by + bh + 205 + 125 * k, pop(t, .9 + words.length * .14), -3); corners(t, 1);
  }};
}

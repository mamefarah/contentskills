import {C, P, theme, textStage, backdrop, fieldOf, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, cornerLabels, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';
import {vignette} from '../../coast.js';

// Two words stacked across a slanted split: one slides in above the gutter, one below, from
// opposite sides, with a small illustrated panel between them (or your own `image`) and two captions.
export const meta = {duration: 4.5, live: true};
export const defaults = {
  top: 'THINK', bottom: 'BIGGER', caption: 'START BEFORE\nYOU FEEL READY', note: 'THE FIRST DRAFT\nCAN BE BAD',
  labels: ['PART TWO', 'MINDSET', 'NOTES TO SELF', 'PG. 04'], marks: ['A', 'R'], image: null, art: 'palm', field: 'sunset',
};

export function mount(el, props = defaults) {
  const stage = textStage(el, {field: props.field}), {root, W, H, ink, k} = stage, m = theme.margin, s = 70, mid = H / 2;
  const lower = [[-20, mid + s], [W + 20, mid - s], [W + 20, H + 20], [-20, H + 20]], low = root.append('g'), lowIn = low.append('g').attr('clip-path', clipPoly(stage, lower));
  backdrop(lowIn, stage, fieldOf(ink.panel === 'dusk' ? 'dusk' : 'candy'), 0, mid - s, W, H - mid + s);
  low.append('path').attr('d', `M-20 ${mid + s}L${W + 20} ${mid - s}`).attr('stroke', C.ink).attr('stroke-width', 44); low.append('path').attr('d', `M-20 ${mid + s}L${W + 20} ${mid - s}`).attr('stroke', C.paper).attr('stroke-width', 28);
  const size = fit([up(props.top), up(props.bottom)], W - m * 2 - 20, H * .19), cap = capH(size);
  const a = glyphs(root, up(props.top), W / 2, mid - s - 70 - (H * .25 - cap) / 2, size, {by: 'all', anchor: 'middle', fill: ink.head, rim: 4}), b = glyphs(root, up(props.bottom), W / 2, mid + s + 70 + cap + (H * .25 - cap) / 2, size, {by: 'all', anchor: 'middle', fill: 'cool', rim: 4});
  const pw = 300 + 60 * k, ph = 220 + 60 * k, insetG = root.append('g'), pn = panel(insetG, quad(-pw / 2, -ph / 2, pw, ph, 14, -10, 10), {fill: 'dusk', gutter: 11, shadow: 13}), pic = insetG.append('g').attr('clip-path', pn.clip);
  const v = props.image ? (pic.append('image').attr('href', props.image).attr('x', -pw / 2 - 10).attr('y', -ph / 2 - 10).attr('width', pw + 20).attr('height', ph + 20).attr('preserveAspectRatio', 'xMidYMid slice'), null) : vignette(pic, props.art, -pw / 2 - 10, -ph / 2 - 14, pw + 20, ph + 28, 3);
  insetG.append('path').attr('d', pn.d).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 6);
  const cap1 = txt(root, m + 10, Math.max(m + 150, mid - s - 30 - H * .3), props.caption, {size: 34 + 8 * k, ink: 9}), cap2 = txt(root, W - m - 10, Math.min(H - m - 150, mid + s + H * .34), props.note, {size: 34 + 8 * k, anchor: 'end', ink: 9});
  const marks = (props.marks ?? []).slice(0, 2).map((mk, i) => { const g = root.append('g'); inked(g, burst(0, 0, 56, 43, 12), {fill: i ? 'aqua' : 'yellow', ink: 6, shadow: 7}); txt(g, 0, 19, mk, {size: 54, font: theme.fonts.head, color: C.ink, anchor: 'middle', spacing: 0}); return g; }), corners = cornerLabels(stage, props.labels);
  return {seek(t) {
    stage.burstG.attr('transform', `rotate(${t * 5})`);
    [a, b].forEach((row, i) => row.forEach(u => { const q = span(t, .2 + i * .25, .5), e = spring(q), dir = i ? 1 : -1; pose(u, {x: dir * (W + 200) * (1 - e), skew: -dir * vel(q) * 22, sx: 1 + vel(q) * .2, o: q > 0 ? 1 : 0}); }));
    place(insetG, W * .5 + Math.sin(t * .8) * 6, mid, pop(t, .8, .4), -6 + Math.sin(t * 1.1) * 1.5); v?.tick(t);
    cap1.attr('opacity', span(t, 1.1, .3)); cap2.attr('opacity', span(t, 1.3, .3));
    marks.forEach((g, i) => place(g, i ? W - m - 60 : m + 60, i ? mid - s - 120 : mid + s + 120, pop(t, 1.2 + i * .15), Math.sin(t * 2 + i) * 8)); corners(t, 1);
  }};
}

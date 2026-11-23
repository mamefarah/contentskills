import {card, heavy, figure, C, STEP, panel, veil, label, rule, up, span, snap, easeIn, fit} from './_card.js';

// Two picture strips side by side with staggered edges, sliding in from opposite ends on the beat.
// Each carries its label in tracked capitals and its value in heavy white over a soft charcoal veil;
// a small charcoal VS block sits on the seam, and a split bar underneath shows the two as shares.
export const meta = {duration: 6};
export const defaults = {title: 'Short vs long', unit: 'Average views, thousands', clear: false,
  a: {label: 'Short form', value: 64, tone: 'ember'}, b: {label: 'Long form', value: 36, tone: 'teal'}};

export function mount(el, props = defaults) {
  const c = card(el, props), {root, T, st} = c, A = props.a ?? defaults.a, B = props.b ?? defaults.b;
  const L = {x: 80, y: 250, w: 410, h: 520}, R = {x: 510, y: 285, w: 410, h: 520};
  const side = (d, box, i) => {
    const p = panel(st, root, {...box, tone: d.tone ?? (i ? 'teal' : 'ember'), image: d.image ?? null});
    const g = root.append('g'), sh = g.append('rect').attr('x', box.x).attr('y', box.y + box.h * .55).attr('width', box.w).attr('height', box.h * .45).attr('fill', C.ink).attr('opacity', .55);
    const vs = Math.min(150, fit(figure(d.value), box.w * .8, 150));
    const val = heavy(g, box.x + box.w / 2, box.y + box.h - 70, '', vs, {anchor: 'middle'});
    const lab = label(g, box.x + box.w / 2, box.y + box.h - 70 - vs * .78 - 26, up(d.label), {size: 22, anchor: 'middle', track: .3});
    return {d, box, p, g, sh, val, lab};
  };
  const s = [side(A, L, 0), side(B, R, 1)];
  const blk = root.append('g'), bs = 92;
  blk.append('rect').attr('x', 500 - bs / 2).attr('y', 530 - bs / 2).attr('width', bs).attr('height', bs).attr('fill', C.bg);
  heavy(blk, 500, 530 + 13, 'VS', 36, {anchor: 'middle'});
  const tot = Math.max(1e-9, A.value + B.value), split = 80 + 840 * A.value / tot, y = 852;
  const barA = rule(root, 80, y, split - 4, y, {width: 14}), barB = rule(root, split + 4, y, 920, y, {width: 14, color: C.mute});
  const pa = label(root, 80, y + 50, '', {size: 18, track: .2, font: '"Space Mono"', weight: 700}), pb = label(root, 920, y + 50, '', {size: 18, anchor: 'end', track: .2, font: '"Space Mono"', weight: 700, color: C.dim});
  return {seek(t) {
    c.seek(t);
    s.forEach((o, i) => {
      const a = snap(span(t, T - .1 + i * STEP * .5, STEP * 1.6)), d = i ? 1 : -1, yy = o.box.y + d * (1 - a) * 1000;
      o.p.set({y: yy, dy: yy - o.box.y, opacity: a > 0 ? 1 : 0});
      o.g.attr('transform', `translate(0 ${(yy - o.box.y).toFixed(1)})`).attr('opacity', a > 0 ? 1 : 0);
      const q = snap(span(t, T + .5 + i * STEP, STEP * 5));
      o.val.selectAll('tspan').text(figure(o.d.value, q)); o.lab.attr('opacity', t >= T + .4 + i * STEP ? 1 : 0);
    });
    blk.attr('opacity', t >= T + .5 ? 1 : 0).attr('transform', `translate(500 530) scale(${(.6 + .4 * snap(span(t, T + .5, STEP))).toFixed(3)}) translate(-500 -530)`);
    const b = snap(span(t, T + .9, STEP * 3));
    barA.range(1 - b, 1); barB.range(0, b);
    pa.attr('opacity', b > .3 ? 1 : 0).selectAll('tspan').text(Math.round(100 * A.value / tot) + '%');
    pb.attr('opacity', b > .3 ? 1 : 0).selectAll('tspan').text(Math.round(100 * B.value / tot) + '%');
  }};
}

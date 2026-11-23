import {card, heavy, short, figure, SERIES, C, STEP, panel, label, rule, up, span, snap, fit} from './_card.js';

// Bars as picture strips: each bar is a studio-tone panel that snaps up from the baseline on the beat
// (left to right, half a beat apart), its value counting up above it in heavy type. The tallest bar's
// value is white, the rest grey. Thin hairline grid, labels in small tracked capitals.
export const meta = {duration: 6};
export const defaults = {title: 'Weekly views', unit: 'Thousands of views', clear: false,
  items: [{label: 'W1', value: 12}, {label: 'W2', value: 18}, {label: 'W3', value: 15}, {label: 'W4', value: 27}, {label: 'W5', value: 34}, {label: 'W6', value: 46}]};

export function mount(el, props = defaults) {
  const c = card(el, props), {root, T, st} = c, items = props.items ?? [], n = Math.max(1, items.length);
  const max = Math.max(1e-9, ...items.map(d => d.value)), best = items.findIndex(d => d.value === max);
  const x0 = 80, x1 = 920, base = 820, top = 340, slot = (x1 - x0) / n, bw = slot * .74;
  const grid = [1, 2, 3].map(k => rule(root, x0, base - (base - top) * k / 3, x1, base - (base - top) * k / 3, {width: 1, color: C.rule}));
  const baseline = rule(root, x0, base, x1, base, {width: 2});
  const vSize = Math.min(52, fit(short(max), bw * .95, 52)), lSize = Math.min(20, fit(items.map(d => up(d.label)).sort((a, b) => b.length - a.length)[0] ?? 'X', slot * .9, 20, {track: .2}));
  const bars = items.map((d, i) => {
    const x = x0 + slot * i + (slot - bw) / 2, h = Math.max(8, (base - top) * d.value / max), tones = props.tones ?? SERIES;
    const p = panel(st, root, {x, y: base - h, w: bw, h, tone: d.tone ?? tones[i % tones.length]});
    const val = heavy(root, x + bw / 2, base - h - 22, '', vSize, {anchor: 'middle', color: i === best ? C.white : C.dim});
    const lab = label(root, x + bw / 2, base + 46, up(d.label), {size: lSize, anchor: 'middle', track: .2, color: C.dim});
    return {d, x, h, p, val, lab, at: T + .2 + i * STEP * .5};
  });
  return {seek(t) {
    c.seek(t);
    grid.forEach((g, k) => g.draw(snap(span(t, T + k * .05, STEP * 3))));
    baseline.draw(snap(span(t, T - .1, STEP * 3)));
    for (const b of bars) {
      const a = snap(span(t, b.at, STEP * 2)), hh = b.h * a;
      b.p.set({y: base - hh, h: hh, opacity: a > 0 ? 1 : 0});
      b.val.attr('opacity', a > 0 ? 1 : 0).attr('y', base - hh - 22).selectAll('tspan').text(figure(b.d.value, a));
      b.lab.attr('opacity', t >= b.at ? .9 : 0);
    }
  }};
}

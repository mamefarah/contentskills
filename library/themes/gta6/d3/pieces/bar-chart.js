import {C, F, P, seriesGrads, label, lettering, place, span, easeOut, pop} from '../../coast.js';
import {card, bar} from './_card.js';

// Chunky inked bars with gradient fills and hard shadows; each value pops on top as its bar lands.
export const meta = {duration: 3.4};
export const defaults = {title: 'Where creators earn', unit: 'Illustrative · percent', max: 50, clear: false,
  items: [{label: 'Sponsors', value: 42}, {label: 'Products', value: 31}, {label: 'Ads', value: 14}, {label: 'Affiliates', value: 9}, {label: 'Tips', value: 4}]};

export function mount(el, props = defaults) {
  const {body, intro} = card(el, props), n = props.items.length, slot = 740 / n, w = slot * .62, base = 800, top = 400;
  body.append('path').attr('d', `M110 ${base + 4}H890`).attr('stroke', C.paper).attr('stroke-width', 6).attr('stroke-linecap', 'round');
  const bars = props.items.map((d, i) => {
    const x = 130 + i * slot + (slot - w) / 2, set = bar(body, P(body, seriesGrads[i % seriesGrads.length]));
    label(body, x + w / 2, base + 48, d.label.toUpperCase(), {size: Math.min(30, slot * 1.5 / Math.max(5, d.label.length) * 1.6), anchor: 'middle'});
    const vg = body.append('g'), value = lettering(vg, 0, 0, String(d.value), {size: 60, fill: 'paper', outline: 7, shadow: 5});
    return {d, x, set, vg, value};
  });
  return {seek(t) {
    intro(t);
    bars.forEach(({d, x, set, vg, value}, i) => {
      const at = .45 + i * .16, q = easeOut(span(t, at, .7)), h = (base - top) * d.value / props.max * q;
      set(x, base - h, w, h); value.text(String(Math.round(d.value * q))); place(vg, x + w / 2, base - h - 22, pop(t, at + .1), -3);
    });
  }};
}

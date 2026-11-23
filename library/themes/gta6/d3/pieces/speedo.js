import {C, F, P, label, lettering, tab, place, span, easeOut, pop, noise} from '../../coast.js';
import {card} from './_card.js';

// A dashboard dial: the needle swings up to the value with a little overshoot and keeps trembling, as on a car at speed.
export const meta = {duration: 3.6, live: true};
export const defaults = {title: 'Posting pace', unit: 'Illustrative · posts per week', clear: false, value: 21, max: 30, suffix: '', label: 'PER WEEK', zones: [.5, .8]};

export function mount(el, props = defaults) {
  const {body, intro} = card(el, props), d3 = window.d3, cx = 500, cy = 690, A = 2.1, g = body.append('g').attr('transform', `translate(${cx} ${cy})`), arc = d3.arc().innerRadius(215).outerRadius(290);
  g.append('path').attr('d', d3.arc().innerRadius(200).outerRadius(304)({startAngle: -A - .05, endAngle: A + .05})).attr('fill', C.ink).attr('transform', 'translate(12 12)');
  [[0, props.zones[0], C.teal], [props.zones[0], props.zones[1], C.yellow], [props.zones[1], 1, C.pink]].forEach(([a, b, color]) => g.append('path').attr('d', arc({startAngle: -A + a * 2 * A, endAngle: -A + b * 2 * A})).attr('fill', color).attr('stroke', C.ink).attr('stroke-width', 7).attr('stroke-linejoin', 'round'));
  for (let i = 0; i <= 10; i++) { const a = -A + i / 10 * 2 * A - Math.PI / 2, r0 = 170, r1 = 195; g.append('path').attr('d', `M${Math.cos(a) * r0} ${Math.sin(a) * r0}L${Math.cos(a) * r1} ${Math.sin(a) * r1}`).attr('stroke', C.paper).attr('stroke-width', i % 5 ? 4 : 8).attr('stroke-linecap', 'round');
    if (i % 5 === 0) label(g, Math.cos(a) * 138, Math.sin(a) * 138 + 12, String(Math.round(props.max * i / 10)), {size: 32, anchor: 'middle', font: F.display, spacing: 0}); }
  const needle = g.append('g'); needle.append('path').attr('d', 'M-14 0L0 -250L14 0Z').attr('fill', C.ink).attr('transform', 'translate(8 8)'); needle.append('path').attr('d', 'M-14 0L0 -250L14 0Z').attr('fill', C.paper).attr('stroke', C.ink).attr('stroke-width', 6).attr('stroke-linejoin', 'round');
  g.append('circle').attr('r', 34).attr('fill', C.pink).attr('stroke', C.ink).attr('stroke-width', 7);
  const numG = body.append('g'), num = lettering(numG, 0, 0, '0', {size: 110, fill: 'hot'}), tag = tab(body, 0, 0, props.label, {size: 34, fill: 'yellow', color: C.ink});
  return {seek(t) {
    intro(t);
    const k = span(t, .5, 1.2), swing = k >= 1 ? 1 : 1 - Math.exp(-5 * k) * Math.cos(9 * k), v = props.value / props.max * swing + (t > .5 ? (noise(t * 9, 4) - .5) * .012 : 0);
    needle.attr('transform', `rotate(${(-A + Math.max(0, v) * 2 * A) * 180 / Math.PI})`); g.attr('opacity', span(t, .25, .15));
    num.text(Math.round(props.value * easeOut(k)) + props.suffix); place(numG, 500, 830, pop(t, .6), -3); place(tag.g, 500 - tag.w / 2, 878, pop(t, .9), -3);
  }};
}

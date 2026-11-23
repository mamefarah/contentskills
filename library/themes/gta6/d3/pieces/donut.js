import {C, F, P, seriesGrads, series, label, lettering, place, span, easeOut, pop} from '../../coast.js';
import {card} from './_card.js';

// Shares of a whole as fat inked ring segments that sweep round, with the leading share called out in the middle.
export const meta = {duration: 3.4};
export const defaults = {title: 'Where the time goes', unit: 'Illustrative · share of a week', clear: false, suffix: '%',
  items: [{label: 'Editing', value: 45}, {label: 'Filming', value: 25}, {label: 'Ideas', value: 18}, {label: 'Posting', value: 12}]};

export function mount(el, props = defaults) {
  const {body, intro} = card(el, props), d3 = window.d3, total = props.items.reduce((s, d) => s + d.value, 0), cx = 360, cy = 590, arc = d3.arc().innerRadius(120).outerRadius(225).cornerRadius(6);
  const ring = body.append('g').attr('transform', `translate(${cx} ${cy})`); ring.append('circle').attr('r', 232).attr('fill', C.ink).attr('transform', 'translate(12 12)');
  let at = 0; const segs = props.items.map((d, i) => { const a0 = at / total * 2 * Math.PI; at += d.value; return {d, a0, a1: at / total * 2 * Math.PI, path: ring.append('path').attr('fill', series[i % series.length]).attr('stroke', C.ink).attr('stroke-width', 7).attr('stroke-linejoin', 'round')}; });
  ring.append('circle').attr('r', 112).attr('fill', C.night).attr('stroke', C.ink).attr('stroke-width', 7);
  const big = props.items.reduce((a, b) => b.value > a.value ? b : a), midG = body.append('g'), mid = lettering(midG, 0, 24, '0' + props.suffix, {size: 76, fill: 'hot', outline: 7, shadow: 5});
  const legend = props.items.map((d, i) => { const g = body.append('g'); g.append('rect').attr('x', 0).attr('y', -28).attr('width', 40).attr('height', 40).attr('fill', series[i % series.length]).attr('stroke', C.ink).attr('stroke-width', 5);
    label(g, 56, 6, d.label.toUpperCase(), {size: 34}); label(g, 56, 40, d.value + props.suffix, {size: 26, font: F.body, weight: 700, color: C.yellow, spacing: 0}); return g; });
  return {seek(t) {
    intro(t);
    const sweep = easeOut(span(t, .45, 1.3)) * 2 * Math.PI;
    segs.forEach(s => s.path.attr('d', sweep > s.a0 ? arc({startAngle: s.a0, endAngle: Math.min(s.a1, sweep)}) : ''));
    mid.text(Math.round(big.value / total * 100 * easeOut(span(t, .45, 1.3))) + props.suffix); place(midG, cx, cy, pop(t, .5));
    legend.forEach((g, i) => place(g, 650, 440 + i * 100, pop(t, .7 + i * .15)));
  }};
}

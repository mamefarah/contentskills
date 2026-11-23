import {C, F, P, burst, inked, label, lettering, place, span, easeOut, pop, draw} from '../../coast.js';
import {card} from './_card.js';

// A fat inked trend line over a gradient fill, with a dot on every point and the last value on a burst.
export const meta = {duration: 3.6};
export const defaults = {title: 'Views per month', unit: 'Illustrative · thousands', clear: false, suffix: 'K',
  points: [{label: 'JAN', value: 12}, {label: 'FEB', value: 18}, {label: 'MAR', value: 16}, {label: 'APR', value: 29}, {label: 'MAY', value: 41}, {label: 'JUN', value: 64}]};

export function mount(el, props = defaults) {
  const {body, intro, defs, id} = card(el, props), d3 = window.d3, n = props.points.length, max = Math.max(...props.points.map(p => p.value)) * 1.12;
  const x = i => 150 + i * 660 / (n - 1), y = v => 800 - v / max * 400, pts = props.points.map((p, i) => [x(i), y(p.value)]), line = d3.line().curve(d3.curveMonotoneX);
  for (let k = 0; k <= 4; k++) body.append('path').attr('d', `M120 ${800 - k * 100}H880`).attr('stroke', C.paper).attr('stroke-width', k ? 2 : 6).attr('opacity', k ? .18 : 1).attr('stroke-linecap', 'round');
  const clip = defs.append('clipPath').attr('id', id + '-wipe').append('rect').attr('x', 100).attr('y', 250).attr('height', 560);
  const area = body.append('path').attr('d', line(pts) + `L${x(n - 1)} 800L${x(0)} 800Z`).attr('fill', P(body, 'hot')).attr('opacity', .75).attr('clip-path', `url(#${id}-wipe)`);
  const under = body.append('path').attr('d', line(pts)).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 26).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
  const over = body.append('path').attr('d', line(pts)).attr('fill', 'none').attr('stroke', C.paper).attr('stroke-width', 12).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
  const dots = props.points.map((p, i) => { label(body, x(i), 848, p.label, {size: 28, anchor: 'middle'}); const g = body.append('g'); g.append('circle').attr('r', 17).attr('fill', C.pink).attr('stroke', C.ink).attr('stroke-width', 6); return g; });
  const flag = body.append('g'); inked(flag, burst(0, 0, 92, 70, 14), {fill: 'yellow', ink: 7, shadow: 9}); lettering(flag, 0, 20, props.points[n - 1].value + props.suffix, {size: 56, fit: 110, fill: 'candy', outline: 6, shadow: 4});
  return {seek(t) {
    intro(t);
    const q = span(t, .5, 1.3); draw(under, q); draw(over, q); clip.attr('width', 20 + 780 * easeOut(q));
    dots.forEach((g, i) => place(g, pts[i][0], pts[i][1], pop(t, .5 + 1.3 * (1 - Math.pow(1 - i / (n - 1), 1 / 3)) * .8)));
    place(flag, Math.min(840, pts[n - 1][0] - 20), pts[n - 1][1] - 96, pop(t, 1.75, .36), 8 + Math.sin(t * 2.5) * 4);
  }};
}

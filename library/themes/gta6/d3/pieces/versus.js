import {C, F, P, quad, poly, inked, burst, label, lettering, place, span, easeOut, pop, slam} from '../../coast.js';
import {card} from './_card.js';

// Two figures head to head: slanted plates slide in from either side, the numbers count up and a VS burst lands between them.
export const meta = {duration: 3.4};
export const defaults = {title: 'One post or a system', unit: 'Illustrative · hours per week', clear: false,
  a: {label: 'BY HAND', value: 14, suffix: 'H'}, b: {label: 'SYSTEM', value: 3, suffix: 'H'}, badge: 'VS'};

export function mount(el, props = defaults) {
  const {body, intro} = card(el, props);
  const sides = [props.a, props.b].map((d, i) => {
    const g = body.append('g'); inked(g, poly(quad(-170, -210, 340, 420, i ? -18 : 18, i ? 18 : -18, 26)), {fill: i ? 'sea' : 'candy', ink: 7, shadow: 14, join: 'miter'});
    const ng = g.append('g'), num = lettering(ng, 0, 40, d.value + (d.suffix ?? ''), {size: 130, fit: 230, fill: 'paper', outline: 11, shadow: 8});
    inked(g, poly(quad(-150, 110, 300, 70, 0, 0, 14)), {fill: 'night', ink: 5, shadow: 6, join: 'miter'}); label(g, 0, 162, d.label, {size: 42, anchor: 'middle'});
    return {g, d, num, ng, dir: i ? 1 : -1};
  });
  const badge = body.append('g'); inked(badge, burst(0, 0, 96, 70, 12), {fill: 'yellow', ink: 8, shadow: 10}); lettering(badge, 0, 26, props.badge, {size: 72, fit: 104, fill: 'candy', outline: 6, shadow: 4});
  return {seek(t) {
    intro(t);
    sides.forEach(({g, d, num, ng, dir}, i) => { const q = easeOut(span(t, .4 + i * .15, .4)); place(g, 500 + dir * 205 + dir * (1 - q) * 500, 590, 1, dir * 2).attr('opacity', span(t, .4 + i * .15, .06));
      num.text(Math.round(d.value * easeOut(span(t, .7 + i * .15, .8))) + (d.suffix ?? '')); place(ng, 0, 0, slam(t, .7 + i * .15)); });
    place(badge, 500, 400, pop(t, 1.1, .36), -8 + Math.sin(t * 2.4) * 5);
  }};
}

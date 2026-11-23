import {C, F, P, burst, label, lettering, place, span, easeOut, pop} from '../../coast.js';
import {card} from './_card.js';

// "So many out of every hundred" as a grid of little suns: the counted ones light up in a wave.
export const meta = {duration: 3.6};
export const defaults = {title: 'Who plans ahead', unit: 'Illustrative · out of 50 creators', clear: false, total: 50, value: 12, cols: 10, label: 'HAVE A SYSTEM'};

export function mount(el, props = defaults) {
  const {body, intro} = card(el, props), cols = props.cols, rows = Math.ceil(props.total / cols), step = Math.min(560 / cols, 400 / rows), r = step * .4, x0 = 130 + r, y0 = 350 + r;
  const cells = Array.from({length: props.total}, (_, i) => {
    const g = body.append('g').attr('transform', `translate(${x0 + (i % cols) * step} ${y0 + Math.floor(i / cols) * step})`), on = i < props.value;
    g.append('path').attr('d', burst(0, 0, r, r * .7, 10)).attr('fill', C.plum).attr('stroke', C.ink).attr('stroke-width', 4).attr('stroke-linejoin', 'round');
    const lit = g.append('g'); if (on) { lit.append('path').attr('d', burst(0, 0, r * 1.1, r * .74, 10)).attr('fill', C.yellow).attr('stroke', C.ink).attr('stroke-width', 4).attr('stroke-linejoin', 'round'); lit.append('circle').attr('r', r * .42).attr('fill', C.orange).attr('stroke', C.ink).attr('stroke-width', 3); }
    return {g, lit, on, i};
  });
  const numG = body.append('g'), num = lettering(numG, 0, 0, '0', {size: 170, fit: 200, fill: 'hot'}); label(numG, 0, 60, `OF ${props.total}`, {size: 40, anchor: 'middle'});
  const tagG = body.append('g'); lettering(tagG, 0, 0, props.label, {size: 50, fit: 700, fill: 'paper', outline: 7, shadow: 5});
  return {seek(t) {
    intro(t);
    cells.forEach(({g, lit, on, i}) => { g.attr('opacity', span(t, .35 + (i % cols + Math.floor(i / cols)) * .03, .15)); if (on) { const k = t - (.9 + i * .07); lit.attr('opacity', k > 0 ? 1 : 0).attr('transform', `scale(${k > 0 ? 1 + .6 * Math.exp(-k * 9) : 1}) rotate(${t * 20})`); } });
    num.text(String(Math.round(props.value * span(t, .9, props.value * .07)))); place(numG, 790, 520, pop(t, .8), -4); place(tagG, 500, 830, pop(t, 1.2 + props.value * .07), -2);
  }};
}

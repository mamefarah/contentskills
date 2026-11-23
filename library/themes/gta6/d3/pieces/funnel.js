import {C, F, P, seriesGrads, poly, inked, label, lettering, place, span, easeOut, pop} from '../../coast.js';
import {card} from './_card.js';

// A funnel of stacked slanted slabs, each narrower than the last, dropping into place with its count.
export const meta = {duration: 3.6};
export const defaults = {title: 'From view to sale', unit: 'Illustrative · people', clear: false,
  stages: [{label: 'SAW IT', value: 10000}, {label: 'WATCHED', value: 4200}, {label: 'CLICKED', value: 900}, {label: 'BOUGHT', value: 120}]};

export function mount(el, props = defaults) {
  const {body, intro} = card(el, props), n = props.stages.length, h = Math.min(120, 500 / n), max = props.stages[0].value;
  const slabs = props.stages.map((s, i) => {
    const w0 = 130 + 440 * Math.sqrt(s.value / max), w1 = 130 + 440 * Math.sqrt((props.stages[i + 1]?.value ?? s.value * .6) / max), g = body.append('g');
    inked(g, poly([[-w0 / 2, 0], [w0 / 2, 0], [w1 / 2, h - 16], [-w1 / 2, h - 16]]), {fill: seriesGrads[i % seriesGrads.length], ink: 7, shadow: 11, join: 'miter'});
    label(g, 0, h / 2 + 4, s.label, {size: Math.min(40, h * .4), color: C.ink, anchor: 'middle'});
    const vg = body.append('g'), value = lettering(vg, 0, 0, '', {size: 48, fill: 'paper', anchor: 'start', outline: 6, shadow: 4});
    return {g, s, vg, value, w0};
  });
  return {seek(t) {
    intro(t);
    slabs.forEach(({g, s, vg, value, w0}, i) => { const at = .45 + i * .28, q = easeOut(span(t, at, .35)), y = 330 + i * h;
      place(g, 390, y - (1 - q) * 240, 1, (1 - q) * (i % 2 ? 8 : -8)).attr('opacity', span(t, at, .06));
      value.text(Math.round(s.value * easeOut(span(t, at + .1, .7))).toLocaleString('en-US')); place(vg, 390 + w0 / 2 + 24, y + h / 2 + 8, pop(t, at + .2), -3); });
  }};
}

import {C, F, P, seriesGrads, burst, inked, label, lettering, place, span, easeOut, pop} from '../../coast.js';
import {card, bar} from './_card.js';

// A ranked list as horizontal inked bars racing out from numbered bursts, longest first.
export const meta = {duration: 3.6};
export const defaults = {title: 'Top formats', unit: 'Illustrative · average watch time', clear: false, suffix: 's',
  items: [{label: 'Story', value: 48}, {label: 'Tutorial', value: 41}, {label: 'List', value: 33}, {label: 'Reaction', value: 24}, {label: 'Vlog', value: 17}]};

export function mount(el, props = defaults) {
  const {body, intro} = card(el, props), n = props.items.length, row = Math.min(112, 520 / n), max = Math.max(...props.items.map(d => d.value)), h = row * .56;
  const rows = props.items.map((d, i) => {
    const y = 350 + i * row, set = bar(body, P(body, seriesGrads[i % seriesGrads.length])), name = label(body, 0, y + h / 2 + 13, d.label.toUpperCase(), {size: Math.min(38, h * .7), color: C.ink}), value = label(body, 0, y + h / 2 + 14, '', {size: 38, font: F.display, color: C.paper, spacing: 0});
    const badge = body.append('g'); inked(badge, burst(0, 0, 40, 31, 10), {fill: i ? 'paper' : 'yellow', ink: 5, shadow: 5}); label(badge, 0, 14, String(i + 1), {size: 38, font: F.display, color: C.ink, anchor: 'middle', spacing: 0});
    return {d, y, set, name, value, badge};
  });
  return {seek(t) {
    intro(t);
    rows.forEach(({d, y, set, name, value, badge}, i) => {
      const at = .45 + i * .15, q = easeOut(span(t, at, .7)), w = 520 * d.value / max * q;
      set(200, y, w, h, false); name.attr('x', 222).attr('opacity', span(t, at + .3, .2) * (w > 180 ? 1 : 0)); value.attr('x', 200 + w + 26).text(Math.round(d.value * q) + props.suffix).attr('opacity', span(t, at, .1));
      place(badge, 150, y + h / 2, pop(t, at - .1), Math.sin(t * 2 + i) * 6);
    });
  }};
}

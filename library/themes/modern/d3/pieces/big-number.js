import {card, heavy, figure, C, STEP, strips, veil, label, up, span, snap, fit, F} from './_card.js';

// One huge number over three picture strips: the strips slide in from alternate ends on the beat,
// a charcoal veil settles over them, and the figure counts up in heavy white capitals;
// a tracked caption sits under it. "2.4M views", "87% of people", "x3 faster".
export const meta = {duration: 5};
export const defaults = {title: 'In thirty days', unit: 'Channel total', value: '2.4M', label: 'Views', clear: false, tones: ['steel', 'ember', 'teal']};

export function mount(el, props = defaults) {
  const c = card(el, props), {root, T, st} = c, value = String(props.value ?? '');
  const top = 250, bottom = 880, s = strips(st, root, {n: 3, tones: props.tones ?? defaults.tones, images: props.images ?? [], top, bottom, gap: 8});
  const v = veil(st, root, 0);
  const size = fit(value, 820, 300), m = value.match(/-?[\d,]*\.?\d+/);
  const num = heavy(root, 500, 565 + size * .36, '', size, {anchor: 'middle'});
  const cap = label(root, 500, 565 + size * .36 + 80, up(props.label ?? ''), {size: 30, anchor: 'middle', track: .32, weight: 600, opacity: 0});
  return {seek(t) {
    c.seek(t); s.seek(t, T - .2);
    v.attr('opacity', .5 * snap(span(t, T + .3, STEP * 2))).attr('y', top).attr('height', bottom - top);
    const q = snap(span(t, T + .45, STEP * 6));
    num.attr('opacity', t >= T + .45 ? 1 : 0).selectAll('tspan').text(m ? value.slice(0, m.index) + figure(m[0].replace(/,/g, ''), q).replace(/\B(?=(\d{3})+(?!\d))/g, m[0].includes(',') ? ',' : '') + value.slice(m.index + m[0].length) : value);
    cap.attr('opacity', t >= T + .8 ? 1 : 0);
  }};
}

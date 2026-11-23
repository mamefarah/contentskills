import {C, F, P, burst, rays, inked, label, lettering, tab, place, span, easeOut, pop, slam, shake} from '../../coast.js';
import {card} from './_card.js';

// One huge figure slammed into the middle of the card over a turning burst, with a sticker note beside it.
export const meta = {duration: 3.2};
export const defaults = {title: 'The number that matters', unit: 'Illustrative', clear: false, value: 87, prefix: '', suffix: '%', label: 'QUIT IN YEAR ONE', sticker: 'OUCH'};

export function mount(el, props = defaults) {
  const {body, intro} = card(el, props), fmt = v => props.prefix + Math.round(v).toLocaleString('en-US') + props.suffix;
  const flare = body.append('path').attr('d', burst(0, 0, 330, 190, 18)).attr('fill', C.pink).attr('stroke', C.ink).attr('stroke-width', 7).attr('stroke-linejoin', 'round');
  const numG = body.append('g'), num = lettering(numG, 0, 90, fmt(props.value), {size: 260, fit: 620, fill: 'hot', rim: 6});
  const tag = tab(body, 0, 0, props.label, {size: 50, fill: 'yellow', color: C.ink});
  const st = body.append('g'); if (props.sticker) { inked(st, burst(0, 0, 100, 78, 14), {fill: 'aqua', ink: 7, shadow: 9}); lettering(st, 0, 20, props.sticker, {size: 56, fit: 130, fill: 'candy', outline: 6, shadow: 4}); }
  return {seek(t) {
    intro(t);
    const [sx, sy] = shake(t, .7, 14);
    flare.attr('transform', `translate(500 570) rotate(${t * 12}) scale(${pop(t, .35, .4) || .0001})`);
    num.text(fmt(props.value * easeOut(span(t, .6, .9)))); place(numG, 500 + sx, 560 + sy, slam(t, .45), -3).attr('opacity', span(t, .45, .06));
    place(tag.g, 500 - tag.w / 2, 800, pop(t, .9), -3); place(st, 800, 360, props.sticker ? pop(t, 1.3, .36) : 0, 12 + Math.sin(t * 2.6) * 5);
  }};
}

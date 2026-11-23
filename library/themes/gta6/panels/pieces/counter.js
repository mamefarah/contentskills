import {C, coastStage, quad, panel, halftone, burst, lettering, tab, place, span, easeOut, slam, pop, presence, flick} from '../../coast.js';

// A big number that counts up on a slanted panel with a label tab — for the figure just spoken.
// `y` is the vertical centre in frame pixels (keep it clear of the face).
export const meta = {duration: 3, live: true};
export const defaults = {value: 5, prefix: '', suffix: '', label: 'WAYS TO MAKE MONEY', y: 360, fill: 'hot'};

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), y = props.y, g = root.append('g'), cardG = g.append('g');
  const card = panel(cardG, quad(-270, -165, 540, 330, 34, -14, 30), {fill: 'dusk'}), inside = cardG.append('g').attr('clip-path', card.clip);
  const flare = inside.append('path').attr('d', burst(0, 10, 330, 150, 16)).attr('fill', C.pink).attr('opacity', .55);
  halftone(inside, -290, -180, 580, 360, {color: C.aqua, from: 'bl', cell: 28, opacity: .4});
  const numG = g.append('g'), fmt = v => (props.prefix ?? '') + (Number.isInteger(props.value) ? Math.round(v).toLocaleString('en-US') : v.toFixed(1)) + (props.suffix ?? '');
  const num = lettering(numG, 0, 96, fmt(props.value), {size: 280, fit: 470, fill: props.fill, rim: 5});
  const label = tab(g, 0, 0, props.label, {size: 46, fill: 'pink'});
  return {
    seek(t) {
      root.attr('opacity', presence(t, props.life)); g.attr('transform', flick(t, props.life, 540, y));
      place(cardG, 540, y, pop(t, 0, .34), -2); flare.attr('transform', `rotate(${t * 14})`);
      num.text(fmt(props.value * easeOut(span(t, .2, .9)))); place(numG, 540, y, slam(t, .16), -2).attr('opacity', span(t, .16, .06));
      place(label.g, 540 - label.w / 2, y + 190, pop(t, .5), -3);
    },
  };
}

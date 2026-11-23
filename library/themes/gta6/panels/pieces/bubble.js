import {C, F, coastStage, bubble, inked, halftone, label, wrap, place, span, pop, presence, leave, typed} from '../../coast.js';

// A comic speech bubble with its tail pointing toward the speaker. The text types in.
// (x, y) is the bubble's top-left, `w` its width; `tail` is the point the tail reaches for.
export const meta = {duration: 3.5, live: true};
export const defaults = {text: 'WAIT, WHAT?!', x: 110, y: 170, w: 720, tail: [610, 640], size: 110, fill: 'paper'};

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), {x, y, w, size} = props, lines = wrap(props.text, w - 110, size, F.comic, .03), h = lines.length * size * 1.02 + 90, g = root.append('g');
  const [tx, ty] = props.tail, d = bubble(x, y, w, h, tx, Math.min(ty, y + h + 150), 60), shape = inked(g, d, {fill: props.fill, ink: 9, shadow: 14}), id = 'bub' + Math.round(x + y * 7 + w);
  g.append('clipPath').attr('id', id).append('path').attr('d', d);
  halftone(g.append('g').attr('clip-path', `url(#${id})`), x, y, w, h + 60, {color: C.pink, from: 'br', cell: 26, opacity: .5});
  g.append('path').attr('d', d).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 9).attr('stroke-linejoin', 'round');
  const rows = lines.map((line, i) => label(g, x + w / 2, y + 52 + size * .82 + i * size * 1.02, '', {size, font: F.comic, color: C.ink, anchor: 'middle', spacing: .03}));
  const total = lines.join('').length;
  return {
    seek(t) {
      root.attr('opacity', presence(t, props.life));
      const k = pop(t, 0, .3) * (1 - leave(t, props.life)); g.attr('transform', `translate(${tx} ${ty}) scale(${Math.max(.0001, k)}) rotate(${(1 - Math.min(1, k)) * -8}) translate(${-tx} ${-ty})`);
      let shown = Math.round(total * span(t, .22, Math.min(.9, total * .035)));
      rows.forEach((row, i) => { row.text(lines[i].slice(0, shown)); shown = Math.max(0, shown - lines[i].length); });
    },
  };
}

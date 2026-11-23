import {C, coastStage, quad, poly, inked, car, lettering, tab, place, span, easeOut, pop, presence, flick} from '../../coast.js';

// A progress bar as a strip of road: it fills with sunset color while a car rides the leading
// edge and the percentage counts up. `to` is the final percent, `seconds` how long it takes.
export const meta = {duration: 3.5, live: true};
export const defaults = {label: 'LOADING THE GOOD PART', to: 100, seconds: 1.4, y: 380, suffix: '%'};

export function mount(el, props = defaults) {
  const {root, defs, id} = coastStage(el, {overlay: true}), y = props.y, x = 90, w = 900, h = 76, g = root.append('g');
  const track = quad(x, y - h / 2, w, h, 0, 0, 30); inked(g, poly(track), {fill: 'night', ink: 7, shadow: 12, join: 'miter'});
  const clip = defs.append('clipPath').attr('id', id + '-bar').append('rect').attr('x', x - 20).attr('y', y - h).attr('height', h * 2);
  const fill = g.append('g').attr('clip-path', `url(#${id}-bar)`); fill.append('path').attr('d', poly(track)).attr('fill', `url(#${id}-hot)`);
  const hatch = fill.append('path').attr('stroke', C.paper).attr('stroke-width', 9).attr('opacity', .35); let d = ''; for (let i = -4; i < 30; i++) d += `M${x + i * 44} ${y + h / 2}l44 ${-h}`; hatch.attr('d', d);
  g.append('path').attr('d', `M${x + 30} ${y}H${x + w - 30}`).attr('stroke', C.paper).attr('stroke-width', 5).attr('stroke-dasharray', '26 22').attr('opacity', .5);
  g.append('path').attr('d', poly(track)).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 7).attr('stroke-linejoin', 'miter');
  const ride = car(g, 0, 0, .42), title = tab(g, 0, 0, props.label, {size: 42, fill: 'pink'}), numG = g.append('g'), num = lettering(numG, 0, 0, '100' + props.suffix, {size: 110, fill: 'hot', anchor: 'end', rim: 4});
  return {
    seek(t) {
      root.attr('opacity', presence(t, props.life)); g.attr('transform', flick(t, props.life, 540, y));
      const q = easeOut(span(t, .3, props.seconds)) * props.to / 100, px = x + w * q;
      clip.attr('width', w * q + 20); hatch.attr('transform', `translate(${(t * 60) % 44} 0)`);
      ride.g.attr('transform', `translate(${px - 150} ${y - h / 2 + 4 + Math.sin(t * 22) * 1.5 * (q < props.to / 100 ? 1 : 0)}) scale(.42)`).attr('opacity', span(t, .2, .1)); ride.wheels.forEach(s => s.attr('transform', `rotate(${q * 3000})`));
      num.text(Math.round(q * 100) + props.suffix); place(numG, x + w, y + 150, pop(t, .3), -3); place(title.g, x + 10, y - 128, pop(t, .1), -3);
    },
  };
}

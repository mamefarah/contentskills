import {C, F, coastStage, pinPath, inked, lettering, tab, measure, draw, place, span, easeOut, pop, presence, leave, typed} from '../../coast.js';

// A place-and-time card: a pin drops, the place name is written in brush script over a painted
// underline, and a tag types out the time. (x, y) is the left end of the name's baseline.
export const meta = {duration: 4, live: true};
export const defaults = {place: 'Sunset Strip', line: 'SATURDAY · 7:42 PM', x: 170, y: 330, fill: 'hot'};

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), {x, y} = props, g = root.append('g'), size = Math.min(150, 150 * 800 / measure(props.place, 150, F.script)), w = measure(props.place, size, F.script);
  const under = g.append('path').attr('d', `M${x - 20} ${y + 34}Q${x + w * .5} ${y + 8} ${x + w + 30} ${y + 26}`).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 30).attr('stroke-linecap', 'round');
  const under2 = g.append('path').attr('d', under.attr('d')).attr('fill', 'none').attr('stroke', C.pink).attr('stroke-width', 18).attr('stroke-linecap', 'round');
  const nameG = g.append('g'); lettering(nameG, 0, 0, props.place, {size, font: F.script, fill: props.fill, anchor: 'start', outline: size * .09, shadow: size * .06});
  const pinG = g.append('g'); inked(pinG, pinPath(0, 0, 1.15), {fill: 'pink', ink: 7, shadow: 8}); pinG.append('circle').attr('cy', -99).attr('r', 20).attr('fill', C.paper).attr('stroke', C.ink).attr('stroke-width', 6);
  const line = tab(g, 0, 0, props.line, {size: 42, fill: 'yellow', color: C.ink}), text = line.g.select('text');
  return {
    seek(t) {
      const out = leave(t, props.life);
      root.attr('opacity', presence(t, props.life)); g.attr('transform', `translate(${-out * 700} 0)`);
      const drop = span(t, 0, .3), bounce = drop >= 1 ? Math.abs(Math.sin((t - .3) * 14)) * 22 * Math.exp(-(t - .3) * 6) : 0;
      place(pinG, x - 78, y + 20 - (1 - drop * drop) * 420 - bounce).attr('opacity', span(t, 0, .1));
      place(nameG, x + 700 * (1 - easeOut(span(t, .2, .35))), y, 1, -3).attr('opacity', span(t, .2, .12));
      draw(under, span(t, .45, .4)); draw(under2, span(t, .5, .4));
      place(line.g, x + 20, y + 112, pop(t, .7), -2); text.text(typed(props.line, span(t, .8, .6)));
    },
  };
}

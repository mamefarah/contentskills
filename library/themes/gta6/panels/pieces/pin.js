import {C, coastStage, pinPath, inked, tab, draw, place, span, pop, presence, leave} from '../../coast.js';

// A map pin drops onto a point in the shot and a label tab is strung to it. (x, y) is the point;
// `side` says which way the label goes ('left' or 'right'), `lift` how far above the point it sits.
export const meta = {duration: 3.5, live: true};
export const defaults = {x: 800, y: 560, label: 'RIGHT HERE', detail: 'LOOK CLOSER', side: 'left', lift: 250, fill: 'pink'};

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), {x, y} = props, dir = props.side === 'left' ? -1 : 1, g = root.append('g');
  const ring = g.append('ellipse').attr('cx', x).attr('cy', y).attr('fill', 'none').attr('stroke', C.paper).attr('stroke-width', 6), spot = g.append('ellipse').attr('cx', x).attr('cy', y + 4).attr('rx', 30).attr('ry', 10).attr('fill', C.ink).attr('opacity', .5);
  const lx = x + dir * 170, ly = y - props.lift, d = `M${x + dir * 30} ${y - 120}L${lx} ${ly}`;
  const cord = g.append('path').attr('d', d).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 13).attr('stroke-linecap', 'round'), cord2 = g.append('path').attr('d', d).attr('fill', 'none').attr('stroke', C.paper).attr('stroke-width', 5).attr('stroke-linecap', 'round');
  const pinG = g.append('g'); inked(pinG, pinPath(0, 0, 1.5), {fill: props.fill, ink: 8, shadow: 9}); pinG.append('circle').attr('cy', -129).attr('r', 26).attr('fill', C.paper).attr('stroke', C.ink).attr('stroke-width', 7);
  const main = tab(g, 0, 0, props.label, {size: 56, fill: 'yellow', color: C.ink}), sub = tab(g, 0, 0, props.detail, {size: 36, fill: 'night'});
  return {
    seek(t) {
      root.attr('opacity', presence(t, props.life) * (1 - leave(t, props.life)));
      const drop = span(t, 0, .28), k = t - .28, bounce = drop >= 1 ? Math.abs(Math.sin(k * 15)) * 30 * Math.exp(-k * 6) : 0;
      place(pinG, x, y - (1 - drop * drop) * 700 - bounce, 1, drop >= 1 ? Math.sin(k * 15) * 6 * Math.exp(-k * 5) : -12).attr('opacity', span(t, 0, .08));
      const r = ((t - .28) % 1.2) / 1.2; ring.attr('rx', 30 + r * 90).attr('ry', 10 + r * 30).attr('opacity', t > .28 ? (1 - r) * .9 : 0); spot.attr('opacity', .5 * drop);
      draw(cord, span(t, .4, .25)); draw(cord2, span(t, .4, .25));
      place(main.g, dir < 0 ? lx - main.w + 30 : lx - 30, ly - 20, pop(t, .58), -3); place(sub.g, dir < 0 ? lx - sub.w + 10 : lx - 10, ly + 56, pop(t, .72), -3);
    },
  };
}

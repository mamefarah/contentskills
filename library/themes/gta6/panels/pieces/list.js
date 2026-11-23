import {C, F, coastStage, quad, poly, inked, burst, label, lettering, measure, place, span, easeOut, pop, presence, flick} from '../../coast.js';

// A list that deals out one slanted strip per item. Use `times` (seconds after the overlay starts)
// to bring each row in on the word that names it. (x, y) is the top-left in frame pixels.
export const meta = {duration: 5, live: true};
export const defaults = {title: 'The plan', items: ['POST EVERY DAY', 'GROW', 'HOPE TO GET PAID'], times: null, x: 70, y: 150, w: 660};

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), {x, y, w} = props, row = 104, g = root.append('g'), fills = ['paper', 'yellow', 'aqua', 'paper', 'pink'];
  const titleG = g.append('g'); lettering(titleG, 0, 0, props.title, {size: 92, font: F.script, fill: 'hot', anchor: 'start', fit: w});
  const rows = props.items.map((item, i) => {
    const r = g.append('g'), size = Math.min(54, 54 * (w - 150) / measure(item, 54, F.caps, .04));
    inked(r, poly(quad(40, -40, w - 40, 80, 8, 8, 22)), {fill: fills[i % fills.length], ink: 6, shadow: 10, join: 'miter'});
    label(r, 108, size * .36, item, {size, font: F.caps, color: C.ink});
    const badge = r.append('g'); inked(badge, burst(0, 0, 52, 40, 10), {fill: 'pink', ink: 6, shadow: 6}); label(badge, 0, 17, String(i + 1), {size: 48, font: F.display, color: C.paper, anchor: 'middle', spacing: 0});
    return {r, badge};
  });
  return {
    seek(t) {
      root.attr('opacity', presence(t, props.life)); g.attr('transform', flick(t, props.life, x + w / 2, y + 200, -1));
      place(titleG, x + 10, y + 70, pop(t, .05), -4);
      rows.forEach(({r, badge}, i) => {
        const at = props.times?.[i] ?? .5 + i * .6, q = easeOut(span(t, at, .28));
        r.attr('transform', `translate(${x + 30 - (1 - q) * 900} ${y + 160 + i * row}) rotate(${-2 + (1 - q) * -6})`).attr('opacity', span(t, at, .05));
        place(badge, 50, 0, pop(t, at + .12), Math.sin(t * 2 + i) * 6);
      });
    },
  };
}

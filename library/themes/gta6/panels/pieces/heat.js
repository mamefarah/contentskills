import {C, coastStage, quad, panel, burst, halftone, tab, lettering, place, span, pop, presence, flick} from '../../coast.js';

// A rating meter made of suns: they light up one at a time, each with a flash. Use it for a score,
// a level or progress through a count. `times` (seconds after it appears) can set when each lights.
export const meta = {duration: 4, live: true};
export const defaults = {label: 'HEAT LEVEL', value: 4, max: 5, y: 330, times: null, note: ''};

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), y = props.y, n = props.max, step = Math.min(170, 860 / n), r = step * .4, w = step * n + 70, x0 = 540 - step * (n - 1) / 2, g = root.append('g'), stripG = g.append('g');
  const strip = panel(stripG, quad(540 - w / 2, y - r - 40, w, r * 2 + 80, 24, 24, 26), {fill: 'dusk'}); halftone(stripG.append('g').attr('clip-path', strip.clip), 540 - w / 2, y - r - 60, w, r * 2 + 120, {color: C.pink, from: 'right', cell: 26, opacity: .45});
  const suns = Array.from({length: n}, (_, i) => {
    const s = g.append('g'), off = s.append('g'), on = s.append('g'), flash = s.append('circle').attr('r', r * 1.5).attr('fill', C.paper);
    off.append('path').attr('d', burst(0, 0, r, r * .72, 12)).attr('fill', C.plum).attr('stroke', C.ink).attr('stroke-width', 6).attr('stroke-linejoin', 'round'); off.append('circle').attr('r', r * .42).attr('fill', 'none').attr('stroke', C.violet).attr('stroke-width', 5);
    on.append('path').attr('d', burst(0, 0, r * 1.08, r * .74, 12)).attr('fill', C.ink).attr('transform', 'translate(7 7)');
    on.append('path').attr('d', burst(0, 0, r * 1.08, r * .74, 12)).attr('fill', C.yellow).attr('stroke', C.ink).attr('stroke-width', 6).attr('stroke-linejoin', 'round');
    on.append('circle').attr('r', r * .46).attr('fill', C.orange).attr('stroke', C.ink).attr('stroke-width', 5); on.append('path').attr('d', `M${-r * .22} ${-r * .12}a${r * .26} ${r * .26} 0 0 1 ${r * .3} ${-r * .2}`).attr('fill', 'none').attr('stroke', C.paper).attr('stroke-width', 5).attr('stroke-linecap', 'round');
    return {s, on, flash, i};
  });
  const title = tab(g, 0, 0, props.label, {size: 44, fill: 'pink'}), noteG = g.append('g');
  if (props.note) lettering(noteG, 0, 0, props.note, {size: 60, fill: 'paper', anchor: 'end', outline: 8, shadow: 5});
  return {
    seek(t) {
      root.attr('opacity', presence(t, props.life)); g.attr('transform', flick(t, props.life, 540, y));
      stripG.attr('transform', `translate(${-1200 * (1 - span(t, 0, .25) ** .5)} 0)`);
      suns.forEach(({s, on, flash, i}) => {
        const at = props.times?.[i] ?? .5 + i * .32, lit = i < props.value && t >= at, k = t - at;
        place(s, x0 + i * step, y - (i - (n - 1) / 2) * step * .028, pop(t, .2 + i * .05), lit ? Math.sin(t * 2 + i) * 5 : 0);
        on.attr('opacity', lit ? 1 : 0).attr('transform', `scale(${lit ? 1 + .5 * Math.exp(-k * 9) : 1})`); flash.attr('opacity', lit ? Math.max(0, .9 - k * 5) : 0);
      });
      place(title.g, 540 - w / 2 + 30, y - r - 74, pop(t, .3), -2.5); place(noteG, 540 + w / 2 - 20, y + r + 104, pop(t, .5 + props.value * .32), -3);
    },
  };
}

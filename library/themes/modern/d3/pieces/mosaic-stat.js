import {card, heavy, figure, C, STEP, mosaic, label, up, span, snap, fit} from './_card.js';

// Four stats in a 2x2 picture mosaic: cells wipe in one by one from their outer edges, a charcoal
// veil settles on each, then its figure counts up in heavy white with a tracked caption under it.
// A cross of charcoal gutters keeps the grid. images: stills for the four cells.
export const meta = {duration: 6};
export const defaults = {title: 'The year in numbers', unit: 'Channel summary', clear: false, tones: ['steel', 'ember', 'rose', 'teal'],
  items: [{label: 'Videos', value: '148'}, {label: 'Hours watched', value: '92K'}, {label: 'Countries', value: '64'}, {label: 'New subscribers', value: '31K'}]};

export function mount(el, props = defaults) {
  const c = card(el, props), {root, T, st} = c, items = (props.items ?? []).slice(0, 4), top = 240, bottom = 890;
  const m = mosaic(st, root, {tones: props.tones ?? defaults.tones, images: props.images ?? [], top, bottom, gap: 10});
  const rank = [0, 3, 1, 2];
  const cells = m.rects.map((r, i) => {
    const d = items[i] ?? {label: '', value: ''}, v = String(d.value ?? ''), g = root.append('g');
    const shade = g.append('rect').attr('x', r.x).attr('y', r.y).attr('width', r.w).attr('height', r.h).attr('fill', C.ink).attr('opacity', .5);
    const size = Math.min(130, fit(v, r.w * .78, 130));
    const num = heavy(g, r.x + 36, r.y + r.h - 70, '', size);
    const cap = label(g, r.x + 40, r.y + r.h - 32, up(d.label), {size: 17, track: .26});
    label(g, r.x + r.w - 32, r.y + 48, String(i + 1).padStart(2, '0'), {size: 17, anchor: 'end', font: '"Space Mono"', weight: 700, track: .04, color: C.bone});
    return {v, g, num, cap, at: T + rank[i] * STEP * .5};
  });
  const mt = v => { const x = v.match(/-?[\d,]*\.?\d+/); return x; };
  return {seek(t) {
    c.seek(t); m.seek(t, T - .1);
    for (const cl of cells) {
      const on = t >= cl.at + STEP * .8, q = snap(span(t, cl.at + STEP * .8, STEP * 4)), x = mt(cl.v);
      cl.g.attr('opacity', on ? 1 : 0);
      cl.num.selectAll('tspan').text(x ? cl.v.slice(0, x.index) + figure(x[0].replace(/,/g, ''), q) + cl.v.slice(x.index + x[0].length) : cl.v);
    }
  }};
}

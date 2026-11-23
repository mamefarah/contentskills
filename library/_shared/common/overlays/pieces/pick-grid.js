import {stage, text, measure, fade, leave, glide, span, easeBack, on} from '../../kit.js';

// A grid of numbered option tiles for "many options, pick one": the tiles pop in, one tile lights up in the
// accent (the pick) while the rest dim, then a few more light up crooked (spreading yourself thin). A small
// readout above the grid counts what is picked ("14 WAYS" -> "1 OF 14" -> "6 OF 14").
// Shared piece: drawn in the theme's look. (x, y) is the grid's top-left; keep it off the face and, below
// y 1160, left of x 945 (the app's button column). Times are seconds into the overlay.
export const meta = {duration: 3, live: true};
export const defaults = {count: 14, cols: 7, x: 56, y: 1180, w: 868, gap: 14, build: .5, one: 10, oneAt: .9, many: [2, 5, 7, 12, 13], manyAt: 1.6, manyStep: .13, unit: 'WAYS'};

export function mount(el, props = defaults, {look} = {}) {
  const p = {...defaults, ...props}, st = stage(el, look), g = st.root.append('g');
  const size = (p.w - p.gap * (p.cols - 1)) / p.cols, r = Math.min(look.radius ?? 24, size * .2);
  const many = (p.many || []).filter(n => n !== p.one);
  // the readout sits on its own tab so it reads on bright footage
  const tabW = measure(`${p.count} OF ${p.count}`, look, 'mono', 38, 700) + 44;
  const tab = g.append('rect').attr('x', p.x).attr('y', p.y - 78).attr('width', tabW).attr('height', 60).attr('rx', Math.min(r, 14)).attr('fill', look.surface);
  const readout = text(g, p.x + 22, p.y - 35, '', {size: 38, role: 'mono', color: look.ink, weight: 700}, look);
  const tiles = [];
  for (let i = 0; i < p.count; i++) {
    const n = i + 1, cx = p.x + (i % p.cols) * (size + p.gap) + size / 2, cy = p.y + Math.floor(i / p.cols) * (size + p.gap) + size / 2;
    const t = g.append('g');
    const box = () => t.append('rect').attr('x', -size / 2).attr('y', -size / 2).attr('width', size).attr('height', size).attr('rx', r);
    box().attr('fill', look.surface);
    const lit = n === p.one ? box().attr('fill', look.accent) : many.includes(n) ? box().attr('fill', look.accent2) : null;
    const num = text(t, 0, size * .15, n, {size: size * .4, role: 'mono', color: look.dim, anchor: 'middle', weight: 700}, look);
    // a fixed tilt per extra tile, alternating sides, so the extras look scattered
    const j = many.indexOf(n), tilt = j < 0 ? 0 : (j % 2 ? -1 : 1) * (5 + (j * 37 % 4));
    tiles.push({n, cx, cy, t, lit, num, j, tilt, litInk: n === p.one ? on(look.accent, look) : on(look.accent2, look)});
  }
  return {
    seek(t) {
      const picked = glide(span(t, p.oneAt, .18));
      let chosen = t >= p.oneAt ? 1 : 0;
      for (const d of tiles) {
        const inK = span(t, (d.n - 1) * p.build / p.count, .22);
        const k = d.n === p.one ? picked : d.j >= 0 ? glide(span(t, p.manyAt + d.j * p.manyStep, .16)) : 0;
        if (d.j >= 0 && t >= p.manyAt + d.j * p.manyStep) chosen++;
        const punch = d.n === p.one ? 1 + .16 * k : 1 + .06 * k;
        d.t.attr('transform', `translate(${d.cx} ${d.cy}) rotate(${d.tilt * k}) scale(${easeBack(inK) * punch})`)
          .attr('opacity', Math.min(1, inK * 3) * (1 - .55 * picked * (1 - k)));
        if (d.lit) d.lit.attr('opacity', k);
        d.num.attr('fill', k > .5 ? d.litInk : look.dim);
      }
      readout.text(chosen ? `${chosen} OF ${p.count}` : `${p.count} ${p.unit}`).attr('opacity', fade(t, 0, .2));
      tab.attr('opacity', fade(t, 0, .2));
      g.attr('opacity', 1 - leave(t, p.life));
    },
  };
}

import {clamp, easeOut, easeBack, fadeOut, stage, group, rr, line, text, measure, F} from '../../ui.js';

// Crossing things off, in big modern type: heavy white uppercase items stack above the head, each with a box; on its
// `strike` time a red stroke draws through the word, the box gets a cross and the word dims. No card: it sits on the
// footage with a soft shadow, like the big title text. Props: items [{label, at, strike}] (seconds into the overlay),
// x (left), y (top of the first row), size (cap size in px), color, strikeColor. Keep it above the face (y + rows ≤ face top).
// font / weight: another typeface (e.g. 'Bowlby One', the GTA6 theme's, loaded when a GTA6 piece or caption is in the video);
// outline: a dark edge in px (0 = none) so white words read on a white wall.
export const meta = {duration: 2, live: true};
export const defaults = {items: [{label: 'Apps', at: .05, strike: .35}, {label: 'Editing', at: .6, strike: .9}], x: 150, y: 250, size: 104,
  color: '#FFFFFF', strikeColor: '#FF3B47', font: '', weight: 800, outline: 0, outlineColor: '#160C24'};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), rows = [];
  const pitch = p.size * 1.22, box = p.size * .72;
  p.items.forEach((it, i) => {
    const label = String(it.label).toUpperCase(), g = group(svg, {filter: svg.shadow}), y = p.y + i * pitch;
    const bx = p.x, by = y + (p.size - box) / 2, tx = p.x + box + p.size * .34;
    const fam = p.font ? `"${p.font}", ${F}` : F, w = measure(svg, label, p.size, p.weight, fam);
    if (p.outline) rr(g, bx, by, box, box, box * .18, 'none', {stroke: p.outlineColor, 'stroke-width': p.size * .085 + p.outline * 2});
    rr(g, bx, by, box, box, box * .18, 'none', {stroke: p.color, 'stroke-width': p.size * .085});
    const cross = group(g);
    line(cross, [[bx + box * .24, by + box * .24], [bx + box * .76, by + box * .76]], p.strikeColor, p.size * .11);
    line(cross, [[bx + box * .76, by + box * .24], [bx + box * .24, by + box * .76]], p.strikeColor, p.size * .11);
    const word = text(g, tx, y + p.size * .5, label, p.size, p.weight, p.color, 'start', {'letter-spacing': -p.size * .02, 'font-family': fam,
      ...(p.outline ? {stroke: p.outlineColor, 'stroke-width': p.outline * 2, 'paint-order': 'stroke fill', 'stroke-linejoin': 'round'} : {})});
    const bar = line(g, [[tx - p.size * .08, y + p.size * .5], [tx - p.size * .08, y + p.size * .5]], p.strikeColor, p.size * .13, {'stroke-linecap': 'round'});
    rows.push({it, g, cross, word, bar, tx, w, y});
  });
  return {
    seek(t) {
      const out = fadeOut(t, p.life, .2);
      for (const r of rows) {
        const k = easeBack((t - r.it.at) / .28), s = clamp((t - r.it.strike) / .22), c = easeBack((t - r.it.strike) / .25);
        r.g.setAttribute('opacity', (clamp(k * 2) * out).toFixed(3));
        r.g.setAttribute('transform', `translate(${((1 - clamp(k)) * -40).toFixed(1)} 0)`);
        const x1 = r.tx - p.size * .08 + (r.w + p.size * .16) * easeOut(s);
        r.bar.setAttribute('points', `${r.tx - p.size * .08},${r.y + p.size * .5} ${x1.toFixed(1)},${r.y + p.size * .5}`);
        r.bar.setAttribute('opacity', s > 0 ? 1 : 0);
        r.cross.setAttribute('opacity', t >= r.it.strike ? 1 : 0);
        r.cross.setAttribute('transform', `translate(0 0)`); r.cross.style.transformOrigin = 'center'; r.cross.style.transformBox = 'fill-box';
        r.cross.style.transform = `scale(${Math.max(0, c).toFixed(3)})`;
        r.word.setAttribute('opacity', (1 - .35 * easeOut(s)).toFixed(3));
      }
    },
  };
}

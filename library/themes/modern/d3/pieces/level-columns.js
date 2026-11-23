import {card, heavy, figure, SERIES, C, STEP, panel, label, rule, up, span, snap, fit, wrap} from './_card.js';

// Comparison columns as tall vertical picture strips with staggered tops, sliding in from alternate
// ends. Charcoal then pours down each strip to its level, leaving the picture filled up to the value;
// a white level line marks it with the value in heavy type above, the label at the foot of the strip.
export const meta = {duration: 6};
export const defaults = {title: 'Retention by length', unit: 'Percent who watch to the end', clear: false,
  items: [{label: 'Under 30 s', value: 82}, {label: '1 minute', value: 61}, {label: '3 minutes', value: 38}, {label: '10 minutes', value: 19}]};

export function mount(el, props = defaults) {
  const c = card(el, props), {root, T, st} = c, items = (props.items ?? []).slice(0, 5), n = Math.max(1, items.length), tones = props.tones ?? SERIES;
  const max = props.max ?? Math.max(100, ...items.map(d => d.value)), x0 = 80, x1 = 920, gap = 16, cw = (x1 - x0 - gap * (n - 1)) / n, y0 = 250, y1 = 880;
  const vs = Math.min(64, fit(figure(max) + '%', cw * .85, 64));
  const cols = items.map((d, i) => {
    const x = x0 + i * (cw + gap), top = y0 + (i % 2 ? 0 : 26), h = y1 - top, lvl = y1 - h * d.value / max;
    const p = panel(st, root, {x, y: top, w: cw, h, tone: d.tone ?? tones[i % tones.length], image: d.image ?? null});
    const g = root.append('g');
    const shade = g.append('rect').attr('x', x).attr('y', top).attr('width', cw).attr('fill', C.bg).attr('opacity', .86);
    const ln = rule(g, x, lvl, x + cw, lvl, {width: 3});
    const val = heavy(g, x + 16, lvl - 20, '', vs);
    const lines = wrap(up(d.label), 18, cw - 32, {font: '"Inter Tight"', weight: 600, track: .22}).slice(0, 2), fh = 76 + (lines.length - 1) * 26;
    g.append('rect').attr('x', x).attr('y', y1 - fh).attr('width', cw).attr('height', fh).attr('fill', C.ink).attr('opacity', .55);
    const lab = label(g, x + 16, y1 - 28 - (lines.length - 1) * 26, lines.join('\n'), {size: 18, track: .22});
    return {d, x, top, h, lvl, p, g, shade, ln, val, lab, at: T - .1 + i * STEP * .5, dir: i % 2 ? -1 : 1};
  });
  return {seek(t) {
    c.seek(t);
    for (const o of cols) {
      const a = snap(span(t, o.at, STEP * 1.6)), yy = o.top + o.dir * (1 - a) * 1000;
      o.p.set({y: yy, dy: yy - o.top, opacity: a > 0 ? 1 : 0});
      const q = snap(span(t, T + .6 + (o.at - T) * .6, STEP * 5)), level = o.top + (o.lvl - o.top) * q;
      o.g.attr('transform', `translate(0 ${(yy - o.top).toFixed(1)})`).attr('opacity', a > 0 ? 1 : 0);
      o.shade.attr('height', Math.max(0, level - o.top));
      o.ln.range(0, q > 0 ? 1 : 0); o.ln.node.attr('y1', level).attr('y2', level);
      o.val.attr('y', Math.max(o.top + vs, level - 20)).attr('opacity', q > 0 ? 1 : 0).selectAll('tspan').text(figure(o.d.value, q) + '%');
      o.lab.attr('opacity', t >= o.at + STEP ? 1 : 0);
    }
  }};
}

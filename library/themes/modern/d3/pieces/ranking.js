import {card, heavy, figure, SERIES, C, STEP, panel, label, mono, rule, up, span, snap, fit, pad} from './_card.js';

// A ranked list as editorial rows: a Space Mono rank, the name in heavy capitals, the value on the
// right, and a picture-tone bar under each name sized by value. Rows land from the left one beat
// apart (top first), each name building in as a hard cut, hairline rules between rows.
export const meta = {duration: 6};
export const defaults = {title: 'Top formats', unit: 'Average watch time, seconds', clear: false,
  items: [{label: 'Tutorials', value: 48}, {label: 'Reviews', value: 41}, {label: 'Vlogs', value: 33}, {label: 'Shorts', value: 22}, {label: 'Live', value: 17}]};

export function mount(el, props = defaults) {
  const c = card(el, props), {root, T, st} = c, items = (props.items ?? []).slice(0, 7), n = Math.max(1, items.length);
  const max = Math.max(1e-9, ...items.map(d => d.value)), y0 = 250, pitch = Math.min(130, 620 / n), x0 = 80, xn = 160, x1 = 920;
  const nameSize = Math.min(pitch * .42, 54, fit(items.map(d => up(d.label)).sort((a, b) => b.length - a.length)[0] ?? 'X', 560, 54, {track: .01}));
  const rows = items.map((d, i) => {
    const y = y0 + pitch * i, gg = root.append('g'), tones = props.tones ?? SERIES;
    const rk = mono(gg, x0, y + pitch * .48, pad(i + 1), {size: 24, color: C.dim});
    const name = heavy(gg, xn, y + pitch * .48, up(d.label), nameSize);
    const val = heavy(gg, x1, y + pitch * .48, '', nameSize, {anchor: 'end', color: i ? C.dim : C.white});
    const bw = (x1 - xn) * d.value / max, bar = panel(st, gg, {x: xn, y: y + pitch * .62, w: bw, h: Math.max(8, pitch * .14), tone: d.tone ?? tones[i % tones.length]});
    const ln = rule(gg, x0, y + pitch - 2, x1, y + pitch - 2, {width: 1, color: C.rule});
    return {d, gg, rk, name, val, bar, bw, ln, at: T + i * STEP};
  });
  return {seek(t) {
    c.seek(t);
    for (const r of rows) {
      const a = snap(span(t, r.at, STEP * 2)), b = snap(span(t, r.at + STEP, STEP * 3));
      r.gg.attr('opacity', a > 0 ? 1 : 0).attr('transform', `translate(${(-60 * (1 - a)).toFixed(1)} 0)`);
      r.bar.set({w: r.bw * b, opacity: b > 0 ? 1 : 0});
      r.val.selectAll('tspan').text(figure(r.d.value, b));
      r.ln.draw(a);
    }
  }};
}

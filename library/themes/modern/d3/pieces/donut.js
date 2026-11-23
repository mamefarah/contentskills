import {card, heavy, figure, SERIES, C, STEP, label, mono, up, span, snap, io, toneOf} from './_card.js';

// Shares as one bold ring: thick segments filled with studio-light picture tones, sweeping round
// clockwise from twelve o'clock with hard gaps at the joins. The biggest share builds huge and heavy
// in the centre; a legend row of tone swatches, labels and percentages sits underneath.
export const meta = {duration: 6};
export const defaults = {title: 'Where views come from', unit: 'Share of views', clear: false,
  items: [{label: 'Search', value: 46}, {label: 'Home', value: 28}, {label: 'Shared', value: 16}, {label: 'Other', value: 10}]};

export function mount(el, props = defaults) {
  const c = card(el, props), {root, T, st} = c, d3 = window.d3, items = (props.items ?? []).slice(0, 6);
  const tot = Math.max(1e-9, d3.sum(items, d => d.value)), cx = 500, cy = 530, r1 = 255, r0 = 175, tones = props.tones ?? SERIES;
  const pie = d3.pie().value(d => d.value).sort(null).padAngle(.018)(items), arc = d3.arc().innerRadius(r0).outerRadius(r1);
  const ring = root.append('g').attr('transform', `translate(${cx} ${cy})`);
  ring.append('circle').attr('r', (r0 + r1) / 2).attr('fill', 'none').attr('stroke', C.graphite).attr('stroke-width', r1 - r0);
  const segs = pie.map((p, i) => ({p, path: ring.append('path').attr('fill', st.url('tone-' + toneOf(items[i].tone ?? tones[i % tones.length])))}));
  const grain = ring.append('path').attr('d', d3.arc().innerRadius(r0).outerRadius(r1)({startAngle: 0, endAngle: Math.PI * 2})).attr('fill', st.url('grain')).attr('opacity', .6).style('mix-blend-mode', 'overlay');
  const best = items.reduce((b, d, i) => d.value > items[b].value ? i : b, 0);
  const pct = heavy(root, cx, cy + 40, '', 120, {anchor: 'middle'}), sub = label(root, cx, cy + 92, up(items[best]?.label ?? ''), {size: 22, anchor: 'middle', track: .3, color: C.dim});
  const n = Math.max(1, items.length), cw = 840 / n;
  const legend = items.map((d, i) => {
    const g = root.append('g'), x = 80 + cw * i;
    g.append('rect').attr('x', x).attr('y', 846).attr('width', 26).attr('height', 26).attr('fill', st.url('tone-' + toneOf(d.tone ?? tones[i % tones.length])));
    label(g, x + 40, 868, up(d.label), {size: Math.min(19, cw / Math.max(6, d.label.length) * 1.1), track: .2});
    mono(g, x + 40, 900, Math.round(100 * d.value / tot) + '%', {size: 18, color: C.dim});
    return g;
  });
  const SWEEP = STEP * 7;
  return {seek(t) {
    c.seek(t);
    const q = io(span(t, T, SWEEP)), end = q * Math.PI * 2;
    segs.forEach(({p, path}) => { const e = Math.min(p.endAngle - p.padAngle / 2, end); path.attr('d', e > p.startAngle + p.padAngle / 2 ? arc({startAngle: p.startAngle + p.padAngle / 2, endAngle: e}) : null); });
    grain.attr('opacity', q > 0 ? .6 : 0);
    const b = snap(span(t, T + SWEEP * .6, STEP * 4));
    pct.attr('opacity', b > 0 ? 1 : 0).selectAll('tspan').text(figure(Math.round(100 * (items[best]?.value ?? 0) / tot), b) + '%');
    sub.attr('opacity', b > 0 ? 1 : 0);
    legend.forEach((g, i) => g.attr('opacity', t >= T + SWEEP + i * STEP * .5 ? 1 : 0));
  }};
}

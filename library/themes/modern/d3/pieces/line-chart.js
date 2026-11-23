import {card, heavy, figure, C, STEP, label, rule, up, span, snap, io, toneOf} from './_card.js';

// A trend as one heavy white line drawn left to right over hairline gridlines, with a studio-tone
// picture filling the area under it as the line passes. Each point lands as a small white square;
// the last value counts up big and heavy at the top left.
export const meta = {duration: 6};
export const defaults = {title: 'Subscribers', unit: 'Thousands, by month', clear: false, tone: 'ember',
  items: [{label: 'Jan', value: 8}, {label: 'Feb', value: 11}, {label: 'Mar', value: 10}, {label: 'Apr', value: 16}, {label: 'May', value: 21}, {label: 'Jun', value: 29}]};

export function mount(el, props = defaults) {
  const c = card(el, props), {root, T, st} = c, d3 = window.d3, items = props.items ?? [], n = Math.max(2, items.length);
  const x0 = 110, x1 = 890, base = 800, top = 380, max = Math.max(1e-9, ...items.map(d => d.value)) * 1.08;
  const pts = items.map((d, i) => [x0 + (x1 - x0) * i / (n - 1), base - (base - top) * d.value / max]);
  const grid = [0, 1, 2, 3].map(k => rule(root, 80, base - (base - top) * k / 3, 920, base - (base - top) * k / 3, {width: k ? 1 : 2, color: k ? C.rule : C.white}));
  // Area: a tone picture clipped to the area under the line, revealed left to right with the draw.
  const cid = st.uid('area'), area = d3.area().x(p => p[0]).y0(base).y1(p => p[1]);
  st.defs.append('clipPath').attr('id', cid).append('path').attr('d', area(pts));
  const fillG = root.append('g').attr('clip-path', `url(#${cid})`);
  const fill = fillG.append('rect').attr('x', x0).attr('y', top - 20).attr('height', base - top + 20).attr('fill', st.url('tone-' + toneOf(props.tone ?? 'ember'))).attr('opacity', .85);
  const fgr = fillG.append('rect').attr('x', x0).attr('y', top - 20).attr('width', x1 - x0).attr('height', base - top + 20).attr('fill', st.url('grain')).attr('opacity', .6).style('mix-blend-mode', 'overlay');
  const path = root.append('path').attr('d', d3.line()(pts)).attr('fill', 'none').attr('stroke', C.white).attr('stroke-width', 7).attr('stroke-linejoin', 'miter').attr('pathLength', 1).attr('stroke-dasharray', '1 1');
  const marks = pts.map(p => root.append('rect').attr('x', p[0] - 10).attr('y', p[1] - 10).attr('width', 20).attr('height', 20).attr('fill', C.white).attr('stroke', C.bg).attr('stroke-width', 4));
  const vals = items.map((d, i) => label(root, pts[i][0], pts[i][1] - 30, figure(d.value), {size: 20, anchor: 'middle', font: '"Space Mono"', weight: 700, track: .04, color: C.dim}));
  const labs = items.map((d, i) => label(root, pts[i][0], base + 44, up(d.label), {size: 18, anchor: 'middle', track: .22, color: C.dim}));
  const last = items.at(-1), big = heavy(root, 80, 330, '', 110);
  const DRAW = 1.6;
  return {seek(t) {
    c.seek(t);
    grid.forEach((g, k) => g.draw(snap(span(t, T - .1 + k * .05, STEP * 3))));
    const q = io(span(t, T + .2, DRAW)), xq = x0 + (x1 - x0) * q;
    path.attr('stroke-dashoffset', 1 - q).attr('opacity', q > 0 ? 1 : 0);
    fill.attr('width', Math.max(0, xq - x0)); fgr.attr('width', Math.max(0, xq - x0));
    pts.forEach((p, i) => { const on = q >= (p[0] - x0) / (x1 - x0) - 1e-6 && q > 0; marks[i].attr('opacity', on ? 1 : 0); vals[i].attr('opacity', on && i < pts.length - 1 ? 1 : 0); labs[i].attr('opacity', t >= T + .1 ? .9 : 0); });
    const b = snap(span(t, T + .2 + DRAW * .85, STEP * 3));
    big.attr('opacity', b > 0 ? 1 : 0).selectAll('tspan').text(last ? figure(last.value, b) : '');
  }};
}

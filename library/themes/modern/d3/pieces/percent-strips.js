import {card, heavy, figure, SERIES, C, STEP, label, up, span, snap, toneOf} from './_card.js';

// Percentages as rows of fifty thin vertical strips: the filled share shows a studio-light picture
// through the strips (one picture per row), the rest stay graphite. Strips fill left to right on the
// beat, row after row, while each row's percentage counts up in heavy type on the right.
export const meta = {duration: 6};
export const defaults = {title: 'Who finishes the video', unit: 'Share of viewers', clear: false,
  items: [{label: 'Under 1 minute', value: 72}, {label: '1 to 5 minutes', value: 48}, {label: 'Over 10 minutes', value: 23}]};

export function mount(el, props = defaults) {
  const c = card(el, props), {root, T, st} = c, items = (props.items ?? []).slice(0, 4), n = Math.max(1, items.length), tones = props.tones ?? SERIES;
  const N = props.strips ?? 50, x0 = 80, x1 = 920, gap = 5, sw = (x1 - x0 - gap * (N - 1)) / N, y0 = 250, pitch = 640 / n, sh = Math.min(170, pitch - 90);
  const rows = items.map((d, i) => {
    const y = y0 + pitch * i, top = y + 70, k = Math.round(N * Math.max(0, Math.min(100, d.value)) / 100);
    const lab = label(root, x0, y + 46, up(d.label), {size: 21, track: .26});
    const val = heavy(root, x1, y + 52, '', 58, {anchor: 'end'});
    const bg = root.append('g'), cid = st.uid('strips'), clip = st.defs.append('clipPath').attr('id', cid);
    const cells = Array.from({length: N}, (_, j) => {
      const x = x0 + j * (sw + gap);
      return {back: bg.append('rect').attr('x', x).attr('y', top).attr('width', sw).attr('height', sh).attr('fill', C.graphite), front: clip.append('rect').attr('x', x).attr('y', top).attr('width', sw).attr('height', sh)};
    });
    const pic = root.append('g').attr('clip-path', `url(#${cid})`);
    pic.append('rect').attr('x', x0).attr('y', top).attr('width', x1 - x0).attr('height', sh).attr('fill', st.url('tone-' + toneOf(d.tone ?? tones[i % tones.length])));
    pic.append('rect').attr('x', x0).attr('y', top).attr('width', x1 - x0).attr('height', sh).attr('fill', st.url('grain')).attr('opacity', .6).style('mix-blend-mode', 'overlay');
    return {d, k, lab, val, cells, at: T + .1 + i * STEP * 3};
  });
  return {seek(t) {
    c.seek(t);
    for (const r of rows) {
      const q = snap(span(t, r.at, STEP * 5)), filled = Math.round(r.k * q);
      r.lab.attr('opacity', t >= r.at - STEP ? 1 : 0);
      r.cells.forEach((cl, j) => { const show = t >= r.at - STEP + j * .004; cl.back.attr('opacity', show ? 1 : 0); cl.front.attr('height', j < filled ? sh : 0); });
      r.val.attr('opacity', t >= r.at ? 1 : 0).selectAll('tspan').text(figure(r.d.value, q) + '%');
    }
  }};
}

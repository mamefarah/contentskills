import {IG, SAFE, BRAND, clamp, easeOut, easeInOut, fadeOut, stage, node, group, rr, circle, poly, line, text, measure, uid, parseNumber} from '../../ui.js';

// A reel-insights card slides in beside you: a gradient header with a sparkline that draws itself, icon rows whose
// numbers count up, a green +38% pill and a highlighter sweeping under the top number; then the card pushes in on
// that row. To zoom the camera too, add a storyboard zoom over the same span
// ({"start": S + 0.45, "end": E - 0.4, "scale": 1.2}) so the footage pushes in with the card. The numbers are props:
// pass real ones (the defaults are sample figures).
export const meta = {duration: 3};
// The numbers are illustrative placeholders, not anyone's real stats: pass real ones in props.
export const defaults = {rows: [{label: 'Views', value: '212,480'}, {label: 'Saves', value: '9,312'}, {label: 'Shares', value: '4,077'}],
  title: 'Reel insights', sub: 'Last 30 days', growth: '38%', push: 1.22, accent: BRAND.accent, accent2: '#7C3AED', highlight: BRAND.highlight,
  x: SAFE.left, y: SAFE.top + 19, width: 605};

const SPARK = [.08, .14, .11, .22, .2, .38, .55, .92];
const ICON_COLORS = [null, '#F59E0B', '#10B981', '#EC4899'];

function icon(p, kind, cx, cy, s, col) {
  circle(p, cx, cy, s, col); const q = s * .5, wl = '#fff';
  if (kind === 0) { node(p, 'ellipse', {cx, cy, rx: q * 1.25, ry: q * .7, fill: 'none', stroke: wl, 'stroke-width': Math.max(2, s * .14)}); circle(p, cx, cy, q * .35, wl); }
  else if (kind === 1) poly(p, [[cx - q * .7, cy - q], [cx + q * .7, cy - q], [cx + q * .7, cy + q], [cx, cy + q * .45], [cx - q * .7, cy + q]], wl);
  else poly(p, [[cx - q, cy - q * .1], [cx + q, cy - q * .8], [cx + q * .25, cy + q * .9], [cx - q * .05, cy + q * .2]], wl);
}

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), root = group(svg), card = group(root), live = group(card);
  const rows = p.rows.map(r => typeof r === 'string' ? {label: r.split('::')[0], value: r.split('::')[1]} : r);
  const w = p.width, rh = 86, hh = 173, h = hh + rh * rows.length + 27, pad = 43;
  // Static parts: card, gradient header, title, row icons, labels and rules.
  const gid = uid('head'), grad = node(svg.defs, 'linearGradient', {id: gid, x1: 0, y1: 0, x2: 1, y2: 0});
  node(grad, 'stop', {offset: 0, 'stop-color': p.accent}); node(grad, 'stop', {offset: 1, 'stop-color': p.accent2});
  const cid = uid('card'), cp = node(svg.defs, 'clipPath', {id: cid}); rr(cp, 0, 0, w, h, 38, '#000');
  const base = group(card); live.remove(); card.appendChild(live);
  rr(base, 0, 0, w, h, 38, IG.white, {filter: svg.shadow});
  rr(group(base, {'clip-path': `url(#${cid})`}), 0, 0, w, hh, 0, `url(#${gid})`);
  text(base, pad, hh * .36, p.title, 39, 800, IG.white); text(base, pad, hh * .62, p.sub, 25, 500, IG.white, 'start', {'fill-opacity': .8});
  const fmts = rows.map(r => parseNumber(r.value)), rowY = i => hh + i * rh + rh / 2 + 9;
  const labelW = measure(svg, rows[0]?.label ?? '', 33, 600), bigW = measure(svg, rows[0]?.value ?? '', 52, 800);
  const hiLayer = group(base);                                   // highlighter sits under the numbers
  rows.forEach((r, i) => {
    const y = rowY(i), s = rh * .27;
    icon(base, i % 3, pad + s, y, s, ICON_COLORS[i % 4] ?? p.accent);
    const lx = pad + s * 2 + 24; text(base, lx, y, r.label, 33, 600, BRAND.ink);
    if (i < rows.length - 1) line(base, [[lx, y + rh / 2], [w - pad, y + rh / 2]], '#E8EAF0', 2, {'stroke-linecap': 'butt'});
  });
  const s0 = rh * .27, lx0 = pad + s0 * 2 + 24, gx = lx0 + labelW + 19, pillH = rh * .42, pillW = 108;
  const pill = group(base);
  rr(pill, gx, rowY(0) - pillH / 2, pillW, pillH, pillH / 2, '#DCFCE7');
  const tx = gx + pillH * .5, ts = pillH * .22, y0 = rowY(0);
  poly(pill, [[tx, y0 - ts], [tx + ts, y0 + ts * .8], [tx - ts, y0 + ts * .8]], '#16A34A');
  text(pill, gx + pillW * .6, y0, p.growth, 24, 700, '#16A34A', 'middle');
  const x0s = w * .5, x1s = w - pad, yb = hh * .82, yt = hh * .2;
  const pts = SPARK.map((v, i) => [x0s + (x1s - x0s) * i / (SPARK.length - 1), yb - (yb - yt) * v]);
  const life = p.life ?? meta.duration;
  return {
    seek(t) {
      live.replaceChildren();
      const spark = easeOut(clamp((t - .2) / .9)), cnt = easeOut(clamp((t - .3) / .7)), hq = easeInOut(clamp((t - .95) / .35));
      // sparkline drawing itself, area under it
      const m = spark * (pts.length - 1), k = Math.floor(m), f = m - k;
      const vis = pts.slice(0, k + 1); if (k < pts.length - 1) vis.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]);
      if (vis.length > 1) {
        poly(live, [...vis, [vis.at(-1)[0], yb], [vis[0][0], yb]], '#fff', {'fill-opacity': .24});
        line(live, vis, '#fff', 6);
        const [ex, ey] = vis.at(-1); circle(live, ex, ey, 12, p.highlight, {stroke: '#fff', 'stroke-width': 3});
      }
      hiLayer.replaceChildren();
      if (hq > 0) rr(hiLayer, w - pad - bigW - 8, y0, (bigW + 16) * hq, rh * .3, 6, p.highlight);
      pill.setAttribute('opacity', clamp((t - .7) / .2));
      rows.forEach((r, i) => text(live, w - pad, rowY(i), fmts[i].format(cnt), i === 0 ? 52 : 37, i === 0 ? 800 : 700, BRAND.ink, 'end'));
      // slide in from the left, then push in on the top row
      const kin = easeOut(t / .35), zin = easeInOut((t - .45) / .5), zout = easeInOut((t - (life - .45)) / .4);
      const z = 1 + (p.push - 1) * zin * (1 - zout), ax = w * .62, ay = y0;
      root.setAttribute('opacity', fadeOut(t, p.life));
      root.setAttribute('transform', `translate(${p.x - (1 - kin) * 756 + ax} ${p.y + ay}) scale(${z}) translate(${-ax} ${-ay})`);
    },
  };
}

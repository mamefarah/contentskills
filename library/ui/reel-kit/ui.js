// Drawing kit for ui/reel-kit: the light "reel kit" cards in frame pixels (1080x1920).
// Plain SVG, no dependencies. One brand look: an accent colour (backgrounds, pills, badges), a highlight colour
// (highlighter, key words), ink and paper. Every piece takes these as props with these defaults, so a storyboard can
// re-brand a piece with {"accent": "#0A7", "highlight": "#FFD400"}.
const NS = 'http://www.w3.org/2000/svg';
export const BRAND = {accent: '#2F5BEA', highlight: '#FFE03C', ink: '#16181D', paper: '#F3F2EF', background: 'grid'};
export const C = {card: '#FFFFFF', muted: '#707682', line: '#E4E6EC', dark: '#15171C', white: '#FFFFFF'};
export const F = '"Inter Tight", Inter, system-ui, sans-serif';
export const SERIF = '"Instrument Serif Italic", "Instrument Serif", Georgia, serif';
/** The part of a vertical frame the Reels / TikTok / Shorts UI never covers. */
export const SAFE = {left: 70, top: 250, right: 1010, rightLower: 850, bottom: 1440};

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeBack = x => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
/** 1 while the piece is up, falling to 0 over the last d seconds of its life (props.life from the storyboard). */
export const fadeOut = (t, life, d = .15) => life ? clamp((life - t) / d) : 1;
/** Colour helpers: "#rrggbb" mixed toward another colour. */
const hex = c => { const s = String(c).replace('#', ''); const v = s.length === 3 ? s.split('').map(x => x + x).join('') : s; return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)); };
export const mix = (a, b, k) => { const p = hex(a), q = hex(b); return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
/** The brand colours a piece draws with: props override the defaults. */
export const brand = p => ({accent: p.accent || BRAND.accent, highlight: p.highlight || BRAND.highlight, ink: p.ink || BRAND.ink, paper: p.paper || BRAND.paper, background: p.background || BRAND.background, grid: p.grid});

let ids = 0;
export const uid = s => `rk-${s}-${++ids}`;
export function stage(el) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1080 1920'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block';
  el.appendChild(svg); el.style.background = 'transparent';
  const defs = node(svg, 'defs'), shadow = uid('shadow'), soft = uid('soft');
  const f = node(defs, 'filter', {id: shadow, x: '-20%', y: '-20%', width: '140%', height: '150%'});
  node(f, 'feDropShadow', {dx: 0, dy: 10, stdDeviation: 18, 'flood-color': '#000', 'flood-opacity': .3});
  const g = node(defs, 'filter', {id: soft, x: '-20%', y: '-20%', width: '140%', height: '150%'});
  node(g, 'feDropShadow', {dx: 0, dy: 5, stdDeviation: 9, 'flood-color': '#000', 'flood-opacity': .28});
  svg.defs = defs; svg.shadow = `url(#${shadow})`; svg.softShadow = `url(#${soft})`;
  return svg;
}
export function node(parent, tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  parent.appendChild(n); return n;
}
export const group = (parent, attrs) => node(parent, 'g', attrs);
export const rr = (p, x, y, w, h, r, fill, extra = {}) => node(p, 'rect', {x, y, width: Math.max(0, w), height: Math.max(0, h), rx: Math.min(r, Math.max(0, w) / 2, Math.max(0, h) / 2), fill, ...extra});
export const circle = (p, cx, cy, r, fill, extra = {}) => node(p, 'circle', {cx, cy, r, fill, ...extra});
export const poly = (p, pts, fill, extra = {}) => node(p, 'polygon', {points: pts.map(q => q.join(',')).join(' '), fill, ...extra});
export const line = (p, pts, stroke, width, extra = {}) => node(p, 'polyline', {points: pts.map(q => q.join(',')).join(' '), fill: 'none', stroke, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra});
export function text(p, x, y, s, size, weight = 600, fill = BRAND.ink, anchor = 'start', extra = {}) {
  return node(p, 'text', {x, y, 'font-family': F, 'font-size': size, 'font-weight': weight, fill, 'text-anchor': anchor, 'dominant-baseline': 'central', style: 'white-space:pre', ...extra}, s);
}
/** Width of a string in a font, measured with a throwaway text node (fonts are loaded before mount). */
export function measure(svg, s, size, weight = 600, family = F) {
  const n = node(svg, 'text', {x: -9999, y: -9999, 'font-family': family, 'font-size': size, 'font-weight': weight, style: 'white-space:pre'}, s);
  const w = n.getComputedTextLength ? n.getComputedTextLength() : s.length * size * .55; n.remove(); return w;
}
/** Cut a string down with an ellipsis until it fits maxWidth. */
export function fit(svg, s, maxWidth, size, weight = 600, family = F, tail = '…') {
  if (measure(svg, s, size, weight, family) <= maxWidth) return s;
  let out = s;
  while (out.length > 3 && measure(svg, out + tail, size, weight, family) > maxWidth) out = out.slice(0, -1);
  return out.trimEnd() + tail;
}
/** A rounded clip for a rectangle; returns the url() to use as clip-path. */
export function clipRect(svg, x, y, w, h, r) {
  const id = uid('clip'), cp = node(svg.defs, 'clipPath', {id}); rr(cp, x, y, w, h, r, '#000'); return `url(#${id})`;
}
/** A picture cover-cropped into a rounded rectangle (grey placeholder when there is none). */
export function image(svg, p, href, x, y, w, h, r, fallback = '#E1E4EA') {
  if (!href) return rr(p, x, y, w, h, r, fallback);
  return node(p, 'image', {href, x, y, width: w, height: h, preserveAspectRatio: 'xMidYMid slice', 'clip-path': clipRect(svg, x, y, w, h, r)});
}
/**
 * Pictures from the server root ("/projects/<name>/thumbs/01.jpg"), decoded before mount resolves so seek(t) stays pure.
 * Returns data URLs cover-cropped to w x h (null for a missing or broken picture).
 */
export const loadImages = (urls = [], w = 360, h = 640) => Promise.all(urls.map(url => !url ? null : new Promise(done => {
  const img = new Image(); img.onerror = () => done(null);
  img.onload = () => {
    const canvas = Object.assign(document.createElement('canvas'), {width: w, height: h});
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    canvas.getContext('2d').drawImage(img, (w - dw) / 2, (h - dh) * .35, dw, dh); done(canvas.toDataURL('image/jpeg', .9));
  };
  img.src = url;
})));

/**
 * The theme's full-frame background: the accent with a soft top-light and a graph-paper grid drifting diagonally,
 * or the plain lit accent when background is "solid". `grid` sets the lines' opacity (0.22).
 * Returns {seek(t)} to move the grid.
 */
export function backdrop(svg, parent, b, {x = 0, y = 0, width = 1080, height = 1920} = {}) {
  const g = group(parent);
  rr(g, x, y, width, height, 0, b.accent);
  const lit = uid('lit'), grad = node(svg.defs, 'radialGradient', {id: lit, cx: .5, cy: .3, r: .85, gradientUnits: 'objectBoundingBox'});
  node(grad, 'stop', {offset: 0, 'stop-color': '#fff', 'stop-opacity': .16});
  node(grad, 'stop', {offset: .55, 'stop-color': '#fff', 'stop-opacity': 0});
  node(grad, 'stop', {offset: 1, 'stop-color': '#000', 'stop-opacity': .2});
  rr(g, x, y, width, height, 0, `url(#${lit})`);
  if (b.background === 'solid') return {seek() {}};
  const step = 92, pid = uid('grid'), pat = node(svg.defs, 'pattern', {id: pid, width: step, height: step, patternUnits: 'userSpaceOnUse'});
  node(pat, 'path', {d: `M${step} 0V${step}M0 ${step}H${step}`, stroke: '#fff', 'stroke-opacity': b.grid ?? .22, 'stroke-width': 2.4, fill: 'none'});
  rr(g, x, y, width, height, 0, `url(#${pid})`);
  return {seek(t) { const off = t * 60; pat.setAttribute('patternTransform', `translate(${-(off % step)} ${-((off * .6) % step)})`); }};
}

/** A caption bar like the reel's own: dark rounded box, white heavy words, *starred* words on the highlight. */
export function captionBar(svg, p, words, cx, y, size, b) {
  const parts = words.map(w => ({s: w.replace(/\*/g, ''), key: /^\*.*\*[.,!?]?$/.test(w)}));
  const gap = size * .28, pad = size * .32, hgt = size * 1.45;
  const widths = parts.map(q => measure(svg, q.s, size, 800)), tot = widths.reduce((a, v) => a + v, 0) + gap * (parts.length - 1);
  const g = group(p, {filter: svg.softShadow}), x0 = cx - tot / 2 - pad;
  rr(g, x0, y, tot + pad * 2, hgt, hgt * .28, b.ink, {'fill-opacity': .91});
  let x = x0 + pad; const cy = y + hgt / 2;
  parts.forEach((q, i) => {
    if (q.key) rr(g, x - size * .14, cy - size * .6, widths[i] + size * .28, size * 1.2, size * .18, b.highlight);
    text(g, x, cy, q.s, size, 800, q.key ? b.ink : C.white); x += widths[i] + gap;
  });
  return g;
}

/** A tilted title sticker: accent rounded label with white heavy caps. */
export function sticker(svg, p, s, cx, y, size, b, angle = -4) {
  const w = measure(svg, s, size, 800) + size * .7, h = size * 1.3;
  const g = group(p, {transform: `rotate(${angle} ${cx} ${y + h / 2})`, filter: svg.softShadow});
  rr(g, cx - w / 2, y, w, h, size * .24, b.accent); text(g, cx, y + h / 2 + size * .02, s, size, 800, C.white, 'middle');
  return g;
}

/** Spinner arc (a 260° stroke turning with t). */
export function spinner(p, cx, cy, r, t, col, width) {
  const a0 = (t * 400) % 360, a1 = a0 + 260, rad = d => d * Math.PI / 180;
  const [x0, y0, x1, y1] = [cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0)), cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1))];
  return node(p, 'path', {d: `M${x0} ${y0}A${r} ${r} 0 1 1 ${x1} ${y1}`, fill: 'none', stroke: col, 'stroke-width': width, 'stroke-linecap': 'round'});
}

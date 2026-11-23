// GTA6 theme drawing kit. Every piece in this theme draws with these colors, fonts and helpers,
// which is what keeps overlays, diagrams and captions looking like one comic-panel sunset world:
// angled panels with thick pale gutters, ink outlines and hard offset shadows, flat cel fills with a
// warm rim, halftone dots, chunky gradient lettering, and a small set of original vector motifs
// (sun, palm, skyline, car, flamingo, helicopter, boat). All artwork here is original, drawn from paths.
import {clamp, span, easeOut, easeBack, mix} from '/library/_shared/kit.js';
export {clamp, span, mix, easeOut, easeInOut, easeBack} from '/library/_shared/kit.js';

export const C = {
  ink: '#190b33', paper: '#fff4e0', night: '#24104f', plum: '#3b1a78', violet: '#7a3cf0',
  pink: '#ff3f97', orange: '#ff8a30', yellow: '#ffd447', teal: '#12c4c0', aqua: '#6ff2e3',
  sky: '#4aa3ff', coral: '#ff6a5c', white: '#ffffff',
};
export const series = [C.pink, C.yellow, C.teal, C.orange, C.violet, C.sky];
/** Gradient pairs for chart series: each is a named gradient below. */
export const seriesGrads = ['hot', 'sea', 'candy', 'gold', 'cool', 'ember'];
export const F = {display: '"Bowlby One"', caps: 'Anton', script: '"Kaushan Script"', comic: 'Bangers', body: 'Poppins'};
export const FRAME = {width: 1080, height: 1920};   // overlays are drawn in full-frame pixels

/** Vertical gradients, top to bottom. Use by name wherever a helper takes a fill: 'hot', 'sunset', … */
export const GRADS = {
  sunset: [[0, '#4a22b8'], [.3, '#a23be0'], [.56, C.pink], [.82, C.orange], [1, C.yellow]],
  dusk: [[0, '#2a1160'], [1, '#56208f']],
  hot: [[0, '#fff09a'], [.38, C.yellow], [.7, C.orange], [1, C.pink]],
  candy: [[0, '#ffc2e2'], [.5, C.pink], [1, C.violet]],
  cool: [[0, '#d5fff8'], [.45, C.aqua], [1, C.sky]],
  sea: [[0, C.aqua], [.55, C.teal], [1, '#0a6f9e']],
  gold: [[0, '#fffbd0'], [.5, C.yellow], [1, C.orange]],
  ember: [[0, C.orange], [1, C.coral]],
  chrome: [[0, '#ffffff'], [.48, '#ffd9ef'], [.52, C.pink], [1, C.violet]],
  paper: [[0, '#ffffff'], [1, C.paper]],
};

let stages = 0, uids = 0;
/** Give an SVG the theme's named gradients, so P() and every helper that takes a fill can use them. */
export function defineGradients(svg, defs, id) {
  for (const [name, stops] of Object.entries(GRADS)) {
    const g = defs.append('linearGradient').attr('id', `${id}-${name}`).attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
    for (const [at, color] of stops) g.append('stop').attr('offset', at).attr('stop-color', color);
  }
  svg.node().__coast = id;
}
const uid = () => `nc${++uids}`;
/**
 * An SVG stage with the theme's gradients defined.
 *   overlay: true  -> transparent, 1080x1920, meant to sit on top of footage
 *   otherwise      -> 1000x1000 card (clear: true keeps the element transparent)
 */
export function coastStage(el, {overlay = false, clear = false} = {}) {
  const d3 = window.d3, [w, h] = overlay ? [FRAME.width, FRAME.height] : [1000, 1000], id = `coast${++stages}`;
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', 'xMidYMid meet').style('overflow', 'visible');
  const defs = svg.append('defs'); defineGradients(svg, defs, id);
  el.style.background = overlay || clear ? 'transparent' : C.night;
  const root = svg.append('g');
  return {svg, root, defs, id, w, h};
}
/** Resolve a fill for the SVG `g` lives in: a gradient name, a palette name, or any CSS color. */
export const P = (g, fill) => GRADS[fill] ? `url(#${g.node().ownerSVGElement.__coast}-${fill})` : C[fill] ?? fill;

// ---------------------------------------------------------------- shapes
export const poly = pts => 'M' + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';
/**
 * Corner points of an angled panel. `a` lifts the top edge on the right (px), `b` the bottom edge,
 * `lean` pushes the top to the right. quad(x, y, w, h) with no slant is a plain rectangle.
 */
export const quad = (x, y, w, h, a = 0, b = a, lean = 0) => [[x + lean / 2, y + a / 2], [x + w + lean / 2, y - a / 2], [x + w - lean / 2, y + h - b / 2], [x - lean / 2, y + h + b / 2]];
/** Point at (u, v) 0..1 inside a quad from quad(): for placing things on a slanted panel. */
export const inQuad = (q, u, v) => { const t = [mix(q[0][0], q[1][0], u), mix(q[0][1], q[1][1], u)], b = [mix(q[3][0], q[2][0], u), mix(q[3][1], q[2][1], u)]; return [mix(t[0], b[0], v), mix(t[1], b[1], v)]; };

/**
 * A comic panel: hard offset shadow, ink outline, thick pale gutter, ink keyline, then the fill.
 * Returns {g, body, clip}: draw the panel's contents into a group with .attr('clip-path', clip).
 */
export function panel(g, pts, {fill = 'dusk', gutter = 14, ink = 6, shadow = 16, paper = C.paper} = {}) {
  const d = typeof pts === 'string' ? pts : poly(pts), out = g.append('g'), id = uid();
  const lay = (stroke, width, f) => out.append('path').attr('d', d).attr('fill', f).attr('stroke', stroke).attr('stroke-width', width).attr('stroke-linejoin', 'miter').attr('stroke-miterlimit', 6);
  if (shadow) lay(C.ink, (gutter + ink) * 2, C.ink).attr('transform', `translate(${shadow} ${shadow})`);
  if (gutter) { lay(C.ink, (gutter + ink) * 2, C.ink); lay(paper, gutter * 2, paper); }
  const body = lay(C.ink, ink, P(g, fill));
  out.append('clipPath').attr('id', id).append('path').attr('d', d);
  return {g: out, body, clip: `url(#${id})`, d};
}
/** An inked shape with a hard shadow and no gutter: stickers, tabs, bars. */
export function inked(g, d, {fill = 'pink', ink = 6, shadow = 10, join = 'round'} = {}) {
  const out = g.append('g');
  if (shadow) out.append('path').attr('d', d).attr('fill', C.ink).attr('stroke', C.ink).attr('stroke-width', ink).attr('stroke-linejoin', join).attr('transform', `translate(${shadow} ${shadow})`);
  const body = out.append('path').attr('d', d).attr('fill', P(g, fill)).attr('stroke', C.ink).attr('stroke-width', ink).attr('stroke-linejoin', join);
  return {g: out, body};
}
/** Starburst outline for stickers and impact flashes. */
export function burst(cx, cy, r1, r2, n = 14, rot = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return poly(pts);
}
export const star = (cx, cy, r, rot = -Math.PI / 2) => burst(cx, cy, r, r * .44, 5, rot);
/** Rounded rectangle path. */
export const rrect = (x, y, w, h, r = 20) => `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
/** Speech bubble: rounded box with a tail from the bottom edge toward (tx, ty). */
export function bubble(x, y, w, h, tx, ty, r = 46) {
  const bx = clamp(tx, x + r + 50, x + w - r - 50), up = ty < y;
  if (up) return `M${x + r} ${y}H${bx - 34}L${tx} ${ty}L${bx + 34} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${bx + 34}L${tx} ${ty}L${bx - 34} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}
/** Map pin path with its point at (x, y). */
export const pinPath = (x, y, s = 1) => `M${x} ${y}C${x - 14 * s} ${y - 34 * s} ${x - 44 * s} ${y - 52 * s} ${x - 44 * s} ${y - 86 * s}A${44 * s} ${44 * s} 0 1 1 ${x + 44 * s} ${y - 86 * s}C${x + 44 * s} ${y - 52 * s} ${x + 14 * s} ${y - 34 * s} ${x} ${y}Z`;

// ---------------------------------------------------------------- texture
/** A field of halftone dots that shrink across the box. `from`: the side ('top', 'bottom', 'left', 'right') or corner ('tl', 'tr', 'bl', 'br') where dots are largest. */
export function halftone(g, x, y, w, h, {color = C.ink, cell = 26, from = 'bottom', max = .62, opacity = .3} = {}) {
  const out = g.append('g').attr('fill', P(g, color)).attr('opacity', opacity), cols = Math.ceil(w / cell), rows = Math.ceil(h / (cell * .866));
  let d = '';
  for (let j = 0; j < rows; j += 1) for (let i = 0; i < cols; i += 1) {
    const px = x + (i + (j % 2 ? .5 : 0)) * cell, py = y + j * cell * .866, u = (px - x) / w, v = (py - y) / h;
    const far = (cu, cv) => clamp(1.25 - Math.hypot(u - cu, v - cv) * 1.25);
    const k = from === 'bottom' ? v : from === 'top' ? 1 - v : from === 'left' ? 1 - u : from === 'right' ? u : from === 'tl' ? far(0, 0) : from === 'tr' ? far(1, 0) : from === 'bl' ? far(0, 1) : from === 'br' ? far(1, 1) : from === 'centre' ? far(.5, .5) : 1;
    const r = cell * max * .5 * clamp(k) ** 1.3;
    if (r > .8 && px < x + w) d += `M${(px - r).toFixed(1)} ${py.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`;
  }
  out.append('path').attr('d', d);
  return out;
}
/** Wedge rays fanning from a point: the comic "burst" behind a headline. */
export function rays(g, cx, cy, r, n = 16, color = C.paper, opacity = .16) {
  let d = '';
  for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n, b = a + Math.PI / n * .9; d += `M${cx} ${cy}L${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}L${cx + Math.cos(b) * r} ${cy + Math.sin(b) * r}Z`; }
  return g.append('path').attr('d', d).attr('fill', P(g, color)).attr('opacity', opacity);
}
/** Horizontal speed streaks, seeded. */
export function streaks(g, x, y, w, h, n = 9, color = C.paper, seed = 1) {
  const out = g.append('g').attr('stroke', P(g, color)).attr('stroke-linecap', 'round');
  for (let i = 0; i < n; i++) { const len = w * (.15 + .4 * hash(i, seed)), sx = x + hash(i, seed + 5) * (w - len); out.append('path').attr('d', `M${sx} ${y + (i + .5) * h / n}h${len}`).attr('stroke-width', 3 + 5 * hash(i, seed + 9)); }
  return out;
}

// ---------------------------------------------------------------- lettering
const ruler = document.createElement('canvas').getContext('2d');
/** Width in pixels of text set at this size and font. */
export function measure(value, size, font = F.display, spacing = 0, weight = 400) { ruler.font = `${weight} ${size}px ${font}`; return ruler.measureText(value).width + spacing * size * String(value).length; }
/**
 * Chunky display lettering: hard drop shadow, heavy ink outline, optional pale rim, gradient fill.
 * Returns {g, text(value), node}. `fit` shrinks the size so the text stays within that width.
 */
export function lettering(g, x, y, value, {size = 120, font = F.display, fill = 'hot', outline = null, shadow = null, rim = 0, anchor = 'middle', spacing = .01, tilt = 0, fit = 0, weight = 400} = {}) {
  if (fit) size = Math.min(size, size * fit / Math.max(1, measure(value, size, font, spacing, weight)));
  const o = outline ?? Math.max(5, size * .07), s = shadow ?? Math.max(4, size * .065);
  const out = g.append('g').attr('transform', `translate(${x} ${y}) rotate(${tilt})`), layers = [];
  const lay = () => { const t = out.append('text').attr('text-anchor', anchor).style('font', `${weight} ${size}px ${font}`).style('letter-spacing', spacing + 'em').attr('stroke-linejoin', 'round').text(value); layers.push(t); return t; };
  if (s) lay().attr('fill', C.ink).attr('stroke', C.ink).attr('stroke-width', (o + rim) * 2).attr('transform', `translate(${s} ${s})`);
  lay().attr('fill', C.ink).attr('stroke', C.ink).attr('stroke-width', (o + rim) * 2);
  if (rim) lay().attr('fill', C.paper).attr('stroke', C.paper).attr('stroke-width', rim * 2);
  const face = lay().attr('fill', P(g, fill));
  return {g: out, size, face, text(v) { for (const t of layers) t.text(v); return this; }};
}
/** Plain text. */
export function label(g, x, y, value, {size = 30, color = C.paper, font = F.caps, weight = 400, anchor = 'start', spacing = .04} = {}) {
  return g.append('text').attr('x', x).attr('y', y).attr('fill', P(g, color)).attr('text-anchor', anchor).style('font', `${weight} ${size}px ${font}`).style('letter-spacing', spacing + 'em').text(value);
}
/** Text with an ink outline, for small labels that sit straight on footage. */
export function outlined(g, x, y, value, {size = 40, color = C.paper, font = F.caps, anchor = 'start', spacing = .04, ink = null, weight = 400} = {}) {
  return label(g, x, y, value, {size, color, font, anchor, spacing, weight}).attr('stroke', C.ink).attr('stroke-width', ink ?? size * .22).attr('stroke-linejoin', 'round').attr('paint-order', 'stroke');
}
/**
 * A slanted label tab sized to its text, origin at its left-middle. Returns {g, w, h}.
 */
export function tab(g, x, y, value, {size = 40, fill = 'pink', color = C.paper, font = F.caps, pad = .55, lean = 14, shadow = 8, ink = 5, spacing = .06} = {}) {
  const w = measure(value, size, font, spacing) + size * pad * 2, h = size * 1.5, out = g.append('g').attr('transform', `translate(${x} ${y})`);
  inked(out, poly(quad(0, -h / 2, w, h, 0, 0, lean)), {fill, ink, shadow, join: 'miter'});
  label(out, w / 2, size * .36, value, {size, color, font, anchor: 'middle', spacing});
  return {g: out, w, h};
}

// ---------------------------------------------------------------- motifs
/** Sun disc with slit stripes across its lower half. */
export function sun(g, cx, cy, r, {fill = 'gold', ink = 0, stripes = 5} = {}) {
  const out = g.append('g'), id = uid(), clip = out.append('clipPath').attr('id', id);
  let d = `M${cx - r} ${cy - r}h${2 * r}v${r * 1.08}h${-2 * r}Z`, yy = cy + r * .08;
  for (let i = 0; i < stripes; i++) { const gap = r * (.035 + i * .022), band = r * (.2 - i * .028); yy += gap; d += `M${cx - r} ${yy}h${2 * r}v${band}h${-2 * r}Z`; yy += band; }
  clip.append('path').attr('d', d);
  if (ink) out.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r + ink / 2).attr('fill', C.ink).attr('clip-path', `url(#${id})`);
  out.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r - ink / 2).attr('fill', P(g, fill)).attr('clip-path', `url(#${id})`);
  return out;
}
/** A palm tree with its base at (x, y); `s` scales it (1 = about 320 tall). `lean` tips the crown sideways. */
export function palm(g, x, y, s = 1, {lean = 30, color = C.ink, rim = null, flip = false} = {}) {
  const out = g.append('g').attr('transform', `translate(${x} ${y}) scale(${flip ? -s : s} ${s})`), cx = lean, cy = -300, fill = P(g, color);
  out.append('path').attr('d', `M-15 0Q${lean * .2 - 12} -160 ${cx - 7} ${cy}L${cx + 7} ${cy}Q${lean * .2 + 14} -160 17 0Z`).attr('fill', fill);
  if (rim) out.append('path').attr('d', `M13 -6Q${lean * .2 + 11} -160 ${cx + 5} ${cy}`).attr('fill', 'none').attr('stroke', P(g, rim)).attr('stroke-width', 4).attr('stroke-linecap', 'round');
  const crown = out.append('g').attr('transform', `translate(${cx} ${cy})`);
  [[205, 150], [172, 170], [140, 150], [100, 120], [62, 150], [28, 172], [-5, 150]].forEach(([deg, len]) => {
    const a = deg * Math.PI / 180, dx = Math.cos(a), dy = -Math.sin(a), tx = dx * len, ty = dy * len + len * .34, mx = dx * len * .55, my = dy * len * .55 - len * .3;
    crown.append('path').attr('d', `M0 0Q${mx} ${my} ${tx} ${ty}Q${mx * .92} ${my + len * .3} 0 6Z`).attr('fill', fill);
    if (rim) crown.append('path').attr('d', `M0 0Q${mx} ${my} ${tx} ${ty}`).attr('fill', 'none').attr('stroke', P(g, rim)).attr('stroke-width', 3.5).attr('stroke-linecap', 'round').attr('opacity', dx > -.2 ? 1 : .35);
  });
  crown.append('circle').attr('r', 13).attr('fill', fill);
  return {g: out, crown};
}
const PASTEL = ['#ff9ec7', '#8ef0e4', '#ffe1a8', '#b9a2ff', '#ffb38a', '#9fd0ff'];
/**
 * A row of art-deco buildings standing on `base`, from x across `w`. With `flat` (a color) it is a
 * silhouette; otherwise pastel fronts with ink outlines, a shaded side, a rim of light and windows.
 */
export function skyline(g, x, base, w, {seed = 1, h = 260, flat = null, ink = 5, lit = .5} = {}) {
  const out = g.append('g'); let px = x, i = 0;
  while (px < x + w - 20) {
    const bw = Math.min(x + w - px, 70 + hash(i, seed) * 90), bh = h * (.38 + .62 * hash(i, seed + 3)), kind = Math.floor(hash(i, seed + 7) * 3), b = out.append('g'), top = base - bh;
    let d = `M${px} ${base}V${top}`;
    if (kind === 0) d += `h${bw * .18}v${-bh * .1}h${bw * .2}v${-bh * .1}h${bw * .24}v${bh * .1}h${bw * .2}v${bh * .1}H${px + bw}V${base}Z M${px + bw * .49} ${top - bh * .2}v${-bh * .22}h${bw * .02}v${bh * .22}Z`;
    else if (kind === 1) d += `Q${px} ${top - bw * .5} ${px + bw * .5} ${top - bw * .5}H${px + bw}V${base}Z`;
    else d += `H${px + bw * .7}v${-bh * .28}h${bw * .12}v${bh * .28}H${px + bw}V${base}Z`;
    if (flat) b.append('path').attr('d', d).attr('fill', P(g, flat));
    else {
      const id = uid(); b.append('clipPath').attr('id', id).append('path').attr('d', d);
      b.append('path').attr('d', d).attr('fill', PASTEL[Math.floor(hash(i, seed + 11) * PASTEL.length)]);
      const inner = b.append('g').attr('clip-path', `url(#${id})`);
      inner.append('rect').attr('x', px).attr('y', top - bh).attr('width', bw * .3).attr('height', bh * 2).attr('fill', C.plum).attr('opacity', .3);
      inner.append('rect').attr('x', px + bw - 7).attr('y', top - bh).attr('width', 7).attr('height', bh * 2).attr('fill', C.yellow).attr('opacity', .9);
      const cols = Math.max(2, Math.floor(bw / 26)), rows = Math.max(2, Math.floor(bh / 34)); let win = '', dark = '';
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const rect = `M${px + 12 + c * (bw - 24) / cols} ${top + 16 + r * (bh - 20) / rows}h${(bw - 24) / cols - 8}v${(bh - 20) / rows * .5}h${-((bw - 24) / cols - 8)}Z`; if (hash(i * 31 + r * 7 + c, seed) < lit) win += rect; else dark += rect; }
      inner.append('path').attr('d', dark).attr('fill', C.plum).attr('opacity', .55); inner.append('path').attr('d', win).attr('fill', '#fff7b8');
      b.append('path').attr('d', d).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', ink).attr('stroke-linejoin', 'round');
    }
    px += bw + (flat ? -4 : 6); i++;
  }
  return out;
}
/** A scalloped wave line across `w`, for water. `phase` slides it sideways. */
export function wavePath(x, y, w, len = 80, amp = 12, phase = 0) {
  const off = ((phase % 1) + 1) % 1 * len; let d = `M${x - len + off} ${y}`;
  for (let px = x - len + off; px < x + w + len; px += len) d += `q${len / 4} ${-amp} ${len / 2} 0t${len / 2} 0`;
  return d;
}
/** A sports car in side view facing right, wheels resting on (x, y) at its rear; 400 long at s = 1. Returns {g, wheels}. */
export function car(g, x, y, s = 1, {fill = 'pink', flip = false} = {}) {
  const out = g.append('g').attr('transform', `translate(${x} ${y}) scale(${flip ? -s : s} ${s})`), id = uid();
  const body = 'M10 -34L6 -74Q8 -94 40 -98L118 -104Q160 -150 216 -150L250 -148Q292 -128 320 -100L372 -90Q397 -82 397 -60L394 -34Z';
  out.append('clipPath').attr('id', id).append('path').attr('d', body);
  out.append('path').attr('d', body).attr('fill', P(g, fill)).attr('stroke', C.ink).attr('stroke-width', 7).attr('stroke-linejoin', 'round');
  const inner = out.append('g').attr('clip-path', `url(#${id})`);
  inner.append('path').attr('d', 'M0 -66H400V-20H0Z').attr('fill', C.ink).attr('opacity', .28);
  inner.append('path').attr('d', 'M30 -95L118 -101Q160 -146 216 -146L250 -144Q290 -126 318 -97L372 -87').attr('fill', 'none').attr('stroke', '#fff3b0').attr('stroke-width', 5);
  out.append('path').attr('d', 'M136 -104Q166 -139 214 -139L246 -138Q272 -124 291 -103Z').attr('fill', C.aqua).attr('stroke', C.ink).attr('stroke-width', 5).attr('stroke-linejoin', 'round');
  out.append('path').attr('d', 'M206 -139L212 -103M291 -103L296 -40M150 -70h36').attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 4).attr('stroke-linecap', 'round');
  out.append('path').attr('d', 'M372 -84q18 4 20 16l-16 -2Z').attr('fill', '#fff7b8').attr('stroke', C.ink).attr('stroke-width', 3);
  out.append('path').attr('d', 'M8 -84l14 -2v14l-13 1Z').attr('fill', C.coral).attr('stroke', C.ink).attr('stroke-width', 3);
  const wheels = [92, 312].map(wx => {
    const wg = out.append('g').attr('transform', `translate(${wx} -36)`);
    wg.append('circle').attr('r', 37).attr('fill', C.ink); wg.append('circle').attr('r', 20).attr('fill', C.paper);
    const spokes = wg.append('path').attr('d', 'M-20 0H20M0 -20V20M-14 -14L14 14M-14 14L14 -14').attr('stroke', C.ink).attr('stroke-width', 5); wg.append('circle').attr('r', 6).attr('fill', C.ink);
    return spokes;
  });
  return {g: out, wheels};
}
/** A flamingo standing on (x, y); about 320 tall at s = 1. */
export function flamingo(g, x, y, s = 1, {flip = false} = {}) {
  const out = g.append('g').attr('transform', `translate(${x} ${y}) scale(${flip ? -s : s} ${s})`), line = (d, color, width) => out.append('path').attr('d', d).attr('fill', 'none').attr('stroke', color).attr('stroke-width', width).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
  for (const d of ['M-6 -140V0M-6 0h-22', 'M14 -140L34 -78L8 -52']) { line(d, C.ink, 13); line(d, C.coral, 6); }
  const neck = 'M44 -182C92 -214 26 -262 64 -296';
  line(neck, C.ink, 34);
  out.append('path').attr('d', 'M-78 -176Q-40 -230 30 -214Q74 -200 66 -164Q52 -128 -10 -130Q-52 -134 -96 -150Z').attr('fill', C.pink).attr('stroke', C.ink).attr('stroke-width', 7).attr('stroke-linejoin', 'round');
  line(neck, C.pink, 21);
  out.append('path').attr('d', 'M-70 -172Q-30 -206 26 -190Q10 -150 -30 -148Q-56 -150 -84 -156Z').attr('fill', '#d81f7a').attr('opacity', .75);
  out.append('path').attr('d', 'M-60 -186Q-30 -220 26 -208').attr('fill', 'none').attr('stroke', '#ffd0e6').attr('stroke-width', 5).attr('stroke-linecap', 'round');
  out.append('circle').attr('cx', 68).attr('cy', -300).attr('r', 19).attr('fill', C.pink).attr('stroke', C.ink).attr('stroke-width', 6);
  out.append('path').attr('d', 'M82 -310L116 -300Q114 -280 96 -286Z').attr('fill', C.paper).attr('stroke', C.ink).attr('stroke-width', 5).attr('stroke-linejoin', 'round');
  out.append('path').attr('d', 'M103 -304L116 -300Q114 -282 100 -286Z').attr('fill', C.ink);
  out.append('circle').attr('cx', 72).attr('cy', -304).attr('r', 4).attr('fill', C.ink);
  return {g: out};
}
/** A helicopter centred on (x, y), nose to the right; about 380 long at s = 1. Returns {g, spin(t)}. */
export function chopper(g, x, y, s = 1, {fill = 'sky', flip = false} = {}) {
  const out = g.append('g').attr('transform', `translate(${x} ${y}) scale(${flip ? -s : s} ${s})`), ink = sel => sel.attr('stroke', C.ink).attr('stroke-width', 6).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
  ink(out.append('path').attr('d', 'M-70 -14L-258 -40L-268 -84L-246 -84L-226 -46L-60 10Z').attr('fill', P(g, fill)));
  ink(out.append('path').attr('d', 'M-40 74h130M-58 92H112q22 0 30 -16M-20 60v32M70 60v32').attr('fill', 'none'));
  ink(out.append('path').attr('d', 'M-84 4Q-84 -62 -6 -64Q96 -62 110 14Q108 62 40 64L-40 64Q-84 58 -84 4Z').attr('fill', P(g, fill)));
  out.append('path').attr('d', 'M-80 24Q-60 56 -38 58L40 58Q96 56 106 22Q60 44 -10 40Q-52 38 -80 24Z').attr('fill', C.ink).attr('opacity', .26);
  ink(out.append('path').attr('d', 'M8 -56Q84 -52 100 8Q60 18 12 14Z').attr('fill', C.aqua));
  out.append('path').attr('d', 'M22 -46Q62 -42 78 -14').attr('fill', 'none').attr('stroke', C.white).attr('stroke-width', 5).attr('stroke-linecap', 'round');
  out.append('path').attr('d', 'M-76 -16Q-70 -52 -10 -58').attr('fill', 'none').attr('stroke', '#fff3b0').attr('stroke-width', 5).attr('stroke-linecap', 'round');
  ink(out.append('path').attr('d', 'M-8 -64v-26').attr('fill', 'none'));
  const rotor = out.append('g').attr('transform', 'translate(-8 -92)'), blade = ink(rotor.append('path').attr('d', 'M-230 0Q0 -12 230 0Q0 12 -230 0Z').attr('fill', C.ink));
  const tail = out.append('g').attr('transform', 'translate(-258 -64)'), tr = ink(tail.append('path').attr('d', 'M0 -34V34M-34 0H34').attr('fill', 'none'));
  return {g: out, spin(t) { blade.attr('transform', `scale(${Math.cos(t * 26) * .92 + .08} 1)`); tr.attr('transform', `rotate(${t * 900})`); }};
}
/** A speedboat in side view, bow to the right, waterline at y; about 420 long at s = 1. */
export function boat(g, x, y, s = 1, {fill = 'paper', flip = false} = {}) {
  const out = g.append('g').attr('transform', `translate(${x} ${y}) scale(${flip ? -s : s} ${s})`);
  out.append('path').attr('d', 'M-190 -52L140 -52L236 -70L140 6L-166 6Z').attr('fill', P(g, fill)).attr('stroke', C.ink).attr('stroke-width', 7).attr('stroke-linejoin', 'round');
  out.append('path').attr('d', 'M-182 -30L186 -30L160 -10L-176 -10Z').attr('fill', C.pink); out.append('path').attr('d', 'M-176 -10L160 -10L140 6L-166 6Z').attr('fill', C.ink).attr('opacity', .25);
  out.append('path').attr('d', 'M-20 -52L20 -96L70 -96L96 -52Z').attr('fill', C.aqua).attr('stroke', C.ink).attr('stroke-width', 6).attr('stroke-linejoin', 'round');
  out.append('path').attr('d', 'M-186 -52L138 -52').attr('fill', 'none').attr('stroke', '#fff3b0').attr('stroke-width', 5);
  return {g: out};
}
/** Flat streak clouds: a stack of rounded bars. */
export function cloud(g, x, y, s = 1, color = C.paper, opacity = .85) {
  const out = g.append('g').attr('transform', `translate(${x} ${y}) scale(${s})`).attr('fill', P(g, color)).attr('opacity', opacity);
  [[0, 0, 220], [-50, 22, 300], [30, 44, 180]].forEach(([dx, dy, w]) => out.append('rect').attr('x', dx - w / 2).attr('y', dy).attr('width', w).attr('height', 16).attr('rx', 8));
  return out;
}
/**
 * A whole sunset scene filling the box: sky, halftone, sun, streak clouds, distant skyline, sea.
 * Returns {g, waves(t)} so the water can move. Use it inside a panel's clip.
 */
export function scene(g, x, y, w, h, {horizon = .7, sunAt = .5, sunR = null, city = true, seed = 1, palms = 0} = {}) {
  const out = g.append('g'), hy = y + h * horizon, r = sunR ?? Math.min(w, h) * .24;
  out.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', hy - y).attr('fill', P(g, 'sunset'));
  halftone(out, x, y, w, (hy - y) * .7, {color: C.plum, from: 'top', cell: Math.max(14, w / 30), opacity: .35});
  sun(out, x + w * sunAt, hy - r * .35, r);
  cloud(out, x + w * .2, y + h * .16, w / 700); cloud(out, x + w * .78, y + h * .3, w / 900, C.paper, .7);
  if (city) skyline(out, x, hy, w, {seed, h: h * .16, flat: C.plum});
  out.append('rect').attr('x', x).attr('y', hy).attr('width', w).attr('height', y + h - hy).attr('fill', P(g, 'sea'));
  out.append('rect').attr('x', x + w * sunAt - r * .5).attr('y', hy).attr('width', r).attr('height', y + h - hy).attr('fill', C.yellow).attr('opacity', .35);
  const lines = [0, 1, 2, 3].map(i => out.append('path').attr('fill', 'none').attr('stroke', i % 2 ? C.aqua : C.paper).attr('stroke-width', 3 + i).attr('stroke-linecap', 'round').attr('opacity', .8));
  out.append('path').attr('d', `M${x} ${hy}h${w}`).attr('stroke', C.ink).attr('stroke-width', 4);
  for (let i = 0; i < palms; i++) palm(out, x + (i % 2 ? w * (1 - .08 - .1 * hash(i, seed)) : w * (.06 + .1 * hash(i, seed))), y + h + 20, h / 420 * (1 + .25 * hash(i, seed + 2)), {lean: i % 2 ? -40 : 40, color: C.ink, rim: C.orange});
  const waves = t => lines.forEach((l, i) => l.attr('d', wavePath(x, hy + (y + h - hy) * (.18 + i * .22), w, 60 + i * 30, 5 + i * 3, t * (.3 + i * .12) * (i % 2 ? -1 : 1))));
  waves(0);
  return {g: out, waves, hy};
}

// ---------------------------------------------------------------- timing
/** Reveal a path by drawing along its length. q is 0..1. */
export function draw(path, q) {
  const node = path.node(), length = node.__len ??= node.getTotalLength();
  path.attr('stroke-dasharray', length).attr('stroke-dashoffset', length * (1 - easeOut(q)));
}
/** Put a group at (x, y), scaled and turned about that point. */
export const place = (sel, x, y, scale = 1, rot = 0) => sel.attr('transform', `translate(${x} ${y}) rotate(${rot}) scale(${Math.max(.0001, scale)})`);
/** Break text into lines no wider than `width` at this size and font. */
export function wrap(value, width, size, font = F.display, spacing = 0) {
  const lines = []; let line = '';
  for (const word of String(value).split(/\s+/)) { const next = line ? line + ' ' + word : word; if (line && measure(next, size, font, spacing) > width) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line);
  return lines;
}
/** Scale for something that pops in at `start`: 0, overshoots, settles on 1. */
export const pop = (t, start, length = .32) => t < start ? 0 : easeBack(span(t, start, length));
/** Scale for a title that slams down onto the frame: starts large, lands on 1 with a small bounce. */
export const slam = (t, start, length = .26) => { const q = span(t, start, length); return q <= 0 ? 0 : q >= 1 ? 1 + .06 * Math.exp(-(t - start - length) * 14) * Math.cos((t - start - length) * 34) : mix(2.6, 1, q * q); };
/** A decaying shake offset [dx, dy] after an impact at `start`. */
export const shake = (t, start, amp = 14) => { const k = t - start; if (k < 0 || k > .5) return [0, 0]; const e = amp * Math.exp(-k * 9); return [Math.sin(k * 70) * e, Math.cos(k * 53) * e]; };
/** 0..1: how far into its exit an overlay is, given how long it stays up (`life` seconds; none = never leaves). */
export const leave = (t, life, length = .22) => life ? span(t, life - length, length) ** 2 : 0;
/** Overall opacity of an overlay: quick in, quick out just before `life` ends. */
export const presence = (t, life) => span(t, 0, .08) * (life ? 1 - span(t, life - .1, .1) : 1);
/** Transform string for a whole overlay leaving: it drops and tips slightly, like a card flicked away. */
export const flick = (t, life, cx = 540, cy = 400, dir = 1) => { const q = leave(t, life); return q ? `translate(${dir * q * 260} ${q * 120}) rotate(${dir * q * 9} ${cx} ${cy})` : null; };
/** Text that types itself. */
export const typed = (value, q) => value.slice(0, Math.round(value.length * clamp(q)));
/** Seeded pseudo-random number 0..1. Pieces may not use Math.random; hash(i, seed) is the stand-in. */
export const hash = (n, seed = 0) => { const x = Math.sin(n * 127.1 + seed * 311.7 + 74.7) * 43758.5453; return x - Math.floor(x); };
/** A smoothly wandering value 0..1 over time. */
export const noise = (t, seed = 0) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u; };
/** Hand-drawn "boil": a small offset that changes 8 times a second, for things that should feel inked rather than rendered. */
export const boil = (t, seed = 0, amp = 2) => (hash(Math.floor(t * 8), seed) - .5) * 2 * amp;
/** 12345 -> "12,345". */
export const comma = n => Math.round(n).toLocaleString('en-US');
/** On/off square wave. */
export const blink = (t, hz = 2) => Math.floor(t * hz * 2) % 2 ? 0 : 1;

// ---------------------------------------------------------------- little scenes
/**
 * A small illustrated scene filling a box, for the inside of a panel (clip it with the panel's clip).
 * kind: 'sun' | 'city' | 'car' | 'palm' | 'flamingo' | 'chopper' | 'boat'. Returns {g, tick(t)} — call tick to move it.
 */
export function vignette(g, kind, x, y, w, h, seed = 1) {
  const out = g.append('g'), rect = (fill, ry = y, rh = h) => out.append('rect').attr('x', x).attr('y', ry).attr('width', w).attr('height', rh).attr('fill', P(g, fill));
  let tick = () => {};
  if (kind === 'sun') { const s = scene(out, x, y, w, h, {seed, palms: 2}); tick = s.waves; }
  else if (kind === 'city') {
    rect('sunset'); halftone(out, x, y, w, h * .5, {color: C.plum, from: 'top', cell: Math.max(14, w / 26), opacity: .35}); sun(out, x + w * .72, y + h * .5, h * .3);
    skyline(out, x - 10, y + h * .9, w + 20, {seed: seed + 4, h: h * .5, flat: C.plum}); skyline(out, x - 6, y + h * .93, w + 12, {seed, h: h * .46, ink: Math.max(3, h / 70)});
    rect(C.ink, y + h * .93, h * .07); palm(out, x + w * .1, y + h * .98, h / 380, {lean: 34, rim: C.orange});
  } else if (kind === 'car') {
    rect('sunset', y, h * .72); sun(out, x + w * .28, y + h * .62, h * .26); skyline(out, x, y + h * .72, w, {seed, h: h * .2, flat: C.plum});
    rect(C.night, y + h * .72, h * .28); out.append('path').attr('d', `M${x} ${y + h * .72}h${w}`).attr('stroke', C.ink).attr('stroke-width', 5);
    const dashes = out.append('path').attr('stroke', C.yellow).attr('stroke-width', Math.max(4, h * .02)).attr('stroke-dasharray', `${w * .09} ${w * .07}`).attr('d', `M${x - w} ${y + h * .93}h${w * 3}`);
    const lines = streaks(out, x, y + h * .2, w * .5, h * .5, 6, C.paper, seed).attr('opacity', .8), s = Math.min(w * .62 / 400, h * .5 / 150), c = car(out, x + w * .5 - 200 * s, y + h * .9, s);
    tick = t => { dashes.attr('stroke-dashoffset', t * w * .9); c.wheels.forEach(sp => sp.attr('transform', `rotate(${t * 720})`)); c.g.attr('transform', `translate(${x + w * .5 - 200 * s + boil(t, 3, 0)} ${y + h * .9 + Math.sin(t * 9) * 1.5}) scale(${s})`); lines.attr('transform', `translate(${-((t * w * .8) % (w * .3))} 0)`); };
  } else if (kind === 'palm') {
    rect('sunset'); sun(out, x + w * .5, y + h * .62, Math.min(w, h) * .3); cloud(out, x + w * .25, y + h * .14, w / 800);
    rect('sea', y + h * .8, h * .2); out.append('path').attr('d', `M${x} ${y + h * .8}h${w}`).attr('stroke', C.ink).attr('stroke-width', 4);
    const ps = [[.14, 1.05, 44], [.86, 1.2, -50], [.68, .8, -24]].map(([u, k, lean]) => palm(out, x + w * u, y + h * 1.02, h / 400 * k, {lean, rim: C.orange}));
    tick = t => ps.forEach((p, i) => p.crown.attr('transform', `translate(${[44, -50, -24][i]} -300) rotate(${Math.sin(t * 1.6 + i * 2) * 4})`));
  } else if (kind === 'flamingo') {
    rect('sea'); halftone(out, x, y, w, h, {color: C.paper, from: 'top', cell: Math.max(14, w / 24), opacity: .25}); out.append('circle').attr('cx', x + w * .7).attr('cy', y + h * .34).attr('r', h * .22).attr('fill', P(g, 'gold'));
    const ripples = [0, 1, 2].map(i => out.append('path').attr('fill', 'none').attr('stroke', C.paper).attr('stroke-width', 4).attr('stroke-linecap', 'round').attr('opacity', .8));
    const f = flamingo(out, x + w * .42, y + h * .96, h / 380);
    tick = t => { ripples.forEach((r, i) => r.attr('d', wavePath(x, y + h * (.78 + i * .08), w, 70, 6, t * .4 * (i % 2 ? -1 : 1)))); f.g.attr('transform', `translate(${x + w * .42} ${y + h * .96}) scale(${h / 380}) rotate(${Math.sin(t * 2) * 1.5})`); };
  } else if (kind === 'chopper') {
    rect('sunset'); cloud(out, x + w * .2, y + h * .2, w / 700); cloud(out, x + w * .8, y + h * .62, w / 600, C.paper, .7); skyline(out, x, y + h, w, {seed, h: h * .26, flat: C.plum});
    const s = Math.min(w * .62 / 480, h * .5 / 200), c = chopper(out, x + w * .52, y + h * .46, s);
    tick = t => { c.spin(t); c.g.attr('transform', `translate(${x + w * .52 + Math.sin(t * 1.3) * w * .03} ${y + h * .46 + Math.sin(t * 2.1) * h * .03}) scale(${s}) rotate(${Math.sin(t * 1.3) * 3 - 4})`); };
  } else if (kind === 'boat') {
    rect('sunset', y, h * .5); sun(out, x + w * .72, y + h * .42, h * .2); rect('sea', y + h * .5, h * .5); out.append('path').attr('d', `M${x} ${y + h * .5}h${w}`).attr('stroke', C.ink).attr('stroke-width', 4);
    const wake = [0, 1, 2].map(i => out.append('path').attr('fill', 'none').attr('stroke', C.paper).attr('stroke-width', 5).attr('stroke-linecap', 'round')), s = Math.min(w * .6 / 430, h * .4 / 100), b = boat(out, x + w * .52, y + h * .78, s);
    tick = t => { wake.forEach((l, i) => l.attr('d', wavePath(x, y + h * (.64 + i * .13), w, 80, 7, -t * (.8 + i * .3)))); b.g.attr('transform', `translate(${x + w * .52} ${y + h * .78 + Math.sin(t * 5) * 2}) scale(${s}) rotate(${-3 + Math.sin(t * 5) * 1.2})`); };
  }
  tick(0);
  return {g: out, tick};
}

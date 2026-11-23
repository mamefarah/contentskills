// Drawing kit for the ui/claude theme: the Claude app (Code tab, dark) in frame pixels (1080x1920).
// Plain SVG, no dependencies. Coordinates match the effects-showcase template so both look the same.
const NS = 'http://www.w3.org/2000/svg';
// Neutral greys sampled from claude.ai in dark mode (page #181818, input #2a2a2a with a #3b3b3b hairline, text #efefef).
export const C = {bg: '#181818', surf: '#2a2a2a', surf2: '#3b3b3b', edge: '#3b3b3b', text: '#efefef', muted: '#9b9b9b', sub: '#b4b4b4',
  orange: '#d97757', orangeHot: '#ec9678', pillBg: '#4a3027', pillFg: '#ec9270', kbBg: '#232323', key: '#474747', key2: '#2f2f2f',
  keyHi: '#6a6a6a', card: '#0e0e0e', placeholder: '#7f7f7f', icon: '#cfcfcf', reply: '#e6e6e6'};
/** The hairline claude.ai draws round its input box. */
export const EDGE = {stroke: '#3b3b3b', 'stroke-width': 2};
// The app sets its UI in Anthropic Sans and Claude's replies in Anthropic Serif (the default chat font). Neither is free,
// so Inter and Source Serif 4 stand in: F for everything you tap or type, FS for anything Claude says.
export const F = 'Inter, "Inter Tight", system-ui, sans-serif';
export const FS = '"Source Serif 4", Georgia, serif';
export const CARD = {x: 30, y: 545, width: 632, height: 1125};   // where the result sits in the chat (the clip's layout window)
export const KB_Y = 1245;

export function stage(el, background = C.bg) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1080 1920'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block';
  el.appendChild(svg); el.style.background = 'transparent';
  if (background) node(svg, 'rect', {x: 0, y: 0, width: 1080, height: 1920, fill: background});
  return svg;
}
export function node(parent, tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  parent.appendChild(n); return n;
}
export const group = (parent, attrs) => node(parent, 'g', attrs);
export const rr = (p, x0, y0, x1, y1, r, fill, extra = {}) => node(p, 'rect', {x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: r, fill, ...extra});
export const circle = (p, cx, cy, r, fill, extra = {}) => node(p, 'circle', {cx, cy, r, fill, ...extra});
export const line = (p, pts, stroke, width) => node(p, 'polyline', {points: pts.map(q => q.join(',')).join(' '), fill: 'none', stroke, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'});
export function text(p, x, y, s, size, weight = 500, fill = C.text, anchor = 'start', extra = {}) {
  return node(p, 'text', {x, y, 'font-family': F, 'font-size': size, 'font-weight': weight, fill, 'text-anchor': anchor, 'dominant-baseline': 'central', ...extra}, s);
}
/** Claude's own words (a reply, a status line from the spark) in the serif chat font, a touch larger as the app does. */
export const say = (p, x, y, s, size, fill = C.reply, anchor = 'start', extra = {}) => text(p, x, y, s, size * 1.06, 400, fill, anchor, {'font-family': FS, ...extra});
let clips = 0;
export function image(p, href, x, y, w, h, r) {
  const id = 'cui-clip' + (++clips);
  const defs = node(p, 'defs'), cp = node(defs, 'clipPath', {id}); rr(cp, x, y, x + w, y + h, r, '#000');
  if (!href) return rr(p, x, y, x + w, y + h, r, C.surf2);
  return node(p, 'image', {href, x, y, width: w, height: h, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${id})`});
}

// ---------- icons ----------
export const iconPlus = (p, x, y, s = 22, col = C.muted) => { line(p, [[x - s, y], [x + s, y]], col, 4); line(p, [[x, y - s], [x, y + s]], col, 4); };
export function iconSliders(p, x, y, col = C.muted) {
  line(p, [[x - 18, y - 9], [x + 18, y - 9]], col, 3.5); line(p, [[x - 18, y + 9], [x + 18, y + 9]], col, 3.5);
  circle(p, x + 6, y - 9, 6, C.surf, {stroke: col, 'stroke-width': 3}); circle(p, x - 6, y + 9, 6, C.surf, {stroke: col, 'stroke-width': 3});
}
export function iconMic(p, x, y, col = C.muted) {
  rr(p, x - 9, y - 24, x + 9, y + 4, 9, 'none', {stroke: col, 'stroke-width': 4});
  node(p, 'path', {d: `M${x - 17} ${y - 4} a17 17 0 0 0 34 0`, fill: 'none', stroke: col, 'stroke-width': 4, 'stroke-linecap': 'round'});
  line(p, [[x, y + 14], [x, y + 24]], col, 4);
}
export function iconArrowUp(p, x, y, col = '#fff', s = 20) {
  line(p, [[x, y + s], [x, y - s]], col, 5); line(p, [[x - s * .8, y - s * .15], [x, y - s], [x + s * .8, y - s * .15]], col, 5);
}
export function spark(p, cx, cy, r, angle) {
  const g = group(p, {transform: `translate(${cx} ${cy}) rotate(${angle * 180 / Math.PI})`});
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6, len = r * (k % 2 ? .78 : 1);
    line(g, [[Math.cos(a) * r * .18, Math.sin(a) * r * .18], [Math.cos(a) * len, Math.sin(a) * len]], C.orange, r * .26);
  }
  return g;
}

export function topBar(p) {
  circle(p, 82, 125, 44, C.surf); line(p, [[64, 116], [100, 116]], C.icon, 4); line(p, [[64, 134], [88, 134]], C.icon, 4);
  rr(p, 362, 82, 718, 168, 43, '#232323'); rr(p, 540, 90, 710, 160, 35, C.surf2);
  text(p, 451, 125, 'Chat', 40, 600, C.muted, 'middle'); text(p, 625, 125, 'Code', 40, 600, C.text, 'middle');
  circle(p, 998, 125, 44, C.surf); rr(p, 980, 108, 1012, 140, 7, 'none', {stroke: C.icon, 'stroke-width': 4});
  rr(p, 996, 100, 1022, 124, 0, C.surf); line(p, [[995, 125], [1016, 104]], C.icon, 4.5);
}

// ---------- keyboard ----------
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
export const KEYS = (() => {
  const r = {}, kw = 93, kh = 112, gx = 12, y0 = KB_Y + 105;
  ROWS.forEach((row, ri) => { let x = (1080 - (row.length * kw + (row.length - 1) * gx)) / 2; const y = y0 + ri * (kh + 26); for (const ch of row) { r[ch] = [x, y, x + kw, y + kh]; x += kw + gx; } });
  const y3 = y0 + 2 * (kh + 26), y4 = y3 + kh + 26;
  r.shift = [22, y3, 150, y3 + kh]; r.back = [930, y3, 1058, y3 + kh];
  r['123'] = [100, y4, 298, y4 + kh]; r[' '] = [310, y4, 776, y4 + kh]; r['/'] = [788, y4, 986, y4 + kh];
  return r;
})();
export function keyboard(p) {
  rr(p, 0, KB_Y, 1080, 1920, 0, C.kbBg); rr(p, 0, KB_Y + 86, 1080, KB_Y + 88, 0, '#2c2c2c');
  for (const [k, [x0, y0, x1, y1]] of Object.entries(KEYS)) {
    const special = ['shift', 'back', '123'].includes(k); rr(p, x0, y0, x1, y1, 14, special ? C.key2 : C.key);
    const label = {shift: '⇧', back: '⌫', '123': '123', ' ': 'space'}[k] ?? k, big = label.length === 1 && !['shift', 'back'].includes(k);
    text(p, (x0 + x1) / 2, (y0 + y1) / 2 - (big ? 4 : 0), label, big ? 52 : 38, 400, '#ececea', 'middle');
  }
}

// Modern theme drawing kit. Every piece in this theme draws with this file; if two pieces disagree
// about what the theme looks like, the fix belongs here.
//
// THE STYLE (original work in the genre of fast editorial "dynamic opener" edits)
//   Frame    Near-black charcoal (#1c1c1e) around full-bleed vertical pictures. Colour comes from the
//            pictures (footage, or the studio-light tones below on title cards); graphics are white or
//            charcoal only. No glows, no gradients on type, no rounded corners, no drop shadows you can see.
//   Layout   The frame splits into 2-3 vertical strips with staggered top/bottom edges, a 2x2 mosaic, a
//            narrow slot that widens, or a centred card that punches up to full frame on the beat.
//   Type     ONE huge word, centred, heavy geometric sans (Montserrat 800) in white capitals with light
//            tracking. It builds and leaves LETTER BY LETTER in a scattered (seeded) order: each letter
//            passes through a GHOST state (translucent fill, hairline outline) before it turns solid, and
//            goes back through ghost before it drops out. Small labels: Inter Tight 600, widely tracked
//            capitals. Counters / frame numbers: Space Mono Bold.
//   Motion   On the beat (STEP = 0.2 s grid): fast arrivals that land hard (expo-out), hard cuts, short
//            holds. Panels slide in from alternate ends; nothing floats or drifts.
//   Avoid    Neon, glow, chrome, script fonts, colour on type, slow fades, centred plates behind text.
//
// EXPORTS (every animated value is set from t inside seek(t): no timers, Math.random or Date.now)
//   C, F, FRAME, SAFE, STEP   colours {bg, ink, coal, graphite, rule, white, bone, ghost, dim, mute, signal},
//                          fonts {head: Montserrat, sans: Inter Tight, mono: Space Mono, alt: Archivo Black,
//                          tall: Anton}, the 1080x1920 frame, the app safe zone, the beat step (s).
//   clamp, span, mix       from the shared kit. span(t, start, length) -> 0..1.
//   snap(x), punch(x), io(x), easeIn(x), lin(x)   expo-out (the theme's arrival), back-out with a small
//                          overshoot (the zoom punch), cubic in-out, cubic in, clamp.
//   beat(t, step), onBeat(t, at, step)   beat index of t on the grid / 0..1 progress through beat `at`.
//   hash(n, seed), order(n, seed, mode)   seeded 0..1 random; a permutation rank[i] for n letters/panels,
//                          mode 'scatter' (default), 'left', 'right', 'centre', 'edges'.
//   tone(name)             a colour of this theme for any colour name (other themes' accents map to white/bone/signal).
//   TONES, toneOf(name)    studio-light picture tones for panels: ember, teal, bone, rose, steel, ink, olive,
//                          cobalt, sand (other names map onto these).
//   up(s), oneLine(s), pad(n, w), comma(n)   string helpers.
//   fieldOf(name)          title-card ground {bg, fg}: charcoal (default), black, graphite, bone (dark ink type).
//   stage(el, {mode, field, clear, grain})
//                          mode 'overlay' = transparent 1080x1920 for footage; 'tall' = title card 1080 wide,
//                          1080..1920 tall (follows the element's shape); 'card' = 1000x1000.
//                          Returns st = {svg, defs, W, H, k (H/1920), sq (squarish), root, back, front, url(name),
//                          uid(prefix), fg (type colour on this field), tick(t)}. Call st.tick(t) from seek (grain).
//   g(parent)              a new <g> (d3 selection) inside a selection or a stage.
//   panel(st, parent, {x, y, w, h, tone, image, focus, grain})
//                          a picture panel clipped to its box: a studio-tone fill (or an image URL, cover-cropped
//                          around focus [u, v]). Returns p = {g, inner, set({x, y, w, h, dx, dy, zoom, opacity}),
//                          box}: set moves/resizes the clip window; dx/dy slide the picture inside it; zoom scales it.
//   strips(st, parent, {n, tones, images, gap, stagger, from, top, bottom})
//                          n (2-3) vertical strips with staggered edges. Returns {panels, rects, seek(t, at, out)}:
//                          strips slide in on the beat from alternate ends (at) and out the same way (out, optional).
//   mosaic(st, parent, {tones, images, gap, from})   a 2x2 grid; seek(t, at, out) wipes cells in one by one.
//   slot(st, parent, {tone, image, x, w0, w1, h})    a narrow slot that widens to w1; seek(t, at, len).
//   punchCard(st, parent, {tone, image, from, ramp}) a centred card scaling up to full frame; seek(t, at).
//   measure(str, size, o), capH(size, o), fit(lines, width, max, o), wrap(str, size, width, o)
//                          text metrics; o = {font, weight, track (em)}. Defaults: the big-word face.
//   word(parent, str, x, y, size, {font, weight, track, anchor, color, seed, order, ghost, stroke, lift})
//                          THE BIG WORD: one <text> per letter at its kerned position, baseline y.
//                          w.seek(t, {at, step, hold, out, outStep, outOrder, drop}) builds letters in (ghost at
//                          at + rank*step, solid `hold` later) and, given `out`, drops them out in a second
//                          scattered order (solid -> ghost -> gone, falling `drop` em). Returns
//                          {nodes, w, cap, x0, seek, set(i, state 0..2), inLen()}. On footage pass `lift: st` (the stage)
//                          for a barely visible shadow.
//   words(parent, lines, x, cy, size, o, leading)    several centred word lines: {rows, top, bottom, seek(t, opts, gap)}.
//   label(parent, x, y, str, {size, anchor, weight, track, color, opacity, font, lift})   small tracked capitals ('\n' = new line).
//   mono(parent, x, y, str, {size, anchor, color, opacity})   Space Mono figures.
//   rule(parent, x0, y0, x1, y1, {width, color})    a hairline that draws: rule.draw(q) / rule.range(a, b).
//   typed(str, q), count(value, q, decimals)         first q of a string / a number counting up to value.
//   presence(t, life, fade)  overlay opacity: in over `fade`, out before `life` ends (props.life).
//   leave(t, life, len)      0 while up, rising to 1 over the last `len` s of `life`.
//   faceAt(props, t)         the face box {x, y, w, h} (0..1) at time t: props.locate, props.track or props.box.
//   frameTag(parent, st, {text, y})   the small centred format tag under a title card (e.g. "9:16 / 24 FPS").
//   veil(st, parent, a, color)   a charcoal veil over pictures so white type reads.
//   corners(st, parent, labels, {size, inset, color})   small corner labels [tl, tr, bl, br]; returns seek(t, at, out).
import {clamp, span, mix} from '/library/_shared/kit.js';
export {clamp, span, mix};

// ---------------------------------------------------------------- theme
export const C = {
  bg: '#1c1c1e', ink: '#121213', coal: '#1c1c1e', graphite: '#2b2b2e', rule: '#3a3a3e',
  white: '#f5f5f2', bone: '#e8e5de', ghost: 'rgba(245,245,242,.26)', dim: '#9a9a9f', mute: '#5d5d62', signal: '#ff5a1f',
};
export const F = {head: 'Montserrat', sans: '"Inter Tight"', mono: '"Space Mono"', alt: '"Archivo Black"', tall: 'Anton'};
export const FRAME = {width: 1080, height: 1920};
export const SAFE = {left: 70, top: 250, right: 1010, bottom: 1440};
export const STEP = .2;

const toneAlias = {cyan: 'white', magenta: 'white', amber: 'bone', cream: 'bone', paper: 'bone', yellow: 'bone', gold: 'bone', orange: 'signal', red: 'signal', coral: 'signal', hot: 'signal', grey: 'dim', gray: 'dim', black: 'ink', dark: 'coal'};
/** A colour of this theme for a colour name from any theme; CSS colours pass through. */
export const tone = c => C[c] ?? C[toneAlias[c]] ?? (/^(#|rgb|hsl)/.test(c ?? '') ? c : C.white);
export const up = s => String(s ?? '').toUpperCase();
export const oneLine = s => String(s ?? '').replace(/\s*\n\s*/g, ' ');
export const pad = (n, width = 2) => String(Math.floor(n)).padStart(width, '0');
export const comma = n => Math.round(n).toLocaleString('en-US');
export const typed = (value, q) => String(value ?? '').slice(0, Math.round(String(value ?? '').length * clamp(q)));
export function count(value, q, decimals = null) {
  const s = String(value ?? ''), m = s.match(/-?[\d,]*\.?\d+/); if (!m) return s;
  const n = parseFloat(m[0].replace(/,/g, '')), d = decimals ?? (m[0].split('.')[1]?.length ?? 0), v = n * clamp(q);
  const txt = m[0].includes(',') ? v.toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d}) : v.toFixed(d);
  return s.slice(0, m.index) + txt + s.slice(m.index + m[0].length);
}

/** Studio-light picture tones for panels with no image: [stops of a lit backdrop], light position. */
export const TONES = {
  ember: {stops: ['#ffb070', '#e2632a', '#5a2010', '#140b08'], at: [.35, .3]},
  teal: {stops: ['#4f7c80', '#24464b', '#11222a', '#0a1215'], at: [.7, .25]},
  bone: {stops: ['#f1eee8', '#d9d4ca', '#b5afa4', '#8e897f'], at: [.4, .3]},
  rose: {stops: ['#f2b8c0', '#c96a7c', '#5e2533', '#1d0b10'], at: [.6, .3]},
  steel: {stops: ['#c3ccd4', '#7d8b97', '#39424b', '#15191d'], at: [.3, .25]},
  ink: {stops: ['#3c3c41', '#26262a', '#18181a', '#0e0e0f'], at: [.5, .3]},
  olive: {stops: ['#c9c089', '#8a8452', '#3d3a22', '#16150c'], at: [.65, .35]},
  cobalt: {stops: ['#7d9bff', '#3554d1', '#14215c', '#080c22'], at: [.4, .2]},
  sand: {stops: ['#f0d3a8', '#d1a46e', '#7c5833', '#2a1c0f'], at: [.55, .3]},
};
const toneNames = Object.keys(TONES);
const toneAlias2 = {amber: 'ember', orange: 'ember', red: 'rose', magenta: 'rose', pink: 'rose', cyan: 'teal', blue: 'cobalt', sky: 'steel', cream: 'bone', paper: 'bone', white: 'bone', black: 'ink', dark: 'ink', slate: 'steel', lime: 'olive', green: 'olive', gold: 'sand', yellow: 'sand', violet: 'cobalt', purple: 'cobalt'};
export const toneOf = name => TONES[name] ? name : toneAlias2[name] ?? (typeof name === 'number' ? toneNames[name % toneNames.length] : 'ink');

/** Title-card grounds: bg and the type colour on it. */
export const fields = {
  charcoal: {bg: '#1c1c1e', fg: '#f5f5f2'},
  black: {bg: '#0f0f10', fg: '#f5f5f2'},
  graphite: {bg: '#2b2b2e', fg: '#f5f5f2'},
  bone: {bg: '#e8e5de', fg: '#151516'},
};
const fieldAlias = {teal: 'charcoal', slate: 'charcoal', dark: 'charcoal', void: 'black', deep: 'black', ink: 'black', noir: 'black', white: 'bone', paper: 'bone', cream: 'bone', mist: 'bone', grey: 'graphite', gray: 'graphite', steel: 'graphite'};
export const fieldOf = name => fields[name] ?? fields[fieldAlias[name]] ?? fields.charcoal;

// ---------------------------------------------------------------- numbers, easing and the beat
export const lin = x => clamp(x);
export const snap = x => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
export const punch = x => { x = clamp(x); const c = 1.25; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
export const io = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeIn = x => Math.pow(clamp(x), 3);
export const beat = (t, step = STEP) => Math.floor(t / step + 1e-6);
export const onBeat = (t, at, step = STEP) => span(t, at * step, step);
export const hash = (n, seed = 0) => { const x = Math.sin(n * 127.1 + seed * 311.7 + 74.7) * 43758.5453; return x - Math.floor(x); };
/** rank[i] = when letter/panel i goes (0 first). 'scatter' is a seeded shuffle that never starts and ends adjacent. */
export function order(n, seed = 1, mode = 'scatter') {
  const idx = [...Array(n).keys()];
  let seq;
  if (mode === 'left') seq = idx;
  else if (mode === 'right') seq = idx.slice().reverse();
  else if (mode === 'centre' || mode === 'center') seq = idx.slice().sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2) || a - b);
  else if (mode === 'edges') seq = idx.slice().sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2) || a - b);
  else seq = idx.slice().sort((a, b) => hash(a + 1, seed) - hash(b + 1, seed));
  const rank = Array(n); seq.forEach((i, r) => { rank[i] = r; }); return rank;
}

// ---------------------------------------------------------------- textures
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
let grainCache = null;
export const grainURL = () => grainCache ??= (() => { const c = document.createElement('canvas'), s = 256; c.width = c.height = s; const x = c.getContext('2d'), r = mulberry(1977), d = x.createImageData(s, s); for (let i = 0; i < s * s; i++) { const v = r() < .5 ? 0 : 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = r() * 34; } x.putImageData(d, 0, 0); return c.toDataURL('image/png'); })();

// ---------------------------------------------------------------- stage
let stages = 0;
export function stage(el, {mode = 'tall', field = 'charcoal', clear = false, grain = true} = {}) {
  const d3 = window.d3, id = `md${++stages}`, overlay = mode === 'overlay', cw = el.clientWidth || 1080, ch = el.clientHeight || 1920;
  const [W, H] = overlay ? [1080, 1920] : mode === 'card' ? [1000, 1000] : [1080, Math.round(clamp(1080 * ch / cw, 1080, 1920))];
  const f = fieldOf(field), bare = overlay || clear;
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet').style('overflow', 'hidden');
  el.style.background = bare ? 'transparent' : f.bg;
  const defs = svg.append('defs'), url = name => `url(#${id}-${name})`;
  let uids = 0; const uid = (p = 'u') => `${id}-${p}${++uids}`;
  // lift: an almost invisible shadow that keeps white type readable on bright footage.
  const lift = defs.append('filter').attr('id', `${id}-lift`).attr('x', '-20%').attr('y', '-30%').attr('width', '140%').attr('height', '160%');
  lift.append('feDropShadow').attr('dx', 0).attr('dy', 3).attr('stdDeviation', 12).attr('flood-color', '#000').attr('flood-opacity', .45);
  defs.append('pattern').attr('id', `${id}-grain`).attr('width', 256).attr('height', 256).attr('patternUnits', 'userSpaceOnUse').append('image').attr('href', grainURL()).attr('width', 256).attr('height', 256);
  for (const [name, T] of Object.entries(TONES)) {
    const gr = defs.append('radialGradient').attr('id', `${id}-tone-${name}`).attr('cx', T.at[0]).attr('cy', T.at[1]).attr('r', 1.05).attr('fx', T.at[0]).attr('fy', T.at[1]);
    T.stops.forEach((c, i) => gr.append('stop').attr('offset', [0, .28, .7, 1][i]).attr('stop-color', c));
  }
  const back = svg.append('g'), root = svg.append('g'), front = svg.append('g');
  const st = {svg, defs, back, root, front, id, W, H, k: H / 1920, sq: H < 1500, mode, field: f, fg: bare ? C.white : f.fg, url, uid, tick: () => {}};
  if (!bare) back.append('rect').attr('width', W).attr('height', H).attr('fill', f.bg);
  if (!bare && grain) {
    const gr = front.append('rect').attr('x', -256).attr('y', -256).attr('width', W + 512).attr('height', H + 512).attr('fill', url('grain')).attr('opacity', .5).style('mix-blend-mode', 'overlay');
    st.tick = t => { const s = Math.floor(t * 12); gr.attr('transform', `translate(${Math.round(hash(s, 1) * 256)} ${Math.round(hash(s, 2) * 256)})`); };
  }
  return st;
}
export const g = parent => (parent.root ?? parent).append('g');

// ---------------------------------------------------------------- picture panels
export function panel(st, parent, {x = 0, y = 0, w = st.W, h = st.H, tone: tn = 'ink', image = null, focus = [.5, .4], grain = true} = {}) {
  const cid = st.uid('clip'), clip = st.defs.append('clipPath').attr('id', cid), cr = clip.append('rect');
  const outer = (parent.root ?? parent).append('g'), gg = outer.append('g').attr('clip-path', `url(#${cid})`), inner = gg.append('g');
  let pic;
  if (image) pic = inner.append('image').attr('href', image).attr('preserveAspectRatio', `x${focus[0] < .34 ? 'Min' : focus[0] > .66 ? 'Max' : 'Mid'}Y${focus[1] < .34 ? 'Min' : focus[1] > .66 ? 'Max' : 'Mid'} slice`);
  else pic = inner.append('rect').attr('fill', st.url('tone-' + toneOf(tn)));
  const gr = grain && !image ? inner.append('rect').attr('fill', st.url('grain')).attr('opacity', .6).style('mix-blend-mode', 'overlay') : null;
  const home = {x, y, w, h}, box = {x, y, w, h, dx: 0, dy: 0, zoom: 1, opacity: 1};
  const self = {g: outer, inner, box, home, set(o = {}) {
    Object.assign(box, o); const {x, y, w, h, dx, dy, zoom} = box;
    cr.attr('x', x).attr('y', y).attr('width', Math.max(0, w)).attr('height', Math.max(0, h));
    // The picture covers the panel's home box, moved by dx/dy and scaled by zoom about its centre.
    const pw = home.w * zoom, ph = home.h * zoom, px = home.x + dx - (pw - home.w) / 2, py = home.y + dy - (ph - home.h) / 2;
    for (const n of [pic, gr]) n?.attr('x', px).attr('y', py).attr('width', pw).attr('height', ph);
    outer.attr('opacity', box.opacity);
    return self;
  }};
  return self.set();
}

/** n vertical strips with staggered edges, sliding in from alternate ends on the beat. */
export function strips(st, parent, {n = 3, tones = ['ember', 'ink', 'bone'], images = [], gap = 0, stagger = null, from = 'alternate', top = 0, bottom = null, step = STEP * .5} = {}) {
  const {W} = st, H = (bottom ?? st.H) - top, sw = (W - gap * (n - 1)) / n, sg = stagger ?? H * .055;
  const rects = Array.from({length: n}, (_, i) => { const off = i % 2 ? sg : (i === 0 ? 0 : -sg * .5); return {x: i * (sw + gap), y: top + off + (i % 2 ? 0 : sg * .3), w: sw, h: H - sg * 1.2}; });
  const panels = rects.map((r, i) => panel(st, parent, {...r, tone: tones[i % tones.length], image: images[i] ?? null}));
  const dir = i => from === 'up' ? -1 : from === 'down' ? 1 : (i % 2 ? -1 : 1);
  return {panels, rects, seek(t, at = 0, out = null) {
    panels.forEach((p, i) => {
      const r = rects[i], a = snap(span(t, at + i * step, STEP * 1.6)), b = out == null ? 0 : easeIn(span(t, out + i * step * .6, STEP * 1.2)), d = dir(i);
      const yy = r.y + (1 - a) * d * st.H * 1.05 - b * d * st.H * 1.05;
      p.set({y: yy, dy: yy - r.y - (1 - a) * d * st.H * .2, opacity: a > 0 && b < 1 ? 1 : 0});
    });
  }};
}

/** A 2x2 grid of pictures; cells wipe in one by one (each from its outer edge). */
export function mosaic(st, parent, {tones = ['steel', 'ember', 'rose', 'teal'], images = [], gap = 10, top = 0, bottom = null, step = STEP * .5} = {}) {
  const H = (bottom ?? st.H) - top, cw = (st.W - gap) / 2, chh = (H - gap) / 2;
  const rects = [0, 1, 2, 3].map(i => ({x: (i % 2) * (cw + gap), y: top + Math.floor(i / 2) * (chh + gap), w: cw, h: chh}));
  const panels = rects.map((r, i) => panel(st, parent, {...r, tone: tones[i % tones.length], image: images[i] ?? null}));
  const rank = [0, 3, 1, 2];
  return {panels, rects, seek(t, at = 0, out = null) {
    panels.forEach((p, i) => {
      const r = rects[i], a = snap(span(t, at + rank[i] * step, STEP * 1.5)), b = out == null ? 0 : snap(span(t, out + rank[i] * step * .6, STEP));
      const left = i % 2 === 0, w = r.w * a * (1 - b);
      p.set({x: left ? r.x + r.w - w : r.x, w, zoom: 1.12 - .12 * a, opacity: w > .5 ? 1 : 0});
    });
  }};
}

/** A narrow slot that widens to its full width. */
export function slot(st, parent, {tone: tn = 'ember', image = null, x = null, w0 = 90, w1 = null, y = null, h = null} = {}) {
  const W1 = w1 ?? st.W * .62, H = h ?? st.H * .62, cx = x ?? st.W / 2, Y = y ?? (st.H - H) / 2;
  const p = panel(st, parent, {x: cx - W1 / 2, y: Y, w: W1, h: H, tone: tn, image});
  return {panel: p, seek(t, at = 0, len = STEP * 3, out = null) {
    const a = span(t, at, STEP * .8), b = snap(span(t, at + STEP, len)), c = out == null ? 0 : snap(span(t, out, STEP * 1.5));
    const w = (w0 + (W1 - w0) * b) * (1 - c), hh = H * snap(a);
    p.set({x: cx - w / 2, w, y: Y + (H - hh) / 2, h: hh, zoom: 1.25 - .25 * b, opacity: a > 0 && w > .5 ? 1 : 0});
  }};
}

/** A centred card punching up from `from` (share of full frame) to full frame. */
export function punchCard(st, parent, {tone: tn = 'teal', image = null, from = .6, ramp = STEP * 1.5} = {}) {
  const p = panel(st, parent, {tone: tn, image});
  return {panel: p, seek(t, at = 0, punchAt = null) {
    const shown = t >= at, pa = punchAt ?? at + STEP * 3, a = punch(span(t, pa, ramp)), s = from + (1 - from) * a;
    const w = st.W * s, h = st.H * s;
    p.set({x: (st.W - w) / 2, y: (st.H - h) / 2, w, h, zoom: s * (1 + (1 - s) * .35), opacity: shown ? 1 : 0});
  }};
}

// ---------------------------------------------------------------- text
const ctx = document.createElement('canvas').getContext('2d'), caps = {};
const fontCss = (size, {font = F.head, weight = 800} = {}) => `${weight} ${size}px ${font}`;
const bareW = (str, o) => { ctx.font = fontCss(100, o); return ctx.measureText(str).width; };
export function measure(str, size, o = {}) { str = String(str ?? ''); return (bareW(str, o) + (o.track ?? .06) * 100 * Math.max(0, [...str].length - 1)) * size / 100; }
export function capH(size, o = {}) { const key = fontCss(100, o); if (!caps[key]) { ctx.font = key; caps[key] = ctx.measureText('H').actualBoundingBoxAscent || 70; } return caps[key] * size / 100; }
export const fit = (lines, width, max, o = {}) => Math.min(max, ...[].concat(lines).map(l => 100 * width / Math.max(1, measure(l, 100, o))));
export function wrap(str, size, width, o = {}) {
  const lines = []; let line = '';
  for (const w of String(str ?? '').split(/\s+/).filter(Boolean)) { const next = line ? line + ' ' + w : w; if (line && measure(next, size, o) > width) { lines.push(line); line = w; } else line = next; }
  if (line) lines.push(line); return lines;
}

/** THE BIG WORD: letters that build in and drop out one at a time, in a scattered order, via a ghost state. */
export function word(parent, str, x, y, size, {font = F.head, weight = 800, track = .06, anchor = 'middle', color = C.white, seed = 3, order: mode = 'scatter', outOrder = null, ghost = .3, stroke = false, lift = false} = {}) {
  str = String(str ?? ''); const chars = [...str], o = {font, weight, track: 0};
  const pre = chars.map((_, i) => bareW(chars.slice(0, i).join(''), o) * size / 100 + track * size * i);
  const w = measure(str, size, {font, weight, track}), x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  const root = (parent.root ?? parent).append('g');
  if (lift?.url) root.attr('filter', lift.url('lift'));
  const nodes = chars.map((ch, i) => root.append('text').attr('x', x0 + pre[i]).attr('y', y).style('font', fontCss(size, {font, weight})).attr('fill', color).attr('stroke', color).attr('stroke-width', 0).text(ch === ' ' ? ' ' : ch));
  const n = chars.length, rIn = order(n, seed, mode), rOut = order(n, seed + 17, outOrder ?? mode);
  /** state 0 hidden, 1 ghost, 2 solid; drop 0..1 moves the letter down as it leaves. */
  const set = (i, s, drop = 0) => {
    const nd = nodes[i];
    if (s <= 0) return nd.attr('opacity', 0);
    const solid = s >= 2;
    nd.attr('opacity', 1).attr('fill-opacity', solid ? 1 : ghost).attr('stroke-width', solid || !stroke ? 0 : Math.max(1, size * .012)).attr('stroke-opacity', .7)
      .attr('transform', drop ? `translate(0 ${(drop * size * .18).toFixed(1)})` : null);
  };
  const self = {nodes, root, w, cap: capH(size, {font, weight}), x0, str, set,
    /** at: first letter appears; step: s between letters; hold: ghost time; out: when the dropout starts. */
    seek(t, {at = 0, step = .055, hold = .09, out = null, outStep = null, drop = .12} = {}) {
      const os = outStep ?? step;
      for (let i = 0; i < n; i++) {
        const tin = at + rIn[i] * step, tout = out == null ? Infinity : out + rOut[i] * os;
        let s = t < tin ? 0 : t < tin + hold ? 1 : 2, dr = 0;
        if (t >= tout) { s = t < tout + hold ? 1 : 0; dr = clamp((t - tout) / hold) * drop / .12; }
        set(i, s, s === 1 && t >= tout ? dr : 0);
      }
      return self;
    },
    /** Seconds until every letter is solid / gone. */
    inLen: (step = .055, hold = .09) => (n - 1) * step + hold,
  };
  return self.seek(-1);
}

export function words(parent, lines, x, cy, size, o = {}, leading = 1.12) {
  const cap = capH(size, o), pitch = cap * (1 + (leading - 1) * 3.2) , top = cy - ((lines.length - 1) * pitch + cap) / 2;
  const rows = lines.map((l, i) => word(parent, l, x, top + cap + i * pitch, size, {...o, seed: (o.seed ?? 3) + i * 5}));
  return {rows, top, bottom: top + (lines.length - 1) * pitch + cap, pitch, cap,
    seek: (t, opts = {}, gap = .18) => rows.forEach((r, i) => r.seek(t, {...opts, at: (opts.at ?? 0) + i * gap, out: opts.out == null ? null : opts.out + i * gap * .5}))};
}

export function label(parent, x, y, str, {size = 26, anchor = 'start', weight = 600, track = .24, color = C.white, opacity = 1, font = F.sans, leading = 1.45, lift = false} = {}) {
  const node = (parent.root ?? parent).append('text').attr('x', x).attr('y', y).attr('fill', tone(color)).attr('text-anchor', anchor).attr('opacity', opacity)
    .style('font', fontCss(size, {font, weight})).style('letter-spacing', `${track}em`);
  if (lift?.url) node.attr('filter', lift.url('lift'));
  // text-anchor 'end'/'middle' with letter-spacing leaves a trailing gap; nudge by half/one track.
  const nudge = anchor === 'end' ? track * size : anchor === 'middle' ? track * size / 2 : 0;
  String(str ?? '').split('\n').forEach((line, i) => node.append('tspan').attr('x', x + nudge).attr('dy', i ? `${leading}em` : 0).text(line));
  return node;
}
export const mono = (parent, x, y, str, o = {}) => label(parent, x, y, str, {font: F.mono, weight: 700, track: .04, size: 26, ...o});

export function rule(parent, x0, y0, x1, y1, {width = 2, color = C.white} = {}) {
  const ln = (parent.root ?? parent).append('line').attr('stroke', tone(color)).attr('stroke-width', width).attr('stroke-linecap', 'butt');
  const self = {node: ln, range(a, b) { a = clamp(a); b = clamp(b); ln.attr('x1', mix(x0, x1, a)).attr('y1', mix(y0, y1, a)).attr('x2', mix(x0, x1, b)).attr('y2', mix(y0, y1, b)).attr('opacity', b - a > .001 ? 1 : 0); return self; }, draw(q) { return self.range(0, q); }};
  return self.draw(0);
}

// ---------------------------------------------------------------- footage helpers
export const presence = (t, life, fade = .12) => clamp(t / fade) * (life ? 1 - span(t, life - fade, fade) : 1);
export const leave = (t, life, len = .4) => life ? span(t, life - len, len) : 0;
export function faceAt(props, t) {
  if (props.locate) return props.locate(t + (props.at ?? 0));
  const track = props.track; if (!track?.length) return props.box ?? {x: .3, y: .3, w: .4, h: .22};
  let i = track.findIndex(s => s[0] > t); if (i < 0) i = track.length - 1;
  const a = track[Math.max(0, i - 1)], b = track[i], q = b[0] > a[0] ? clamp((t - a[0]) / (b[0] - a[0])) : 0;
  return {x: mix(a[1], b[1], q), y: mix(a[2], b[2], q), w: mix(a[3], b[3], q), h: mix(a[4], b[4], q)};
}
/** The small centred format tag at the foot of a title card. */
export function frameTag(parent, st, {text = '9:16', y = null} = {}) {
  return label(parent, st.W / 2, y ?? st.H - Math.max(46, st.H * .035), up(text), {size: 20 + 4 * st.k, anchor: 'middle', track: .3, color: st.fg, opacity: .75});
}
/** A charcoal veil over pictures so white type reads (a 0..1). */
export const veil = (st, parent, a = .3, color = C.ink) => (parent.root ?? parent).append('rect').attr('width', st.W).attr('height', st.H).attr('fill', color).attr('opacity', a);
/** Small labels in the corners of a title card ([tl, tr, bl, br]); returns seek(t, at, out): each types on in turn. */
export function corners(st, parent, labels = [], {size = null, inset = 64, color = null} = {}) {
  const {W, H} = st, s = size ?? 19 + 5 * st.k, top = inset + s;
  const nodes = (labels || []).slice(0, 4).map((l, i) => l ? label(parent, i % 2 ? W - inset : inset, i > 1 ? H - inset - (String(l).split('\n').length - 1) * s * 1.45 : top, up(l), {size: s, anchor: i % 2 ? 'end' : 'start', track: .26, color: color ?? st.fg, opacity: 0}) : null);
  return (t, at = .3, out = null) => nodes.forEach((n, i) => n?.attr('opacity', t >= at + i * STEP * .5 && (out == null || t < out + i * STEP * .25) ? .8 : 0));
}

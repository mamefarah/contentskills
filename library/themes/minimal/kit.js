// The Minimal theme's drawing kit. Every piece draws with it, so they all look like one product.
//
// The look: one hero object centred on a near-black canvas with a faint vignette (mode "dark") or a warm light
// grey (mode "light"); Apple-like product UI — rounded app-icon tiles with a soft coloured glow, white or graphite
// cards with soft shadows, pill chips, a pointer that clicks. Inter for everything, Instrument Serif italic for the
// accent word, JetBrains Mono for tiny subtitles. Motion: pops with a slight overshoot that de-blur as they land,
// numbers ticking, bars filling, glows breathing. The top ~380 px of the frame stays clear for the caption line.
//
// Pieces are HTML: a 1080x1920 root scaled to fit its host. seek(t) only sets styles from t (no timers, no
// randomness: hash() is seeded). The root carries class mn-dark / mn-light; the top-line caption style reads it.

export const W = 1080, H = 1920;
/** Where the hero object sits (frame px): centred, about 45% down, under the caption line. */
export const HERO = {x: 540, y: 880};
export const SAFE = {left: 70, top: 250, right: 1010, bottom: 1440};

export const C = {
  night: '#0b0b0c', graphite: '#161618', paper: '#ecebe8', white: '#ffffff', ink: '#111113',
  blue: '#3b5bdb', blueHi: '#7b96ff', green: '#22c55e', red: '#e5484d', orange: '#ff7a1a', amber: '#f5b83d', violet: '#8b5cf6',
};
/** Everything that changes between the dark and the light canvas. */
export const MODES = {
  dark: {
    bg: C.night, field: 'radial-gradient(120% 75% at 50% 44%, #1a1a1c 0%, #0e0e0f 48%, #060607 100%)',
    card: '#161618', raised: '#202023', line: 'rgba(255,255,255,.08)', ink: '#f5f5f4', text: '#d6d6da', dim: '#8e8e93', faint: '#3a3a3f',
    skeleton: 'rgba(255,255,255,.10)', shadow: '0 40px 100px rgba(0,0,0,.6), 0 8px 24px rgba(0,0,0,.35)', button: '#f5f5f4', buttonInk: '#111113',
    green: '#34d36b', red: '#ff5c61', blue: '#7b96ff',
    hue: {blue: C.blue, blueHi: C.blueHi, red: C.red, orange: C.orange, green: C.green, violet: C.violet, pink: '#ec4899'},
  },
  light: {
    bg: C.paper, field: 'radial-gradient(110% 70% at 50% 40%, #f7f6f3 0%, #ecebe8 55%, #e1e0dc 100%)',
    card: '#ffffff', raised: '#f3f2ef', line: 'rgba(0,0,0,.07)', ink: '#111113', text: '#2c2c30', dim: '#6b6b70', faint: '#d3d2ce',
    skeleton: 'rgba(0,0,0,.075)', shadow: '0 34px 80px rgba(40,32,20,.13), 0 6px 18px rgba(40,32,20,.07)', button: '#111113', buttonInk: '#ffffff',
    green: '#16a34a', red: '#d93036', blue: '#3b5bdb',
    hue: {blue: C.blue, blueHi: C.blueHi, red: C.red, orange: C.orange, green: C.green, violet: C.violet, pink: '#db2777'},
  },
  // Warm paper: an ivory field with a faint clay warmth, white cards with soft shadows, near-black ink and a clay-orange
  // accent (the Claude-like look). Strong contrast, so the graphics jump off the background.
  claude: {
    bg: '#f0eee6', field: 'radial-gradient(70% 45% at 15% 8%, rgba(217,119,87,.16) 0%, transparent 70%), radial-gradient(60% 40% at 95% 90%, rgba(204,120,92,.12) 0%, transparent 70%), radial-gradient(120% 80% at 50% 45%, #faf9f5 0%, #f0eee6 60%, #e8e5da 100%)',
    card: '#ffffff', raised: '#f5f3ec', line: 'rgba(20,20,19,.09)', ink: '#141413', text: '#3d3d3a', dim: '#73726c', faint: '#d8d5ca',
    skeleton: 'rgba(20,20,19,.08)', shadow: '0 30px 70px rgba(60,40,20,.14), 0 6px 18px rgba(60,40,20,.08)', button: '#d97757', buttonInk: '#ffffff',
    green: '#4f8a5b', red: '#c6523a', blue: '#5b84b1',
    hue: {blue: '#5b84b1', blueHi: '#6a9bcc', red: '#c6523a', orange: '#d97757', green: '#4f8a5b', violet: '#8a6fb3', pink: '#c6523a'},
  },
  // Charcoal: the look of the best-performing faceless reels in viral-reels-analysis/ (the Claude app's dark mode):
  // near-black #1a1a18 field, ivory cards that pop off it, clay-orange accent, white captions.
  charcoal: {
    bg: '#1a1a18', field: 'radial-gradient(90% 60% at 50% 42%, #2b2a27 0%, #1f1e1c 45%, #151513 100%)',
    card: '#faf9f5', raised: '#f0eee6', line: 'rgba(20,20,19,.10)', ink: '#141413', text: '#2b2a27', dim: '#6e6c66', faint: 'rgba(255,255,255,.35)',
    skeleton: 'rgba(20,20,19,.10)', shadow: '0 40px 100px rgba(0,0,0,.55), 0 8px 24px rgba(0,0,0,.35)', button: '#d97757', buttonInk: '#ffffff',
    green: '#2f9e5b', red: '#e5484d', blue: '#3a6fd8',
    hue: {blue: '#3a6fd8', blueHi: '#5b8af0', red: '#e5484d', orange: '#d97757', green: '#2f9e5b', violet: '#8a63d2', pink: '#e5484d'},
    fieldInk: '#faf9f5', fieldDim: '#a8a6a0',
  },
  // Sky: a saturated periwinkle field, the complement of the clay-orange accent, so orange logos, buttons and stamps
  // jump off it; black ink stays readable on it and white cards separate cleanly.
  sky: {
    bg: '#7f9cf5', field: 'radial-gradient(75% 50% at 50% 40%, #d4defe 0%, #aabdfb 40%, #8aa5f6 72%, #6d8cee 100%)',
    card: '#ffffff', raised: '#eef2fd', line: 'rgba(20,24,60,.10)', ink: '#10132a', text: '#262a45', dim: '#3b4270', faint: 'rgba(255,255,255,.6)',
    skeleton: 'rgba(16,19,42,.10)', shadow: '0 34px 80px rgba(20,30,90,.30), 0 8px 20px rgba(20,30,90,.16)', button: '#d4592f', buttonInk: '#ffffff',
    green: '#1f8a4c', red: '#d02c1f', blue: '#2f55c9',
    hue: {blue: '#2f55c9', blueHi: '#3f6ae0', red: '#d02c1f', orange: '#e0652f', green: '#1f8a4c', violet: '#6b46c9', pink: '#d02c1f'},
  },
  // Clay: the warm Claude-like palette turned up for social feeds. A saturated clay-orange field (bright in the middle,
  // deeper at the edges) under crisp white cards and near-black ink, so every card and chip separates from the ground.
  clay: {
    bg: '#c9603e', field: 'radial-gradient(75% 50% at 50% 42%, #ef9a72 0%, #df7f57 38%, #c9603e 72%, #a94a2c 100%)',
    card: '#ffffff', raised: '#f6f2ea', line: 'rgba(20,20,19,.10)', ink: '#141413', text: '#2b2a27', dim: '#4a2a1c', faint: 'rgba(255,255,255,.45)',
    skeleton: 'rgba(20,20,19,.10)', shadow: '0 34px 80px rgba(80,25,5,.35), 0 8px 20px rgba(80,25,5,.2)', button: '#141413', buttonInk: '#ffffff',
    green: '#2f7d45', red: '#b42318', blue: '#3a62a8',
    hue: {blue: '#3a62a8', blueHi: '#4f7cc9', red: '#b42318', orange: '#d4592f', green: '#2f7d45', violet: '#6b4fa8', pink: '#b42318'},
  },
  // Blacklight: a UV-lit room. Deep violet field with purple, blue and magenta glow; glassy violet cards with a neon
  // edge; fluorescent green, hot pink, electric cyan and orange that glow.
  uv: {
    bg: '#07041a', field: 'radial-gradient(70% 45% at 18% 12%, rgba(124,58,237,.55) 0%, transparent 70%), radial-gradient(60% 40% at 92% 38%, rgba(37,99,235,.42) 0%, transparent 70%), radial-gradient(75% 45% at 40% 100%, rgba(219,39,119,.38) 0%, transparent 70%), radial-gradient(120% 80% at 50% 50%, #140a3a 0%, #0a0624 60%, #05031a 100%)',
    card: 'rgba(30,18,78,.82)', raised: 'rgba(52,34,120,.85)', line: 'rgba(170,130,255,.38)', ink: '#f6f1ff', text: '#ddd3ff', dim: '#a99be6', faint: '#4b3a9e',
    skeleton: 'rgba(190,160,255,.18)', shadow: '0 0 0 1px rgba(160,110,255,.28), 0 0 70px rgba(124,58,237,.45), 0 40px 100px rgba(0,0,0,.6)', button: '#3dffa8', buttonInk: '#0a0620',
    green: '#3dffa8', red: '#ff3d9a', blue: '#4de3ff',
    hue: {blue: '#4d7dff', blueHi: '#4de3ff', red: '#ff3d9a', orange: '#ff9a3d', green: '#3dffa8', violet: '#b06bff', pink: '#ff4fd8'},
  },
};
export const F = {sans: 'Inter', serif: '"Instrument Serif Italic"', mono: '"JetBrains Mono"', tight: '"Inter Tight"'};

// ---------------------------------------------------------------- timing
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const mix = (a, b, q) => a + (b - a) * q;
export const span = (t, at, d) => d > 0 ? clamp((t - at) / d) : t >= at ? 1 : 0;
export const ease = x => 1 - Math.pow(1 - clamp(x), 3);
export const expo = x => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
export const io = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
/** Ease out with a slight overshoot (the theme's pop). */
export const back = (x, c = 1.5) => { x = clamp(x); const y = x - 1; return 1 + (c + 1) * y * y * y + c * y * y; };
export const hash = (n, seed = 0) => { const x = Math.sin(n * 127.1 + seed * 311.7 + 74.7) * 43758.5453; return x - Math.floor(x); };
/** 0..1 breathing, for glows. */
export const breathe = (t, period = 2.2) => .5 - .5 * Math.cos(2 * Math.PI * t / period);

/** A pop at time `at`: opacity, scale (from `from`, with a slight overshoot), a little rise and a de-blur. */
export function pop(t, at, {d = .45, from = .86, rise = 26, blur = 12} = {}) {
  const q = span(t, at, d);
  return {q, on: t >= at, o: clamp(q * 3.2), s: mix(from, 1, back(q)), y: (1 - ease(q)) * rise, blur: (1 - ease(q * 1.5)) * blur};
}
/** Style for a pop; `base` is a transform to keep (e.g. the element's own centring). */
export const popStyle = (P, base = '') => ({opacity: P.o, transform: `${base} translateY(${P.y.toFixed(1)}px) scale(${P.s.toFixed(4)})`, filter: P.blur > .3 ? `blur(${P.blur.toFixed(1)}px)` : 'none'});
/** Leaving at `at`: fade + slight blur (soft blur out). */
export function fadeOut(t, at, d = .3) { if (at == null) return {o: 1, blur: 0}; const q = span(t, at, d); return {o: 1 - q, blur: q * 10}; }

// ---------------------------------------------------------------- text
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
export const comma = (n, decimals = 0) => Number(n).toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
const ctx = document.createElement('canvas').getContext('2d');
export function measure(str, size, {font = F.sans, weight = 600, track = 0} = {}) {
  ctx.font = `${weight} ${size}px ${font}`; return ctx.measureText(String(str ?? '')).width + track * size * Math.max(0, [...String(str ?? '')].length - 1);
}
/** The biggest size (<= max) at which `str` fits `width`. */
export const fitSize = (str, width, max, o = {}) => Math.min(max, max * width / Math.max(1, measure(str, max, o)));

// ---------------------------------------------------------------- DOM
const UNITLESS = new Set(['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flex', 'flexGrow', 'order', 'scale']);
const px = css => Object.fromEntries(Object.entries(css).map(([k, v]) => [k, typeof v === 'number' && !UNITLESS.has(k) ? v + 'px' : v]));
/** A div in `parent` with classes, inline styles (numbers are px) and optional inner HTML. */
export function h(parent, cls = '', css = {}, html = null) {
  const n = document.createElement('div'); if (cls) n.className = cls; Object.assign(n.style, px(css)); if (html != null) n.innerHTML = html; parent?.append(n); return n;
}
const last = new WeakMap();
/** Set styles, touching the DOM only when a value changed. */
export function set(node, css) {
  const prev = last.get(node) ?? {}; last.set(node, prev);
  for (const [k, v] of Object.entries(px(css))) if (prev[k] !== v) { node.style[k] = v; prev[k] = v; }
}

const CSS = `
.mn{position:absolute;left:50%;top:50%;width:${W}px;height:${H}px;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow:visible;transform-origin:50% 50%}
.mn *{box-sizing:border-box}
.mn .a{position:absolute}
.mn .c{position:absolute;transform:translate(-50%,-50%)}
.mn .mn-card{border-radius:30px;border:1.5px solid var(--line);background:var(--card);box-shadow:var(--shadow)}
.mn .mn-chip{display:inline-flex;align-items:center;gap:12px;height:50px;padding:0 22px;border-radius:999px;font:700 25px/1 Inter;letter-spacing:.05em;white-space:nowrap}
.mn .mn-chip i{display:block;width:12px;height:12px;border-radius:50%;background:currentColor}
.mn .mn-chip.green{color:var(--green);background:color-mix(in srgb,var(--green) 15%,transparent)}
.mn .mn-chip.red{color:var(--red);background:color-mix(in srgb,var(--red) 15%,transparent)}
.mn .mn-chip.blue{color:var(--blue);background:color-mix(in srgb,var(--blue) 16%,transparent)}
.mn .mn-chip.plain{color:var(--ink);background:var(--raised);border:1.5px solid var(--line)}
.mn .mono{font-family:"JetBrains Mono",monospace;font-weight:500}
.mn .serif{font-family:"Instrument Serif Italic",serif;font-weight:400;font-style:normal}
.mn .skel{border-radius:8px;background:var(--skeleton)}
.mn .one{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mn-clay .mn-chip,.mn-sky .mn-chip,.mn-charcoal .mn-chip{background:#fff!important;box-shadow:0 6px 18px rgba(20,30,90,.2)}
.mn-clay .mn-chip.plain,.mn-sky .mn-chip.plain,.mn-charcoal .mn-chip.plain{border-color:transparent}
.mn-uv .mn-card{backdrop-filter:blur(6px)}
.mn-uv .mn-chip{box-shadow:0 0 22px color-mix(in srgb,currentColor 38%,transparent);text-shadow:0 0 12px color-mix(in srgb,currentColor 70%,transparent)}
.mn-uv .mn-chip.plain{text-shadow:none;box-shadow:0 0 18px rgba(160,110,255,.3)}
.mn-uv{text-shadow:0 0 18px rgba(190,150,255,.35)}
`;
function injectCss() { if (!document.getElementById('mn-kit')) { const s = document.createElement('style'); s.id = 'mn-kit'; s.textContent = CSS; document.head.append(s); } }

/**
 * The canvas every piece draws on: the host gets the dark or light field, and a 1080x1920 root scaled to fit it.
 * Returns {root, M, mode}. `clear`: no field (to float over something else).
 */
export function scene(el, {mode = 'dark', clear = false, width = W, height = H, ambient: ambientOn = true} = {}) {
  injectCss();
  mode = MODES[mode] ? mode : 'dark';
  // fieldInk / fieldDim: text drawn straight on the background (not on a card). Same as ink / dim unless the mode's
  // cards and field are opposite (charcoal: ivory cards on a near-black field).
  const M = {fieldInk: MODES[mode].ink, fieldDim: MODES[mode].dim, ...MODES[mode]};
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.style.overflow = 'hidden';
  el.style.background = clear ? 'transparent' : `${M.field}, ${M.bg}`;
  const root = h(el, `mn mn-${mode}`, {width, height});
  for (const [k, v] of Object.entries({'--card': M.card, '--raised': M.raised, '--line': M.line, '--ink': M.ink, '--text': M.text, '--dim': M.dim, '--skeleton': M.skeleton, '--shadow': M.shadow, '--green': M.green, '--red': M.red, '--blue': M.blue})) root.style.setProperty(k, v);
  root.style.color = M.ink;
  // Ambient motion (dark modes): a drifting dot grid, rising sparks and two slow light blobs behind everything, so no
  // frame is ever static. Driven by the playhead: the player
  // calls el.__ambient(t) next to the piece's own seek, so renders stay frame-exact. `ambient: false` turns it off.
  if (!clear && ambientOn && ['charcoal', 'dark', 'uv'].includes(mode)) el.__ambient = ambient(root, M);
  const fit = () => { const k = Math.min((el.clientWidth || width) / width, (el.clientHeight || height) / height); root.style.transform = `translate(-50%,-50%) scale(${k})`; };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(el);
  el.__dispose = () => ro.disconnect();
  return {root, M, mode};
}

function ambient(root, M) {
  const layer = h(root, 'a', {inset: 0, pointerEvents: 'none', zIndex: 0});
  root.prepend(layer);
  const grid = h(layer, 'a', {left: -60, top: -60, width: W + 120, height: H + 180, opacity: .55,
    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.10) 1.6px, transparent 2.2px)', backgroundSize: '60px 60px'});
  const blobs = [[M.hue.orange, .16, 900], [M.hue.blue, .10, 1000]].map(([c, a, d]) =>
    h(layer, 'c', {left: 0, top: 0, width: d, height: d, borderRadius: '50%', background: `radial-gradient(circle, ${c} 0%, transparent 62%)`, opacity: a}));
  const sparks = Array.from({length: 26}, (_, i) => ({i, x: hash(i, 11) * W, sp: 60 + hash(i, 12) * 140, ph: hash(i, 13) * H, s: 3 + hash(i, 14) * 5,
    n: h(layer, 'c', {left: 0, top: 0, width: 8, height: 8, borderRadius: '50%', background: i % 4 ? '#ffffff' : M.hue.orange})}));
  return t => {
    set(grid, {transform: `translateY(${-(t * 24) % 60}px)`});
    blobs.forEach((b, k) => set(b, {left: W / 2 + Math.cos(t * .35 + k * 3) * 300, top: H * .45 + Math.sin(t * .27 + k * 2) * 420}));
    for (const p of sparks) {
      const y = H + 40 - ((p.ph + t * p.sp) % (H + 80));
      set(p.n, {left: p.x + Math.sin(t * 1.3 + p.i) * 18, top: y, width: p.s, height: p.s, opacity: .25 + .5 * (.5 + .5 * Math.sin(t * 4 + p.i * 1.7))});
    }
  };
}

/** A rounded card (graphite in dark mode, white in light) at x, y (top-left), w x h. */
export const card = (parent, x, y, w, hgt, css = {}) => h(parent, 'a mn-card', {left: x, top: y, width: w, height: hgt, ...css});
/** A pill chip: tone green | red | blue | plain; `dot` adds a status dot. */
export const chip = (parent, text, tone = 'green', {dot = true, css = {}} = {}) => h(parent, `mn-chip ${tone}`, css, `${dot ? '<i></i>' : ''}${esc(text)}`);
/** A soft round glow (centre x, y; diameter d). */
export const glow = (parent, x, y, d, color, css = {}) => h(parent, 'c', {left: x, top: y, width: d, height: d, borderRadius: '50%', background: `radial-gradient(circle, ${color} 0%, transparent 68%)`, filter: 'blur(18px)', ...css});
/** Placeholder text lines (grey bars) of seeded widths: a mini document with nothing readable invented. */
export function lines(parent, x, y, w, n, {gap = 26, height = 12, seed = 1, min = .55, last = .4} = {}) {
  const out = [];
  for (let i = 0; i < n; i++) { const f = i === n - 1 ? last + hash(i, seed) * .2 : min + hash(i, seed) * (1 - min); out.push(h(parent, 'a skel', {left: x, top: y + i * gap, width: w * f, height})); }
  return out;
}

// ---------------------------------------------------------------- things
/** A macOS-like pointer, tip at the element's top-left. */
export const CURSOR = `<svg viewBox="0 0 30 42" width="66" height="92" style="display:block;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))"><path d="M3 3 L3 33 L10.4 26.2 L15.6 38.4 L21 36 L15.8 24.2 L26 24.2 Z" fill="#fff" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
export const cursor = parent => h(parent, 'a', {width: 66, height: 92, transformOrigin: '6px 6px', zIndex: 20}, CURSOR);
/** Pointer position and press from a path: glide from `from` to `to` arriving at `at - .1`, press at `at`. */
export function pointer(t, at, from, to, {travel = .7} = {}) {
  const q = io(span(t, at - .1 - travel, travel)), press = span(t, at, .08) - span(t, at + .1, .12);
  return {x: mix(from[0], to[0], q), y: mix(from[1], to[1], q), s: 1 - .14 * press, o: clamp((t - (at - .1 - travel)) / .2), press};
}
/** A ring that spreads from a click. */
export const ripple = parent => h(parent, 'c', {width: 120, height: 120, borderRadius: '50%', border: '4px solid rgba(255,255,255,.9)', opacity: 0, zIndex: 19});
export const rippleStyle = (t, at, x, y, color = null) => { const q = span(t, at, .45); return {left: x, top: y, opacity: t < at ? 0 : (1 - q) * .8, transform: `translate(-50%,-50%) scale(${.3 + q * 1.1})`, ...(color ? {borderColor: color} : {})}; };

// An inked stamp: double rule, heavy capitals, a seeded mottled mask so it reads as ink, not a sticker.
const inkMask = seed => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='${seed}'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.62'/></filter><rect width='400' height='160' filter='url(#n)'/></svg>`)}")`;
export function stamp(parent, text, color = C.red, {size = 64, rotate = -11, seed = 3} = {}) {
  const s = h(parent, 'c', {color, background: `color-mix(in srgb, ${color} 14%, transparent)`, backdropFilter: 'blur(6px)', border: `${Math.round(size * .11)}px solid ${color}`, borderRadius: size * .22, padding: `${size * .16}px ${size * .34}px`, font: `900 ${size}px/1 Inter`, letterSpacing: '.08em', whiteSpace: 'nowrap', zIndex: 10,
    boxShadow: `inset 0 0 0 ${Math.round(size * .05)}px transparent, inset 0 0 0 ${Math.round(size * .09)}px ${color}33`, WebkitMaskImage: inkMask(seed), WebkitMaskSize: '400px 160px', textTransform: 'uppercase'}, esc(text));
  s.rotate = rotate; return s;
}
/** A stamp slamming down at `at`: falls from big and lands with a jolt. Returns styles. */
export function slamStyle(t, at, rotate = -11) {
  if (t < at) return {opacity: 0, transform: 'translate(-50%,-50%) scale(2)'};
  const q = span(t, at, .16), settle = span(t, at + .16, .25);
  const s = q < 1 ? mix(2.1, 1, q * q) : 1 + .05 * Math.sin(Math.PI * settle) * (1 - settle);
  return {opacity: clamp(q * 2.5), transform: `translate(-50%,-50%) rotate(${rotate}deg) scale(${s.toFixed(4)})`};
}
/** A jolt (px offset) for what a stamp hits. */
export const jolt = (t, at, amount = 12) => t < at + .14 ? 0 : amount * Math.exp(-(t - at - .14) * 14) * Math.sin((t - at - .14) * 60);

/** Images, decoded before the first seek so drawing stays synchronous. */
export const loadImage = src => new Promise(ok => { if (!src) return ok(null); const im = new Image(); im.onload = () => im.decode().then(() => ok(im), () => ok(im)); im.onerror = () => ok(null); im.src = src.startsWith('/') || /^(https?:|data:)/.test(src) ? src : '/' + src; });
export const url = src => !src ? '' : src.startsWith('/') || /^(https?:|data:)/.test(src) ? src : '/' + src;

/** A GitHub-like octocat mark as inline SVG (simple, drawn from primitives; no logo file). */
export const MARK_GITHUB = (size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="${color}"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;
/** Small line icons for rows and labels, drawn in currentColor. */
export const ICONS = {
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 7l7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  cross: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  doc: '<path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 7.5V5.5h6v2" fill="none" stroke="currentColor" stroke-width="2"/>',
  globe: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/>',
  bolt: '<path d="M13 3L5.5 13.5H11L10 21l8-11h-5.6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  user: '<circle cx="12" cy="8.5" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 20.5c1.2-4 4-5.6 7.5-5.6s6.3 1.6 7.5 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  ghost: '<path d="M5.5 20.5V11a6.5 6.5 0 0113 0v9.5l-2.2-1.6-2.1 1.6-2.2-1.6-2.2 1.6-2.1-1.6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="9.6" cy="11" r="1.2" fill="currentColor"/><circle cx="14.4" cy="11" r="1.2" fill="currentColor"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  search: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
};
export const icon = (name, size = 32, color = 'currentColor') => ICONS[name] ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="display:block;color:${color}">${ICONS[name]}</svg>` : '';
/** Content for a tile or row: an image path, an icon name ("icon:check"), or text / emoji / glyph. */
export function content(value, size, color) {
  const v = String(value ?? '');
  if (/\.(png|jpe?g|webp|svg|gif)$/i.test(v)) return `<img src="${esc(url(v))}" style="width:${size}px;height:${size}px;object-fit:contain;display:block">`;
  if (v.startsWith('icon:')) return icon(v.slice(5), size, color);
  if (v === 'github') return MARK_GITHUB(size, color);
  return `<span style="font:800 ${size * ([...v].length > 2 ? .42 : .8)}px/1 Inter;color:${color};letter-spacing:-.02em">${esc(v)}</span>`;
}

// ---------------------------------------------------------------- shorthands for pieces
/** Pop `node` in at `at` (keeping a base transform, e.g. 'translate(-50%,-50%)' for centred nodes). */
export const popIn = (node, t, at, base = '', o = {}) => set(node, popStyle(pop(t, at, o), base));
/** A number counting up from `from` to `to` between at and at + d (fast start, soft landing). */
export const tick = (t, at, d, to, from = 0) => from + (to - from) * expo(span(t, at, d));
/** A status ring that spins until `at`, for a row that is "working". */
export const SPIN = color => `<svg width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="13" fill="none" stroke="${color}" stroke-opacity=".2" stroke-width="4"/><path d="M17 4a13 13 0 0113 13" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/></svg>`;

/**
 * A small vertical video (a 9:16 card) of someone talking to camera that can be shown raw or edited.
 * clip(parent, {w, seed, caption}) -> {el, seek(t, edit)}: edit 0..1 goes from raw (grey, flat, no text) to edited
 * (colour graded, punched in, a caption with a highlighted word, a sticker and a tick). The mouth moves with t.
 */
const CLIP_BG = [['#ffb38a', '#e0603a'], ['#9ec5ff', '#3a6fd8'], ['#b9f0c9', '#2f9e5b'], ['#d9c2ff', '#8a63d2'], ['#ffe08a', '#e0a020'], ['#ffc2d6', '#d9467a']];
const CLIP_SKIN = ['#f2c9a8', '#e0ac85', '#c98e66', '#f6d7bd', '#a8714f', '#eebb98'], CLIP_SHIRT = ['#141413', '#faf9f5', '#3a6fd8', '#2f9e5b', '#8a63d2', '#d97757'];
export function clip(parent, {w = 260, seed = 0, caption = 'WATCH THIS', word = 1} = {}) {
  const hgt = w * 16 / 9, k = seed % CLIP_BG.length, [b1, b2] = CLIP_BG[k];
  const el = h(parent, 'a', {width: w, height: hgt, borderRadius: w * .09, overflow: 'hidden', background: '#2b2a27', boxShadow: '0 24px 50px rgba(0,0,0,.4)', border: '3px solid rgba(255,255,255,.85)'});
  const raw = h(el, 'a', {left: 0, top: 0, right: 0, bottom: 0, background: 'linear-gradient(180deg, #8d8d8d, #5a5a5a)'});
  const graded = h(el, 'a', {left: 0, top: 0, right: 0, bottom: 0, background: `linear-gradient(170deg, ${b1}, ${b2})`, opacity: 0});
  const fig = h(el, 'a', {left: 0, top: 0, width: w, height: hgt, transformOrigin: '50% 40%'});
  h(fig, 'a', {left: w * .1, bottom: -w * .12, width: w * .8, height: w * .62, borderRadius: `${w * .4}px ${w * .4}px 0 0`, background: CLIP_SHIRT[seed % CLIP_SHIRT.length]});
  const head = h(fig, 'a', {left: w * .29, top: hgt * .36, width: w * .42, height: w * .5, borderRadius: '50%', background: CLIP_SKIN[seed % CLIP_SKIN.length]});
  [-.09, .09].forEach(dx => h(head, 'a', {left: w * (.21 + dx) - w * .018, top: w * .22, width: w * .036, height: w * .044, borderRadius: '50%', background: '#2a1d18'}));
  const mouth = h(head, 'a', {left: w * .21 - w * .05, top: w * .34, width: w * .1, height: w * .02, borderRadius: w * .03, background: '#8a3b2e'});
  const words = String(caption).split(' ');
  const cap = h(el, 'a', {left: w * .06, right: w * .06, top: hgt * .14, textAlign: 'center', font: `900 ${Math.round(w * .11)}px/1.1 Inter`, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,.45)', letterSpacing: '-.01em'},
    words.map((x, i) => i === word ? `<span style="background:#d97757;border-radius:6px;padding:0 .12em">${esc(x)}</span>` : esc(x)).join(' '));
  const sticker = h(el, 'c', {left: w * .82, top: hgt * .58, width: w * .26, height: w * .26, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `${Math.round(w * .14)}px/1 Inter`, boxShadow: '0 6px 14px rgba(0,0,0,.3)'}, ['🔥', '✨', '💡', '⚡', '🎬', '✅'][seed % 6]);
  const tickBadge = h(el, 'a', {right: w * .05, bottom: w * .05, width: w * .2, height: w * .2, borderRadius: '50%', background: '#2f9e5b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `900 ${Math.round(w * .12)}px/1 Inter`}, '✓');
  const rawTag = h(el, 'a', {left: w * .06, top: w * .06, padding: `${w * .02}px ${w * .05}px`, borderRadius: 8, background: 'rgba(0,0,0,.45)', color: '#fff', font: `700 ${Math.round(w * .08)}px/1 "JetBrains Mono"`}, 'RAW');
  return {el, seek(t, e) {
    e = clamp(e);
    set(graded, {opacity: e}); set(raw, {opacity: 1 - e});
    set(fig, {transform: `scale(${(1 + .14 * ease(e)).toFixed(3)})`, filter: `saturate(${(.15 + .85 * e).toFixed(2)})`});
    set(mouth, {height: w * (.02 + .07 * Math.abs(Math.sin(t * 15 + seed) * Math.sin(t * 5.3 + seed * 2)))});
    const c = span(e, .35, .4), s = span(e, .55, .35), d = span(e, .8, .2);
    set(cap, {opacity: c, transform: `translateY(${((1 - ease(c)) * 20).toFixed(1)}px) scale(${(.8 + .2 * back(c)).toFixed(3)})`});
    set(sticker, {opacity: s, transform: `translate(-50%,-50%) rotate(${(-20 + 30 * ease(s)).toFixed(1)}deg) scale(${back(s).toFixed(3)})`});
    set(tickBadge, {opacity: d, transform: `scale(${back(d).toFixed(3)})`}); set(rawTag, {opacity: 1 - e});
  }};
}

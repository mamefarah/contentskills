// A style: the look of a video taken from a reel the user likes (npm run style from <reel>) or learnt from their
// review marks, laid over whatever theme the storyboard uses. Themes keep their pieces; a style only changes
// what they wear:
//   colors   {accent, accent2, accent3, ink, paper}      hex; swapped into the theme kit's colours
//   fonts    {display, text}                              families bundled in any theme's fonts/ (npm run style -- fonts)
//   captions {font, weight, size, case, color, highlight: {mode: color|pill|none, color}, future: show|dim|hide,
//             background: {mode: box|pill|none, color, opacity, radius}, words, tracking, shadow (true | 'strong')}
//   grade    {warmth, saturation, contrast, brightness, fade, grain, vignette}   -1..1 nudges, applied by the combiner
//   pace, prefs, notes                                    read by the agent when it writes a storyboard
//
// A storyboard names it with "style": "profile" (style/profile.json, their own), "<name>"
// (style/references/<name>/style.json) or an inline object. Everything here is pure: no timers, no randomness.
import {esc, bare, activeIndex, clamp} from './captions.js';

/** The style a storyboard asks for, or null. `getJson(path)` reads a file relative to the repository root (fetch in a page, fs in node). */
export async function resolveStyle(spec, getJson) {
  if (!spec) return null;
  if (typeof spec === 'object') return spec;
  const path = spec === 'profile' ? 'style/profile.json' : `style/references/${spec}/style.json`;
  const found = await getJson(path);
  if (!found) throw Error(`No such style: "${spec}" (looked for ${path}). Make one with npm run style -- from <reel>`);
  return found;
}

// ---------------------------------------------------------------- fonts from any theme
let fontIndex = null;
/** family -> {theme, file, weights} for every font bundled in a theme (browser only). */
export async function fonts() {
  return fontIndex ??= (async () => {
    const out = {}, themes = await (await fetch('/library/themes/index.json')).json();
    for (const theme of themes) {
      const r = await fetch(`/library/themes/${theme}/fonts/catalog.json`); if (!r.ok) continue;
      for (const f of (await r.json()).items ?? []) out[f.family] ??= {theme, ...f};
    }
    return out;
  })();
}
const declared = new Set();
/** Declare and load the style's fonts (display, text, captions), wherever they are bundled. */
export async function loadStyleFonts(style) {
  if (!style) return;
  document.documentElement.style.fontSynthesis = 'none';      // a single-weight face stays itself instead of a smeared fake bold
  const index = await fonts(), families = [style.fonts?.display, style.fonts?.text, style.captions?.font].filter(Boolean);
  for (const family of families) {
    const f = index[family]; if (!f) { console.warn(`Style font "${family}" is not bundled in any theme; the theme's own font is kept.`); continue; }
    if (!declared.has(family)) {
      declared.add(family); const tag = document.createElement('style');
      tag.textContent = `@font-face{font-family:"${family}";src:url("/library/themes/${f.theme}/fonts/${f.file}");font-weight:${f.file.includes('Variable') ? '100 900' : f.weight ?? 400};font-display:block}`;
      document.head.append(tag);
    }
    await document.fonts.load(`400 20px "${family}"`); await document.fonts.load(`800 20px "${family}"`);
  }
}

// ---------------------------------------------------------------- a theme kit wearing the style
const rgb = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => v / 255); };
const role = hex => {
  const c = rgb(hex); if (!c) return null;
  const max = Math.max(...c), min = Math.min(...c), sat = max ? (max - min) / max : 0, lum = .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  return sat > .35 && max > .25 ? 'accent' : lum < .3 ? 'ink' : lum > .75 ? 'paper' : null;
};
const TEXT_KEYS = /^(text|sans|body|sub|tall)$/, KEEP_KEYS = /^(mono|hand|type|script|italic|serif)$/;

/**
 * The old -> new swaps that dress a kit in the style: saturated colours become the style's accents in the order the
 * kit declares them (accent, accent2, accent3, then round again), dark neutrals its ink, light ones its paper;
 * display fonts become fonts.display, text fonts fonts.text. Monospace, handwriting and script faces are kept.
 */
export function swapsFor(kit, style) {
  const swaps = new Map(), accents = [style.colors?.accent, style.colors?.accent2, style.colors?.accent3].filter(Boolean);
  let a = 0;
  for (const [, value] of Object.entries(kit.C ?? {})) {
    if (typeof value !== 'string' || swaps.has(value.toLowerCase())) continue;
    const r = role(value), next = r === 'accent' && accents.length ? accents[a++ % accents.length] : r === 'ink' ? style.colors?.ink : r === 'paper' ? style.colors?.paper : null;
    if (next) swaps.set(value.toLowerCase(), next);
  }
  for (const [key, value] of Object.entries(kit.F ?? {})) {
    if (typeof value !== 'string' || KEEP_KEYS.test(key)) continue;
    const next = TEXT_KEYS.test(key) ? style.fonts?.text : style.fonts?.display, bare = value.replace(/"/g, '');
    // a family the kit uses for both display and text: a real change wins over keeping it (the first change wins)
    if (!next || next === bare || swaps.has(bare.toLowerCase())) continue;
    swaps.set(value.toLowerCase(), /\s/.test(next) ? `"${next}"` : next); swaps.set(bare.toLowerCase(), next);
  }
  return swaps;
}
/** Swap the style into every value the kit exports (and objects inside them, a few levels deep). Mutates the kit; once per kit. */
const dressed = new WeakMap();      // module namespaces cannot take a flag: remember dressed kits here
export function dressKit(kit, style) {
  if (!style || dressed.get(kit) === style) return; if (dressed.has(kit)) throw Error('A kit can wear only one style per page'); dressed.set(kit, style); const swaps = swapsFor(kit, style), seen = new Set();
  const walk = (obj, depth) => {
    if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > 3 || Object.isFrozen(obj)) return; seen.add(obj);
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') { const s = swaps.get(v.toLowerCase()); if (s) try { obj[k] = s; } catch {} }
      else if (v && typeof v === 'object' && !(v instanceof Node)) walk(v, depth + 1);
    }
  };
  for (const value of Object.values(kit)) walk(value, 0);
}

// ---------------------------------------------------------------- captions in the style
const fx = x => Math.round(x * 1000) / 1000;
const pop = (w, t, len) => clamp((t - w.start) / len);
/** The style's captions as a caption style (the same shape as a theme's captions/styles.js entries). */
export function captionStyle(c = {}, id = 'profile') {
  const font = c.font ?? 'Inter Tight', weight = c.weight ?? 700, size = c.size ?? 5.4, color = c.color ?? '#FFFFFF';
  const bg = c.background ?? {mode: 'none'}, hl = c.highlight ?? {mode: 'color', color: '#FFD84D'}, future = c.future ?? 'show';
  const box = bg.mode === 'none' ? '' : `background:${rgba(bg.color ?? '#000000', bg.opacity ?? .9)};padding:.14em .4em .2em;border-radius:${bg.mode === 'pill' ? '1em' : (bg.radius ?? .12) + 'em'};`;
  // shadow: true (a soft drop shadow) or 'strong' (a tight dark edge plus a soft glow: white words stay readable on a white wall)
  const shadow = c.shadow === 'strong' ? 'text-shadow:0 0 .045em rgba(0,0,0,.85),0 .03em .07em rgba(0,0,0,.75),0 .05em .3em rgba(0,0,0,.55);'
    : c.shadow ?? bg.mode === 'none' ? 'text-shadow:0 .04em .18em rgba(0,0,0,.55);' : '';
  const css = `.cap-${id}{bottom:13%;font:${weight} ${size}cqw/1.15 "${font}";color:${color};letter-spacing:${c.tracking ?? 0}em;${c.case === 'upper' ? 'text-transform:uppercase;' : c.case === 'lower' ? 'text-transform:lowercase;' : ''}${shadow}}
    .cap-${id}>span{display:inline-block;${box}}
    .cap-${id} b{font-weight:inherit;display:inline-block;${hl.mode === 'pill' ? `background:${hl.color};color:${hl.text ?? color};padding:0 .16em;border-radius:.3em;` : hl.mode === 'color' ? `color:${hl.color};` : ''}}
    .cap-${id} i{font-style:normal;display:inline-block}`;
  return {
    id, name: c.name ?? 'Profile captions', font, group: {maxWords: c.words ?? 3, maxChars: c.maxChars ?? 22},
    description: 'Captions in the style profile (style/profile.json or a reference style).', css,
    render: (p, t) => {
      const active = activeIndex(p, t), first = p.words[0], q = pop(first, t, .12);
      const words = p.words.map((w, i) => {
        const text = esc(bare(w.text)), on = i === active && hl.mode !== 'none';
        if (i > active && future === 'hide') return '';
        return on ? `<b>${text}</b>` : `<i${i > active && future === 'dim' ? ' style="opacity:.45"' : ''}>${text}</i>`;
      }).filter(Boolean).join(' ');
      return `<span style="opacity:${fx(Math.min(1, q * 2))};transform:translateY(${fx((1 - q) * .12)}em)">${words}</span>`;
    },
  };
}
function rgba(hex, a) { const c = rgb(hex) ?? [0, 0, 0]; return `rgba(${c.map(v => Math.round(v * 255)).join(',')},${a})`; }

/** How the style groups words into phrases (node side, for the render cache). */
export const captionGroup = c => ({maxWords: c?.words ?? 3, maxChars: c?.maxChars ?? 22});

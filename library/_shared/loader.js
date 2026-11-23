// Loads any library piece into an element and returns one uniform handle:
//   const piece = await loadPiece(el, 'd3/bar-chart', {title: 'My data'}, 'futuristic');
//   piece.seek(1.5);            // draw the piece exactly as it looks at 1.5 seconds
//   piece.duration, piece.loops
//   piece.dispose();            // free its resources (matters for 3D pieces) before removing el
// seek(t) is synchronous and depends only on t, which is what lets the dashboard,
// the rough-draft player and the renderer all share the same pieces.

// Which bundled library each category draws with (HUD overlays are SVG drawn with D3).
import {themePath, COMMON} from '/library/_shared/themes.js';
import {dressKit, loadStyleFonts} from '/library/_shared/style.js';
import {fillMe} from '/library/_shared/settings.js';
const vendor = {d3: 'd3-7.9.2.min.js', hud: 'd3-7.9.2.min.js', panels: 'd3-7.9.2.min.js', text: 'd3-7.9.2.min.js', overlays: 'd3-7.9.2.min.js', three: 'three-0.160.1.min.js', lottie: 'lottie-5.12.2.min.js'};
const global = {d3: 'd3', hud: 'd3', panels: 'd3', text: 'd3', overlays: 'd3', three: 'THREE', lottie: 'lottie'};
const scripts = {};
const script = src => scripts[src] ??= new Promise((ok, bad) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(Error('Could not load ' + src)); document.head.append(s);
});

const themes = {};
/** A theme's description (library/themes/<theme>/theme.json): its categories, fonts and colors. */
export const loadTheme = theme => themes[theme] ??= fetch(`/library/${themePath(theme)}/theme.json`).then(r => { if (!r.ok) throw Error(`No such theme: ${theme}`); return r.json(); });

const fonts = {};
/** Every font in a theme, declared and ready to draw with. Resolves with the font catalog items. */
export const loadThemeFonts = theme => fonts[theme] ??= (async () => {
  const catalog = await (await fetch(`/library/${themePath(theme)}/fonts/catalog.json`)).json();
  const tag = document.createElement('style');
  tag.textContent = catalog.items.map(f => `@font-face{font-family:"${f.family}";src:url("/library/${themePath(theme)}/fonts/${f.file}");font-weight:${f.file.includes('Variable') ? '100 900' : f.weights[0]};font-display:block}`).join('\n');
  document.head.append(tag);
  // Pieces measure text when they mount, so the fonts they draw with must be loaded first.
  const {pieceFonts = []} = await loadTheme(theme);
  await Promise.all(pieceFonts.map(font => document.fonts.load(font)));
  return catalog.items;
})();

export function parsePieceId(id) {
  const [category, name] = String(id || '').split('/');
  if (!/^[a-z0-9]+$/.test(category || '') || !/^[a-z0-9-]+$/.test(name || '')) throw Error(`Bad piece id "${id}". Expected <category>/<name>, e.g. d3/bar-chart`);
  return {category, name};
}

/** A theme's kit (kit.js, or hud.js for futuristic), dressed in `style` before any piece mounts (library/_shared/style.js). */
const kits = {};
async function styleKit(theme, style) {
  if (!style) return;
  const kit = await (kits[theme] ??= (async () => { for (const file of ['kit.js', 'hud.js']) { try { return await import(`/library/${themePath(theme)}/${file}`); } catch {} } return null; })());
  if (kit) dressKit(kit, style);
  await loadStyleFonts(style);
}

/** The theme's own piece, else the shared one (library/_shared/common). A theme piece that exists but fails to load still throws. */
async function importPiece(theme, category, name) {
  const own = `/library/${themePath(theme)}/${category}/pieces/${name}.js`;
  try { return await import(own); } catch (error) {
    if ((await fetch(own, {method: 'HEAD'})).ok) throw error;
    try { return await import(`/library/${COMMON}/${category}/pieces/${name}.js`); } catch { throw Error(`No such piece: ${category}/${name} (not in ${themePath(theme)} or ${COMMON})`); }
  }
}

/** What a shared piece draws with: the theme's `look` (theme.json), with a style's accents and fonts swapped in. */
async function lookOf(theme, style) {
  const look = {...LOOK, ...((await loadTheme(theme)).look ?? {})};
  if (style?.colors?.accent) look.accent = style.colors.accent;
  if (style?.colors?.accent2) look.accent2 = style.colors.accent2;
  if (style?.fonts?.display) look.head = style.fonts.display;
  if (style?.fonts?.text) look.body = style.fonts.text;
  return look;
}
const LOOK = {surface: '#2b2b2e', ink: '#f5f5f2', dim: '#9a9a9f', line: '#5d5d62', accent: '#ff5a1f', accent2: '#e8e5de',
  head: 'Montserrat', headWeight: 800, body: 'Inter Tight', mono: 'Space Mono', card: 'flat', radius: 28};

/** Mount a piece. `style` (optional) is a resolved style (library/_shared/style.js): the theme's colours and fonts swapped for it. */
export async function loadPiece(el, id, props, theme = 'modern', style = null) {
  const {category, name} = parsePieceId(id);
  if (vendor[category] && !window[global[category]]) await script('/library/_shared/vendor/' + vendor[category]);
  await loadThemeFonts(theme);
  await styleKit(theme, style);
  if (category === 'lottie') {
    const response = await fetch(`/library/${themePath(theme)}/lottie/animations/${name}.json`);
    if (!response.ok) throw Error(`No such piece: ${id}`);
    const data = await response.json(), frames = data.op - data.ip;
    const anim = window.lottie.loadAnimation({container: el, renderer: 'svg', loop: false, autoplay: false, animationData: data});
    return {duration: frames / data.fr, loops: Boolean(data.meta?.loop), meta: {}, background: data.meta?.background, dispose: () => anim.destroy(), seek: t => anim.goToAndStop(Math.max(0, Math.min(frames - .001, t * data.fr)), true)};
  }
  const module = await importPiece(theme, category, name);
  const defaults = fillMe(module.defaults);   // `{me.handle}` placeholders from the user's settings
  const handle = await module.mount(el, props ? {...defaults, ...props} : defaults, {look: await lookOf(theme, style), theme});
  return {duration: module.meta.duration, loops: Boolean(module.meta.loop), meta: module.meta, seek: handle.seek, dispose: () => el.__dispose?.()};
}


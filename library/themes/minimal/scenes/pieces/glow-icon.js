import {scene, h, set, esc, pop, popStyle, breathe, span, ease, expo, content, glow, stamp, slamStyle, jolt, fitSize, HERO, C} from '../../kit.js';

// A big rounded app-icon tile with a breathing coloured glow, centred under the caption line. The tile shows an
// image, a glyph / emoji / short text, "github" or "icon:<name>". Under it an optional label (a price, a name) that
// can be struck through at `strikeAt`, and an optional stamp that slams across it at `stampAt` ("REJECTED", "APPLY").
// Times are seconds from the start of the shot.
export const meta = {duration: 10};
export const defaults = {
  mode: 'dark', icon: '✳', iconColor: '#ffffff', tile: ['#ff9a3d', '#f05a14'], glow: 'rgba(255,122,26,.75)', size: 380,
  label: '$100/mo', labelSize: 96, sub: '', strikeAt: null, stamp: '', stampColor: 'red', stampAt: 1.2, popAt: 0,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const S = p.size, cx = HERO.x, cy = HERO.y - (p.label ? 70 : 0);
  const [top, bottom] = Array.isArray(p.tile) ? p.tile : [p.tile, p.tile];
  const halo = glow(root, cx, cy, S * 2.3, p.glow);
  const rays = h(root, 'c', {left: cx, top: cy, width: S * 1.9, height: S * 1.9, borderRadius: '50%', background: `repeating-conic-gradient(from 0deg, ${p.glow} 0deg 1.2deg, transparent 1.2deg 9deg)`, WebkitMaskImage: 'radial-gradient(circle, transparent 30%, #000 42%, transparent 70%)', opacity: .35, filter: 'blur(1.5px)'});
  const tile = h(root, 'c', {left: cx, top: cy, width: S, height: S, borderRadius: S * .235, background: `linear-gradient(160deg, ${top} 0%, ${bottom} 100%)`,
    boxShadow: `inset 0 3px 0 rgba(255,255,255,.35), inset 0 -6px 18px rgba(0,0,0,.18), 0 30px 70px rgba(0,0,0,.45)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  content(p.icon, S * .56, p.iconColor));
  h(tile, 'a', {left: 0, top: 0, right: 0, height: '50%', background: 'linear-gradient(180deg, rgba(255,255,255,.18), transparent)', pointerEvents: 'none'});
  const ly = cy + S / 2 + 110;
  const labelSize = p.label ? fitSize(p.label, 900, p.labelSize, {weight: 800}) : 0;
  const label = p.label ? h(root, 'c', {left: cx, top: ly, font: `800 ${labelSize}px/1.1 Inter`, letterSpacing: '-.02em', color: M.fieldInk, whiteSpace: 'nowrap'}, labelHtml(p.label)) : null;
  const strike = label ? h(label, 'a', {left: '-4%', top: '54%', height: Math.max(6, labelSize * .08), width: '0%', background: M.hue.red, borderRadius: 6, transform: 'rotate(-4deg)', transformOrigin: '0 50%', boxShadow: '0 0 18px rgba(229,72,77,.6)'}) : null;
  const sub = p.sub ? h(root, 'c', {left: cx, top: ly + labelSize * .5 + 60, font: '400 52px/1.1 "Instrument Serif Italic"', color: M.fieldDim, whiteSpace: 'nowrap'}, esc(p.sub)) : null;
  const tone = {red: M.hue.red, green: M.hue.green, blue: M.hue.blue}[p.stampColor] ?? p.stampColor;
  const st = p.stamp ? stamp(root, p.stamp, tone, {size: fitSize(p.stamp, 640, 92, {weight: 900, track: .08}), rotate: -10}) : null;
  if (st) set(st, {left: cx, top: cy + S * .12});
  return {
    seek(t) {
      const P = pop(t, p.popAt, {d: .55, from: .72, rise: 40, blur: 18}), b = breathe(t - p.popAt, 2.4), k = jolt(t, p.stampAt, 10);
      set(tile, popStyle(P, `translate(-50%,-50%) translateX(${k}px)`));
      set(halo, {opacity: P.o * (.65 + .35 * b), transform: `translate(-50%,-50%) scale(${(.85 + .15 * ease(P.q)) * (.94 + .08 * b)})`});
      set(rays, {opacity: P.o * (.22 + .18 * b), transform: `translate(-50%,-50%) rotate(${t * 6}deg) scale(${.9 + .1 * b})`});
      if (label) set(label, popStyle(pop(t, p.popAt + .25, {d: .45, from: .9}), 'translate(-50%,-50%)'));
      if (strike) set(strike, {width: p.strikeAt == null ? '0%' : `${108 * expo(span(t, p.strikeAt, .3))}%`, opacity: p.strikeAt != null && t >= p.strikeAt ? 1 : 0});
      if (label && p.strikeAt != null) set(label, {color: t >= p.strikeAt + .15 ? M.fieldDim : M.fieldInk});
      if (sub) set(sub, popStyle(pop(t, p.popAt + .45, {d: .5, from: .95}), 'translate(-50%,-50%)'));
      if (st) set(st, slamStyle(t, p.stampAt, -10));
    },
  };
}
/** "$100/mo": a trailing "/unit" is drawn small and dim, like a price. */
function labelHtml(s) {
  const m = String(s).match(/^(.*?)(\/\w+)$/);
  return m ? `${esc(m[1])}<span style="font-size:.42em;font-weight:600;opacity:.55;letter-spacing:0">${esc(m[2])}</span>` : esc(s);
}

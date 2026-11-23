import {scene, h, set, esc, pop, popStyle, span, ease, io, back, mix, clip, url, HERO} from '../../kit.js';

// One raw clip in the middle; at `splitAt` it duplicates: the raw copy slides left ("Before") and the edited copy slides
// right ("After"), a Claude-orange arrow between them, the edited one playing (captions, colour, sticker, tick).
// For "here's how I use it" / any before-and-after of an edit. With `raw` and `edited` (sprite strips of real clips,
// frames stacked top to bottom: see real-wall.js) the cards play the real footage instead of drawn people.
// Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {mode: 'dark', raw: '', edited: '', frames: 39, fps: 15, splitAt: .3, before: 'Before', after: 'After', caption: 'MY BEST TIP', popAt: 0};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const w = 380, hh = w * 16 / 9, cy = HERO.y - hh / 2 + 10;
  const real = src => { const el = h(root, 'a', {width: w, height: hh, borderRadius: w * .07, overflow: 'hidden', border: '3px solid rgba(255,255,255,.85)', boxShadow: '0 24px 50px rgba(0,0,0,.45)',
      backgroundImage: `url("${url(src)}")`, backgroundSize: `${w}px ${hh * p.frames}px`, backgroundRepeat: 'no-repeat'});
    return {el, seek(t, e) { set(el, {backgroundPosition: `0 ${-Math.max(0, Math.min(p.frames - 1, Math.floor(t * p.fps))) * hh}px`}); }}; };
  const A = p.raw ? real(p.raw) : clip(root, {w, seed: 1, caption: p.caption}), B = p.edited ? real(p.edited) : clip(root, {w, seed: 1, caption: p.caption});
  if (p.raw) set(A.el, {filter: 'saturate(.35) brightness(.85)'});
  const la = h(root, 'c', {top: cy + hh + 60, font: '700 46px/1 Inter', color: M.fieldDim}, esc(p.before));
  const lb = h(root, 'c', {top: cy + hh + 60, font: '800 46px/1 Inter', color: M.fieldInk}, esc(p.after));
  const arrow = h(root, 'c', {left: HERO.x, top: HERO.y, width: 110, height: 110, borderRadius: '50%', background: 'linear-gradient(160deg, #ff9a3d, #f05a14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 60px/1 Inter', boxShadow: '0 0 40px rgba(255,122,26,.7)', zIndex: 5}, '→');
  return {
    seek(t) {
      const P = pop(t, p.popAt, {d: .4, from: .85}), q = io(span(t, p.splitAt, .45)), dx = 225 * q;
      set(A.el, {left: HERO.x - w / 2 - dx, top: cy, opacity: P.o, transform: `scale(${(P.s * (1 - .06 * q)).toFixed(3)})`}); A.seek(t, 0);
      set(B.el, {left: HERO.x - w / 2 + dx, top: cy, opacity: q > 0 ? 1 : 0, zIndex: 2, transform: `rotate(${(4 * q).toFixed(1)}deg)`}); B.seek(t, span(t, p.splitAt + .1, .45));
      set(la, {left: HERO.x - 225, opacity: span(t, p.splitAt + .2, .25)}); set(lb, {left: HERO.x + 225, opacity: span(t, p.splitAt + .3, .25)});
      set(arrow, {opacity: span(t, p.splitAt + .15, .2), transform: `translate(-50%,-50%) scale(${back(span(t, p.splitAt + .15, .3)).toFixed(3)})`});
    },
  };
}

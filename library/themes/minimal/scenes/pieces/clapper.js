import {scene, h, set, esc, pop, popStyle, span, ease, back, breathe, glow, HERO} from '../../kit.js';

// A film clapperboard: the board fills in (ROLE, NAME), the striped clapstick lifts and snaps shut at `snapAt`
// with a flash, and a director's chair title lands under it. For "you're the director now". Times from shot start.
export const meta = {duration: 10};
export const defaults = {mode: 'dark', role: 'DIRECTOR', name: 'YOU', scene: 'SCENE 1', snapAt: .4, popAt: 0};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 760, x = HERO.x - W / 2, y = HERO.y - 200;
  const halo = glow(root, HERO.x, HERO.y, 1100, 'rgba(217,119,87,.45)');
  const board = h(root, 'a', {left: x, top: y, width: W, height: 520, borderRadius: 24, background: '#1d1d1b', border: '4px solid #faf9f5', padding: '50px 50px', boxShadow: '0 40px 90px rgba(0,0,0,.6)'});
  const row = (k, v, big) => h(board, '', {display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '3px solid rgba(250,249,245,.35)', padding: '18px 0', font: `600 34px/1 "JetBrains Mono"`, color: 'rgba(250,249,245,.7)'},
    `<span>${esc(k)}</span><b style="font:900 ${big ? 120 : 52}px/1 Inter;color:${big ? '#d97757' : '#faf9f5'};letter-spacing:-.02em">${esc(v)}</b>`);
  row('ROLE', p.role, false); const name = row('NAME', p.name, true); row('TAKE', p.scene, false);
  const stick = h(root, 'a', {left: x, top: y - 110, width: W, height: 100, borderRadius: 14, transformOrigin: '0% 100%', border: '4px solid #faf9f5',
    background: 'repeating-linear-gradient(-55deg, #faf9f5 0 50px, #1d1d1b 50px 100px)'});
  h(root, 'a', {left: x, top: y - 14, width: W, height: 24, background: 'repeating-linear-gradient(-55deg, #1d1d1b 0 50px, #faf9f5 50px 100px)', borderRadius: 4});
  const flash = h(root, 'a', {left: 0, top: 0, width: 1080, height: 1920, background: '#fff', opacity: 0, pointerEvents: 'none'});
  return {
    seek(t) {
      const P = pop(t, p.popAt, {d: .45, from: .85, rise: 50}); set(board, popStyle(P, ''));
      const lift = ease(span(t, p.popAt + .05, .25)), snap = span(t, p.snapAt, .09), ang = -28 * lift * (1 - snap);
      set(stick, {opacity: P.o, transform: `translateY(${P.y.toFixed(1)}px) rotate(${ang.toFixed(1)}deg)`});
      const k = t >= p.snapAt ? Math.exp(-(t - p.snapAt) * 10) : 0;
      set(flash, {opacity: (.5 * k).toFixed(3)}); set(halo, {opacity: .5 + .4 * breathe(t, 2) + .5 * k});
      set(name, {transform: `scale(${(1 + .12 * k).toFixed(3)})`, transformOrigin: '100% 50%'});
      set(board, {transform: `${popStyle(P, '').transform} translateY(${(14 * k).toFixed(1)}px)`});
    },
  };
}

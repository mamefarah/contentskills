import {scene, h, set, esc, pop, popStyle, span, ease, io, cursor, pointer, ripple, rippleStyle, HERO} from '../../kit.js';

// A video player card: a cursor taps the big play button at `playAt` (ripple), the button shrinks away and the
// picture starts cycling through coloured scene frames while the scrubber runs and the time counts up.
// For "watch it play". Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {mode: 'dark', title: 'Preview', playAt: .25, total: 42, popAt: 0, colors: ['#d97757', '#5b84b1', '#4f8a5b', '#8a6fb3', '#c6523a'], labels: ['Hook', 'Step 1', 'Step 2', 'Step 3', 'End']};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 640, H = 1000, x = HERO.x - W / 2, y = HERO.y - H / 2;
  const card = h(root, 'a mn-card', {left: x, top: y, width: W, height: H, padding: 22, borderRadius: 40});
  const pic = h(card, 'a', {left: 22, top: 22, right: 22, height: H - 170, borderRadius: 26, overflow: 'hidden', background: p.colors[0]});
  const lab = h(pic, 'c', {left: '50%', top: '50%', font: '800 72px/1 Inter', color: '#fff', letterSpacing: '-.02em'});
  const btn = h(card, 'c', {left: W / 2, top: (H - 170) / 2 + 22, width: 190, height: 190, borderRadius: '50%', background: 'rgba(255,255,255,.92)', boxShadow: '0 20px 50px rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center'},
    '<svg width="80" height="80" viewBox="0 0 24 24"><path d="M7 4 L20 12 L7 20 Z" fill="#141413"/></svg>');
  const bar = h(card, 'a', {left: 40, right: 40, bottom: 90, height: 12, borderRadius: 6, background: M.faint});
  const fill = h(bar, 'a', {left: 0, top: 0, bottom: 0, width: '0%', borderRadius: 6, background: M.hue.orange});
  const knob = h(bar, 'a', {top: -9, width: 30, height: 30, marginLeft: -15, borderRadius: '50%', background: M.hue.orange, boxShadow: '0 4px 10px rgba(0,0,0,.25)'});
  const time = h(card, 'a', {left: 40, bottom: 30, font: '600 32px/1 "JetBrains Mono"', color: M.dim});
  const cur = cursor(root), rip = ripple(root), bx = HERO.x, by = y + (H - 170) / 2 + 22;
  return {
    seek(t) {
      set(card, popStyle(pop(t, p.popAt, {d: .45, from: .88}), ''));
      const run = Math.max(0, t - p.playAt), k = Math.floor(run / .32) % p.colors.length, played = t >= p.playAt;
      set(pic, {background: played ? p.colors[k] : p.colors[0], filter: played ? 'none' : 'brightness(.7)'});
      lab.textContent = played ? p.labels[k % p.labels.length] : '';
      set(btn, {opacity: 1 - span(t, p.playAt + .05, .2), transform: `translate(-50%,-50%) scale(${(1 - .3 * ease(span(t, p.playAt, .2))).toFixed(3)})`});
      const q = Math.min(1, run / 6); set(fill, {width: `${(100 * q).toFixed(1)}%`}); set(knob, {left: `${(100 * q).toFixed(1)}%`});
      const s = Math.floor(q * p.total); time.textContent = `0:${String(s).padStart(2, '0')} / 0:${p.total}`;
      const P = pointer(t, p.playAt, [bx + 260, by + 420], [bx + 10, by + 10], {travel: .25});
      set(cur, {left: P.x, top: P.y, opacity: P.o * (1 - span(t, p.playAt + .3, .3)), transform: `scale(${P.s})`}); set(rip, rippleStyle(t, p.playAt, bx, by, M.hue.orange));
    },
  };
}

import {scene, h, set, esc, pop, popStyle, span, breathe, hash, chip, HERO} from '../../kit.js';

// A phone filming its user: a front-camera view with a simple head-and-shoulders figure, a pulsing REC dot and a
// running timer, and live voice bars under the figure that bounce with speech. A chip lands at `chipAt`.
// For "just talk to your phone". Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {mode: 'light', chipText: 'That\'s your input', chipAt: .6, popAt: 0, skin: '#f2c9a8', shirt: '#8a63d2'};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 520, H = 980, x = HERO.x - W / 2, y = HERO.y - H / 2 + 20;
  const phone = h(root, 'a', {left: x, top: y, width: W, height: H, borderRadius: 78, background: '#111', padding: 18, boxShadow: M.shadow});
  const screen = h(phone, 'a', {left: 18, top: 18, right: 18, bottom: 18, borderRadius: 62, overflow: 'hidden', background: 'linear-gradient(180deg, #cdd7f5, #e9d9f2)'});
  h(screen, 'a', {left: '50%', top: 22, width: 150, height: 40, marginLeft: -75, borderRadius: 30, background: '#000', zIndex: 3});
  const fig = h(screen, 'a', {left: 0, right: 0, bottom: 0, height: 640});
  h(fig, 'a', {left: '50%', bottom: -40, width: 440, height: 300, marginLeft: -220, borderRadius: '220px 220px 0 0', background: p.shirt});
  const head = h(fig, 'a', {left: '50%', top: 80, width: 230, height: 270, marginLeft: -115, borderRadius: '50%', background: p.skin});
  const mouth = h(head, 'a', {left: '50%', top: 185, width: 56, height: 10, marginLeft: -28, borderRadius: 20, background: '#8a3b2e'});
  [-50, 50].forEach(dx => h(head, 'a', {left: 115 + dx - 9, top: 120, width: 18, height: 22, borderRadius: '50%', background: '#2a1d18'}));
  const rec = h(screen, 'a', {left: 40, top: 90, display: 'flex', alignItems: 'center', gap: 12, font: '700 30px/1 "JetBrains Mono"', color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.4)'}, '<i style="display:block;width:20px;height:20px;border-radius:50%;background:#ff3b30"></i><span>00:00</span>');
  const bars = Array.from({length: 13}, (_, i) => h(screen, 'a', {left: 70 + i * 28, bottom: 60, width: 14, height: 20, borderRadius: 8, background: 'rgba(255,255,255,.92)', transformOrigin: '50% 100%'}));
  const c = chip(root, p.chipText, 'blue'); set(c, {position: 'absolute', left: HERO.x, top: y + H + 50, transform: 'translate(-50%,-50%)'});
  return {
    seek(t) {
      set(phone, popStyle(pop(t, p.popAt, {d: .5, from: .8, rise: 60}), ''));
      const talk = Math.abs(Math.sin(t * 17) * Math.sin(t * 6.3));
      set(mouth, {height: 8 + 30 * talk, top: 185 - 10 * talk});
      set(rec.firstChild, {opacity: .4 + .6 * breathe(t, .9)});
      rec.lastChild.textContent = `00:0${Math.min(9, Math.floor(t + 3))}`;
      bars.forEach((b, i) => set(b, {transform: `scaleY(${(1 + 5 * talk * (.4 + .6 * hash(i + Math.floor(t * 12)))).toFixed(2)})`}));
      set(c, popStyle(pop(t, p.chipAt, {d: .4}), 'translate(-50%,-50%)'));
    },
  };
}

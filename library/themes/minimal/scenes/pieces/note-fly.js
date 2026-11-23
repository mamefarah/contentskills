import {scene, h, set, esc, pop, popStyle, span, ease, io, mix, HERO} from '../../kit.js';

// A sticky note types itself out, then at `sendAt` it folds up into a paper plane that flies on an arc (with a dotted
// trail) to a scene card at the top, which flashes "Updated". For "just leave a note". Times from the shot start.
export const meta = {duration: 10};
export const defaults = {mode: 'dark', text: 'make the hook faster', typeAt: .1, typeFor: .8, sendAt: 1.4, target: 'Scene 1', done: 'Updated', popAt: 0};

const PLANE = '<svg viewBox="0 0 24 24" width="150" height="150"><path d="M2 11 L22 3 L15 21 L11 13 Z" fill="#faf9f5" stroke="#d97757" stroke-width="1.2" stroke-linejoin="round"/><path d="M11 13 L22 3" stroke="#d97757" stroke-width="1.2"/></svg>';

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const nx = HERO.x, ny = HERO.y + 170, tx = HERO.x + 170, ty = HERO.y - 330;
  const tcard = h(root, 'c mn-card', {left: tx, top: ty, width: 420, height: 250, padding: 24, borderRadius: 26});
  h(tcard, '', {height: 140, borderRadius: 16, background: 'linear-gradient(150deg, #d97757, #8a3b2e)'});
  h(tcard, '', {marginTop: 20, font: '700 34px/1 Inter', color: M.ink}, esc(p.target));
  const flag = h(root, 'c mn-chip green', {left: tx, top: ty - 170}, `<i></i>${esc(p.done)}`);
  const note = h(root, 'c', {left: nx, top: ny, width: 620, height: 460, padding: '50px 46px', background: '#ffe58a', borderRadius: 10, boxShadow: '0 30px 60px rgba(0,0,0,.45)', transformOrigin: '50% 50%',
    font: '600 64px/1.2 "Instrument Serif Italic"', color: '#3b2a10'});
  h(note, 'a', {left: '50%', top: -26, width: 180, height: 50, marginLeft: -90, background: 'rgba(255,255,255,.55)', transform: 'rotate(-3deg)'});
  const txt = h(note, '', {});
  const plane = h(root, 'c', {opacity: 0}, PLANE);
  const dots = Array.from({length: 14}, () => h(root, 'c', {width: 12, height: 12, borderRadius: '50%', background: M.hue.orange, opacity: 0}));
  const path = q => ({x: mix(nx, tx, q) + Math.sin(Math.PI * q) * -260, y: mix(ny, ty, q) - Math.sin(Math.PI * q) * 120});
  return {
    seek(t) {
      set(tcard, popStyle(pop(t, p.popAt, {d: .4, from: .9}), 'translate(-50%,-50%)'));
      const n = Math.round(p.text.length * span(t, p.typeAt, p.typeFor)); txt.innerHTML = esc(p.text.slice(0, n)) + (t < p.sendAt ? '<span style="opacity:.6">|</span>' : '');
      const fold = ease(span(t, p.sendAt, .22)), fly = io(span(t, p.sendAt + .15, .6));
      set(note, {...popStyle(pop(t, p.popAt + .05, {d: .45, from: .8}), `translate(-50%,-50%) rotate(${(-3 + 40 * fold).toFixed(1)}deg) scale(${(1 - .85 * fold).toFixed(3)})`), opacity: t < p.sendAt + .22 ? 1 : 0});
      const P = path(fly); set(plane, {left: P.x, top: P.y, opacity: t >= p.sendAt + .15 && fly < 1 ? 1 : 0, transform: `translate(-50%,-50%) rotate(${(-30 + 60 * fly).toFixed(1)}deg) scale(${(1 - .5 * fly).toFixed(3)})`});
      dots.forEach((d, i) => { const q = (i + 1) / (dots.length + 1), D = path(q); set(d, {left: D.x, top: D.y, opacity: fly > q ? .7 * (1 - span(t, p.sendAt + .9, .4)) : 0}); });
      const hit = p.sendAt + .75; set(tcard, {boxShadow: t >= hit ? `0 0 0 ${(6 * (1 - span(t, hit + .3, .5)) + 3).toFixed(1)}px #2f9e5b, ${M.shadow}` : M.shadow});
      set(flag, popStyle(pop(t, hit, {d: .35, from: .5}), 'translate(-50%,-50%)'));
    },
  };
}

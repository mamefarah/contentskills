import {scene, h, set, esc, popIn, pop, popStyle, cursor, pointer, ripple, rippleStyle, icon, span, ease, HERO, C} from '../../kit.js';

// A big input field: a pointer glides in and clicks it, a link is pasted in (blue selection flash, a ⌘V key chip),
// then a button under it pops and is pressed. Times are seconds from the start of the shot.
export const meta = {duration: 10};
export const defaults = {
  mode: 'light', placeholder: 'Paste a job link…', link: 'jobs.company.com/senior-ai-engineer', button: 'Evaluate',
  popAt: 0, clickAt: .45, pasteAt: .7, buttonAt: 1.1, pressAt: 1.6,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 920, H = 150, x = HERO.x - W / 2, y = HERO.y - 120;
  const field = h(root, 'a mn-card', {left: x, top: y, width: W, height: H, borderRadius: 40, display: 'flex', alignItems: 'center', gap: 24, padding: '0 40px'});
  h(field, '', {flex: 'none'}, icon('globe', 52, M.dim));
  const text = h(field, '', {flex: 1, font: '500 40px/1 Inter', color: M.dim, whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative'});
  const key = h(root, 'c', {left: x + W - 60, top: y - 30, font: '600 30px/1 Inter', padding: '14px 20px', borderRadius: 16, background: M.card, color: M.ink, border: `1.5px solid ${M.line}`, boxShadow: M.shadow}, '⌘V');
  const btn = h(root, 'c', {left: HERO.x, top: y + H + 130, height: 120, padding: '0 64px', borderRadius: 999, background: M.button, color: M.buttonInk, font: '700 44px/120px Inter', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 18},
    `${esc(p.button)} <span style="font-weight:500">→</span>`);
  const ptr = cursor(root), rip = ripple(root);
  rip.style.borderColor = M.hue.blue;
  const target1 = [x + 260, y + H / 2], target2 = [HERO.x + 40, y + H + 140];
  return {
    seek(t) {
      popIn(field, t, p.popAt, '', {d: .5, from: .9, rise: 40});
      const on = t >= p.clickAt + .05;
      set(field, {borderColor: on ? M.hue.blue : M.line, boxShadow: on ? `${M.shadow}, 0 0 0 6px rgba(59,91,219,.18)` : M.shadow});
      if (t < p.pasteAt) { text.innerHTML = esc(p.placeholder) + (on && Math.floor(t * 3) % 2 === 0 ? `<span style="display:inline-block;width:3px;height:44px;background:${M.hue.blue};vertical-align:middle;margin-left:4px"></span>` : ''); set(text, {color: M.dim}); }
      else {
        const sel = 1 - ease(span(t, p.pasteAt + .15, .35));
        text.innerHTML = `<span style="background:rgba(59,91,219,${(.28 * sel).toFixed(3)});border-radius:6px;padding:2px 0">${esc(p.link)}</span>`;
        set(text, {color: M.ink});
      }
      set(key, popStyle(pop(t, p.pasteAt - .08, {d: .3, from: .6}), 'translate(-50%,-50%)'));
      if (t > p.pasteAt + .6) set(key, {opacity: Math.max(0, 1 - (t - p.pasteAt - .6) / .2)});
      const press = t >= p.pressAt ? 1 - .06 * (span(t, p.pressAt, .08) - span(t, p.pressAt + .1, .12)) : 1;
      popIn(btn, t, p.buttonAt, 'translate(-50%,-50%)', {d: .45, from: .8});
      if (t >= p.buttonAt + .45) set(btn, {transform: `translate(-50%,-50%) scale(${press})`, background: t >= p.pressAt + .05 ? M.hue.blue : M.button, color: t >= p.pressAt + .05 ? '#fff' : M.buttonInk});
      const a = pointer(t, p.clickAt, [x + W + 80, y + 520], target1, {travel: .35});
      const b = pointer(t, p.pressAt, target1, target2, {travel: .4});
      const P = t < p.pressAt - .55 ? a : b;
      set(ptr, {left: P.x, top: P.y, opacity: P.o, transform: `scale(${P.s})`});
      set(rip, t < p.pressAt - .1 ? rippleStyle(t, p.clickAt, ...target1, M.hue.blue) : rippleStyle(t, p.pressAt, ...target2, M.hue.blue));
    },
  };
}

import {scene, h, set, esc, popIn, cursor, pointer, ripple, rippleStyle, icon, chip, span, ease, HERO, C} from '../../kit.js';

// An application form card, fields already filled (green checks), and a big Submit button. A glowing "AI" pointer
// glides toward the button and stops short at `blockAt` (a lock chip pops: it never submits); then a plain
// pointer labelled "You" comes in and clicks at `youAt`: ripple, the button turns green with a check.
// Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {
  mode: 'light', title: 'Application', fields: ['Full name', 'Resume (tailored)', 'Cover letter', 'Why this role?'], button: 'Submit',
  done: 'Submitted', lock: 'AI never submits', ai: 'AI', you: 'You', popAt: 0, fieldStep: .12, blockAt: .9, youAt: 1.8,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 860, x = HERO.x - W / 2, fh = 96, H = 150 + p.fields.length * (fh + 16) + 190, y = HERO.y - H / 2 - 20;
  const box = h(root, 'a mn-card', {left: x, top: y, width: W, height: H, padding: '40px 44px'});
  h(box, '', {font: '700 40px/1.1 Inter', color: M.ink}, esc(p.title));
  const fields = p.fields.map((f, i) => {
    const n = h(box, 'a', {left: 44, right: 44, top: 120 + i * (fh + 16), height: fh, borderRadius: 20, background: M.raised, border: `1.5px solid ${M.line}`, display: 'flex', alignItems: 'center', gap: 18, padding: '0 24px'});
    h(n, '', {flex: 1, font: '600 32px/1 Inter', color: M.text, whiteSpace: 'nowrap'}, esc(f));
    h(n, '', {width: 180, height: 12, borderRadius: 6, background: M.skeleton});
    h(n, '', {flex: 'none'}, icon('check', 40, M.green));
    return n;
  });
  const by = y + H - 120, bx = HERO.x;
  const btn = h(root, 'c', {left: bx, top: by, width: W - 88, height: 120, borderRadius: 28, background: M.button, color: M.buttonInk, font: '700 46px/120px Inter', textAlign: 'center', whiteSpace: 'nowrap'});
  const lock = chip(root, p.lock, 'red', {dot: false, css: {position: 'absolute', left: bx, top: by + 185, height: 66, fontSize: 28, letterSpacing: '.02em', gap: 12}});
  lock.innerHTML = icon('lock', 30) + esc(p.lock);
  const aiPtr = cursor(root), aiTag = h(aiPtr, 'a', {left: 50, top: 66, padding: '8px 16px', borderRadius: 12, background: 'linear-gradient(160deg,#ff9a3d,#f05a14)', color: '#fff', font: '800 26px/1 Inter', boxShadow: '0 0 30px rgba(255,122,26,.6)'}, esc(p.ai));
  const youPtr = cursor(root), youTag = h(youPtr, 'a', {left: 50, top: 66, padding: '8px 16px', borderRadius: 12, background: M.hue.blue, color: '#fff', font: '800 26px/1 Inter'}, esc(p.you));
  const rip = ripple(root);
  return {
    seek(t) {
      popIn(box, t, p.popAt, '', {d: .5, from: .92, rise: 40});
      fields.forEach((f, i) => popIn(f, t, p.popAt + .15 + i * p.fieldStep, '', {d: .35, from: .96, rise: 10}));
      const done = t >= p.youAt + .05;
      popIn(btn, t, p.popAt + .2, 'translate(-50%,-50%)', {d: .45, from: .9});
      btn.innerHTML = done ? `<span style="display:inline-flex;align-items:center;gap:16px">${icon('check', 48, '#fff')}${esc(p.done)}</span>` : esc(p.button);
      const press = 1 - .05 * (span(t, p.youAt, .08) - span(t, p.youAt + .1, .12));
      if (t >= p.popAt + .65) set(btn, {transform: `translate(-50%,-50%) scale(${press})`, background: done ? M.green : M.button, color: done ? '#fff' : M.buttonInk});
      // the AI pointer: glides in, stops short of the button, shakes "no" and drifts back
      const stop = [bx + 40, by - 150], a = pointer(t, p.blockAt, [x + W + 120, by - 520], stop, {travel: .55});
      const shake = t > p.blockAt ? 12 * Math.exp(-(t - p.blockAt) * 6) * Math.sin((t - p.blockAt) * 40) : 0, back = ease(span(t, p.youAt - .5, .4));
      set(aiPtr, {left: a.x + shake + back * 260, top: a.y - back * 120, opacity: a.o * (1 - back * .7), transform: 'scale(1)'});
      popIn(lock, t, p.blockAt + .05, 'translate(-50%,-50%)', {d: .35, from: .6});
      const yv = pointer(t, p.youAt, [x - 140, by + 380], [bx - 60, by + 10], {travel: .45});
      set(youPtr, {left: yv.x, top: yv.y, opacity: yv.o, transform: `scale(${yv.s})`});
      set(rip, rippleStyle(t, p.youAt, bx - 60, by + 10, M.green));
    },
  };
}

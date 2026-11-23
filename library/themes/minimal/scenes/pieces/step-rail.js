import {scene, h, set, esc, pop, popStyle, span, expo, jolt, stamp, slamStyle, HERO} from '../../kit.js';

// A numbered checklist of steps that builds down the screen one row per spoken beat; at `tagAt` one row (`tagIndex`)
// lights up and a stamp slaps across it ("SKIPPED"), the row shaking on impact while the others dim. For "there are N
// steps and one of them is the one people miss". Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {
  mode: 'dark', title: '5 steps', steps: [{label: 'Install it', at: .1}, {label: 'Tell it', at: .3}, {label: 'It plans', at: .5}, {label: 'Preview it', at: .7}, {label: 'Make it', at: .9}],
  tagIndex: 3, tag: 'SKIPPED', tagAt: null, popAt: 0,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 860, rowH = 128, gap = 20, n = p.steps.length, H = 120 + n * (rowH + gap), x = HERO.x - W / 2, y = HERO.y - H / 2 + 30;
  const title = h(root, 'a', {left: x + 8, top: y, font: '800 64px/1 Inter', letterSpacing: '-.02em', color: M.fieldInk}, esc(p.title));
  const rows = p.steps.map((s, i) => {
    const r = h(root, 'a mn-card', {left: x, top: y + 110 + i * (rowH + gap), width: W, height: rowH, display: 'flex', alignItems: 'center', gap: 34, padding: '0 40px', borderRadius: 26});
    const num = h(r, '', {width: 72, height: 72, borderRadius: 20, background: M.raised, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 38px/1 Inter', color: M.ink, flex: 'none'}, String(i + 1));
    h(r, '', {font: '700 46px/1 Inter', color: M.ink, letterSpacing: '-.01em'}, esc(s.label));
    return {r, num, at: s.at};
  });
  const target = rows[p.tagIndex];
  const st = p.tagAt != null && target ? stamp(root, p.tag, M.hue.red, {size: 76, rotate: -8}) : null;
  if (st) set(st, {left: x + W - 230, top: y + 110 + p.tagIndex * (rowH + gap) + rowH / 2});
  return {
    seek(t) {
      set(title, popStyle(pop(t, p.popAt, {d: .4}), ''));
      const hit = p.tagAt != null && t >= p.tagAt;
      rows.forEach(({r, num, at}, i) => {
        const P = pop(t, at, {d: .4, from: .9, rise: 30});
        const focus = hit && r === target?.r, k = focus ? jolt(t, p.tagAt, 14) : 0;
        set(r, {...popStyle(P, `translateX(${k.toFixed(1)}px)`), opacity: P.o * (hit && !focus ? .45 : 1),
          boxShadow: focus ? `0 0 0 4px ${M.hue.red}, 0 30px 70px rgba(0,0,0,.4)` : ''});
        set(num, {background: focus ? M.hue.red : M.raised, color: focus ? '#fff' : M.ink});
      });
      if (st) set(st, slamStyle(t, p.tagAt, -8));
    },
  };
}

import {scene, h, set, esc, pop, popStyle, span, ease, io, mix, breathe, HERO} from '../../kit.js';

// A phone frame showing a talking person with a big caption sitting across their face. At `scanAt` cyan corner
// brackets lock onto the face (a scan line sweeps); at `moveAt` the caption slides off the face to the top and turns
// from red-outlined to green; checklist rows tick on below. For "it checks no text covers your face".
export const meta = {duration: 10};
export const defaults = {mode: 'dark', caption: 'BIG WORDS', scanAt: .3, moveAt: 1, rows: [{label: 'Face found', at: .6}, {label: 'Text off face', at: 1.2}], skin: '#f2c9a8', shirt: '#3a6fd8', popAt: 0};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 520, H = 860, x = HERO.x - W / 2, y = HERO.y - H / 2 - 60;
  const phone = h(root, 'a', {left: x, top: y, width: W, height: H, borderRadius: 70, background: '#0d0d0d', padding: 16, boxShadow: M.shadow, border: '2px solid rgba(255,255,255,.12)'});
  const scr = h(phone, 'a', {left: 16, top: 16, right: 16, bottom: 16, borderRadius: 56, overflow: 'hidden', background: 'linear-gradient(180deg, #2d3442, #1b1f27)'});
  h(scr, 'a', {left: '50%', bottom: -40, width: 400, height: 280, marginLeft: -200, borderRadius: '200px 200px 0 0', background: p.shirt});
  const fx = (W - 32) / 2, fy = 380;
  const head = h(scr, 'a', {left: fx - 110, top: fy - 135, width: 220, height: 260, borderRadius: '50%', background: p.skin});
  [-45, 45].forEach(dx => h(head, 'a', {left: 110 + dx - 9, top: 115, width: 18, height: 22, borderRadius: '50%', background: '#2a1d18'}));
  const mouth = h(head, 'a', {left: 82, top: 180, width: 56, height: 12, borderRadius: 20, background: '#8a3b2e'});
  const cap = h(scr, 'c', {left: fx, font: '900 66px/1 Inter', color: '#fff', padding: '10px 22px', borderRadius: 14, whiteSpace: 'nowrap', letterSpacing: '-.02em'}, esc(p.caption));
  const brackets = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => h(scr, 'a', {width: 60, height: 60, borderColor: '#4de3ff', borderStyle: 'solid', borderWidth: `${sy < 0 ? 7 : 0}px ${sx > 0 ? 7 : 0}px ${sy > 0 ? 7 : 0}px ${sx < 0 ? 7 : 0}px`, borderRadius: 8, filter: 'drop-shadow(0 0 10px #4de3ff)'}));
  const scan = h(scr, 'a', {left: 0, right: 0, height: 8, background: 'linear-gradient(90deg, transparent, #4de3ff, transparent)', boxShadow: '0 0 24px #4de3ff'});
  const rows = p.rows.map((r, i) => h(root, 'a', {left: HERO.x - 230, top: y + H + 40 + i * 76, display: 'flex', alignItems: 'center', gap: 18, font: '700 44px/1 Inter', color: M.fieldInk},
    `<span style="display:inline-flex;width:52px;height:52px;border-radius:50%;background:${M.hue.green};color:#fff;align-items:center;justify-content:center;font-size:32px">✓</span>${esc(r.label)}`));
  return {
    seek(t) {
      set(phone, popStyle(pop(t, p.popAt, {d: .5, from: .85, rise: 50}), ''));
      set(mouth, {height: 8 + 22 * Math.abs(Math.sin(t * 15) * Math.sin(t * 5.1))});
      const m = io(span(t, p.moveAt, .45)), moved = t >= p.moveAt;
      set(cap, {top: mix(fy - 10, 110, m), background: moved ? 'rgba(47,158,91,.85)' : 'rgba(229,72,77,.18)', boxShadow: `0 0 0 4px ${moved ? '#2f9e5b' : '#e5484d'}`, transform: `translate(-50%,-50%) scale(${mix(1, .8, m)})`});
      const lock = ease(span(t, p.scanAt, .35)), pad = mix(190, 0, lock);
      brackets.forEach((b, i) => { const sx = i % 2 ? 1 : -1, sy = i < 2 ? -1 : 1;
        set(b, {left: fx + sx * (120 + pad) - 30, top: fy + sy * (145 + pad) - 30, opacity: t >= p.scanAt ? lock * (.75 + .25 * breathe(t, .8)) : 0}); });
      const sq = span(t, p.scanAt, .7); set(scan, {top: mix(0, H - 40, sq), opacity: sq > 0 && sq < 1 ? 1 : 0});
      rows.forEach((r, i) => set(r, popStyle(pop(t, p.rows[i].at, {d: .35}), '')));
    },
  };
}

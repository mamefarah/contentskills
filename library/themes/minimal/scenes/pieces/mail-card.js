import {scene, h, set, esc, popIn, chip, stamp, slamStyle, jolt, icon, lines, glow, breathe, HERO, C} from '../../kit.js';

// An email card centred under the caption line: sender row, subject, a body sentence that pops in, placeholder
// lines, an optional chip ("Screened by AI") and a stamp that slams across it ("REJECTED").
// Times are seconds from the start of the shot.
export const meta = {duration: 10};
export const defaults = {
  mode: 'dark', from: 'Hiring Team', address: 'no-reply@careers', when: '2 min ago', subject: 'Update on your application',
  body: 'Unfortunately, we have decided to move forward with other candidates.',
  chip: 'Screened by AI', chipTone: 'blue', stamp: 'REJECTED', stampColor: 'red',
  popAt: 0, bodyAt: .5, chipAt: .9, stampAt: 1.4, glowColor: 'rgba(229,72,77,.35)',
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 880, H = 560, x = HERO.x - W / 2, y = HERO.y - H / 2 - 40;
  const halo = glow(root, HERO.x, HERO.y, 1100, p.glowColor);
  const box = h(root, 'a mn-card', {left: x, top: y, width: W, height: H, padding: '44px 50px'});
  h(box, '', {display: 'flex', alignItems: 'center', gap: 22},
    `<div style="width:84px;height:84px;border-radius:50%;background:${M.raised};border:1.5px solid ${M.line};display:flex;align-items:center;justify-content:center">${icon('briefcase', 42, M.dim)}</div>
     <div style="flex:1"><div style="font:700 36px/1.2 Inter;color:${M.ink}">${esc(p.from)}</div><div class="mono" style="font-size:24px;color:${M.dim};margin-top:6px">${esc(p.address)}</div></div>
     <div class="mono" style="font-size:22px;color:${M.dim}">${esc(p.when)}</div>`);
  h(box, '', {font: '700 42px/1.2 Inter', color: M.ink, marginTop: 40, letterSpacing: '-.01em'}, esc(p.subject));
  const body = h(box, '', {font: '500 34px/1.4 Inter', color: M.text, marginTop: 24});
  body.innerHTML = esc(p.body);
  const ph = h(box, '', {position: 'relative', height: 80, marginTop: 26});
  lines(ph, 0, 0, W - 100, 3, {gap: 26, height: 12, seed: 4});
  const tone = {red: M.hue.red, green: M.hue.green, blue: M.hue.blue}[p.stampColor] ?? p.stampColor;
  const ch = p.chip ? chip(root, p.chip, p.chipTone, {css: {position: 'absolute', left: x + W - 40, top: y - 26, transform: 'translate(-100%,0)', height: 60, fontSize: 26}}) : null;
  const st = p.stamp ? stamp(root, p.stamp, tone, {size: 110, rotate: -12, seed: 7}) : null;
  if (st) set(st, {left: HERO.x, top: y + H / 2 + 30});
  return {
    seek(t) {
      const k = jolt(t, p.stampAt, 14);
      popIn(box, t, p.popAt, `translateX(${k}px)`, {d: .5, from: .9, rise: 50});
      popIn(body, t, p.bodyAt, '', {d: .4, from: .97, rise: 14});
      if (ch) popIn(ch, t, p.chipAt, 'translate(-100%,0)', {d: .4, from: .7});
      if (st) set(st, slamStyle(t, p.stampAt, -12));
      set(halo, {opacity: t >= p.stampAt ? .6 + .4 * breathe(t, 2) : 0});
    },
  };
}

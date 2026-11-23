import {scene, h, set, esc, popIn, chip, icon, SPIN, HERO, C, expo, span} from '../../kit.js';

// A white (or graphite) card titled like a running job ("Posting check · running"), whose rows pop in one by one:
// an icon, a label, a spinner that turns into a status chip. An optional badge (a big icon in a circle, struck
// through) pops beside it at `badge.at`. Times are seconds from the start of the shot.
export const meta = {duration: 10};
export const defaults = {
  mode: 'light', title: 'Posting check', sub: 'career-ops · verify', status: 'running',
  rows: [{icon: 'globe', label: 'Posting still live', chip: 'OPEN', tone: 'green', at: .3}, {icon: 'search', label: 'Reposted listing?', chip: 'NO', tone: 'green', at: .8}],
  settle: .35, badge: {icon: 'ghost', strike: true, at: 1.4, label: 'ghost job'}, popAt: 0,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 900, rowH = 118, H = 170 + p.rows.length * rowH + 30, x = HERO.x - W / 2, y = HERO.y - H / 2 - (p.badge ? 120 : 0);
  const box = h(root, 'a mn-card', {left: x, top: y, width: W, height: H, padding: '40px 44px'});
  h(box, '', {display: 'flex', alignItems: 'center', gap: 20},
    `<div style="width:64px;height:64px;border-radius:16px;background:${M.hue.blue};display:flex;align-items:center;justify-content:center">${icon('check', 38, '#fff')}</div>
     <div style="flex:1"><div style="font:700 38px/1.1 Inter;color:${M.ink}">${esc(p.title)}</div><div class="mono" style="font-size:22px;color:${M.dim};margin-top:6px">${esc(p.sub)}</div></div>`
    + (p.status ? `<span class="mn-chip green" style="height:46px;font-size:20px"><i></i>${esc(p.status)}</span>` : ''));
  const rows = p.rows.map((r, i) => {
    const row = h(box, 'a', {left: 44, right: 44, top: 150 + i * rowH, height: rowH - 18, borderRadius: 22, background: M.raised, border: `1.5px solid ${M.line}`, display: 'flex', alignItems: 'center', gap: 22, padding: '0 26px'});
    h(row, '', {flex: 'none'}, icon(r.icon ?? 'check', 44, M.dim));
    h(row, '', {flex: 1, font: '600 36px/1.1 Inter', color: M.ink, whiteSpace: 'nowrap'}, esc(r.label));
    const spin = h(row, '', {flex: 'none', width: 34, height: 34}, SPIN(M.dim));
    const c = chip(row, r.chip, r.tone ?? 'green', {css: {position: 'absolute', right: 26, top: '50%', height: 54, fontSize: 24}});
    return {row, spin, c, at: r.at ?? .3 + i * .5};
  });
  let badge = null, strike = null, blabel = null, ghost = null;
  // badge.big: a huge floating ghost (with echo trails) instead of the small round badge; a red "no" sign slams over
  // it 0.35 s later, and 0.9 s later it bursts into wisps. The rows card lifts away to make room.
  if (p.badge?.big) {
    const S = 520, gx = HERO.x, gy = y + H + 330;
    const svg = fill => `<svg viewBox="0 0 100 110" width="100%" height="100%"><path d="M50 4C27 4 12 21 12 44v58l12-9 13 9 13-9 13 9 13-9 12 9V44C88 21 73 4 50 4z" fill="${fill}"/><ellipse cx="37" cy="45" rx="7" ry="10" fill="#141413"/><ellipse cx="63" cy="45" rx="7" ry="10" fill="#141413"/><ellipse cx="50" cy="70" rx="8" ry="10" fill="#141413"/></svg>`;
    const wrap = h(root, 'c', {left: gx, top: gy, width: S, height: S * 1.1, zIndex: 5});
    const echoes = [0, 1, 2].map(k => h(wrap, 'a', {inset: 0, opacity: .18 - k * .05, filter: 'blur(6px)'}, svg('#d97757')));
    const body = h(wrap, 'a', {inset: 0, filter: 'drop-shadow(0 30px 60px rgba(0,0,0,.5)) drop-shadow(0 0 40px rgba(255,255,255,.25))'}, svg('#faf9f5'));
    const no = h(root, 'c', {left: gx, top: gy, width: S * 1.25, height: S * 1.25, zIndex: 6, opacity: 0},
      `<svg viewBox="-60 -60 120 120" width="100%" height="100%"><circle r="52" fill="none" stroke="${M.hue.red}" stroke-width="9"/><line x1="-37" y1="-37" x2="37" y2="37" stroke="${M.hue.red}" stroke-width="9" stroke-linecap="round"/></svg>`);
    const wisps = Array.from({length: 16}, (_, i) => ({a: i / 16 * Math.PI * 2, d: 260 + (i % 3) * 90, n: h(root, 'c', {left: gx, top: gy, width: 46, height: 46, borderRadius: '50%', background: '#faf9f5', opacity: 0, zIndex: 4, filter: 'blur(3px)'})}));
    const label = p.badge.label ? h(root, 'c', {left: gx, top: gy + S * .72, zIndex: 7, font: '400 92px/1 "Instrument Serif Italic"', color: M.fieldInk ?? M.ink, whiteSpace: 'nowrap'}, esc(p.badge.label)) : null;
    ghost = {wrap, echoes, body, no, wisps, label, at: p.badge.at, S};
  } else if (p.badge) {
    const by = y + H + 190;
    badge = h(root, 'c', {left: HERO.x, top: by, width: 220, height: 220, borderRadius: '50%', background: M.card, border: `1.5px solid ${M.line}`, boxShadow: M.shadow, display: 'flex', alignItems: 'center', justifyContent: 'center'}, icon(p.badge.icon, 120, M.dim));
    if (p.badge.strike) strike = h(badge, 'a', {left: 20, top: 104, width: 180, height: 12, borderRadius: 6, background: M.hue.red, transform: 'rotate(-40deg)', transformOrigin: '50% 50%', boxShadow: '0 0 18px rgba(229,72,77,.5)'});
    if (p.badge.label) blabel = h(root, 'c', {left: HERO.x, top: by + 160, font: '400 54px/1 "Instrument Serif Italic"', color: M.dim, whiteSpace: 'nowrap'}, esc(p.badge.label));
  }
  return {
    seek(t) {
      popIn(box, t, p.popAt, '', {d: .5, from: .92, rise: 40});
      for (const r of rows) {
        popIn(r.row, t, r.at, '', {d: .4, from: .95, rise: 18});
        const done = t >= r.at + p.settle;
        set(r.spin, {opacity: done ? 0 : 1, transform: `rotate(${(t * 540) % 360}deg)`});
        popIn(r.c, t, r.at + p.settle, 'translateY(-50%)', {d: .35, from: .6, rise: 0});
      }
      if (ghost) {
        const g = ghost, a = g.at, burst = a + .9, q = span(t, a - .15, .45);
        if (t >= a - .3) set(box, {transform: `translateY(${-160 * expo(span(t, a - .3, .4))}px) scale(${1 - .15 * expo(span(t, a - .3, .4))})`});
        const bob = Math.sin(t * 5) * 26, sway = Math.sin(t * 3.1) * 7, gone = span(t, burst, .25);
        set(g.wrap, {opacity: t < a - .15 ? 0 : 1 - gone, transform: `translate(-50%,-50%) translateY(${(1 - expo(q)) * 500 + bob}px) rotate(${sway}deg) scale(${(.4 + .6 * expo(q)) * (1 + .06 * Math.sin(t * 9)) * (1 - .7 * gone)})`});
        g.echoes.forEach((e, k) => set(e, {transform: `translate(${Math.sin(t * 5 - k - 1) * 40}px, ${(k + 1) * 34}px)`}));
        set(g.no, {opacity: t >= a + .35 && t < burst + .4 ? 1 : 0, transform: `translate(-50%,-50%) scale(${t >= a + .35 ? 1 + 1.2 * Math.exp(-(t - a - .35) * 12) : 2}) rotate(${t * 6}deg)`});
        for (const w of g.wisps) { const k = expo(span(t, burst, .6)); set(w.n, {opacity: t >= burst ? .9 * (1 - k) : 0, transform: `translate(calc(-50% + ${Math.cos(w.a) * w.d * k}px), calc(-50% + ${Math.sin(w.a) * w.d * k}px)) scale(${1 + k})`}); }
        if (g.label) popIn(g.label, t, a + .35, 'translate(-50%,-50%)', {d: .35, from: .6});
      }
      if (badge) {
        popIn(badge, t, p.badge.at, 'translate(-50%,-50%)', {d: .45, from: .6});
        if (strike) set(strike, {transform: `rotate(-40deg) scaleX(${Math.min(1, Math.max(0, (t - p.badge.at - .25) / .18))})`});
        if (blabel) popIn(blabel, t, p.badge.at + .2, 'translate(-50%,-50%)');
      }
    },
  };
}

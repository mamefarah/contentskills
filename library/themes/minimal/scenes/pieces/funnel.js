import {scene, h, set, esc, popIn, tick, comma, stamp, slamStyle, span, expo, glow, breathe, HERO, C} from '../../kit.js';

// A results funnel: one row per stage, each popping in on its word with its number ticking up and a bar filling
// (width by square root, so 1 out of 740 still shows; the numbers are printed). The last row glows; an optional
// stamp ("HIRED") slams at the end. Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {
  mode: 'dark', title: 'The creator’s own search', rows: [{value: 740, label: 'listings evaluated', at: .2}, {value: 68, label: 'applied', at: .8}, {value: 12, label: 'interviews', at: 1.4}, {value: 1, label: 'offer', at: 2}],
  colors: ['#3b5bdb', '#5b6ff0', '#8b5cf6', '#22c55e'], stamp: 'HIRED', stampColor: 'green', stampAt: 2.6,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const max = Math.max(...p.rows.map(r => r.value)), W = 780, x = HERO.x - W / 2 - 10,   // inside the 9:16 safe zone (140..920), clear of the right-side app buttons
    rh = 190, top = HERO.y - (p.rows.length * rh) / 2 + 40;
  const title = h(root, 'c', {left: HERO.x, top: top - 90, font: '400 56px/1 "Instrument Serif Italic"', color: M.fieldDim, whiteSpace: 'nowrap'}, esc(p.title));
  const rows = p.rows.map((r, i) => {
    const color = r.color ?? p.colors[i % p.colors.length], y = top + i * rh;
    const n = h(root, 'a', {left: x, top: y, width: W, height: rh - 30});
    const num = h(n, 'a', {left: 0, top: 0, font: '800 96px/1 Inter', letterSpacing: '-.04em', color: M.fieldInk, fontVariantNumeric: 'tabular-nums'});
    h(n, 'a', {left: 0, top: 104, font: '500 30px/1 Inter', color: M.fieldDim, whiteSpace: 'nowrap'}, esc(r.label));
    const trackX = 310, tw = W - trackX;
    h(n, 'a', {left: trackX, top: 22, width: tw, height: 64, borderRadius: 18, background: M.skeleton});
    const bar = h(n, 'a', {left: trackX, top: 22, height: 64, borderRadius: 18, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 75%, #fff))`, boxShadow: `0 0 40px color-mix(in srgb, ${color} 45%, transparent)`});
    return {n, num, bar, r, w: Math.max(26, tw * Math.sqrt(r.value / max))};
  });
  const halo = glow(root, x + 160, top + (p.rows.length - 1) * rh + 60, 600, 'rgba(34,197,94,.35)');
  const tone = {red: M.hue.red, green: M.hue.green, blue: M.hue.blue}[p.stampColor] ?? p.stampColor;
  const st = p.stamp ? stamp(root, p.stamp, tone, {size: 120, rotate: -10, seed: 9}) : null;
  if (st) set(st, {left: HERO.x + 200, top: top + (p.rows.length - 1) * rh + 50});
  return {
    seek(t) {
      popIn(title, t, Math.max(0, (p.rows[0]?.at ?? 0) - .2), 'translate(-50%,-50%)');
      for (const row of rows) {
        popIn(row.n, t, row.r.at, '', {d: .4, from: .94, rise: 20});
        row.num.textContent = t < row.r.at ? '' : comma(Math.round(tick(t, row.r.at, .6, row.r.value)));
        set(row.bar, {width: row.w * expo(span(t, row.r.at + .05, .6))});
      }
      const lastAt = p.rows.at(-1)?.at ?? 0;
      set(halo, {opacity: t >= lastAt ? (.6 + .4 * breathe(t, 2)) * Math.min(1, (t - lastAt) * 3) : 0});
      if (st) set(st, slamStyle(t, p.stampAt, -10));
    },
  };
}

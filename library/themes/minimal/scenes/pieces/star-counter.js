import {scene, h, set, esc, popIn, tick, comma, glow, breathe, content, fitSize, MARK_GITHUB, url, HERO, C} from '../../kit.js';

// A repo's proof moment: an app-icon tile (the project's logo) with a breathing glow, its name, then a giant
// number ticking up (stars), a tracked label over it and small stat chips under it.
// Times are seconds from the start of the shot.
export const meta = {duration: 10};
export const defaults = {
  mode: 'dark', logo: '', name: 'career-ops', glowColor: 'rgba(255,122,26,.7)', tile: ['#ff9a3d', '#e2671c'],
  label: 'STARS ON GITHUB', value: 84020, suffix: '', countAt: 1, countFor: 1.3, stats: [{text: '15,382 forks'}, {text: 'MIT licence'}],
  popAt: 0, nameAt: .3, statsAt: 2,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const S = 260, cy = HERO.y - 260;
  const halo = glow(root, HERO.x, cy, S * 2.6, p.glowColor);
  const tile = h(root, 'c', {left: HERO.x, top: cy, width: S, height: S, borderRadius: S * .235, overflow: 'hidden', background: `linear-gradient(160deg, ${p.tile[0]}, ${p.tile[1]})`, boxShadow: 'inset 0 3px 0 rgba(255,255,255,.35), 0 30px 70px rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center'},
    p.logo ? `<img src="${esc(url(p.logo))}" style="width:100%;height:100%;object-fit:cover;display:block">` : MARK_GITHUB(S * .55, '#fff'));
  const name = h(root, 'c', {left: HERO.x, top: cy + S / 2 + 70, font: '700 54px/1 Inter', color: M.fieldInk, letterSpacing: '-.02em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 18},
    `${MARK_GITHUB(46, M.fieldDim)}<span>${esc(p.name)}</span>`);
  const ny = HERO.y + 230;
  const label = h(root, 'c', {left: HERO.x, top: ny - 120, font: '600 26px/1 "Inter Tight"', letterSpacing: '.32em', color: M.fieldDim, whiteSpace: 'nowrap'}, esc(p.label));
  const size = fitSize(comma(p.value) + p.suffix + '★', 940, 190, {weight: 800});
  const num = h(root, 'c', {left: HERO.x, top: ny, font: `800 ${size}px/1 Inter`, letterSpacing: '-.04em', color: M.fieldInk, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'});
  const stats = h(root, 'c', {left: HERO.x, top: ny + size * .5 + 80, display: 'flex', gap: 16, whiteSpace: 'nowrap'});
  const chips = p.stats.map(s => h(stats, 'mn-chip plain', {height: 56, fontSize: 25, letterSpacing: '.02em', fontWeight: 600}, esc(s.text)));
  return {
    seek(t) {
      const b = breathe(t, 2.4);
      popIn(tile, t, p.popAt, 'translate(-50%,-50%)', {d: .55, from: .7, rise: 40, blur: 16});
      set(halo, {opacity: Math.min(1, t * 3) * (.6 + .4 * b), transform: `translate(-50%,-50%) scale(${.92 + .08 * b})`});
      popIn(name, t, p.nameAt, 'translate(-50%,-50%)');
      popIn(label, t, p.countAt - .1, 'translate(-50%,-50%)');
      const v = Math.round(tick(t, p.countAt, p.countFor, p.value));
      num.innerHTML = t < p.countAt ? '' : `${comma(v)}${esc(p.suffix)}<span style="color:${M.hue.orange};font-size:.55em;vertical-align:.45em;margin-left:.08em">★</span>`;
      popIn(num, t, p.countAt, 'translate(-50%,-50%)', {d: .35, from: .9});
      chips.forEach((c, i) => popIn(c, t, p.statsAt + i * .18, '', {d: .4, from: .8}));
    },
  };
}

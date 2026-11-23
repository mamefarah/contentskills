import {scene, h, set, esc, popIn, tick, glow, breathe, hash, HERO, C} from '../../kit.js';

// A giant number ticking up (with a tracked label) at the centre, and a cloud of name chips popping in around it.
// Chips with `at` pop on that moment and glow blue (the names being said); the rest pop in a quick seeded scatter
// from `cloudAt`. Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {
  mode: 'dark', value: 180, suffix: '+', label: 'COMPANIES PRE-CONFIGURED', countAt: .2, countFor: .9,
  named: [{text: 'Anthropic', at: 1.2}, {text: 'OpenAI', at: 1.6}, {text: 'ElevenLabs', at: 2}],
  others: ['Retool', 'n8n', 'Ashby', 'Greenhouse', 'Lever', 'Wellfound'], cloudAt: .5, cloudStep: .07,
};

const SPOTS = [[-300, -330], [290, -300], [-330, 330], [320, 310], [0, -470], [0, 470], [-360, 0], [360, 10], [-200, 520], [210, -520]];

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const cy = HERO.y + 40;
  const halo = glow(root, HERO.x, cy, 900, 'rgba(59,91,219,.35)');
  const label = h(root, 'c', {left: HERO.x, top: cy + 130, font: '600 26px/1 "Inter Tight"', letterSpacing: '.3em', color: M.fieldDim, whiteSpace: 'nowrap'}, esc(p.label));
  const num = h(root, 'c', {left: HERO.x, top: cy, font: '800 250px/1 Inter', letterSpacing: '-.05em', color: M.fieldInk, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'});
  const all = [...p.named.map(n => ({...n, hot: true})), ...p.others.map((text, i) => ({text, at: p.cloudAt + i * p.cloudStep}))];
  const chips = all.map((c, i) => {
    const [dx, dy] = SPOTS[i % SPOTS.length], jx = (hash(i, 3) - .5) * 40, jy = (hash(i, 7) - .5) * 30;
    const n = h(root, 'c', {left: HERO.x + dx + jx, top: cy + dy + jy, height: c.hot ? 84 : 64, padding: c.hot ? '0 36px' : '0 26px', borderRadius: 999, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
      font: c.hot ? '700 38px/1 Inter' : '600 28px/1 Inter', color: c.hot ? '#fff' : M.text, background: c.hot ? M.hue.blue : M.card, border: `1.5px solid ${c.hot ? 'rgba(123,150,255,.8)' : M.line}`,
      boxShadow: c.hot ? '0 0 60px rgba(59,91,219,.55)' : M.shadow, zIndex: c.hot ? 5 : 1}, esc(c.text));
    return {n, at: c.at, hot: c.hot, drift: (hash(i, 11) - .5) * 14};
  });
  return {
    seek(t) {
      set(halo, {opacity: Math.min(1, t * 3) * (.6 + .4 * breathe(t, 2.4))});
      num.innerHTML = t < p.countAt ? '' : `${Math.round(tick(t, p.countAt, p.countFor, p.value))}<span style="color:${M.blue}">${esc(p.suffix)}</span>`;
      popIn(num, t, p.countAt, 'translate(-50%,-50%)', {d: .35, from: .9});
      popIn(label, t, p.countAt + .15, 'translate(-50%,-50%)');
      for (const c of chips) popIn(c.n, t, c.at, `translate(-50%,-50%) translateY(${(c.drift * Math.sin(t * 1.3 + c.drift)).toFixed(1)}px)`, {d: .4, from: c.hot ? .5 : .7});
    },
  };
}

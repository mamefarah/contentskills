import {scene, h, set, esc, popIn, stamp, slamStyle, jolt, glow, span, expo, icon, HERO} from '../../kit.js';

// A storm of rejection notifications: banners rain in from the top, one every `step` seconds, and pile up (the first
// few are already landing on frame 0, so the very first frame is busy). Each carries a red "Rejected" chip and an
// "AI screened" tag. At `stampAt` a huge stamp slams across the pile, the pile jolts and a red flash fills the frame.
// No real company names: senders are generic. Times are seconds from the shot start.
export const meta = {duration: 4};
export const defaults = {
  mode: 'dark', step: .13, lead: .4, count: 9, stamp: 'REJECTED', stampAt: 1.2,
  senders: ['Hiring Team', 'Talent Acquisition', 'Recruiting', 'People Team', 'Careers', 'HR Department', 'Hiring Team', 'Recruiting', 'Talent Team'],
  lines: ['Unfortunately, we have decided…', 'We will not be moving forward…', 'After careful review…', 'We regret to inform you…'],
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const halo = glow(root, HERO.x, HERO.y, 1100, 'rgba(229,72,77,.28)');
  const flash = h(root, 'a', {inset: 0, background: M.hue.red, opacity: 0, mixBlendMode: 'multiply'});
  const pile = h(root, 'c', {left: HERO.x, top: HERO.y + 40, width: 860, height: 1000});
  const cards = Array.from({length: p.count}, (_, i) => {
    const card = h(pile, 'a mn-card', {left: 0, top: 0, width: 860, height: 168, padding: '24px 28px', display: 'flex', gap: 22, alignItems: 'center'});
    h(card, '', {width: 76, height: 76, borderRadius: 20, flex: 'none', display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${M.hue.red} 14%, transparent)`}, icon('mail', 40, M.hue.red));
    const body = h(card, '', {flex: 1, minWidth: 0});
    h(body, '', {display: 'flex', alignItems: 'center', gap: 12, font: '700 30px/1.1 Inter', color: M.ink, whiteSpace: 'nowrap'}, `${esc(p.senders[i % p.senders.length])}<span class="mn-chip blue" style="height:34px;font-size:17px;padding:0 12px">AI screened</span>`);
    h(body, 'one', {marginTop: 10, font: '500 25px/1.2 Inter', color: M.dim}, esc(p.lines[i % p.lines.length]));
    h(card, 'mn-chip red', {height: 50, fontSize: 22, flex: 'none'}, '✕ Rejected');
    return card;
  });
  const st = stamp(root, p.stamp, M.hue.red, {size: 150, rotate: -12, seed: 9});
  set(st, {left: HERO.x, top: HERO.y + 60});
  return {
    seek(t) {
      const k = jolt(t, p.stampAt, 22);
      cards.forEach((card, i) => {
        const at = i * p.step - p.lead, q = expo(span(t, at, .28));
        // newest on top; older ones are pushed down and back, slightly fanned
        const above = cards.filter((_, j) => t >= j * p.step - p.lead && j > i).length;
        const y = -700 * (1 - q) + 40 + above * 92, sc = 1 - above * .035, rot = (i % 2 ? 1 : -1) * (1.5 + above * .6);
        set(card, {opacity: t < at ? 0 : Math.max(0, 1 - above * .12), zIndex: i, transform: `translate(${k}px, ${y}px) rotate(${rot}deg) scale(${sc})`});
      });
      set(st, slamStyle(t, p.stampAt, -14));
      const f = span(t, p.stampAt, .35);
      set(flash, {opacity: t >= p.stampAt && f < 1 ? .35 * (1 - f) : 0});
      set(halo, {opacity: t >= p.stampAt ? .9 : .45});
      popIn(pile, t, -1, 'translate(-50%,-50%)');
    },
  };
}

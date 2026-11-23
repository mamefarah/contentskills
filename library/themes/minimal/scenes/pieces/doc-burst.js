import {scene, h, set, esc, popIn, expo, span, icon, hash, HERO} from '../../kit.js';

// One document in the middle (the resume) that keeps producing: on each item's time a new card shoots out of it to its
// corner along a glowing wire, its lines "type" in, and a tick lands. The resume pulses each time it sends one, with a
// spark ring. Items: [{icon, title, sub, at}] (up to 4: top-left, top-right, bottom-left, bottom-right).
// Times are seconds from the shot start.
export const meta = {duration: 8};
export const defaults = {
  mode: 'dark', popAt: 0, source: 'Your resume',
  items: [{icon: 'doc', title: 'Tailored resume', sub: 'rewritten for this role', at: .5}, {icon: 'send', title: 'Cover letter', sub: 'drafted', at: 1.1},
    {icon: 'check', title: 'Your answers', sub: 'form questions', at: 1.7}, {icon: 'user', title: 'Hiring manager', sub: 'found', at: 2.3}],
};
const SPOTS = [[270, 690], [810, 690], [270, 1400], [810, 1400]];

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const cx = HERO.x, cy = HERO.y + 165;
  const wires = h(root, 'a', {inset: 0},
    `<svg width="1080" height="1920" viewBox="0 0 1080 1920">${p.items.slice(0, 4).map((_, i) => `<path d="M${cx} ${cy} L${SPOTS[i][0]} ${SPOTS[i][1]}" stroke="${M.hue.orange}" stroke-width="7" stroke-linecap="round" stroke-dasharray="14 16" fill="none" pathLength="1000"/>`).join('')}</svg>`);
  const paths = [...wires.querySelectorAll('path')];
  const ring = h(root, 'c', {left: cx, top: cy, width: 420, height: 420, borderRadius: '50%', border: `8px solid ${M.hue.orange}`, opacity: 0});
  const cv = h(root, 'c mn-card', {left: cx, top: cy, width: 280, height: 360, padding: '28px 26px', zIndex: 2});
  h(cv, '', {display: 'flex', alignItems: 'center', gap: 12, font: '800 30px/1 Inter', color: M.ink}, `${icon('doc', 34, M.hue.orange)}${esc(p.source)}`);
  h(cv, '', {width: 74, height: 74, borderRadius: '50%', margin: '24px 0 18px', background: `color-mix(in srgb, ${M.hue.blue} 20%, #fff)`});
  for (const wd of [.95, .8, .9, .6, .75]) h(cv, 'skel', {width: `${wd * 100}%`, height: 14, marginTop: 14});
  const cards = p.items.slice(0, 4).map((it, i) => {
    const [x, y] = SPOTS[i];
    const card = h(root, 'c mn-card', {left: x, top: y, width: 400, height: 250, padding: '26px 28px', zIndex: 3});
    const head = h(card, '', {display: 'flex', alignItems: 'center', gap: 16});
    h(head, '', {width: 70, height: 70, borderRadius: 20, display: 'grid', placeItems: 'center', background: [M.hue.blue, M.hue.violet, M.hue.green, M.hue.orange][i], flex: 'none'}, icon(it.icon, 38, '#fff'));
    h(head, '', {font: '800 32px/1.1 Inter', color: M.ink}, `${esc(it.title)}<div style="font:500 22px/1.3 Inter;color:${M.dim};margin-top:4px">${esc(it.sub ?? '')}</div>`);
    const lines = [.9, .7, .82].map(wd => h(card, 'skel', {width: '0%', height: 13, marginTop: 16, maxWidth: `${wd * 100}%`}));
    const tickMark = h(card, 'a', {right: 22, top: 22, width: 46, height: 46, borderRadius: '50%', background: M.green, display: 'grid', placeItems: 'center', opacity: 0}, icon('check', 28, '#fff'));
    return {card, lines, tickMark, at: it.at, x, y, rot: (hash(i, 7) - .5) * 8};
  });
  return {
    seek(t) {
      popIn(cv, t, p.popAt, 'translate(-50%,-50%)', {d: .4, from: .7});
      // the resume kicks a little each time it sends a card
      const kick = cards.reduce((k, c) => k + (t >= c.at ? Math.exp(-(t - c.at) * 10) : 0), 0);
      set(cv, {transform: `translate(-50%,-50%) scale(${1 + .07 * kick}) rotate(${-2 * kick}deg)`});
      const last = cards.filter(c => t >= c.at).at(-1), rq = last ? span(t, last.at, .5) : 1;
      set(ring, {opacity: last && rq < 1 ? (1 - rq) * .8 : 0, transform: `translate(-50%,-50%) scale(${.6 + .8 * expo(rq)})`});
      cards.forEach((c, i) => {
        const q = expo(span(t, c.at, .4));
        const x = cx + (c.x - cx) * q, y = cy + (c.y - cy) * q;
        set(c.card, {left: x, top: y, opacity: t < c.at ? 0 : 1, transform: `translate(-50%,-50%) rotate(${c.rot * q}deg) scale(${.3 + .7 * q})`});
        c.lines.forEach((l, k) => set(l, {width: `${100 * expo(span(t, c.at + .3 + k * .12, .35))}%`}));
        popIn(c.tickMark, t, c.at + .65, '', {d: .3, from: .3});
        paths[i].style.opacity = t >= c.at - .05 ? '.85' : '0';
        paths[i].setAttribute('stroke-dashoffset', String(-t * 90));
      });
    },
  };
}

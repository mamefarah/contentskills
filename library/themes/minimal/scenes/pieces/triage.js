import {scene, h, set, esc, stamp, slamStyle, jolt, expo, span, icon, HERO} from '../../kit.js';

// A triage conveyor: job cards stream up from the bottom, one every `step` seconds (the first are already moving on
// frame 0). Each gets a score as it crosses the judge line: below `threshold` it flashes red and is flicked off to
// the left, at or above it glows green and slides off right. Two counters (SKIP / APPLY) tick at the top, and at
// `stampAt` a big stamp slams. Scores are illustrative (a small "example" note says so). Times: seconds from shot start.
export const meta = {duration: 4};
export const defaults = {
  mode: 'dark', step: .17, lead: .35, threshold: 4, stamp: 'SKIP', stampAt: 1.2, note: 'example scores',
  jobs: [['Senior Engineer', 3.2], ['Product Manager', 4.5], ['Data Analyst', 2.8], ['Designer', 3.6], ['Sales Lead', 4.2], ['Ops Manager', 2.4],
    ['Recruiter', 3.1], ['Tech Lead', 4.7], ['Marketing', 3.4], ['Analyst', 2.9], ['Backend Dev', 4.1], ['Support Lead', 3.0]],
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const judgeY = HERO.y + 80, travel = .55, hold = .22, out = .4;
  const line = h(root, 'c', {left: HERO.x, top: judgeY, width: 980, height: 6, borderRadius: 3, background: `linear-gradient(90deg, transparent, ${M.hue.orange}, transparent)`, boxShadow: `0 0 30px ${M.hue.orange}`});
  const cards = p.jobs.map(([role, score], i) => {
    const ok = score >= p.threshold, at = i * p.step - p.lead;
    const c = h(root, 'c mn-card', {left: HERO.x, top: judgeY, width: 800, height: 150, padding: '0 34px', display: 'flex', alignItems: 'center', gap: 22, zIndex: 2});
    h(c, '', {width: 70, height: 70, borderRadius: 18, display: 'grid', placeItems: 'center', background: M.raised, flex: 'none'}, icon('briefcase', 38, M.dim));
    h(c, '', {flex: 1, font: '700 38px/1 Inter', color: M.ink, whiteSpace: 'nowrap'}, esc(role));
    const pill = h(c, '', {height: 78, minWidth: 150, padding: '0 22px', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      font: '800 44px/1 Inter', color: '#fff', background: M.raised, transition: 'none'}, `${score.toFixed(1)}`);
    return {c, pill, ok, at};
  });
  const counter = (x, label, color) => {
    const box = h(root, 'c', {left: x, top: HERO.y - 330, padding: '22px 38px', borderRadius: 30, background: '#fff', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,.4)', zIndex: 3});
    const n = h(box, '', {font: '800 96px/1 Inter', color, fontVariantNumeric: 'tabular-nums'}, '0');
    h(box, '', {marginTop: 8, font: '700 24px/1 "Inter Tight"', letterSpacing: '.28em', color: '#6e6c66'}, label);
    return {box, n};
  };
  const skipN = counter(HERO.x - 210, 'SKIP', M.hue.red), applyN = counter(HERO.x + 210, 'APPLY', M.hue.green);
  const note = h(root, 'c', {left: HERO.x, top: HERO.y + 760, font: '500 24px/1 "JetBrains Mono"', color: M.fieldDim ?? M.dim}, esc(p.note));
  const st = stamp(root, p.stamp, M.hue.red, {size: 200, rotate: -12, seed: 4});
  set(st, {left: HERO.x, top: judgeY, zIndex: 9});
  return {
    seek(t) {
      const k = jolt(t, p.stampAt, 26);
      let s = 0, a = 0;
      for (const cd of cards) {
        const tj = cd.at + travel, gone = tj + hold;
        if (t >= tj) cd.ok ? a++ : s++;
        let x = 0, y, rot = 0, op = 1;
        if (t < cd.at) op = 0;
        if (t < tj) y = (1 - expo(span(t, cd.at, travel))) * 1100;
        else if (t < gone) y = 0;
        else { const q = span(t, gone, out); y = -60 * q; x = (cd.ok ? 1 : -1) * 1200 * q * q; rot = (cd.ok ? 8 : -22) * q; op = 1 - q * .3; }
        // cards waiting below the line stack a little so the queue reads
        set(cd.c, {opacity: op, transform: `translate(calc(-50% + ${x + k}px), calc(-50% + ${y}px)) rotate(${rot}deg) scale(${t >= tj && t < gone ? 1.06 : 1})`});
        const judged = t >= tj;
        set(cd.pill, {background: judged ? (cd.ok ? M.hue.green : M.hue.red) : M.raised, color: judged ? '#fff' : M.dim, boxShadow: judged ? `0 0 30px ${cd.ok ? M.hue.green : M.hue.red}` : 'none'});
      }
      skipN.n.textContent = s; applyN.n.textContent = a;
      for (const [c, v] of [[skipN, s], [applyN, a]]) set(c.box, {transform: `translate(-50%,-50%) scale(${1 + .12 * Math.exp(-((t - (cards.filter(x => x.ok === (c === applyN) && t >= x.at + travel).at(-1)?.at ?? -9) - travel) * 10))})`});
      set(line, {opacity: .6 + .4 * Math.sin(t * 12), transform: 'translate(-50%,-50%)'});
      set(note, {transform: 'translate(-50%,-50%)'});
      set(st, slamStyle(t, p.stampAt, -12));
    },
  };
}

import {scene, h, set, esc, pop, span, ease, io, back, mix, hash, HERO} from '../../kit.js';

// Storyboard cards dealt from a deck: each card flies on an arc from the bottom into a 2x2 (or 2x3) grid at its
// `at`, spinning flat as it lands, a numbered scene with a tiny picture and caption bar; the newest one glows.
// For "scene by scene". Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {mode: 'light', title: '', cards: [{label: 'Hook', at: .05}, {label: 'Step 1', at: .22}, {label: 'Step 2', at: .39}, {label: 'Ending', at: .56}], cols: 2, popAt: 0,
  colors: ['#d97757', '#5b84b1', '#4f8a5b', '#8a6fb3', '#c6523a', '#6a9bcc']};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const cols = p.cols, rows = Math.ceil(p.cards.length / cols), cw = 360, ch = 400, gap = 34;
  const gx = HERO.x - (cols * cw + (cols - 1) * gap) / 2, gy = HERO.y - (rows * ch + (rows - 1) * gap) / 2 - 20;
  const title = h(root, 'c', {left: HERO.x, top: gy - 70, display: p.title ? '' : 'none', font: '800 56px/1 Inter', color: M.fieldInk, letterSpacing: '-.02em'}, esc(p.title));
  const cards = p.cards.map((c, i) => {
    const n = h(root, 'a mn-card', {width: cw, height: ch, padding: 20, borderRadius: 26, transformOrigin: '50% 50%'});
    const pic = h(n, '', {height: 250, borderRadius: 16, background: `linear-gradient(150deg, ${p.colors[i % p.colors.length]}, color-mix(in srgb, ${p.colors[i % p.colors.length]} 55%, #000))`, position: 'relative', overflow: 'hidden'});
    h(pic, 'a', {left: 22, top: 20, font: '800 34px/1 Inter', color: '#fff'}, String(i + 1));
    h(pic, 'a', {left: '50%', top: '58%', width: 120, height: 120, marginLeft: -60, marginTop: -60, borderRadius: 30, background: 'rgba(255,255,255,.28)'});
    h(n, '', {marginTop: 26, font: '700 38px/1 Inter', color: M.ink}, esc(c.label));
    h(n, 'skel', {marginTop: 22, height: 16, width: '80%'});
    return {n, at: c.at, x: gx + (i % cols) * (cw + gap), y: gy + Math.floor(i / cols) * (ch + gap), spin: (hash(i) - .5) * 70};
  });
  return {
    seek(t) {
      set(title, {opacity: span(t, p.popAt, .3)});
      let newest = -1; cards.forEach((c, i) => { if (t >= c.at) newest = i; });
      cards.forEach((c, i) => {
        const q = span(t, c.at, .42), e = io(q), sx = HERO.x - cw / 2, sy = 1900;
        const x = mix(sx, c.x, e), y = mix(sy, c.y, e) - Math.sin(Math.PI * e) * 260, r = c.spin * (1 - ease(q)), s = mix(.7, 1, back(q, 1.2));
        set(c.n, {left: x, top: y, opacity: t < c.at ? 0 : 1, transform: `rotate(${r.toFixed(1)}deg) scale(${s.toFixed(3)})`,
          boxShadow: i === newest ? `0 0 0 4px ${M.hue.orange}, ${M.shadow}` : M.shadow});
      });
    },
  };
}

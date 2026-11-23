import {scene, h, set, esc, pop, popStyle, span, ease, io, expo, hash, HERO} from '../../kit.js';

// An old-school multi-track editing timeline (video, captions, music, sound rows full of fiddly clips) with a playhead
// scrubbing back and forth; at `killAt` a giant red X slashes across it in two strokes and the whole panel tips over
// and drops out. Draw the thing being negated, then kill it. For "not the editor". Times from the shot start.
export const meta = {duration: 10};
export const defaults = {mode: 'dark', title: 'Editing timeline', tracks: ['Video', 'Captions', 'Music', 'Sound'], killAt: .4, popAt: 0, colors: ['#5b84b1', '#d97757', '#4f8a5b', '#8a6fb3']};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 940, H = 640, x = HERO.x - W / 2, y = HERO.y - H / 2;
  const panel = h(root, 'a', {left: x, top: y, width: W, height: H, borderRadius: 26, background: '#2a2926', border: '2px solid rgba(255,255,255,.1)', boxShadow: '0 40px 100px rgba(0,0,0,.6)', transformOrigin: '50% 100%', padding: 28});
  h(panel, '', {font: '600 30px/1 "JetBrains Mono"', color: 'rgba(250,249,245,.6)'}, esc(p.title));
  p.tracks.forEach((tr, i) => {
    const ty = 90 + i * 130;
    h(panel, 'a', {left: 28, top: ty + 40, font: '700 34px/1 Inter', color: 'rgba(250,249,245,.8)'}, esc(tr));
    let cx = 210; for (let k = 0; cx < W - 60; k++) { const w = 40 + hash(i * 17 + k) * 110;
      h(panel, 'a', {left: cx, top: ty + 14, width: Math.min(w, W - 50 - cx), height: 92, borderRadius: 10, background: p.colors[i % p.colors.length], opacity: .55 + .4 * hash(k + i)}); cx += w + 8; }
  });
  const head = h(panel, 'a', {top: 70, width: 5, height: H - 100, background: '#ff5c61', boxShadow: '0 0 12px #ff5c61'});
  const strokes = [45, -45].map(r => h(root, 'c', {left: HERO.x, top: HERO.y, height: 60, width: 0, borderRadius: 30, background: '#e5484d', boxShadow: '0 0 40px rgba(229,72,77,.8)', transform: `translate(-50%,-50%) rotate(${r}deg)`}));
  return {
    seek(t) {
      const P = pop(t, p.popAt, {d: .4, from: .9}), fall = io(span(t, p.killAt + .45, .55));
      set(panel, {opacity: P.o * (1 - fall), transform: `translateY(${(P.y + 700 * fall * fall).toFixed(1)}px) rotate(${(16 * fall).toFixed(1)}deg) scale(${P.s.toFixed(3)})`, filter: t >= p.killAt ? 'grayscale(.8) brightness(.7)' : 'none'});
      set(head, {left: 210 + (.5 + .5 * Math.sin(t * 7)) * (W - 280)});
      strokes.forEach((s, i) => { const q = expo(span(t, p.killAt + i * .12, .16)); set(s, {width: 1000 * q, opacity: q > 0 ? 1 - fall : 0}); });
    },
  };
}

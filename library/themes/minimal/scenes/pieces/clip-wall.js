import {scene, h, set, esc, pop, span, ease, io, mix, hash, clip, stamp, slamStyle, jolt, HERO} from '../../kit.js';

// A wall of raw talking-head clips (grey, flat, RAW tag) that fan in from frame 0; at `editAt` a Claude-orange beam
// with the ✳ mark sweeps across the wall and every clip it passes turns edited (colour, punch-in, caption, sticker,
// tick), one after another until `editDone`; a stamp ("FREE") slams across the wall at `stampAt`. With `counter`
// ("videos edited"), a big "0/6" under the wall counts up as each clip turns.
// For "it edits all your videos". Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {mode: 'dark', count: 6, cols: 3, editAt: .4, editDone: 1.4, stamp: 'FREE', stampColor: 'green', stampAt: null, popAt: 0, counter: '', 
  captions: ['WATCH THIS', 'STOP SCROLLING', 'HERE IS WHY', 'MY BEST TIP', 'TRY THIS NOW', 'BIG NEWS']};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const cols = p.cols, rows = Math.ceil(p.count / cols), w = p.clipW ?? 270, hh = w * 16 / 9, gap = 26;
  const gx = HERO.x - (cols * w + (cols - 1) * gap) / 2, gy = HERO.y - (rows * hh + (rows - 1) * gap) / 2 + 10;
  const clips = Array.from({length: p.count}, (_, i) => {
    const c = clip(root, {w, seed: i, caption: p.captions[i % p.captions.length], word: 1});
    return {c, x: gx + (i % cols) * (w + gap), y: gy + Math.floor(i / cols) * (hh + gap), at: p.popAt + i * .05, r: (hash(i, 2) - .5) * 24};
  });
  const beam = h(root, 'a', {top: gy - 40, width: 90, height: rows * hh + (rows - 1) * gap + 80, marginLeft: -45, background: 'linear-gradient(90deg, transparent, rgba(255,154,61,.85), transparent)', filter: 'blur(4px)', mixBlendMode: 'screen'});
  const mark = h(root, 'c', {top: gy + (rows * hh + (rows - 1) * gap) / 2, width: 110, height: 110, borderRadius: 28, background: 'linear-gradient(160deg, #ff9a3d, #f05a14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 70px/1 Inter', boxShadow: '0 0 40px rgba(255,122,26,.8)'}, '✳');
  const st = p.stampAt != null ? stamp(root, p.stamp, {green: M.hue.green, red: M.hue.red}[p.stampColor] ?? p.stampColor, {size: 150, rotate: -10}) : null;
  if (st) set(st, {left: HERO.x, top: HERO.y + 10});
  const count = p.counter ? h(root, 'c', {left: HERO.x + (p.counterShift ?? 0), top: gy + rows * hh + (rows - 1) * gap + (p.counterGap ?? 90), display: 'flex', alignItems: 'baseline', gap: 18, whiteSpace: 'nowrap',
    padding: '18px 40px', borderRadius: 999, background: '#141413', color: '#fff', boxShadow: '0 20px 50px rgba(0,0,0,.35)'}) : null;
  const x0 = gx - 60, x1 = gx + cols * w + (cols - 1) * gap + 60;
  return {
    seek(t) {
      const sweep = span(t, p.editAt, p.editDone - p.editAt), bx = mix(x0, x1, io(sweep)), k = p.stampAt != null ? jolt(t, p.stampAt, 12) : 0;
      clips.forEach(({c, x, y, at, r}, i) => {
        const q = span(t, at, .45), e = ease(q), cx = x + w / 2, edit = span(bx, cx - 60, 160);
        set(c.el, {left: mix(HERO.x - w / 2, x, e) + k, top: mix(1900, y, e), opacity: q > 0 ? 1 : 0, transform: `rotate(${(r * (1 - e)).toFixed(1)}deg) scale(${(1 + .05 * Math.sin(Math.PI * edit)).toFixed(3)})`});
        c.seek(t, edit);
      });
      if (count) { const done = clips.filter(({x}) => bx >= x + w / 2 + 100).length;   // a clip counts once its edit is complete
        count.innerHTML = `<b style="font:900 92px/1 Inter;color:${done === clips.length ? '#4ade80' : '#ff9a3d'}">${done}/${clips.length}</b><span style="font:700 46px/1 Inter">${esc(p.counter)}</span>`; }
      const live = sweep > 0 && sweep < 1;
      set(beam, {left: bx, opacity: live ? 1 : 0}); set(mark, {left: bx, opacity: live ? 1 : 0, transform: `translate(-50%,-50%) rotate(${(t * 90).toFixed(1)}deg)`});
      if (st) set(st, slamStyle(t, p.stampAt, -10));
    },
  };
}

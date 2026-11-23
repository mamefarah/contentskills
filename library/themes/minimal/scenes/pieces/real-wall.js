import {scene, h, set, esc, span, ease, io, mix, hash, url, stamp, slamStyle, jolt, HERO} from '../../kit.js';

// A wall of real vertical clips playing, each from a sprite strip (frames stacked top to bottom, `fps`), first as the
// raw footage (desaturated, RAW tag). A Claude-orange wiper with the ✳ mark sweeps left to right from `editAt` to
// `editDone`, and inside every clip it crosses, the finished edit is revealed behind the line (a true wipe), with a
// green tick once a clip is done. Optional stamp at `stampAt`. Make the strips with ffmpeg:
//   ffmpeg -ss <t> -i clip.mp4 -t 2.6 -vf "fps=15,scale=250:444:force_original_aspect_ratio=increase,crop=250:444,tile=1x39" -frames:v 1 strip.jpg
// clips: [{raw, edited}] (paths), frames: frames per strip. Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {mode: 'charcoal', clips: [], frames: 39, fps: 15, cols: 3, clipW: 250, editAt: 0, editDone: 1.5, stamp: '', stampColor: 'green', stampAt: null, popAt: 0, start: 0};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const n = p.clips.length, cols = p.cols, rows = Math.ceil(n / cols), w = p.clipW, hh = w * 444 / 250, gap = 24;
  const gx = HERO.x - (cols * w + (cols - 1) * gap) / 2, gy = HERO.y - (rows * hh + (rows - 1) * gap) / 2 - 20 + (p.y ?? 0);
  const strip = (parent, src, css = {}) => h(parent, 'a', {left: 0, top: 0, width: w, height: hh, backgroundImage: `url("${url(src)}")`, backgroundSize: `${w}px ${hh * p.frames}px`, backgroundRepeat: 'no-repeat', ...css});
  const cells = p.clips.map((c, i) => {
    const box = h(root, 'a', {left: gx + (i % cols) * (w + gap), top: gy + Math.floor(i / cols) * (hh + gap), width: w, height: hh, borderRadius: 22, overflow: 'hidden', background: '#000',
      boxShadow: '0 24px 60px rgba(0,0,0,.55)', border: '2px solid rgba(255,255,255,.18)'});
    const raw = strip(box, c.raw, {filter: 'saturate(.35) brightness(.82) contrast(.95)'});
    const edited = strip(box, c.edited);
    const tag = h(box, 'a', {left: 12, top: 12, padding: '5px 10px', borderRadius: 8, background: 'rgba(0,0,0,.55)', color: '#fff', font: '700 20px/1 "JetBrains Mono"'}, 'RAW');
    const ok = h(box, 'a', {right: 12, bottom: 12, width: 46, height: 46, borderRadius: '50%', background: '#2f9e5b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '900 28px/1 Inter', boxShadow: '0 4px 12px rgba(0,0,0,.4)'}, '✓');
    return {box, raw, edited, tag, ok, x: gx + (i % cols) * (w + gap), off: Math.floor(hash(i, 5) * 4)};
  });
  const top = gy - 30, tall = rows * hh + (rows - 1) * gap + 60;
  const beam = h(root, 'a', {top, width: 14, height: tall, marginLeft: -7, borderRadius: 7, background: '#ff9a3d', boxShadow: '0 0 30px 10px rgba(255,122,26,.75), 0 0 90px 30px rgba(255,122,26,.35)'});
  const mark = h(root, 'c', {top: top + tall / 2, width: 100, height: 100, borderRadius: 26, background: 'linear-gradient(160deg, #ff9a3d, #f05a14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 64px/1 Inter', boxShadow: '0 0 40px rgba(255,122,26,.85)'}, '✳');
  const st = p.stamp && p.stampAt != null ? stamp(root, p.stamp, {green: M.hue.green, red: M.hue.red}[p.stampColor] ?? p.stampColor, {size: 140, rotate: -10}) : null;
  if (st) set(st, {left: HERO.x, top: HERO.y});
  const x0 = gx - 40, x1 = gx + cols * w + (cols - 1) * gap + 40;
  return {
    seek(t) {
      const f = Math.max(0, Math.min(p.frames - 1, Math.floor((t - p.start) * p.fps))), q = io(span(t, p.editAt, p.editDone - p.editAt)), bx = mix(x0, x1, q), k = st ? jolt(t, p.stampAt, 12) : 0;
      cells.forEach(c => {
        const y = -((f + c.off) % p.frames) * hh, cut = Math.max(0, Math.min(w, bx - c.x));
        set(c.raw, {backgroundPosition: `0 ${y}px`}); set(c.edited, {backgroundPosition: `0 ${y}px`, clipPath: `inset(0 ${(w - cut).toFixed(1)}px 0 0)`});
        set(c.tag, {opacity: cut > 30 ? 0 : 1}); set(c.ok, {opacity: cut >= w ? 1 : 0, transform: `scale(${cut >= w ? 1 : .5})`});
        set(c.box, {transform: `translateX(${k.toFixed(1)}px) scale(${(1 + .04 * Math.sin(Math.PI * Math.min(1, cut / w))).toFixed(3)})`});
      });
      const live = q > 0 && q < 1; set(beam, {left: bx, opacity: live ? 1 : 0}); set(mark, {left: bx, opacity: live ? 1 : 0, transform: `translate(-50%,-50%) rotate(${(t * 120).toFixed(1)}deg)`});
      if (st) set(st, slamStyle(t, p.stampAt, -10));
    },
  };
}

import {C, stage, group, rr, circle, line, text, spark} from '../../ui.js';

// The opening of a "Claude edited this video" reel: the viewer watches Claude edit the very clip they are on.
// From the first frame a Claude Code status pill sits above the head (spinning spark, `status` typing); on `slamAt` the
// `word` (an outline until then) fills solid with a slam (an overshoot, an ivory flash, a shake) and the pill flips to
// `done`; the room behind the speaker is solid `bg` (Claude clay) throughout; on `burstAt` thin `rays` burst behind the head; from `tagAt` the pill
// types the `tag`, letter by letter over `tagFor`; at the end the word slices into strips that slide off. Pair it
// with a punch-in zoom on the slam. (A dark, raw-grade version was tried first; the user found it dull: nothing popped.)
// Use two copies, like platform-orbit: layer "back" (word + burst, with behind: "person") and layer "front" (pill,
// tag, flash). Times in seconds from the overlay start. Charcoal, ivory and clay only.
export const meta = {duration: 2.4, live: true};
export const defaults = {
  layer: 'back', word: 'CRAZIEST', status: 'editing your video…', done: 'edited', tag: 'CLAUDE USE CASE',
  slamAt: .56, burstAt: .96, tagAt: 1.12, tagFor: .36, wipeAt: 2.05,
  y: 600, size: 300, pillY: 290, bg: '#D97757', ink: '#1D1D1B', rays: '#ECE8DA', font: 'Instrument Serif', weight: 400, track: -.02, outline: true, ghost: .22, burst: {x: 540, y: 980, r: 470},
};

const IVORY = '#ECE8DA', CLAY = '#D97757', CHAR = '#1D1D1B', SERIF = '"Instrument Serif", Georgia, serif';
const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace';
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - Math.pow(1 - clamp(x), 3);
const back = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

export async function mount(el, props = defaults) {
  const p = {...defaults, ...props}, life = p.life ?? meta.duration;
  await Promise.all([`400 100px ${SERIF}`, `600 40px ${MONO}`, `${p.weight} 100px "${p.font}"`].map(f => document.fonts?.load(f).catch(() => {})));
  const svg = stage(el, null), root = group(svg), live = group(root);
  return {seek(t) {
    live.replaceChildren();
    const out = clamp((t - (life - .12)) / .12);
    root.setAttribute('opacity', (1 - out).toFixed(3));
    const hit = t - p.slamAt, shake = hit >= 0 && hit < .3 ? 1 - hit / .3 : 0;
    const dx = Math.sin(t * 97) * shake * 22, dy = Math.cos(t * 83) * shake * 22;
    if (p.layer === 'back') back_(t, dx, dy); else front(t);
  }};

  function back_(t, dx, dy) {
    const wipe = clamp((t - p.wipeAt) / .28);
    // from the first frame the room behind the speaker is solid Claude clay (this layer sits behind the speaker, so they are cut out on it)
    rr(live, 0, 0, 1080, 1920, 0, p.bg, {opacity: (1 - wipe).toFixed(3)});
    const g = group(live, {transform: `translate(${dx.toFixed(1)} ${dy.toFixed(1)})`});
    // the spark burst behind the head: thin ivory rays out fast with an overshoot, then a slow turn
    if (t >= p.burstAt) {
      const q = t - p.burstAt, s = back(q / .3), {x, y, r} = p.burst, rot = q * .35;
      const bg = group(g, {opacity: (1 - wipe).toFixed(3)});
      circle(bg, x, y, r * .5 * s, p.rays, {opacity: .35, filter: 'blur(50px)'});
      for (let k = 0; k < 16; k++) {
        const a = rot + k * Math.PI / 8, r0 = r * .22 * s, r1 = r * s * (k % 2 ? .72 : 1);
        line(bg, [[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], p.rays, k % 2 ? 8 : 14)
          .setAttribute('stroke-linecap', 'round');
      }
    }
    // the word: a faint ghost from the first frame (breathing), filled solid with a slam on slamAt, sliced off at wipeAt
    if (t < p.slamAt && p.outline) { const b = 1 + .015 * Math.sin(t * 9); word(group(g, {transform: `translate(540 ${p.y}) scale(${b.toFixed(3)}) translate(-540 ${-p.y})`}), true); return; }
    if (t < p.slamAt) return;
    {
      const q = t - p.slamAt, s = q < .2 ? 1.5 - .5 * back(q / .2) : 1, a = 1;
      const w = group(g, {opacity: a.toFixed(3), transform: `translate(540 ${p.y}) scale(${s.toFixed(3)}) rotate(${((1 - clamp(q / .22)) * -4).toFixed(2)}) translate(-540 ${-p.y})`});
      const n = 6, top = p.y - p.size * .72, h = p.size * .82;
      if (wipe <= 0) { word(w); return; }
      for (let i = 0; i < n; i++) {
        const id = `eh-clip-${i}`, y0 = top + h * i / n, dir = i % 2 ? 1 : -1, off = dir * 1300 * Math.pow(clamp(wipe * 1.3 - i * .05), 2);
        const cp = svg.querySelector(`#${id}`) || (() => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath'); c.id = id;
          const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); r.setAttribute('x', -200); r.setAttribute('width', 1480);
          r.setAttribute('y', y0 - (i ? 0 : 200)); r.setAttribute('height', h / n + (i === 0 || i === n - 1 ? 200 : .5)); c.appendChild(r); svg.appendChild(c); return c; })();
        const sg = group(w, {'clip-path': `url(#${id})`, transform: `translate(${off.toFixed(1)} 0)`});
        word(sg);
        rr(sg, -200, y0 + h / n - 6, 1280, y0 + h / n, 0, p.ink, {opacity: clamp(wipe * 4).toFixed(3)});
      }
    }
  }
  function word(g, outline = false) {
    const paint = outline ? {opacity: p.ghost} : {};                         // before the slam: a faint solid ghost (a stroked outline
                                                                               // showed the variable font's overlapping contours)
    const t = text(g, 540, p.y, p.word, p.size, p.weight, p.ink, 'middle', {'font-family': `"${p.font}", ${SERIF}`, 'letter-spacing': p.size * p.track, 'dominant-baseline': 'alphabetic', ...paint});
    const bb = t.getBBox(); if (bb.width > 940) t.setAttribute('transform', `translate(540 0) scale(${(940 / bb.width).toFixed(3)} 1) translate(-540 0)`);
  }

  function front(t) {
    // one pill, on screen from the first frame: status typing (already part-typed on frame 0) with the spinning spark,
    // "edited" with a clay tick on the slam, then the tag typing in clay from tagAt
    const done = t >= p.slamAt, tagging = t >= p.tagAt, fs = 40;
    const s = tagging ? p.tag.slice(0, Math.max(1, Math.round(clamp((t - p.tagAt) / p.tagFor) * p.tag.length)))
      : done ? p.done : p.status.slice(0, Math.round((.4 + .6 * clamp(t / .3)) * p.status.length));
    const full = tagging ? p.tag : done ? p.done : p.status, ls = tagging ? 8 : 0;
    const w = (tagging ? 64 : 120) + full.length * (fs * .6 + ls), x0 = 540 - w / 2, y = p.pillY;
    const pop = done && !tagging ? back((t - p.slamAt) / .2) : tagging ? back((t - p.tagAt) / .2) : 1;
    const g = group(live, {transform: `translate(540 ${y}) scale(${pop.toFixed(3)}) translate(-540 ${-y})`});
    rr(g, x0, y - 42, x0 + w, y + 42, 42, CHAR, {stroke: '#3A3A37', 'stroke-width': 2});
    if (tagging) text(g, x0 + 32, y + 2, s, fs, 700, CLAY, 'start', {'font-family': MONO, 'letter-spacing': ls});
    else {
      if (done) { circle(g, x0 + 52, y, 20, CLAY); line(g, [[x0 + 42, y], [x0 + 50, y + 8], [x0 + 63, y - 8]], CHAR, 5); }
      else spark(g, x0 + 52, y, 22, t * 7);
      text(g, x0 + 92, y + 2, s, fs, 600, done ? CLAY : IVORY, 'start', {'font-family': MONO});
    }
    // the clay flash on the slam
    const hit = t - p.slamAt;
    if (hit >= 0 && hit < .14) rr(live, 0, 0, 1080, 1920, 0, IVORY, {opacity: (.7 * (1 - hit / .14)).toFixed(3)});
  }
}

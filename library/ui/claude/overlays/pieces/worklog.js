import {C, stage, group, rr, circle, line, text, image, spark, EDGE} from '../../ui.js';

// Claude at work, as the app shows it: a dark card with the spinning spark and a title, then the steps of the job
// one under another. Each step waits dimmed, lights up with a turning ring while it runs (from its `at`), and gets an
// orange tick and its `detail` (a figure, at the right) when it is done (the next step's `at`, or `doneAt` for the
// last). A thin orange line under the list fills with the work. Transparent around the card: place it with x, y, w.
// Give the steps real figures; the piece invents nothing.
export const meta = {duration: 2.4, live: true};
export const defaults = {title: 'Editing your video...', label: 'WORKING', steps: [{label: 'Transcribe', detail: '', at: .15}, {label: 'Find the pauses', detail: '', at: .5}, {label: 'Cut', detail: '', at: .85}, {label: 'Add graphics', detail: '', at: 1.2}], doneAt: 1.6, done: 'Done', x: 60, y: 620, w: 960, size: 50};

const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 4);
export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el, null), root = group(svg), base = group(root), live = group(root), steps = p.steps ?? [], n = steps.length;
  const {x, y, w} = p, pad = 48, head = 136, pitch = p.size * 2.05, h = head + n * pitch + 70, life = p.life ?? meta.duration;
  rr(base, x, y + 12, x + w, y + h + 12, 40, 'rgba(0,0,0,.3)', {filter: 'blur(16px)'});
  rr(base, x, y, x + w, y + h, 40, C.bg, EDGE);
  text(base, x + w - pad, y + 72, p.label, 26, 700, C.muted, 'end', {'letter-spacing': 7});
  line(base, [[x + pad, y + head - 16], [x + w - pad, y + head - 16]], C.surf2, 2);
  const ends = steps.map((s, i) => s.doneAt ?? steps[i + 1]?.at ?? p.doneAt), py = y + h - 40;
  return {seek(t) {
    live.replaceChildren();
    const a = ease(t / .3), b = life ? Math.pow(Math.max(0, Math.min(1, (t - (life - .26)) / .26)), 3) : 0, all = t >= p.doneAt;
    root.setAttribute('opacity', (Math.min(1, t / .16) * (1 - b)).toFixed(3)); root.setAttribute('transform', `translate(0 ${((1 - a) * 60 + b * 40).toFixed(1)})`);
    spark(live, x + pad + 26, y + 70, 26, all ? 0 : t * 5); text(live, x + pad + 72, y + 72, all ? p.done : p.title, 42, 500, C.reply);
    let prog = 0;
    steps.forEach((s, i) => {
      const cy = y + head + pitch * (i + .5), on = t >= s.at, fin = t >= ends[i], cx = x + pad + 24, q = on ? Math.min(1, (t - s.at) / Math.max(.05, ends[i] - s.at)) : 0;
      prog += q / n;
      if (fin) { circle(live, cx, cy, 22, C.orange); const k = ease((t - ends[i]) / .16); line(live, [[cx - 10, cy + 1], [cx - 3, cy + 8]].concat(k > .5 ? [[cx - 3 + 14 * (k - .5) * 2, cy + 8 - 17 * (k - .5) * 2]] : []), '#fff', 5); }
      else if (on) { circle(live, cx, cy, 20, 'none', {stroke: C.surf2, 'stroke-width': 5}); const ang = t * 9; live.appendChild(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'path'), {})).setAttribute('d', `M${cx + 20 * Math.cos(ang)} ${cy + 20 * Math.sin(ang)}A20 20 0 0 1 ${cx + 20 * Math.cos(ang + 1.7)} ${cy + 20 * Math.sin(ang + 1.7)}`); const arc = live.lastChild; arc.setAttribute('fill', 'none'); arc.setAttribute('stroke', C.orange); arc.setAttribute('stroke-width', 5); arc.setAttribute('stroke-linecap', 'round'); }
      else circle(live, cx, cy, 20, 'none', {stroke: C.surf2, 'stroke-width': 4});
      text(live, x + pad + 72, cy, s.label, p.size, on ? 500 : 450, on ? C.text : C.placeholder);
      if (s.detail && fin) text(live, x + w - pad, cy, s.detail, p.size * .78, 500, C.pillFg, 'end', {opacity: ease((t - ends[i]) / .2)});
    });
    rr(live, x + pad, py - 3, x + w - pad, py + 3, 3, C.surf2); if (prog > 0) rr(live, x + pad, py - 3, x + pad + (w - pad * 2) * Math.min(1, prog), py + 3, 3, C.orange);
  }};
}

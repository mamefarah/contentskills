import {stage, text, measure, fade, leave, glide, span, mix, easeInOut, easeBack, shade} from '../../kit.js';

// A drinking glass whose water level moves between two fills (draining or filling), with a small line above it and a
// big label landing under it. Shared piece: drawn in the theme's look. Levels are 0..1 of the glass and show a state,
// not a measurement: no figures are printed.
// Props: from, to (levels), at, dur (when and how long the level moves), kicker, label, labelAt, warn (label in the
// accent), pour (a stream falls in from above while it fills), color (the water; the theme's accent when not given),
// cx, top, w, h (the glass).
export const meta = {duration: 3, live: true};
export const defaults = {from: .85, to: .12, at: .3, dur: 1.2, kicker: 'OVERNIGHT', label: 'RUNNING LOW', labelAt: 1.2, warn: false, pour: false, color: null, cx: 540, top: 500, w: 500, h: 720};

const frac = x => x - Math.floor(x);

export function mount(el, props = defaults, {look} = {}) {
  const p = {...defaults, ...props}, st = stage(el, look), g = st.root.append('g');
  const {cx, top: y0, w, h} = p, y1 = y0 + h, tw = w / 2, bw = w * .39, r = 56, base = 30;
  const water = p.color ?? look.accent, pale = shade(water, .3);
  const half = y => mix(tw, bw, (y - y0) / h);                       // half-width of the glass at height y
  const sides = `M${cx - tw} ${y0} L${cx - half(y1 - r)} ${y1 - r} Q${cx - bw} ${y1} ${cx - bw + r} ${y1} L${cx + bw - r} ${y1} Q${cx + bw} ${y1} ${cx + half(y1 - r)} ${y1 - r} L${cx + tw} ${y0}`;
  const surface = level => y1 - base - level * (h - base - 40);

  st.defs.append('clipPath').attr('id', `${st.id}-glass`).append('path').attr('d', `${sides} Z`);
  const stream = g.append('rect').attr('x', cx - 20).attr('width', 40).attr('rx', 20).attr('fill', water);
  g.append('path').attr('d', `${sides} Z`).attr('fill', look.ink).attr('fill-opacity', .05);
  const inside = g.append('g').attr('clip-path', `url(#${st.id}-glass)`);
  const back = inside.append('path').attr('fill', pale).attr('opacity', .55);
  const front = inside.append('path').attr('fill', water).attr('opacity', .92);
  const bubbles = Array.from({length: 8}, (_, i) => inside.append('circle').attr('fill', '#fff').attr('r', 6 + 7 * frac(i * .37 + .2)));
  inside.append('rect').attr('x', cx - tw).attr('y', y1 - base).attr('width', w).attr('height', base).attr('fill', look.ink).attr('fill-opacity', .22);
  for (const k of [.25, .5, .75]) {                                    // quiet level marks on the right wall
    const y = surface(k);
    g.append('line').attr('x1', cx + half(y) - 64).attr('x2', cx + half(y) - 20).attr('y1', y).attr('y2', y).attr('stroke', look.ink).attr('stroke-opacity', .35).attr('stroke-width', 5).attr('stroke-linecap', 'round');
  }
  g.append('line').attr('x1', cx - half(y0 + 70) + 40).attr('y1', y0 + 70).attr('x2', cx - half(y1 - 170) + 40).attr('y2', y1 - 170)
    .attr('stroke', '#fff').attr('stroke-opacity', .22).attr('stroke-width', 12).attr('stroke-linecap', 'round');
  g.append('path').attr('d', sides).attr('fill', 'none').attr('stroke', look.ink).attr('stroke-width', 12).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');

  const kick = p.kicker ? text(g, cx, y0 - 96, p.kicker, {size: 36, role: 'mono', color: look.dim, anchor: 'middle'}, look).style('letter-spacing', '.22em') : null;
  const size = p.label ? Math.min(128, 128 * 700 / Math.max(1, measure(p.label, look, 'head', 128))) : 0;
  const lab = p.label ? st.root.append('g') : null;
  if (lab) text(lab, 0, 0, p.label, {size, role: 'head', color: p.warn ? look.accent : look.ink, anchor: 'middle'}, look);

  const wave = (ys, t, amp, phase) => {
    let d = `M${cx - tw - 10} ${y1}`;
    for (let x = cx - tw - 10; x <= cx + tw + 10; x += 20) d += ` L${x} ${(ys + amp * Math.sin(x * .021 + t * 4.2 + phase)).toFixed(1)}`;
    return `${d} L${cx + tw + 10} ${y1} Z`;
  };

  return {
    seek(t) {
      const into = glide(span(t, 0, .35)), gone = 1 - leave(t, p.life);
      g.attr('opacity', fade(t, 0, .18) * gone).attr('transform', `translate(0 ${(1 - into) * 70})`);
      const q = easeInOut(span(t, p.at, p.dur)), level = mix(p.from, p.to, q), ys = surface(level);
      const moving = Math.sin(Math.PI * span(t, p.at, p.dur + .35)), amp = 7 + 16 * moving;
      back.attr('d', wave(ys - 8, t * .8, amp, 1.9));
      front.attr('d', wave(ys, t, amp, 0));
      bubbles.forEach((b, i) => {
        const ph = frac(t * (.3 + .12 * frac(i * .61)) + i * .37), by = mix(y1 - base - 10, ys + 16, ph);
        b.attr('cx', cx + (frac(i * .618 + .13) - .5) * 1.5 * bw + 10 * Math.sin(t * 2 + i)).attr('cy', by).attr('opacity', level > .14 ? .34 * (1 - ph) : 0);
      });
      if (p.pour) {
        const from = y0 - 270, head = mix(from, ys + 20, span(t, p.at - .18, .18)), tail = mix(from, ys + 20, span(t, p.at + p.dur - .1, .2));
        stream.attr('y', tail).attr('height', Math.max(0, head - tail)).attr('opacity', head > tail ? .92 : 0);
      } else stream.attr('opacity', 0);
      kick?.attr('opacity', fade(t, .1, .2));
      if (lab) {
        const a = span(t, p.labelAt, .28);
        lab.attr('opacity', (a > 0 ? 1 : 0) * gone).attr('transform', `translate(${cx} ${y1 + 150}) scale(${(.6 + .4 * easeBack(a)).toFixed(4)})`);
      }
    },
  };
}

import {C, STEP, stage, word, label, fit, capH, measure, up, span, snap, punch} from '../../kit.js';

// A tag: a solid white square block punches in on the beat (a small overshoot), the word in heavy charcoal
// capitals builds on it, and the ring text runs as a tracked label along its foot. `r` is half the block size.
// `solid: false` makes a charcoal block with white type.
export const meta = {duration: 3.5, live: true};
export const defaults = {text: 'NEW', ring: 'LIMITED RUN', x: 850, y: 380, r: 150, tilt: -6, solid: true};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), r = props.r ?? 150, x = props.x ?? 850, y = props.y ?? 380, solid = props.solid !== false;
  const bg = solid ? C.white : C.coal, fg = solid ? C.ink : C.white, txt = up(props.text);
  const g = st.root.append('g'), inner = g.append('g');
  inner.append('rect').attr('x', -r).attr('y', -r).attr('width', r * 2).attr('height', r * 2).attr('fill', bg);
  const size = fit(txt, r * 1.6, r * .9), cap = capH(size);
  const wd = word(inner, txt, 0, cap / 2 - r * .08, size, {color: fg, seed: 5});
  const ring = props.ring ? label(inner, 0, r - 26, up(props.ring), {size: Math.min(22, r * 1.5 / Math.max(4, String(props.ring).length) / .9), anchor: 'middle', track: .3, color: fg, weight: 700}) : null;
  const tick = inner.append('rect').attr('x', -r).attr('y', -r).attr('width', r * .5).attr('height', 8).attr('fill', fg);
  const life = props.life ?? meta.duration, out = Math.max(.8, life - .35);
  return {seek(t) {
    const a = punch(span(t, 0, STEP * 1.4)), b = snap(span(t, out + .15, STEP));
    g.attr('transform', `translate(${x} ${y}) rotate(${props.tilt ?? -6}) scale(${Math.max(0.001, a * (1 - b))})`).attr('opacity', t > 0 && b < 1 ? 1 : 0);
    wd.seek(t, {at: .15, step: .05, hold: .07, out, outStep: .03});
    ring?.attr('opacity', t > .4 && t < out ? 1 : 0);
  }};
}

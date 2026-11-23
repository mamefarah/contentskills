import {C, STEP, stage, word, label, fit, capH, up, span, snap} from '../../kit.js';

// A narrow charcoal strip drops down the frame edge on the beat with a word stacked in it letter over letter,
// building from the top in heavy white capitals; a small tracked label at its foot. Leaves upward.
// Props: word, x (strip centre), width, top, bottom, label.
export const meta = {duration: 3.5, live: true};
export const defaults = {word: 'STYLE', x: 150, width: 170, top: 260, bottom: 1500, label: 'NO. 04'};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), w = up(props.word), x = props.x ?? 150, sw = props.width ?? 170, top = props.top ?? 260, bot = props.bottom ?? 1500, H = bot - top;
  const strip = st.root.append('rect').attr('x', x - sw / 2).attr('width', sw).attr('fill', C.coal);
  const n = [...w].length, size = Math.min(sw * .72, (H - 140) / Math.max(1, n) / .82), cap = capH(size), pitch = (H - 140) / Math.max(1, n);
  const letters = [...w].map((ch, i) => word(st.root, ch, x, top + 40 + pitch * i + pitch / 2 + cap / 2, size, {seed: i}));
  const lab = props.label ? label(st.root, x, bot - 36, up(props.label), {size: 18, anchor: 'middle', track: .3, opacity: .8}) : null;
  const life = props.life ?? meta.duration, out = Math.max(1, life - .45);
  return {seek(t) {
    const a = snap(span(t, 0, STEP * 1.5)), b = snap(span(t, out + .15, STEP * 1.4)), hh = H * a * (1 - b);
    strip.attr('y', top + H * b).attr('height', Math.max(0, hh)).attr('opacity', hh > 1 ? 1 : 0);
    letters.forEach((l, i) => l.seek(t, {at: .2 + i * .06, step: 0, hold: .09, out: out - (n - 1 - i) * .04, outStep: 0}));
    lab?.attr('opacity', t > .5 && t < out ? .8 : 0);
  }};
}

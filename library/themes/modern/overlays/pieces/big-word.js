import {C, STEP, stage, word, label, fit, capH, up} from '../../kit.js';

// THE look of the theme: one huge white word centred across the frame, its letters building in a scattered
// order (each a translucent ghost first, then solid) and, before the overlay ends, dropping out one by one in
// a different order. Props: word, y (centre), size (max), color white|ink, order scatter|left|right|centre|edges,
// seed (changes the scatter), step (s between letters), kicker (small label above, optional),
// width (the widest the word may run, px of a 1080 frame; default 90 % of the frame; smaller keeps it in the app safe zone).
export const meta = {duration: 3, live: true};
export const defaults = {word: 'MODERN', y: 1500, size: 260, color: 'white', order: 'scatter', seed: 3, step: .06, kicker: ''};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W} = st, w = up(props.word), y = props.y ?? 1500, ink = props.color === 'ink', col = ink ? C.ink : C.white;
  const size = fit(w, props.width ? props.width * W / 1080 : W * .9, props.size ?? 260), cap = capH(size);
  const big = word(st.root, w, W / 2, y + cap / 2, size, {color: col, order: props.order, seed: props.seed ?? 3, lift: ink ? null : st});
  const kick = props.kicker ? label(st.root, W / 2, y - cap / 2 - 36, up(props.kicker), {size: 26, anchor: 'middle', track: .36, color: col, lift: ink ? null : st}) : null;
  const life = props.life ?? meta.duration, step = props.step ?? .06, out = Math.max(big.inLen(step) + .2, life - (w.length - 1) * step * .7 - .12);
  return {seek(t) {
    big.seek(t, {at: 0, step, hold: .1, out, outStep: step * .7});
    kick?.attr('opacity', t > .2 && t < out ? 1 : 0);
  }};
}

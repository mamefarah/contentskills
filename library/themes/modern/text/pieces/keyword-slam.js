import {C, STEP, stage, word, label, fit, capH, up, span, leave} from '../../kit.js';

// One huge word over the footage, centred: its letters build in a scattered order (ghost, then solid) and, when
// the overlay's life runs out, drop out again one by one. A small tracked kicker above. `y` is the word's centre;
// `color` 'white' (default) or 'ink' for bright backgrounds; `order` scatter | left | right | centre | edges.
export const meta = {duration: 3.5, live: true};
export const defaults = {word: 'UNSTOPPABLE', kicker: 'WORD OF THE DAY', y: 1560, tilt: 0, color: 'white', order: 'scatter', size: 220, seed: 3};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W} = st, w = up(props.word), y = props.y ?? 1560, col = props.color === 'ink' ? C.ink : C.white;
  const size = fit(w, W * .86, props.size ?? 220), cap = capH(size);
  st.root.attr('transform', `rotate(${props.tilt ?? 0} ${W / 2} ${y})`);
  const big = word(st.root, w, W / 2, y + cap / 2, size, {color: col, order: props.order, seed: props.seed ?? 3, lift: props.color === 'ink' ? null : st});
  const kick = props.kicker ? label(st.root, W / 2, y - cap / 2 - 34, up(props.kicker), {size: 26, anchor: 'middle', track: .34, color: col, lift: props.color === 'ink' ? null : st}) : null;
  const life = props.life ?? meta.duration, out = Math.max(.6, life - .45);
  return {seek(t) {
    big.seek(t, {at: 0, step: .045, hold: .08, out, outStep: .03});
    kick?.attr('opacity', t > .15 && t < out ? 1 : 0);
  }};
}

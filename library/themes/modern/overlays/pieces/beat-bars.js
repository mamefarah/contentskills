import {C, STEP, stage, span, snap, easeIn} from '../../kit.js';

// A beat accent: three charcoal vertical bars cross the frame in turn, one per half beat, each sweeping from one
// edge to the other (alternating directions) and covering a strip for an instant — a strip-wipe flicker to mark
// a cut or a hit without hiding the face for more than a frame or two. Props: n (bars), width (share of W), color.
export const meta = {duration: .8};
export const defaults = {n: 3, width: .34, color: 'coal'};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W, H} = st, n = props.n ?? 3, bw = W * (props.width ?? .34);
  const col = props.color === 'white' ? C.white : C.coal;
  const bars = Array.from({length: n}, (_, i) => st.root.append('rect').attr('width', bw).attr('height', H).attr('fill', col));
  return {seek(t) {
    bars.forEach((b, i) => {
      const q = span(t, i * STEP * .5, STEP * 1.4), d = i % 2 ? -1 : 1, x = d > 0 ? -bw + (W + bw) * easeIn(q) * .5 + (W + bw) * snap(q) * .5 : W - (W + bw) * (easeIn(q) * .5 + snap(q) * .5);
      b.attr('x', x).attr('opacity', q > 0 && q < 1 ? 1 : 0);
    });
  }};
}

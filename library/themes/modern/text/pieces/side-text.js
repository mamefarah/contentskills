import {C, STEP, stage, word, label, fit, capH, up, span, snap} from '../../kit.js';

// Heavy capitals running up the frame edge (rotated), building letter by letter from the bottom; a small tracked
// sub line beside it and a thin rule. `side` left | right; `top`/`bottom` bound the run; `edge` the margin.
export const meta = {duration: 4, live: true};
export const defaults = {text: 'BEHIND THE SCENES', sub: 'PART 02 / UNCUT', side: 'left', top: 300, bottom: 1560, edge: 40};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W} = st, text = up(props.text), left = props.side !== 'right', room = (props.bottom ?? 1560) - (props.top ?? 300);
  const size = fit(text, room, 110), cap = capH(size), cy = ((props.top ?? 300) + (props.bottom ?? 1560)) / 2, e = props.edge ?? 40;
  const x = left ? e + cap : W - e - cap;
  const g = st.root.append('g').attr('transform', `translate(${x} ${cy}) rotate(${left ? -90 : 90})`);
  const wd = word(g, text, 0, left ? 0 : cap, size, {order: left ? 'left' : 'left', seed: 4, lift: st});
  const sub = props.sub ? label(g, 0, left ? 64 : cap + 64, up(props.sub), {size: 22, anchor: 'middle', track: .34, lift: st}) : null;
  const life = props.life ?? meta.duration, out = Math.max(.9, life - .45);
  return {seek(t) {
    wd.seek(t, {at: 0, step: .035, hold: .07, out, outStep: .025});
    sub?.attr('opacity', t > .6 && t < out ? .9 : 0);
  }};
}

import {C, STEP, stage, g, panel, slot, veil, word, label, corners, fit, up, span, snap} from '../../kit.js';

// Two words stacked. The top word builds on charcoal; on the beat a picture slot opens below it and widens to the
// frame edges, and the bottom word builds over the picture. A caption sits under the top word, a note at the foot.
export const meta = {duration: 4.5, live: true};
export const defaults = {
  top: 'THINK', bottom: 'BIGGER', caption: 'START BEFORE\nYOU FEEL READY', note: 'THE FIRST DRAFT CAN BE BAD',
  labels: ['PART TWO', 'MINDSET', 'NOTES', 'PG. 04'], image: null, tone: 'teal', field: 'charcoal',
};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'tall', field: props.field}), {W, H, k} = st, top = up(props.top), bottom = up(props.bottom);
  const half = H * .46, pics = g(st);
  const sl = slot(st, pics, {tone: props.tone, image: props.image, w0: 70, w1: W, y: half, h: H - half});
  veil(st, pics, .22).attr('y', half);
  const size1 = fit(top, W * .82, 250 * (.7 + .3 * k)), size2 = fit(bottom, W * .86, 250 * (.7 + .3 * k));
  const w1 = word(st.root, top, W / 2, half - H * .1, size1, {color: st.fg, seed: 4});
  const w2 = word(st.root, bottom, W / 2, half + (H - half) * .5 + size2 * .36, size2, {seed: 9, lift: st});
  const cap = props.caption ? label(st.root, W / 2, half - H * .1 + 64 * (.6 + .4 * k), up(props.caption), {size: 22 + 4 * k, anchor: 'middle', track: .3, color: st.fg}) : null;
  const note = props.note ? label(st.root, W / 2, H - 70 * (.7 + .3 * k), up(props.note), {size: 20 + 4 * k, anchor: 'middle', track: .3, opacity: .85}) : null;
  const cl = corners(st, st.root, [props.labels?.[0], props.labels?.[1]]);
  const out = meta.duration - .8;
  return {seek(t) {
    st.tick(t);
    w1.seek(t, {at: .1, out});
    cap?.attr('opacity', t > .6 && t < out ? .9 : 0);
    sl.seek(t, .9, STEP * 2.5, out + .35);
    w2.seek(t, {at: 1.35, out: out + .1});
    note?.attr('opacity', t > 1.9 && t < out + .3 ? .85 : 0);
    cl(t, .4, out);
  }};
}

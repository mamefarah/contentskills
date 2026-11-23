import {C, STEP, stage, g, strips, veil, words, label, corners, frameTag, fit, up, span, snap} from '../../kit.js';

// Three picture strips slide in from alternate ends with staggered edges; the headline builds letter by
// letter in a scattered order (ghost, then solid) across them. Near the end the letters drop out again and
// the strips leave. `images` (optional) puts stills in the strips instead of studio tones.
export const meta = {duration: 4.5, live: true};
export const defaults = {
  lines: ['MAKE IT', 'LOUD'], kicker: 'ONE IDEA. FULL VOLUME.', note: 'SAY THE THING YOU MEAN',
  labels: ['VOL. 01', 'NO. 26', 'KINETIC TYPE', 'SIDE A'], foot: '9:16 / 24 FPS', tones: ['ember', 'ink', 'bone'], images: [], field: 'charcoal',
};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'tall', field: props.field}), {W, H, k} = st, lines = [].concat(props.lines).map(up);
  const pics = g(st), sp = strips(st, pics, {n: 3, tones: props.tones, images: props.images ?? []});
  veil(st, pics, .32);
  const type = g(st), size = fit(lines, W * .84, 230 * (.75 + .25 * k)), block = words(type, lines, W / 2, H * .5, size, {lift: st});
  const kick = props.kicker ? label(type, W / 2, block.top - 48 * (.7 + .3 * k), up(props.kicker), {size: 24 + 6 * k, anchor: 'middle', track: .32}) : null;
  const note = props.note ? label(type, W / 2, block.bottom + 70 * (.7 + .3 * k), up(props.note), {size: 20 + 4 * k, anchor: 'middle', track: .3, opacity: .85}) : null;
  const cl = corners(st, st.root, props.labels), tag = props.foot ? frameTag(st.root, st, {text: props.foot}) : null;
  const out = meta.duration - .9;
  return {seek(t) {
    st.tick(t);
    sp.seek(t, 0, out + .45);
    block.seek(t, {at: .45, step: .05, out}, .22);
    kick?.attr('opacity', t > .3 && t < out + .1 ? 1 : 0);
    note?.attr('opacity', t > 1.3 && t < out + .2 ? .85 : 0);
    cl(t, .5, out); tag?.attr('opacity', t > .2 ? .75 : 0);
  }};
}

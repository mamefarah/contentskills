import {C, STEP, stage, g, slot, veil, word, label, mono, rule, corners, fit, capH, up, span, snap} from '../../kit.js';

// A chapter opener. A huge ghosted chapter number fills the upper frame; a picture slot opens across the middle
// and widens; the title builds over it letter by letter; kicker above, note below.
export const meta = {duration: 4.5, live: true};
export const defaults = {number: '02', kicker: 'CHAPTER', title: 'THE BUILD', note: 'WHERE THE IDEA\nBECOMES A THING', labels: ['SECTION', 'PT. 02'], tone: 'teal', image: null, field: 'charcoal'};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'tall', field: props.field}), {W, H, k} = st, title = up(props.title), num = String(props.number ?? '');
  const nsize = fit(num, W * .7, H * .3, {weight: 900, track: -.02}), ncap = capH(nsize, {weight: 900});
  const sh = H * (st.sq ? .36 : .3), gapN = 90 * (.5 + .5 * k), y0 = Math.max(H * .08, (H - (ncap + gapN + sh + 120 * k)) / 2);
  const big = word(st.root, num, W / 2, y0 + ncap, nsize, {weight: 900, track: -.02, ghost: .12, color: st.fg, seed: 1});
  const sy = y0 + ncap + gapN, pics = g(st), sl = slot(st, pics, {tone: props.tone, image: props.image, y: sy, h: sh, w0: 50, w1: W});
  const vl = veil(st, pics, .25).attr('y', sy).attr('height', sh);
  const size = fit(title, W * .84, 190 * (.6 + .4 * k)), cap = capH(size), wy = sy + sh / 2 + cap / 2;
  const tw = word(st.root, title, W / 2, wy, size, {seed: 6, lift: st});
  const kick = label(st.root, W / 2, sy - 30 * (.6 + .4 * k), up(props.kicker) + (num ? ' ' + num : ''), {size: 22 + 4 * k, anchor: 'middle', track: .4, color: st.fg});
  const note = props.note ? label(st.root, W / 2, sy + sh + 70 * (.6 + .4 * k), up(props.note), {size: 22 + 4 * k, anchor: 'middle', track: .3, color: st.fg, opacity: .85}) : null;
  const cl = corners(st, st.root, [null, null, props.labels?.[0], props.labels?.[1]]), out = meta.duration - .7;
  return {seek(t) {
    st.tick(t);
    // the number holds as a ghost and goes solid only on its last beat, then drops out first
    big.seek(t, {at: 0, step: .1, hold: 99, out: out - .15});
    sl.seek(t, .5, STEP * 2.5, out + .2); vl.attr('opacity', t > .5 && t < out + .3 ? .25 : 0);
    tw.seek(t, {at: 1, out});
    kick.attr('opacity', t > .3 && t < out ? 1 : 0); note?.attr('opacity', t > 1.6 && t < out ? .85 : 0);
    cl(t, .4, out);
  }};
}

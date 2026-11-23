import {C, STEP, stage, g, punchCard, veil, word, label, corners, fit, capH, count, up, span, snap} from '../../kit.js';

// A number in huge heavy type over a picture card that punches up from the middle to full frame on the beat.
// The figure counts up while the card grows, its digits settling solid one by one; kicker above, label and
// note below. Pass the value as a string ('2026', '$4.2M', '87%').
export const meta = {duration: 4.5, live: true};
export const defaults = {
  value: '2026', kicker: 'MARK THE YEAR', label: 'EVERYTHING CLICKS', note: 'SMALL STEPS, STACKED DAILY',
  labels: ['DATA POINT', 'NO. 01'], tone: 'ember', image: null, field: 'charcoal',
};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'tall', field: props.field}), {W, H, k} = st, value = String(props.value);
  const pics = g(st), card = punchCard(st, pics, {tone: props.tone, image: props.image, from: .56}), vl = veil(st, pics, .3);
  const size = fit(value, W * .86, 420 * (.6 + .4 * k), {track: 0, weight: 900}), cap = capH(size, {weight: 900});
  const cy = H * .5, base = cy + cap / 2;
  const num = st.root.append('text').attr('x', W / 2).attr('y', base).attr('text-anchor', 'middle').attr('fill', C.white).attr('filter', st.url('lift')).style('font', `900 ${size}px Montserrat`).style('letter-spacing', '-0.02em');
  const kick = props.kicker ? word(st.root, up(props.kicker), W / 2, cy - cap / 2 - 50 * (.6 + .4 * k), 34 * (.7 + .3 * k), {font: '"Inter Tight"', weight: 800, track: .3, seed: 2}) : null;
  const lab = props.label ? word(st.root, up(props.label), W / 2, base + 90 * (.6 + .4 * k), 52 * (.7 + .3 * k), {seed: 5, lift: st}) : null;
  const note = props.note ? label(st.root, W / 2, base + 150 * (.6 + .4 * k), up(props.note), {size: 20 + 4 * k, anchor: 'middle', track: .3, opacity: .85}) : null;
  const cl = corners(st, st.root, props.labels), out = meta.duration - .7;
  return {seek(t) {
    st.tick(t);
    card.seek(t, 0, .55);
    vl.attr('opacity', .3 * snap(span(t, .55, STEP)));
    const q = snap(span(t, .5, 1.1)), gone = t > out + .25;
    num.text(count(value, q)).attr('opacity', t < .45 || gone ? 0 : 1).attr('fill-opacity', q < 1 ? .55 + .45 * q : 1);
    kick?.seek(t, {at: .3, step: .02, out}); lab?.seek(t, {at: 1.4, step: .03, out});
    note?.attr('opacity', t > 1.9 && t < out ? .85 : 0);
    cl(t, .4, out);
  }};
}

import {C, STEP, stage, g, mosaic, veil, words, label, rule, corners, fit, up, span, snap} from '../../kit.js';

// The end card. A 2x2 mosaic of pictures wipes in cell by cell; the closing lines build over it in heavy
// capitals; the action and handle sit below in tracked labels with a rule; a strip of small type at the foot.
export const meta = {duration: 5, live: true};
export const defaults = {
  lines: ['FOLLOW', 'FOR MORE'], action: 'NEW VIDEO EVERY WEEK', handle: '@YOURNAME', strip: 'SEE YOU NEXT TIME',
  labels: ['THE END', 'FIN.'], tones: ['steel', 'ember', 'rose', 'teal'], images: [], field: 'charcoal',
};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'tall', field: props.field}), {W, H, k} = st, lines = [].concat(props.lines).map(up);
  const pics = g(st), mo = mosaic(st, pics, {tones: props.tones, images: props.images ?? []}), vl = veil(st, pics, .4);
  const size = fit(lines, W * .82, 200 * (.6 + .4 * k)), block = words(st.root, lines, W / 2, H * .44, size, {lift: st});
  const ry = block.bottom + 70 * (.6 + .4 * k), rl = rule(st.root, W / 2 - 90, ry, W / 2 + 90, ry, {width: 3});
  const act = props.action ? label(st.root, W / 2, ry + 60 * (.6 + .4 * k), up(props.action), {size: 22 + 4 * k, anchor: 'middle', track: .3, lift: st}) : null;
  const handle = props.handle ? label(st.root, W / 2, ry + 120 * (.6 + .4 * k), props.handle, {size: 36 + 6 * k, anchor: 'middle', track: .06, weight: 800, lift: st}) : null;
  const strip = props.strip ? label(st.root, W / 2, H - 60 * (.6 + .4 * k), up(props.strip), {size: 18 + 4 * k, anchor: 'middle', track: .5, opacity: .8, lift: st}) : null;
  const cl = corners(st, st.root, props.labels);
  return {seek(t) {
    st.tick(t);
    mo.seek(t, 0); vl.attr('opacity', .4 * snap(span(t, .4, STEP)));
    block.seek(t, {at: .6, step: .05});
    rl.draw(snap(span(t, 1.5, STEP * 2)));
    act?.attr('opacity', t > 1.7 ? 1 : 0); handle?.attr('opacity', t > 1.9 ? 1 : 0); strip?.attr('opacity', t > 2.2 ? .8 : 0);
    cl(t, .5);
  }};
}

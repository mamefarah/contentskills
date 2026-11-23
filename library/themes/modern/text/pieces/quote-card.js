import {C, STEP, stage, g, slot, veil, word, label, rule, corners, wrap, capH, measure, up, span, snap} from '../../kit.js';

// A quote. A narrow picture slot opens at the top and widens; a huge ghosted quote mark sits on it; the quote
// arrives below one word per beat in heavy sentence case; a rule draws and the attribution types on.
export const meta = {duration: 5, live: true};
export const defaults = {
  quote: 'Done beats perfect every single time', by: 'NOTE TO SELF', role: 'PINNED SINCE DAY ONE',
  labels: ['QUOTED', 'NO. 12'], tone: 'rose', image: null, field: 'charcoal',
};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'tall', field: props.field}), {W, H, k} = st, m = 84, o = {track: -.01, font: '"Inter Tight"', weight: 800};
  const sh = H * (st.sq ? .3 : .34), pics = g(st), sl = slot(st, pics, {tone: props.tone, image: props.image, y: H * .08, h: sh, w0: 60, w1: W - m * 2});
  const mark = st.root.append('text').attr('x', m + 30).attr('y', H * .08 + sh - 24 * (.6 + .4 * k)).attr('fill', C.white).style('font', `900 ${300 * (.6 + .4 * k)}px Montserrat`).text('“');
  const text = String(props.quote ?? '');
  let size = 96 * (.6 + .4 * k), lines;
  const room = H - (H * .08 + sh) - 260 * (.6 + .4 * k);
  for (; size > 30; size -= 3) { lines = wrap(text, size, W - m * 2, o); if (lines.length * capH(size, o) * 1.55 < room) break; }
  const cap = capH(size, o), pitch = cap * 1.55, top = H * .08 + sh + 70 * (.6 + .4 * k);
  const items = []; let n = 0;
  lines.forEach((line, li) => { let x = m; line.split(' ').forEach(wd => { items.push({w: word(st.root, wd, x, top + cap + li * pitch, size, {...o, anchor: 'start', order: 'left', color: st.fg}), at: .7 + n * STEP}); x += measure(wd + ' ', size, o) + size * .02; n++; }); });
  const ry = top + lines.length * pitch + 10, end = .7 + n * STEP, rl = rule(st.root, m, ry, m + 120, ry, {width: 4, color: st.fg});
  const by = label(st.root, m, ry + 52 * (.7 + .3 * k), up(props.by), {size: 26 + 4 * k, track: .26, color: st.fg, weight: 700});
  const role = props.role ? label(st.root, m, ry + 92 * (.7 + .3 * k), up(props.role), {size: 19 + 3 * k, track: .3, color: st.fg, opacity: .7}) : null;
  const cl = corners(st, st.root, props.labels?.length > 2 ? [props.labels[0], props.labels.at(-1)] : props.labels), out = meta.duration - .6;
  return {seek(t) {
    st.tick(t);
    sl.seek(t, 0, STEP * 2.5, out + .2);
    mark.attr('opacity', t > .45 && t < out ? (t < .6 ? .3 : .9) : 0);
    items.forEach(it => it.w.seek(t, {at: it.at, step: .025, hold: .06, out, outStep: .015}));
    rl.draw(snap(span(t, end, STEP * 2)) * (t < out ? 1 : 0));
    by.attr('opacity', t > end + .15 && t < out ? 1 : 0); role?.attr('opacity', t > end + .3 && t < out ? .7 : 0);
    cl(t, .3, out);
  }};
}

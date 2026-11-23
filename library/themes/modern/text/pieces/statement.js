import {C, STEP, stage, g, panel, word, label, rule, corners, wrap, capH, measure, up, span, snap} from '../../kit.js';

// A sentence in heavy capitals, left-aligned, one word per beat. Each word builds letter by letter (ghost, then
// solid); words in `emphasis` sit on a picture block that wipes in behind them. A tag above, a rule and a foot below.
export const meta = {duration: 6, live: true};
export const defaults = {
  statement: 'Good ideas get better the moment you ship them', emphasis: ['SHIP'], tag: 'FIELD NOTE 07',
  labels: ['', 'OBSERVED', '', 'KEEP GOING'], foot: 'SHIP IT, THEN FIX IT', tone: 'ember', field: 'charcoal',
};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'tall', field: props.field}), {W, H, k} = st, m = 80, text = up(props.statement), emph = new Set([].concat(props.emphasis ?? []).map(up));
  const o = {track: .02};
  let size = 150 * (.65 + .35 * k), lines;
  for (; size > 40; size -= 4) { lines = wrap(text, size, W - m * 2, o); if (lines.length * capH(size, o) * 1.42 < H * .58) break; }
  const cap = capH(size, o), pitch = cap * 1.42, top = H * .5 - (lines.length * pitch - (pitch - cap)) / 2;
  const blocks = g(st), type = g(st), items = [];
  let n = 0;
  lines.forEach((line, li) => {
    let x = m; const y = top + cap + li * pitch;
    line.split(' ').forEach(wd => {
      const w = measure(wd, size, o), isE = emph.has(wd.replace(/[^\w']/g, ''));
      const p = isE ? panel(st, blocks, {x: x - size * .12, y: y - cap - size * .14, w: w + size * .24, h: cap + size * .28, tone: props.tone}) : null;
      items.push({w: word(type, wd, x, y, size, {anchor: 'start', seed: n + 2, track: o.track, order: 'left', color: st.fg}), p, at: .5 + n * STEP * 1.1, box: p ? {...p.box} : null});
      x += w + measure(' ', size, o) + size * .06; n++;
    });
  });
  const tag = props.tag ? label(st.root, m, top - 60 * (.7 + .3 * k), up(props.tag), {size: 22 + 4 * k, track: .32, color: st.fg}) : null;
  const ry = top + lines.length * pitch + 30 * k, rl = rule(st.root, m, ry, W - m, ry, {width: 2, color: st.fg});
  const foot = props.foot ? label(st.root, m, ry + 56 * (.7 + .3 * k), up(props.foot), {size: 20 + 4 * k, track: .3, color: st.fg, opacity: .8}) : null;
  const cl = corners(st, st.root, props.labels), end = .5 + n * STEP * 1.1, out = meta.duration - .7;
  return {seek(t) {
    st.tick(t);
    items.forEach(it => {
      it.w.seek(t, {at: it.at, step: .03, hold: .07, out, outStep: .02});
      if (it.p) { const a = snap(span(t, it.at - .05, STEP)), b = snap(span(t, out, STEP)); it.p.set({w: it.box.w * a * (1 - b), opacity: a > 0 && b < 1 ? 1 : 0}); }
    });
    tag?.attr('opacity', t > .2 && t < out ? 1 : 0);
    rl.range(snap(span(t, out, STEP * 2)), snap(span(t, end, STEP * 3)));
    foot?.attr('opacity', t > end + .3 && t < out ? .8 : 0);
    cl(t, .4, out);
  }};
}

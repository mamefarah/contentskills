import {C, STEP, stage, g, panel, word, label, mono, rule, corners, fit, capH, up, pad, span, snap} from '../../kit.js';

// A list. The title builds at the top; then each item lands on its beat: a thin picture strip wipes in at the
// left as its thumbnail, a frame number in mono and the item in heavy capitals building letter by letter.
// `step` is the time between items.
export const meta = {duration: 6, live: true};
export const defaults = {
  title: 'THE PLAN', kicker: 'FOUR MOVES', items: ['FIND THE HOOK', 'WRITE IT SHORT', 'CUT THE FLUFF', 'POST IT TODAY'],
  labels: ['AGENDA', 'TODAY'], step: .8, tones: ['ember', 'teal', 'bone', 'rose', 'steel', 'olive'], field: 'charcoal',
};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'tall', field: props.field}), {W, H, k} = st, m = 80, items = [].concat(props.items).map(up).slice(0, 7), n = items.length;
  const tsize = fit(up(props.title), W - m * 2, 170 * (.6 + .4 * k)), tcap = capH(tsize), ty = H * .16 + tcap;
  const title = word(st.root, up(props.title), m, ty, tsize, {anchor: 'start', seed: 3, color: st.fg});
  const kick = props.kicker ? label(st.root, m, ty - tcap - 34 * (.6 + .4 * k), up(props.kicker), {size: 22 + 4 * k, track: .32, color: st.fg}) : null;
  const top = ty + 70 * (.6 + .4 * k), room = H * .92 - top, rowH = Math.min(220 * (.6 + .4 * k), room / n), thumbW = rowH * .55;
  const isize = Math.min(fit(items, W - m * 2 - thumbW - 120, 92 * (.6 + .4 * k), {track: .02}), rowH * .4), icap = capH(isize);
  const step = props.step ?? .8, at0 = .9;
  const rows = items.map((it, i) => {
    const y = top + i * rowH, cy = y + rowH / 2;
    const p = panel(st, st.root, {x: m, y: y + rowH * .1, w: thumbW, h: rowH * .8, tone: props.tones[i % props.tones.length]});
    const num = mono(st.root, m + thumbW + 30, cy - icap / 2 - 14, pad(i + 1) + ' /', {size: 20 + 4 * k, color: st.fg, opacity: .7});
    const w = word(st.root, it, m + thumbW + 30, cy + icap / 2 + 18 * (.6 + .4 * k), isize, {anchor: 'start', seed: i + 4, track: .02, color: st.fg});
    const r = rule(st.root, m + thumbW + 30, y + rowH, W - m, y + rowH, {width: 1.5, color: C.mute});
    return {p, num, w, r, at: at0 + i * step, h: rowH * .8, y: y + rowH * .1};
  });
  const cl = corners(st, st.root, [null, props.labels?.[0], null, props.labels?.[1]]), out = Math.max(at0 + n * step + .8, meta.duration - .7);
  return {seek(t) {
    st.tick(t);
    title.seek(t, {at: .1, out}); kick?.attr('opacity', t > .3 && t < out ? 1 : 0);
    rows.forEach((r, i) => {
      const a = snap(span(t, r.at, STEP * 1.2)), b = snap(span(t, out + i * .05, STEP));
      r.p.set({h: r.h * a * (1 - b), y: r.y, opacity: a > 0 && b < 1 ? 1 : 0, zoom: 1.2 - .2 * a});
      r.num.attr('opacity', t > r.at + .1 && t < out ? .7 : 0);
      r.w.seek(t, {at: r.at + .1, step: .03, hold: .07, out: out + i * .05, outStep: .02});
      r.r.range(0, snap(span(t, r.at, STEP * 3)) * (t < out ? 1 : 0));
    });
    cl(t, .4, out);
  }};
}

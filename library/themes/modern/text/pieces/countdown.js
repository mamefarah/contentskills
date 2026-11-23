import {C, STEP, stage, g, panel, veil, word, label, corners, fit, capH, up, span, snap, toneOf} from '../../kit.js';

// A countdown. Each count takes one slice of the duration: a picture card punches in to full frame behind a huge
// digit that builds solid and drops out; the layout alternates strips, card and mosaic feel by changing the
// card's start size and the tone. The last beat shows `go` across the frame.
export const meta = {duration: 4};
export const defaults = {from: 3, go: 'GO', label: 'STARTING IN', note: 'GET READY', labels: ['STAND BY', 'TAKE 01'], tones: ['teal', 'rose', 'sand', 'ember'], field: 'charcoal'};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'tall', field: props.field}), {W, H, k} = st, from = Math.max(1, Math.min(9, props.from | 0)), steps = from + 1, len = meta.duration / steps;
  const tones = props.tones ?? defaults.tones, pics = g(st);
  const cards = Array.from({length: steps}, (_, i) => panel(st, pics, {tone: toneOf(tones[i % tones.length])}));
  const vl = veil(st, pics, .28);
  const items = Array.from({length: steps}, (_, i) => {
    const s = i < from ? String(from - i) : up(props.go), size = fit(s, W * .8, (i < from ? 640 : 300) * (.6 + .4 * k), {weight: 900}), cap = capH(size, {weight: 900});
    return word(st.root, s, W / 2, H / 2 + cap / 2, size, {weight: 900, seed: i + 1, lift: st});
  });
  const lab = props.label ? label(st.root, W / 2, H * .2, up(props.label), {size: 26 + 4 * k, anchor: 'middle', track: .4, lift: st}) : null;
  const note = props.note ? label(st.root, W / 2, H * .82, up(props.note), {size: 22 + 4 * k, anchor: 'middle', track: .4, opacity: .85, lift: st}) : null;
  const cl = corners(st, st.root, props.labels);
  return {seek(t) {
    st.tick(t);
    const i = Math.min(steps - 1, Math.floor(t / len)), u = t - i * len;
    cards.forEach((c, j) => {
      if (j !== i) return c.set({opacity: 0});
      const s = [.55, .8, .35][j % 3] + (1 - [.55, .8, .35][j % 3]) * snap(span(u, .05, STEP * .9)), w = W * s, h = H * s;
      c.set({x: (W - w) / 2, y: (H - h) / 2, w, h, zoom: s * 1.08, opacity: 1});
    });
    items.forEach((w, j) => j === i ? w.seek(u, {at: .02, step: .04, hold: .06, out: j < steps - 1 ? len - .16 : null, outStep: .02}) : w.seek(-1));
    lab?.attr('opacity', i < from ? 1 : 0); note?.attr('opacity', t > len * .5 ? .85 : 0);
    cl(t, .2);
  }};
}

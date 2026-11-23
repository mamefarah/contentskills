import {C, STEP, stage, g, panel, veil, word, label, mono, rule, corners, fit, capH, up, span, snap} from '../../kit.js';

// Two sides. The frame splits into an upper and a lower picture panel sliding in from opposite sides;
// word A builds on the top panel, word B on the bottom; on the seam a rule draws and the mark (VS) sits
// in a charcoal tab. Notes under each word.
export const meta = {duration: 4.5, live: true};
export const defaults = {
  a: 'FAST', b: 'PERFECT', mark: 'VS', aNote: 'SHIPS TODAY', bNote: 'SHIPS SOMEDAY', labels: ['ROUND ONE', 'PICK A SIDE'],
  tones: ['ember', 'steel'], images: [], field: 'charcoal',
};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'tall', field: props.field}), {W, H, k} = st, gap = 12, hh = (H - gap) / 2, tones = props.tones ?? defaults.tones;
  const pics = g(st);
  const pa = panel(st, pics, {x: 0, y: 0, w: W, h: hh, tone: tones[0], image: props.images?.[0]}), pb = panel(st, pics, {x: 0, y: hh + gap, w: W, h: hh, tone: tones[1], image: props.images?.[1]});
  veil(st, pics, .28);
  const A = up(props.a), B = up(props.b), size = fit([A, B], W * .8, 240 * (.6 + .4 * k)), cap = capH(size);
  const wa = word(st.root, A, W / 2, hh * .55 + cap / 2, size, {seed: 2, lift: st}), wb = word(st.root, B, W / 2, hh + gap + hh * .45 + cap / 2, size, {seed: 7, lift: st});
  const na = props.aNote ? label(st.root, W / 2, hh * .55 + cap / 2 + 60 * (.6 + .4 * k), up(props.aNote), {size: 20 + 4 * k, anchor: 'middle', track: .3, lift: st}) : null;
  const nb = props.bNote ? label(st.root, W / 2, hh + gap + hh * .45 + cap / 2 + 60 * (.6 + .4 * k), up(props.bNote), {size: 20 + 4 * k, anchor: 'middle', track: .3, lift: st}) : null;
  const tab = st.root.append('rect').attr('fill', st.field.bg), tw = 150 * (.7 + .3 * k), th = 70 * (.7 + .3 * k);
  tab.attr('x', (W - tw) / 2).attr('y', hh + gap / 2 - th / 2).attr('width', tw).attr('height', th);
  const vs = mono(st.root, W / 2, hh + gap / 2 + 11 * (.7 + .3 * k), up(props.mark), {size: 32 * (.7 + .3 * k), anchor: 'middle', color: st.fg});
  const cl = corners(st, st.root, props.labels), out = meta.duration - .7;
  return {seek(t) {
    st.tick(t);
    const a = snap(span(t, 0, STEP * 1.5)), b = snap(span(t, STEP, STEP * 1.5)), x = snap(span(t, out + .2, STEP * 1.5));
    pa.set({x: -(1 - a) * W - x * W, dx: -(1 - a) * W - x * W, opacity: a > 0 ? 1 : 0});
    pb.set({x: (1 - b) * W + x * W, dx: (1 - b) * W + x * W, opacity: b > 0 ? 1 : 0});
    wa.seek(t, {at: .4, out}); wb.seek(t, {at: 1.2, out});
    na?.attr('opacity', t > .9 && t < out ? 1 : 0); nb?.attr('opacity', t > 1.7 && t < out ? 1 : 0);
    const on = t > .8 && t < out + .2; tab.attr('opacity', on ? 1 : 0); vs.attr('opacity', on ? 1 : 0);
    cl(t, .4, out);
  }};
}

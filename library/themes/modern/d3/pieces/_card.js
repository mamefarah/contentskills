// Shared diagram card for the modern d3 pieces (the underscore keeps it out of piece ids).
// A 1000x1000 editorial card on charcoal (or nothing when `clear`, with the kit's faint lift under
// everything so white reads on footage): a tiny tracked kicker and a Space Mono index at the top, the
// title as THE BIG WORD (heavy Montserrat capitals building letter by letter through a ghost), a
// hairline rule snapping across under it, and a footer with "Illustrative data" and a running
// timecode. Pieces start their body at `card.T` (s). Fills are studio-light picture tones (kit TONES),
// everything else is white / grey on charcoal. All motion is set from seek(t).
import {C, F, STEP, stage, word, label, mono, rule, fit, up, span, snap, pad} from '../../kit.js';
export * from '../../kit.js';

export const BODY = {x0: 80, x1: 920, y0: 250, y1: 880};

/** Heavy figure text (Montserrat 800), for values and numbers. */
export const heavy = (parent, x, y, str, size, o = {}) => label(parent, x, y, str, {size, font: F.head, weight: 800, track: .01, ...o});
/** Short number formatting: 12400 -> 12.4K. */
export const short = v => { const a = Math.abs(v); return a >= 1e9 ? +(v / 1e9).toFixed(1) + 'B' : a >= 1e6 ? +(v / 1e6).toFixed(1) + 'M' : a >= 1e4 ? +(v / 1e3).toFixed(1) + 'K' : String(Math.round(v * 10) / 10); };
/** A value counting up (q 0..1), keeping the decimals the value has; large values shortened. */
export const figure = (v, q = 1) => { const d = (String(v).split('.')[1] ?? '').length, x = v * q; return Math.abs(v) >= 1e4 ? short(x) : x.toFixed(d); };
/** Default picture tones for data series, in order. */
export const SERIES = ['ember', 'steel', 'bone', 'teal', 'rose', 'sand', 'olive', 'cobalt'];

export function card(el, props = {}, {note = true} = {}) {
  const clear = Boolean(props.clear), st = stage(el, {mode: 'card', clear}), {root} = st;
  if (clear) root.attr('filter', st.url('lift'));
  const head = up(props.title ?? ''), size = fit(head, 840, 74);
  const kicker = props.unit ? label(root, 80, 82, up(props.unit), {size: 19, track: .3, color: C.dim, opacity: 0}) : null;
  const index = mono(root, 920, 82, props.index ?? '01', {size: 19, anchor: 'end', color: C.dim, opacity: 0});
  const title = word(root, head, 80, 168, size, {anchor: 'start', seed: 5});
  const line = rule(root, 80, 202, 920, 202, {width: 2});
  const foot = note && props.note !== false ? label(root, 80, 950, up(props.note ?? 'Illustrative data'), {size: 15, track: .3, color: C.dim, opacity: 0}) : null;
  const clock = note ? mono(root, 920, 950, '', {size: 16, anchor: 'end', color: C.mute, opacity: 0}) : null;
  const T = .75;
  return {st, root, T, clear, heavy,
    seek(t) {
      st.tick(t);
      kicker?.attr('opacity', t >= .05 ? .9 : 0); index.attr('opacity', t >= .15 ? .9 : 0);
      title.seek(t, {at: .1, step: Math.min(.04, .5 / Math.max(1, head.length)), hold: .08});
      line.draw(snap(span(t, .25, STEP * 3)));
      foot?.attr('opacity', t >= 1.2 ? .8 : 0);
      clock?.attr('opacity', t >= 1.2 ? .8 : 0).text(`${pad(t / 60)}:${pad(t % 60)}:${pad((t * 24) % 24)}`);
    }};
}

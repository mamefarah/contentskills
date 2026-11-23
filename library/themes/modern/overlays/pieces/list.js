import {C, STEP, stage, word, mono, rule, fit, capH, up, pad, span, snap} from '../../kit.js';

// A list in heavy capitals, one item per beat (`step` s apart): a mono number, the item building letter by letter
// and a hairline under it. Lower part of the frame by default. Props: items, x, y (top), step, size, numbered.
export const meta = {duration: 5, live: true};
export const defaults = {items: ['LIGHT', 'FRAME', 'MOTION', 'CUT'], x: 72, y: 1340, step: .5, size: 92, numbered: true};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), items = [].concat(props.items).map(up), x = props.x ?? 72, y = props.y ?? 1340;
  const size = fit(items, 820, props.size ?? 92), cap = capH(size), pitch = cap * 1.75, nx = props.numbered === false ? x : x + 90;
  const rows = items.map((it, i) => {
    const by = y + cap + i * pitch;
    return {n: props.numbered === false ? null : mono(st.root, x, by, pad(i + 1), {size: 26, lift: st}), w: word(st.root, it, nx, by, size, {anchor: 'start', order: 'left', seed: i, lift: st}),
      r: rule(st.root, nx, by + 20, nx + Math.min(820, 300), by + 20, {width: 2}), at: .05 + i * (props.step ?? .5)};
  });
  const life = props.life ?? meta.duration, out = Math.max(rows.at(-1).at + .6, life - .45);
  return {seek(t) {
    rows.forEach((r, i) => {
      const o = out + i * .04;
      r.n?.attr('opacity', t > r.at && t < o ? .85 : 0);
      r.w.seek(t, {at: r.at, step: .03, hold: .06, out: o, outStep: .02});
      r.r.range(snap(span(t, o, STEP)), snap(span(t, r.at + .1, STEP * 1.5)));
    });
  }};
}

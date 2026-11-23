import {C, STEP, stage, word, fit, capH, up, span, snap} from '../../kit.js';

// One word stacked three times: ghost, solid, ghost. The rows slide in from opposite sides on the beat and
// settle; the solid row's letters build in, then all three drop out. An echo of the big word for emphasis.
// Props: word, y (middle row centre), size, gap (row pitch, share of cap height).
export const meta = {duration: 3, live: true};
export const defaults = {word: 'AGAIN', y: 1540, size: 170, gap: 1.25};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W} = st, w = up(props.word), y = props.y ?? 1540;
  const size = fit(w, W * .8, props.size ?? 170), cap = capH(size), pitch = cap * (props.gap ?? 1.25);
  const rows = [-1, 0, 1].map(r => { const g = st.root.append('g'); return {g, r, w: word(g, w, W / 2, y + cap / 2 + r * pitch, size, {seed: 4 + r, ghost: .28, lift: r ? null : st})}; });
  const life = props.life ?? meta.duration, out = Math.max(.9, life - .4);
  return {seek(t) {
    rows.forEach(({g, r, w: wd}, i) => {
      const a = snap(span(t, i * STEP * .5, STEP * 1.4));
      g.attr('transform', `translate(${((1 - a) * (i % 2 ? -1 : 1) * W).toFixed(1)} 0)`);
      if (r) { wd.nodes.forEach((n, j) => wd.set(j, t >= 0 && t < out + j * .02 ? 1 : 0)); }
      else wd.seek(t, {at: .3, step: .04, hold: .08, out, outStep: .03});
    });
  }};
}

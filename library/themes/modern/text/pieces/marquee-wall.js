import {C, STEP, stage, g, measure, capH, up, span, snap, hash} from '../../kit.js';

// A wall of heavy capitals in rows that run in alternate directions, solid and ghost rows taking turns.
// On each beat one row snaps solid while the others stay ghosted, so the wall pulses in time. Rows repeat
// to fill the frame. `speed` scales the run.
export const meta = {duration: 5, live: true};
export const defaults = {rows: ['KEEP MOVING', 'NO PAUSE', 'LOOP IT', 'STAY LOUD', 'ONE MORE TIME'], speed: 1, field: 'charcoal'};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'tall', field: props.field}), {W, H} = st, rows = [].concat(props.rows).map(up).filter(Boolean);
  const n = Math.max(5, Math.round(H / 190)), rh = H / n, o = {track: .02}, size = rh * .8 / (capH(100, o) / 100), cap = capH(size, o);
  const lines = Array.from({length: n}, (_, i) => {
    const str = rows[i % rows.length] + '  /  ', w = measure(str, size, o) + size * .2, reps = Math.ceil(W / w) + 2;
    const gr = st.root.append('g'), node = gr.append('text').attr('y', i * rh + (rh + cap) / 2).style('font', `800 ${size}px Montserrat`).style('letter-spacing', `${o.track}em`).attr('fill', st.fg).text(str.repeat(reps));
    return {gr, node, w, dir: i % 2 ? 1 : -1, v: (40 + 30 * hash(i, 4)) * (props.speed ?? 1)};
  });
  return {seek(t) {
    st.tick(t);
    const b = Math.floor(t / (STEP * 2)), lit = b % n;
    lines.forEach((l, i) => {
      const enter = snap(span(t, i * STEP * .35, STEP * 1.6)), x = -l.w + ((l.dir * t * l.v) % l.w + l.w) % l.w - (1 - enter) * l.dir * W;
      l.gr.attr('transform', `translate(${x.toFixed(1)} 0)`);
      l.node.attr('fill-opacity', t < .6 ? .3 : i === lit ? 1 : .16);
    });
  }};
}

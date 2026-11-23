import {C, STEP, stage, word, label, rule, measure, capH, fit, up, span, snap} from '../../kit.js';

// A name strap: a charcoal block slides in from the left edge on the beat, the name builds in heavy capitals on
// it, a hairline draws under it and the role types on in tracked small capitals. Leaves the way it came.
export const meta = {duration: 4, live: true};
export const defaults = {name: 'ALEX RIVERA', role: 'MAKES THINGS MOVE', y: 1540};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), name = up(props.name), y = props.y ?? 1540, x0 = 64;
  const size = fit(name, 760, 76), cap = capH(size), h = cap + 128, w = measure(name, size) + 96;
  const blk = st.root.append('rect').attr('y', y - h / 2).attr('height', h).attr('fill', C.coal);
  const nm = word(st.root, name, x0 + 48, y - h / 2 + 40 + cap, size, {anchor: 'start', seed: 2});
  const rl = rule(st.root, x0 + 48, y - h / 2 + 40 + cap + 22, x0 + 48 + Math.min(w - 96, 220), y - h / 2 + 40 + cap + 22, {width: 2});
  const role = props.role ? label(st.root, x0 + 48, y + h / 2 - 30, up(props.role), {size: 22, track: .3, color: C.white, opacity: .8}) : null;
  const life = props.life ?? meta.duration, out = Math.max(.9, life - .5);
  return {seek(t) {
    const a = snap(span(t, 0, STEP * 1.4)), b = snap(span(t, out + .2, STEP * 1.4)), bw = w * a;
    blk.attr('x', x0 - (b * (w + x0))).attr('width', Math.max(0, bw)).attr('opacity', a > 0 ? 1 : 0);
    nm.seek(t, {at: .2, step: .035, hold: .07, out, outStep: .02});
    rl.draw(snap(span(t, .55, STEP * 2)) * (t < out ? 1 : 0));
    role?.attr('opacity', t > .75 && t < out ? .8 : 0);
  }};
}

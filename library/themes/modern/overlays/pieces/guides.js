import {C, STEP, stage, label, rule, up, span, snap} from '../../kit.js';

// Layout guides over the footage: two thin vertical rules split the frame into three strips (drawn from the
// top and bottom edges in turn), small corner crop marks lock on, and tiny strip numbers sit at the top.
// The grid the theme's strips cut along, as a quiet whole-clip frame. Props: strips (2 or 3), opacity, labels.
export const meta = {duration: 6, live: true};
export const defaults = {strips: 3, opacity: .55, labels: true};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W, H} = st, n = Math.max(2, Math.min(4, props.strips ?? 3)), m = 48;
  st.root.attr('opacity', props.opacity ?? .55);
  const lines = Array.from({length: n - 1}, (_, i) => { const x = W * (i + 1) / n; return i % 2 ? rule(st.root, x, H, x, 0, {width: 1.5}) : rule(st.root, x, 0, x, H, {width: 1.5}); });
  const marks = st.root.append('g').attr('stroke', C.white).attr('stroke-width', 3).attr('fill', 'none');
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => marks.append('path').attr('d', `M${x + sx * 40} ${y}H${x}V${y + sy * 40}`));
  const nums = props.labels === false ? [] : Array.from({length: n}, (_, i) => label(st.root, W * (i + .5) / n, m + 70, String(i + 1).padStart(2, '0'), {size: 18, anchor: 'middle', track: .3}));
  return {seek(t) {
    const life = props.life, out = life ? snap(span(t, life - .4, .4)) : 0;
    lines.forEach((l, i) => l.range(0, snap(span(t, i * STEP * .5, STEP * 2)) * (1 - out)));
    marks.attr('opacity', t > .25 && out < .5 ? 1 : 0);
    nums.forEach((nn, i) => nn.attr('opacity', t > .4 + i * .06 && out < .5 ? 1 : 0));
  }};
}

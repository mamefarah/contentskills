import {C, STEP, stage, label, rule, up, span, snap} from '../../kit.js';

// Small widely tracked labels in the four corners of the frame, each typing on in turn on the beat with a short
// hairline beside it; a mark (one letter or number) in heavy type top-right. Labels may use '\n'.
export const meta = {duration: 4, live: true};
export const defaults = {topLeft: 'EP. 12\nBEHIND THE BUILD', topRight: 'UNSCRIPTED\nONE TAKE', bottomLeft: 'KEEP\nWATCHING', bottomRight: 'PT. 01\nOF 03', mark: '', inset: 56};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W, H} = st, m = props.inset ?? 56, s = 24;
  const spots = [[props.topLeft, m, m + 160, 'start'], [props.topRight, W - m, m + 160, 'end'], [props.bottomLeft, m, H - m - 220, 'start'], [props.bottomRight, W - m, H - m - 220, 'end']];
  const items = spots.map(([txt, x, y, anchor], i) => {
    if (!txt) return null; const lines = up(txt).split('\n');
    const nodes = lines.map((l, j) => label(st.root, x, y + j * s * 1.5, l, {size: j ? s * .85 : s, anchor, track: .3, weight: j ? 600 : 800, opacity: 0, lift: st}));
    const rl = rule(st.root, x, y - s - 16, x + (anchor === 'end' ? -60 : 60), y - s - 16, {width: 3});
    return {nodes, rl, lines, at: .1 + i * STEP * .8};
  });
  const mark = props.mark ? label(st.root, W - m, m + 110, up(props.mark), {size: 72, anchor: 'end', weight: 900, font: 'Montserrat', track: 0, opacity: 0, lift: st}) : null;
  const life = props.life ?? meta.duration, out = Math.max(1, life - .4);
  return {seek(t) {
    items.forEach((it, i) => {
      if (!it) return; const on = t < out + i * .05;
      it.rl.draw(snap(span(t, it.at, STEP)) * (on ? 1 : 0));
      it.nodes.forEach((n, j) => { const full = it.lines[j], q = span(t, it.at + .08 + j * .1, .25); n.select('tspan').text(on ? full.slice(0, Math.round(full.length * q)) : ''); n.attr('opacity', j ? .8 : 1); });
    });
    mark?.attr('opacity', t > .3 && t < out ? 1 : 0);
  }};
}

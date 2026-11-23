import {C, STEP, stage, label, mono, rule, up, pad, span, snap} from '../../kit.js';

// A picture-in-picture frame: a slot opens horizontally from a thin line to the box (fill: 0 = see-through
// hairline frame, 1 = charcoal card), corner ticks lock on, a tab label sits on its top edge and a caption with
// a running frame number under it. `box` is {x, y, w, h} as shares of the frame.
export const meta = {duration: 4, live: true};
export const defaults = {box: {x: .52, y: .075, w: .42, h: .2}, label: 'EXHIBIT A', caption: 'SCREEN RECORDING', fill: 0};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W, H} = st, b = props.box ?? defaults.box, x = b.x * W, y = b.y * H, w = b.w * W, h = b.h * H, cx = x + w / 2;
  const card = st.root.append('rect').attr('fill', C.coal).attr('fill-opacity', props.fill ?? 0).attr('stroke', C.white).attr('stroke-width', 3);
  const ticks = st.root.append('g').attr('stroke', C.white).attr('stroke-width', 6).attr('fill', 'none'), L = 26;
  [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([px, py, sx, sy]) => ticks.append('path').attr('d', `M${px + sx * L} ${py}H${px}V${py + sy * L}`));
  const tabW = Math.min(w * .8, String(props.label ?? '').length * 15 + 44);
  const tab = st.root.append('rect').attr('x', x).attr('y', y - 40).attr('width', tabW).attr('height', 40).attr('fill', C.white);
  const tl = st.root.append('text').attr('x', x + 16).attr('y', y - 13).attr('fill', C.ink).style('font', '800 20px "Inter Tight"').style('letter-spacing', '.26em').text(up(props.label));
  const cap = props.caption ? label(st.root, x, y + h + 42, up(props.caption), {size: 20, track: .3, lift: st}) : null;
  const fr = mono(st.root, x + w, y + h + 42, '', {size: 20, anchor: 'end', lift: st});
  const life = props.life ?? meta.duration, out = Math.max(.9, life - .4);
  return {seek(t) {
    const a = snap(span(t, 0, STEP)), o = snap(span(t, STEP * .6, STEP * 1.6)), c = snap(span(t, out, STEP * 1.5)), ww = Math.max(6, w * o) * (1 - c), hh = h * a * (1 - c);
    card.attr('x', cx - ww / 2).attr('y', y + (h - hh) / 2).attr('width', ww).attr('height', hh).attr('opacity', a > 0 && c < 1 ? 1 : 0);
    const on = t > .45 && t < out; ticks.attr('opacity', on ? 1 : 0); tab.attr('opacity', on ? 1 : 0); tl.attr('opacity', on ? 1 : 0);
    cap?.attr('opacity', t > .6 && t < out ? .9 : 0);
    fr.select('tspan').text('FR ' + pad(Math.floor(t * 24) + 1, 4)); fr.attr('opacity', t > .6 && t < out ? .9 : 0);
  }};
}

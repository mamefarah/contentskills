import {C, STEP, stage, label, faceAt, up, span, snap, mix} from '../../kit.js';

// Crop marks that lock round the speaker's face and follow it (props.locate / track / box): four white corner
// brackets snap in from wider on the beat, with a small tracked tag on the top-left bracket. The face itself is
// never covered. Props: tag, pad (extra room round the face, share of its size).
export const meta = {duration: 3, live: true};
export const defaults = {tag: 'SUBJECT 01', pad: .22};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W, H} = st, g = st.root.append('g').attr('stroke', C.white).attr('stroke-width', 5).attr('fill', 'none').attr('filter', st.url('lift'));
  const corners = [0, 1, 2, 3].map(() => g.append('path'));
  const tag = props.tag ? label(st.root, 0, 0, up(props.tag), {size: 20, track: .32, weight: 800, lift: st}) : null;
  const life = props.life ?? meta.duration, out = Math.max(.6, life - .25);
  return {seek(t) {
    const f = faceAt(props, t), p = props.pad ?? .22, a = snap(span(t, 0, STEP * 1.4)), grow = mix(1.6, 1, a);
    const cx = (f.x + f.w / 2) * W, cy = (f.y + f.h / 2) * H, hw = f.w * W * (.5 + p) * grow, hh = f.h * H * (.5 + p) * grow, L = Math.min(hw, hh) * .35;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy], i) => { const x = cx + sx * hw, y = cy + sy * hh; corners[i].attr('d', `M${x - sx * L} ${y}H${x}V${y - sy * L}`); });
    const on = t >= 0 && t < out; g.attr('opacity', on ? 1 : 0);
    tag?.attr('transform', `translate(${cx - hw} ${cy - hh - 20})`).attr('opacity', on && t > .25 ? 1 : 0);
  }};
}

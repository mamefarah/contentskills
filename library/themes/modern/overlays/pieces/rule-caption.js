import {C, STEP, stage, label, mono, rule, up, pad, span, snap} from '../../kit.js';

// A thin white rule draws across the frame on the beat; a caption in heavy tracked capitals sits on it and a
// small mono index under it at the right. Props: caption, sub, index, y, x0, x1.
export const meta = {duration: 3.5, live: true};
export const defaults = {caption: 'THE NEW COLLECTION', sub: 'SPRING / SUMMER', index: '03', y: 1620, x0: 72, x1: 1008};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), y = props.y ?? 1620, x0 = props.x0 ?? 72, x1 = props.x1 ?? 1008;
  const rl = rule(st.root, x0, y, x1, y, {width: 3});
  const cap = label(st.root, x0, y - 26, '', {size: 40, track: .18, weight: 800, lift: st});
  const sub = props.sub ? label(st.root, x0, y + 46, up(props.sub), {size: 20, track: .34, opacity: .85, lift: st}) : null;
  const idx = props.index ? mono(st.root, x1, y + 46, String(props.index).length < 3 && /^\d+$/.test(props.index) ? pad(+props.index) : up(props.index), {size: 22, anchor: 'end', lift: st}) : null;
  const T = up(props.caption), life = props.life ?? meta.duration, out = Math.max(1, life - .4);
  return {seek(t) {
    rl.range(snap(span(t, out, STEP * 1.6)), snap(span(t, 0, STEP * 2)));
    cap.select('tspan').text(t < out ? T.slice(0, Math.round(T.length * span(t, .25, .35))) : '');
    sub?.attr('opacity', t > .6 && t < out ? .85 : 0); idx?.attr('opacity', t > .4 && t < out ? 1 : 0);
  }};
}

import {C, STEP, stage, label, mono, up, pad, span, snap} from '../../kit.js';

// Charcoal bars slide in from the top and bottom edges on the beat (a cinematic crop of the vertical frame), with
// a small tracked title in the top bar and a running frame number in the bottom one. Can run a whole clip.
// Props: top (top bar height), bottom (bottom bar height), title, note.
export const meta = {duration: 6, live: true};
export const defaults = {top: 210, bottom: 300, title: 'A SHORT FILM', note: '9:16'};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W, H} = st, th = props.top ?? 210, bh = props.bottom ?? 300;
  const a = st.root.append('rect').attr('x', 0).attr('width', W).attr('height', th).attr('fill', C.coal);
  const b = st.root.append('rect').attr('x', 0).attr('width', W).attr('height', bh).attr('fill', C.coal);
  const ti = props.title ? label(st.root, W / 2, th - 50, up(props.title), {size: 22, anchor: 'middle', track: .4}) : null;
  const fr = mono(st.root, 72, H - bh + 70, '', {size: 22, opacity: .8});
  const nt = props.note ? label(st.root, W - 72, H - bh + 70, up(props.note), {size: 20, anchor: 'end', track: .32, opacity: .8}) : null;
  return {seek(t) {
    const life = props.life, i = snap(span(t, 0, STEP * 1.5)), o = life ? snap(span(t, life - STEP * 1.5, STEP * 1.5)) : 0, q = i * (1 - o);
    a.attr('y', -th * (1 - q)); b.attr('y', H - bh * q);
    const on = q > .98; ti?.attr('opacity', on ? 1 : 0); nt?.attr('opacity', on ? .8 : 0);
    fr.select('tspan').text('FR ' + pad(Math.floor(t * 24) + 1, 4)); fr.attr('opacity', on ? .8 : 0);
  }};
}

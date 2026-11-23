import {C, STEP, stage, measure, up, pad, span, snap} from '../../kit.js';

// A small index tag: a white block with an index number in Space Mono and a word in heavy charcoal capitals,
// wiping open from its left edge on the beat. Props: index, text, x, y, align left|right, dark (charcoal block).
export const meta = {duration: 3, live: true};
export const defaults = {index: '03', text: 'LOOK', x: 72, y: 300, align: 'left', dark: false};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), dark = !!props.dark, bg = dark ? C.coal : C.white, fg = dark ? C.white : C.ink;
  const idx = /^\d+$/.test(String(props.index ?? '')) ? pad(+props.index) : up(props.index ?? ''), txt = up(props.text), h = 64;
  const iw = idx ? measure(idx, 26, {font: '"Space Mono"', weight: 700, track: 0}) + 36 : 0, tw = measure(txt, 30, {weight: 800, track: .14}) + 44, w = iw + tw;
  const x = props.align === 'right' ? (props.x === defaults.x ? 1008 : props.x) - w : props.x ?? 72, y = props.y ?? 300;
  const cid = st.uid('tag'), cr = st.defs.append('clipPath').attr('id', cid).append('rect').attr('x', x).attr('y', y).attr('height', h);
  const g = st.root.append('g').attr('clip-path', `url(#${cid})`);
  g.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', h).attr('fill', bg);
  if (idx) { g.append('text').attr('x', x + 18).attr('y', y + 42).attr('fill', fg).style('font', '700 26px "Space Mono"').text(idx); g.append('rect').attr('x', x + iw - 2).attr('y', y + 16).attr('width', 2).attr('height', h - 32).attr('fill', fg).attr('opacity', .5); }
  g.append('text').attr('x', x + iw + 22).attr('y', y + 43).attr('fill', fg).style('font', '800 30px Montserrat').style('letter-spacing', '.14em').text(txt);
  const life = props.life ?? meta.duration, out = Math.max(.6, life - .3);
  return {seek(t) {
    const a = snap(span(t, 0, STEP * 1.3)), b = snap(span(t, out, STEP * 1.3));
    cr.attr('x', x + w * b).attr('width', Math.max(0, w * a - w * b));
  }};
}

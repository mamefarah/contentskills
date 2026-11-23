import {C, stage, label, mono, pad, up} from '../../kit.js';

// A running frame number in Space Mono with a small solid square that blinks on the beat and a tracked format
// tag under it, in a corner. Can run a whole clip. Props: x, y, align left|right, fps, start (first frame), tag.
export const meta = {duration: 6, live: true};
export const defaults = {x: 1008, y: 1760, align: 'right', fps: 24, start: 1, tag: '9:16 / 24 FPS'};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), right = props.align !== 'left', x = props.x ?? 1008, y = props.y ?? 300, anchor = right ? 'end' : 'start';
  const sq = st.root.append('rect').attr('width', 16).attr('height', 16).attr('fill', C.white).attr('x', right ? x - 16 : x).attr('y', y - 66);
  const num = mono(st.root, x, y, '', {size: 44, anchor, lift: st});
  const tag = props.tag ? label(st.root, x, y + 40, up(props.tag), {size: 18, anchor, track: .32, opacity: .85, lift: st}) : null;
  return {seek(t) {
    const life = props.life, on = t > .05 && (!life || t < life - .1);
    num.select('tspan').text('FR ' + pad(Math.floor(t * (props.fps ?? 24)) + (props.start ?? 1), 4)); num.attr('opacity', on ? 1 : 0);
    sq.attr('opacity', on && Math.floor(t / .4) % 2 === 0 ? 1 : 0); tag?.attr('opacity', on ? .85 : 0);
  }};
}

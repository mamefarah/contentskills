import {C, STEP, stage, label, rule, up, span, snap} from '../../kit.js';

// A minimal opening credit: a role in small tracked capitals over a name in heavy capitals, a short hairline
// between, typing on letter by letter at the bottom-left of the frame. Props: role, name, x, y, align left|right.
export const meta = {duration: 3, live: true};
export const defaults = {role: 'DIRECTED BY', name: 'YOUR NAME', x: 72, y: 1600, align: 'left'};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), right = props.align === 'right', x = right ? (props.x === defaults.x ? 1008 : props.x) : props.x ?? 72, y = props.y ?? 1600, anchor = right ? 'end' : 'start';
  const role = label(st.root, x, y, '', {size: 22, anchor, track: .36, lift: st, opacity: .85});
  const rl = rule(st.root, x, y + 24, x + (right ? -64 : 64), y + 24, {width: 3});
  const name = label(st.root, x, y + 96, '', {size: 58, anchor, track: .04, weight: 800, font: 'Montserrat', lift: st});
  const R = up(props.role), N = up(props.name), life = props.life ?? meta.duration, out = Math.max(1, life - .35);
  return {seek(t) {
    const on = t < out;
    role.select('tspan').text(on ? R.slice(0, Math.round(R.length * span(t, 0, .3))) : '');
    rl.draw(on ? snap(span(t, .2, STEP)) : 0);
    name.select('tspan').text(on ? N.slice(0, Math.round(N.length * span(t, .3, .35))) : '');
  }};
}

import {C, STEP, stage, measure, capH, up, span, snap} from '../../kit.js';

// A charcoal band across the frame with heavy capitals running through it, solid and ghosted words alternating,
// and a small sub label in a white tab at its left end. The band wipes in from the left and out to the right.
export const meta = {duration: 4, live: true};
export const defaults = {text: 'NEW EPISODE', sub: 'OUT NOW', y: 1760, height: 130, tilt: 0, speed: 1};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W} = st, h = props.height ?? 130, y = props.y ?? 1760, text = up(props.text);
  const size = h * .56 / (capH(100) / 100), cap = capH(size), unit = measure(text + ' ', size) + size * .6, reps = Math.ceil(W * 1.6 / unit) + 2;
  const cid = st.uid('band'); st.defs.append('clipPath').attr('id', cid).append('rect').attr('x', 0).attr('y', y - h / 2).attr('width', W).attr('height', h);
  const root = st.root.attr('transform', `rotate(${props.tilt ?? 0} ${W / 2} ${y})`);
  const band = root.append('rect').attr('y', y - h / 2).attr('height', h).attr('fill', C.coal);
  const run = root.append('g').attr('clip-path', `url(#${cid})`).append('g');
  for (let i = 0; i < reps; i++) run.append('text').attr('x', i * unit).attr('y', y + cap / 2).attr('fill', C.white).attr('fill-opacity', i % 2 ? .3 : 1).style('font', `800 ${size}px Montserrat`).style('letter-spacing', '.04em').text(text);
  const tabW = props.sub ? measure(up(props.sub), h * .2, {font: '"Inter Tight"', weight: 700, track: .3}) + 44 : 0;
  const tab = props.sub ? root.append('rect').attr('x', 0).attr('y', y - h / 2 - h * .36).attr('width', tabW + 24).attr('height', h * .36).attr('fill', C.white) : null;
  const sub = props.sub ? root.append('text').attr('x', 34).attr('y', y - h / 2 - h * .11).attr('fill', C.ink).style('font', `700 ${h * .2}px "Inter Tight"`).style('letter-spacing', '.3em').text(up(props.sub)) : null;
  const life = props.life ?? meta.duration, out = Math.max(.8, life - .35);
  return {seek(t) {
    const a = snap(span(t, 0, STEP * 1.5)), b = snap(span(t, out, STEP * 1.5));
    band.attr('x', W * b).attr('width', W * a * (1 - b));
    run.attr('transform', `translate(${(-((t * 160 * (props.speed ?? 1)) % unit) - unit * .5).toFixed(1)} 0)`).attr('opacity', a > .3 && b < .7 ? 1 : 0);
    const on = t > .25 && t < out; tab?.attr('opacity', on ? 1 : 0); sub?.attr('opacity', on ? 1 : 0);
  }};
}

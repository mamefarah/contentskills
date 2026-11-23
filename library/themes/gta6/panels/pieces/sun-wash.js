import {C, FRAME, coastStage, halftone, span, easeOut, presence, noise} from '../../coast.js';

// A sunset wash over the edges of the picture: violet and pink bleeding down from the top, orange
// rising from the bottom, a sun flare in one corner with slow rays, and a light leak that crosses
// once as it arrives. The middle of the frame is left clean.
export const meta = {duration: 6, live: true};
export const defaults = {strength: .8, corner: 'right', leak: true};

export function mount(el, props = defaults) {
  const {root, defs, id} = coastStage(el, {overlay: true}), {width: W, height: H} = FRAME, a = props.strength, fx = props.corner === 'left' ? 120 : W - 120, fy = 170;
  const grad = (name, stops, attrs) => { const g = defs.append(attrs.r ? 'radialGradient' : 'linearGradient').attr('id', `${id}-${name}`); for (const [k, v] of Object.entries(attrs)) g.attr(k, v); for (const [at, color, o] of stops) g.append('stop').attr('offset', at).attr('stop-color', color).attr('stop-opacity', o); return `url(#${id}-${name})`; };
  const top = root.append('rect').attr('width', W).attr('height', 760).attr('fill', grad('top', [[0, '#5a2bd0', .85], [.4, C.pink, .5], [1, C.pink, 0]], {x1: 0, y1: 0, x2: 0, y2: 1}));
  const bottom = root.append('rect').attr('y', H - 620).attr('width', W).attr('height', 620).attr('fill', grad('bot', [[0, C.orange, 0], [.6, C.orange, .45], [1, C.yellow, .8]], {x1: 0, y1: 0, x2: 0, y2: 1}));
  const dots = halftone(root, 0, 0, 620, 520, {color: C.yellow, from: props.corner === 'left' ? 'tr' : 'tl', cell: 34, max: .7, opacity: .5});
  if (props.corner === 'left') dots.attr('transform', `translate(${W - 620} 0)`);
  const flare = root.append('g').attr('transform', `translate(${fx} ${fy})`), raysG = flare.append('g');
  let d = ''; for (let i = 0; i < 14; i++) { const p = i * Math.PI / 7, q = p + .11; d += `M0 0L${Math.cos(p) * 900} ${Math.sin(p) * 900}L${Math.cos(q) * 900} ${Math.sin(q) * 900}Z`; }
  raysG.append('path').attr('d', d).attr('fill', grad('ray', [[0, '#fff3b0', .55], [1, '#fff3b0', 0]], {r: 900, cx: 0, cy: 0, gradientUnits: 'userSpaceOnUse'}));
  const glow = flare.append('circle').attr('r', 420).attr('fill', grad('glow', [[0, '#fffbe0', .95], [.25, C.yellow, .6], [.6, C.orange, .22], [1, C.pink, 0]], {r: .5, cx: .5, cy: .5}));
  const leak = root.append('rect').attr('y', -200).attr('width', 520).attr('height', H + 400).attr('fill', grad('leak', [[0, C.orange, 0], [.5, '#ffe7a0', .55], [1, C.pink, 0]], {x1: 0, y1: 0, x2: 1, y2: 0}));
  return {
    seek(t) {
      const on = easeOut(span(t, 0, .6)) * a;
      root.attr('opacity', presence(t, props.life)); top.attr('opacity', on); bottom.attr('opacity', on); dots.attr('opacity', .5 * on);
      raysG.attr('transform', `rotate(${t * 5})`).attr('opacity', on * (.7 + .3 * noise(t * 1.5, 3))); glow.attr('opacity', on).attr('transform', `scale(${.92 + .08 * noise(t * 1.2, 7)})`);
      const k = span(t, .05, 1.1); leak.attr('transform', `translate(${-700 + k * 2200} 0) rotate(14)`).attr('opacity', props.leak ? Math.sin(k * Math.PI) * a : 0);
    },
  };
}

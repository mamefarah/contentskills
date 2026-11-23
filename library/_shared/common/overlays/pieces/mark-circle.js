import {stage, fade, leave, glide, span} from '../../kit.js';

// A hand-drawn circle that draws itself around something on screen (a word, a number, a button), slightly
// overshooting its start like a real pen stroke. Shared piece: drawn in the theme's accent.
// (x, y) centre, (w, h) size of the thing being circled. Never circle the face.
export const meta = {duration: 2, live: true};
export const defaults = {x: 540, y: 1300, w: 520, h: 160, at: .1, draw: .45, width: 9, seed: 3};

const rand = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function mount(el, props = defaults, {look} = {}) {
  const p = {...defaults, ...props}, st = stage(el, look), r = rand(p.seed * 7919 + 1), rx = p.w / 2 + 28, ry = p.h / 2 + 22;
  // one and a bit turns, radius wobbling a little, start and end not meeting: reads as drawn by hand
  const pts = [], turns = 1.12, n = 64, a0 = -2.2 + r() * .4;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * turns * Math.PI * 2, k = 1 + (r() - .5) * .04 + (i / n) * .06;
    pts.push([p.x + Math.cos(a) * rx * k, p.y + Math.sin(a) * ry * k]);
  }
  const path = st.root.append('path').attr('d', window.d3.line().curve(window.d3.curveCatmullRom)(pts)).attr('fill', 'none')
    .attr('stroke', look.accent).attr('stroke-width', p.width).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
  const len = path.node().getTotalLength();
  path.attr('stroke-dasharray', `${len} ${len}`);
  return {
    seek(t) {
      path.attr('stroke-dashoffset', len * (1 - glide(span(t, p.at, p.draw))));
      path.attr('opacity', fade(t, p.at, .05) * (1 - leave(t, p.life)));
    },
  };
}

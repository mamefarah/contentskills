import {C, F, FRAME, coastStage, poly, quad, tab, halftone, label, lettering, span, easeOut, pop, presence} from '../../coast.js';

// A comic-panel frame around the whole picture: a thick pale gutter with ink keylines and slanted
// top and bottom edges, a title tab, an issue tag and a brush sign-off. The middle stays empty.
export const meta = {duration: 6, live: true};
export const defaults = {label: 'GTA6', issue: 'EP. 01', tag: 'Live from the coast', inset: 36, slant: 40};

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), {width: W, height: H} = FRAME, m = props.inset, s = props.slant;
  const inner = [[m, m + s], [W - m, m], [W - m, H - m - s], [m, H - m]], border = root.append('g');
  border.append('path').attr('d', `M0 0H${W}V${H}H0Z${poly(inner)}`).attr('fill-rule', 'evenodd').attr('fill', C.paper);
  border.append('path').attr('d', poly(inner)).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 9).attr('stroke-linejoin', 'miter');
  border.append('path').attr('d', poly(inner.map(([x, y]) => [x + (x < W / 2 ? 16 : -16), y + (y < H / 2 ? 16 : -16)]))).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 3).attr('opacity', .9);
  const dots = halftone(root, m + 10, H - m - 480, 460, 470, {color: C.pink, from: 'bl', cell: 30, max: .8, opacity: .7}), dots2 = halftone(root, W - m - 420, m + 14, 410, 420, {color: C.yellow, from: 'tr', cell: 28, max: .8, opacity: .7});
  const title = tab(root, 0, 0, props.label, {size: 46, fill: 'pink'}), issue = tab(root, 0, 0, props.issue, {size: 34, fill: 'yellow', color: C.ink});
  const sign = lettering(root, W - m - 44, H - m - 62, props.tag, {size: 54, font: F.script, fill: 'paper', anchor: 'end', tilt: -3, outline: 7, shadow: 5});
  return {
    seek(t) {
      root.attr('opacity', presence(t, props.life));
      const q = easeOut(span(t, 0, .45)); border.attr('transform', `translate(540 960) scale(${1.12 - .12 * q}) translate(-540 -960)`).attr('opacity', span(t, 0, .2));
      dots.attr('opacity', .7 * span(t, .3, .4)); dots2.attr('opacity', .7 * span(t, .4, .4));
      title.g.attr('transform', `translate(${m + 34} ${m + s + 62}) rotate(-3) scale(${pop(t, .35)})`);
      issue.g.attr('transform', `translate(${W - m - 40 - issue.w} ${m + 70}) rotate(-2) scale(${pop(t, .5)})`);
      sign.g.attr('opacity', span(t, .7, .25));
    },
  };
}

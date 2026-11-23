import {C, F, coastStage, rrect, halftone, label, measure, place, span, slam, shake, presence, leave, hash} from '../../coast.js';

// A rubber stamp thumped onto the picture at an angle, with a spray of ink flecks. For verdicts:
// done, sold, wrong, yes. (x, y) is its centre.
export const meta = {duration: 3, live: true};
export const defaults = {text: 'NAILED IT', sub: 'NO NOTES', x: 540, y: 380, tilt: -9, color: 'pink'};

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), color = C[props.color] ?? props.color, size = Math.min(150, 150 * 700 / measure(props.text, 150, F.display, .03)), w = measure(props.text, size, F.display, .03) + 110, h = size * 1.25 + (props.sub ? 110 : 20), g = root.append('g'), body = g.append('g');
  body.append('path').attr('d', rrect(-w / 2, -h / 2, w, h, 26)).attr('fill', C.paper).attr('stroke', C.ink).attr('stroke-width', 8).attr('transform', 'translate(12 12)').attr('opacity', .0);
  body.append('path').attr('d', rrect(-w / 2, -h / 2, w, h, 26)).attr('fill', C.paper).attr('fill-opacity', .92).attr('stroke', color).attr('stroke-width', 14);
  body.append('path').attr('d', rrect(-w / 2 + 20, -h / 2 + 20, w - 40, h - 40, 14)).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 5);
  halftone(body, -w / 2 + 26, -h / 2 + 26, w - 52, h - 52, {color, from: 'br', cell: 24, opacity: .35});
  label(body, 0, (props.sub ? -34 : 0) + size * .36, props.text, {size, font: F.display, color, anchor: 'middle', spacing: .03});
  if (props.sub) label(body, 0, h / 2 - 40, props.sub, {size: 42, font: F.caps, color: C.ink, anchor: 'middle', spacing: .16});
  const flecks = Array.from({length: 16}, (_, i) => { const a = hash(i, 1) * Math.PI * 2, r = w * (.55 + hash(i, 2) * .35); return g.append('circle').attr('cx', Math.cos(a) * r).attr('cy', Math.sin(a) * r * .6).attr('r', 5 + hash(i, 3) * 13).attr('fill', color); });
  return {
    seek(t) {
      const [sx, sy] = shake(t, .3, 16);
      root.attr('opacity', presence(t, props.life) * (1 - leave(t, props.life))).attr('transform', `translate(${sx} ${sy})`);
      place(g, props.x, props.y, 1, props.tilt); body.attr('transform', `scale(${slam(t, .05, .25) || .0001})`).attr('opacity', span(t, .05, .08));
      flecks.forEach((f, i) => f.attr('opacity', t > .3 ? 1 : 0).attr('transform', `scale(${.4 + .6 * span(t, .3, .12 + hash(i, 5) * .1)})`));
    },
  };
}

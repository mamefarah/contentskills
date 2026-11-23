import {C, P, theme, textStage, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A starburst sticker slapped onto the picture with a wobble: one or two short words, with a line
// of small text running round inside its edge. (x, y) is its centre, `r` its outer radius.
export const meta = {duration: 3.5, live: true};
export const defaults = {text: 'NEW', ring: 'LIMITED RUN', x: 850, y: 340, r: 160, color: 'yellow', tilt: -12};

export function mount(el, props = defaults) {
  const stage = textStage(el, {overlay: true}), {root, defs, id} = stage, r = props.r, fill = tone(props.color), g = root.append('g'), spin = g.append('g');
  inked(spin, burst(0, 0, r, r * .82, 18), {fill, ink: 8, shadow: 12}); spin.append('circle').attr('r', r * .7).attr('fill', 'none').attr('stroke', inkOn(fill)).attr('stroke-width', 4).attr('stroke-dasharray', '14 12').attr('opacity', .6);
  const size = fit(up(props.text), r * 1.2, r * .7), word = glyphs(g, up(props.text), 0, capH(size) / 2 - (props.ring ? r * .06 : 0), size, {by: 'all', anchor: 'middle', fill: fill === 'pink' ? 'gold' : 'candy', rim: 4});
  if (props.ring) { defs.append('path').attr('id', id + '-ring').attr('d', `M${-r * .56} ${r * .1}A${r * .56} ${r * .56} 0 0 0 ${r * .56} ${r * .1}`); g.append('text').attr('fill', inkOn(fill)).style('font', `${r * .15}px ${theme.fonts.sub}`).style('letter-spacing', '.14em').attr('text-anchor', 'middle').append('textPath').attr('href', `#${id}-ring`).attr('startOffset', '50%').text(up(props.ring)); }
  return {seek(t) {
    const x = leave(t, props.life), q = span(t, .05, .5), s = spring(q); root.attr('opacity', span(t, 0, .06));
    place(g, props.x, props.y, (2.2 - 1.2 * s) * (q > 0 ? 1 : 0) * (1 - x), props.tilt + (1 - s) * 40 + Math.sin(t * 2.4) * 3); spin.attr('transform', `rotate(${t * 18})`);
    word.forEach(u => pose(u, {sx: 1 + .06 * Math.sin(t * 5)}));
  }};
}

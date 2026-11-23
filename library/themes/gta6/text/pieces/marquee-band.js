import {C, P, theme, textStage, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A marquee band across the picture that keeps scrolling: the main text in a wide strip, with a
// thinner strip above it running the other way. Sits below the captions by default.
export const meta = {duration: 4, live: true};
export const defaults = {text: 'NEW EPISODE', sub: 'OUT NOW', y: 1760, height: 130, color: 'pink', second: 'yellow', tilt: -1.5, speed: 1};

export function mount(el, props = defaults) {
  const stage = textStage(el, {overlay: true}), {root, W} = stage, h = props.height, h2 = h * .46, fill = tone(props.color), second = tone(props.second);
  const g = root.append('g').attr('transform', `translate(${W / 2} ${props.y}) rotate(${props.tilt}) translate(${-W / 2} 0)`);
  const thin = g.append('g'), wide = g.append('g'), bar = (parent, y0, hh, f) => { parent.append('rect').attr('x', -120).attr('y', y0 + 10).attr('width', W + 240).attr('height', hh).attr('fill', C.ink); parent.append('rect').attr('x', -120).attr('y', y0).attr('width', W + 240).attr('height', hh).attr('fill', P(root, f)).attr('stroke', C.ink).attr('stroke-width', 8); };
  bar(thin, -h / 2 - h2 + 4, h2, second); bar(wide, -h / 2, h, fill);
  const s1 = h * .54 / capH(1), run = strip(wide, stage, props.text, capH(s1) / 2, s1, {color: inkOn(fill) === C.ink ? 'night' : 'paper', mark: second}), o2 = {font: theme.fonts.sub};
  const s2 = h2 * .56 / capH(1, o2), run2 = props.sub ? strip(thin, stage, props.sub, -h / 2 - h2 / 2 + 4 + capH(s2, o2) / 2, s2, {color: inkOn(second) === C.ink ? 'night' : 'paper', mark: fill, font: theme.fonts.sub, ink: 0}) : null;
  return {seek(t) {
    const x = leave(t, props.life), q = span(t, 0, .4), q2 = span(t, .15, .4); root.attr('opacity', span(t, 0, .06));
    wide.attr('transform', `translate(${-(W + 300) * (1 - easeOut(q)) - x * (W + 300)} 0) skewX(${vel(q) * 14})`); thin.attr('transform', `translate(${(W + 300) * (1 - easeOut(q2)) + x * (W + 300)} 0)`).attr('opacity', props.sub ? 1 : 0);
    run.set(t * 190 * props.speed); run2?.set(-t * 120 * props.speed);
  }};
}

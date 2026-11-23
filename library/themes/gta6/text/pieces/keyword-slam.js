import {C, P, theme, textStage, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// One word slammed across the picture: a slanted gradient band shoots in, the letters land on it
// one after another with a shake, and a brush kicker sits above. `y` is the band's centre.
export const meta = {duration: 3.5, live: true};
export const defaults = {word: 'UNSTOPPABLE', kicker: 'Word of the day', y: 330, color: 'hot', band: 'candy', tilt: -3};

export function mount(el, props = defaults) {
  const stage = textStage(el, {overlay: true}), {root, W} = stage, word = up(props.word), y = props.y, fill = tone(props.color), band = tone(props.band);
  const size = fit(word, 920, 250), cap = capH(size), bh = cap + 90, g = root.append('g'), tilt = g.append('g').attr('transform', `translate(${W / 2} ${y}) rotate(${props.tilt})`), bandG = tilt.append('g');
  const p = panel(bandG, quad(-W / 2 - 80, -bh / 2, W + 160, bh, 0), {fill: band, gutter: 12, shadow: 16}), inside = bandG.append('g').attr('clip-path', p.clip); rays(inside, 0, 0, 760, 18, C.paper, .2); halftone(inside, 0, -bh / 2 - 20, 640, bh + 40, {color: C.ink, from: 'right', cell: 30, opacity: .28});
  const letters = glyphs(tilt, word, 0, cap / 2, size, {anchor: 'middle', fill, rim: 4}), ks = fit(oneLine(props.kicker), 760, 84), kick = props.kicker ? glyphs(g, oneLine(props.kicker), 96, y - bh / 2 - 34, ks, {by: 'word', font: theme.fonts.script, fill: 'paper'}) : [];
  return {seek(t) {
    const x = leave(t, props.life), [sx, sy] = shake(t, .4, 16), q = span(t, 0, .32);
    root.attr('opacity', span(t, 0, .06)); g.attr('transform', `translate(${sx} ${sy})`);
    bandG.attr('transform', `translate(${-(W + 300) * (1 - easeOut(q)) + x * (W + 300)} 0) skewX(${-vel(q) * 16 - x * 20})`);
    letters.forEach(u => slam(u, span(t, .18 + u.i * .035, .5), x, {rot: (u.i % 2 ? 1 : -1) * 14})); kick.forEach(u => rise(u, span(t, .5 + u.i * .08, .35), x, 60));
  }};
}

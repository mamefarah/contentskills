import {C, P, theme, textStage, backdrop, fieldOf, tone, inkOn, up, oneLine, clipPoly, clipBox, measure, capH, fit, wrap, flow, txt, glyphs, pose, slam, rise, spring, vel, leave, pop, shake, place, label, cornerLabels, strip, poly, quad, panel, inked, halftone, rays, burst, clamp, span, mix, easeOut, hash, noise} from '../kit.js';

// A wall of marquee strips that never stop: every row scrolls its own phrase, alternating direction
// and band colour, the whole wall tilted like a stack of signs.
export const meta = {duration: 5, live: true};
export const defaults = {rows: ['KEEP MOVING', 'NO PAUSE', 'LOOP IT', 'STAY LOUD', 'ONE MORE TIME'], field: 'dusk', speed: 1};

export function mount(el, props = defaults) {
  const stage = textStage(el, {field: props.field}), {root, W, H} = stage, n = Math.max(5, Math.round(H / 190)), tilt = root.append('g').attr('transform', `translate(${W / 2} ${H / 2}) rotate(-5) scale(1.14) translate(${-W / 2} ${-H / 2})`), rh = H / n, size = rh * .56 / capH(1), cap = capH(size);
  const looks = [['pink', 'paper', 'yellow'], [null, 'hot', 'aqua'], ['yellow', 'night', 'pink'], [null, 'paper', 'pink'], ['sea', 'paper', 'yellow'], [null, 'cool', 'yellow'], ['candy', 'paper', 'aqua']];
  const rows = Array.from({length: n + 2}, (_, j) => {
    const i = j - 1, [band, color, mark] = looks[((i % looks.length) + looks.length) % looks.length], g = tilt.append('g').attr('transform', `translate(0 ${i * rh})`), inner = g.append('g');
    if (band) { inner.append('rect').attr('x', -200).attr('y', 6).attr('width', W + 400).attr('height', rh - 12).attr('fill', P(root, band)).attr('stroke', C.ink).attr('stroke-width', 8); inner.append('rect').attr('x', -200).attr('y', rh - 6).attr('width', W + 400).attr('height', 12).attr('fill', C.ink); }
    const s = strip(inner, stage, props.rows[((i % props.rows.length) + props.rows.length) % props.rows.length], rh / 2 + cap / 2, size, {color, mark, ink: band ? size * .14 : size * .2});
    return {inner, s, dir: i % 2 ? 1 : -1, i};
  });
  return {seek(t) {
    rows.forEach(({inner, s, dir, i}) => { const q = span(t, .05 + (i + 1) * .07, .5), e = easeOut(q);
      inner.attr('transform', `translate(${dir * (1 - e) * (W + 500)} 0)`); s.set(dir * (t * 150 * props.speed * (1 + (i % 3) * .25) + i * 77), -dir * vel(q) * 18); });
  }};
}

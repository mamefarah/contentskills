import {stage, clamp, punch, span} from '../../kit.js';

// One emoji that pops in on a word (overshoot, a small wobble, a soft shadow) and pops out at the end of its slot.
// Props: image (a PNG of the emoji, server path: the safe choice, since the video renderer may not draw colour-emoji
// glyphs), emoji (the character, drawn with the system emoji font when no image is given), x, y (centre, frame px),
// size (px), tilt (deg), delay (pop-in, s into the slot; not "at", which the player sets to the slot's start),
// jitter (px, 0 = off): after the pop it shakes like it is about to blow, harder and swelling until the slot ends;
// seed varies the shake so several emojis side by side do not move in step.
export const meta = {duration: 1.5, live: true};
export const defaults = {emoji: '🤯', image: '', x: 880, y: 620, size: 170, tilt: 12, delay: 0, jitter: 0, seed: 1};
const FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export async function mount(el, props = defaults) {
  const p = {...defaults, ...props}, st = stage(el, {mode: 'overlay'});
  const g = st.root.append('g'), life = p.life ?? meta.duration, s0 = p.size;
  if (p.image) {
    const img = new Image(); img.src = p.image; await img.decode().catch(() => {});
    g.append('image').attr('href', p.image).attr('x', -s0 / 2).attr('y', -s0 / 2 + s0 * .08).attr('width', s0).attr('height', s0).attr('opacity', .3).style('filter', 'blur(8px) brightness(0)');
    g.append('image').attr('href', p.image).attr('x', -s0 / 2).attr('y', -s0 / 2).attr('width', s0).attr('height', s0);
  } else {
    g.append('text').attr('y', s0 * .1).attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', 'rgba(0,0,0,.28)').style('font', `${s0}px ${FONT}`).style('filter', 'blur(10px)').text(p.emoji);
    g.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'central').style('font', `${s0}px ${FONT}`).text(p.emoji);
  }
  return {seek(t) {
    const a = t - (+p.delay || 0), inn = punch(span(a, 0, .28)), out = 1 - clamp((t - (life - .18)) / .18);
    const s = Math.max(0, inn * out), rot = p.tilt * (1 - clamp(a / .5)) * Math.cos(a * 18) + (a > 0 ? Math.sin(a * 5) * 3 : 0);
    let dx = 0, dy = 0, jr = 0, sw = 1;
    if (+p.jitter > 0 && a > .2) {                                   // the about-to-explode shake: grows towards the end
      const k = +p.seed || 1, grow = .35 + .65 * clamp((a - .2) / Math.max(.2, life - .4)), J = p.jitter * grow;
      dx = J * (Math.sin(a * 71 + k * 1.7) + .6 * Math.sin(a * 113 + k * 4.1)) / 1.6;
      dy = J * (Math.sin(a * 83 + k * 2.9) + .6 * Math.sin(a * 127 + k * .7)) / 1.6;
      jr = 4 * grow * Math.sin(a * 97 + k * 3.3);
      sw = 1 + .06 * grow * (.5 + .5 * Math.sin(a * 41 + k));      // swelling, pressure building
    }
    g.attr('transform', `translate(${(p.x + dx).toFixed(1)} ${(p.y + dy).toFixed(1)}) rotate(${(rot + jr).toFixed(2)}) scale(${(s * sw).toFixed(3)})`).attr('opacity', a < 0 ? 0 : 1);
  }};
}

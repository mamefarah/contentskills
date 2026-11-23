// GTA6 theme caption styles. See /library/_shared/captions.js for the engine.
import {esc, bare, clamp, back, eachWord, activeIndex} from '/library/_shared/captions.js';

const INK = '#190b33', PAPER = '#fff4e0', PINK = '#ff3f97', YELLOW = '#ffd447', ORANGE = '#ff8a30', AQUA = '#6ff2e3', NIGHT = '#24104f';
/** A comic ink outline of width w (em) plus a hard drop shadow, as text-shadow. */
const outline = (w, drop = w * 1.6) => [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7], [.92, .38], [-.92, .38], [.92, -.38], [-.92, -.38], [.38, .92], [-.38, .92], [.38, -.92], [-.38, -.92]].map(([x, y]) => `${(x * w).toFixed(3)}em ${(y * w).toFixed(3)}em 0 ${INK}`).concat(`${drop}em ${drop}em 0 ${INK}`, `${drop + w * .5}em ${drop + w * .5}em 0 ${INK}`).join(',');
/** The same for elements whose fill is a gradient (text-shadow would show through): drop-shadow filters. */
const outlineFilter = w => [[w, 0], [-w, 0], [0, w], [0, -w]].map(([x, y]) => `drop-shadow(${x}em ${y}em 0 ${INK})`).concat(`drop-shadow(${w * 1.5}em ${w * 1.5}em 0 ${INK})`).join(' ');

export const styles = [
  {
    id: 'panel-pop', name: 'Panel pop', font: 'Anton',
    description: 'Tall inked capitals; the spoken word jumps onto a slanted pink tab with an ink edge. The theme default — reads cleanly over any footage.',
    group: {maxWords: 3, maxChars: 18},
    css: `.cap-panel-pop{bottom:17%;font:400 8.2cqw/1.5 Anton;color:${PAPER};text-transform:uppercase;letter-spacing:.03em;text-shadow:${outline(.07)}}
          .cap-panel-pop span{display:inline-block;padding:0 .16em}
          .cap-panel-pop span.on{background:${PINK};text-shadow:.05em .05em 0 ${INK};box-shadow:0 0 0 .07em ${INK},.16em .16em 0 .07em ${INK};transform:rotate(-3deg) skewX(-8deg) scale(1.08)}`,
    render: (p, t) => eachWord(p, t, (w, i, on) => `<span class="${on ? 'on' : ''}">${esc(bare(w.text))}</span>`),
  },
  {
    id: 'gradient-shout', name: 'Gradient shout', font: 'Bowlby One',
    description: 'Fat poster lettering; each word lights up in the yellow-to-pink gradient with a heavy outline as it is spoken, and stays warm afterwards.',
    group: {maxWords: 3, maxChars: 14},
    css: `.cap-gradient-shout{bottom:17%;font:400 7cqw/1.4 "Bowlby One";color:${PAPER};text-transform:uppercase;text-shadow:${outline(.06)}}
          .cap-gradient-shout b{font-weight:400;display:inline-block;text-shadow:none;color:transparent;background:linear-gradient(#fff09a 15%,${YELLOW} 40%,${ORANGE} 62%,${PINK} 88%);-webkit-background-clip:text;background-clip:text;filter:${outlineFilter(.055)};transform:scale(1.14) rotate(-2deg)}
          .cap-gradient-shout u{text-decoration:none;color:${YELLOW}}`,
    render: (p, t) => eachWord(p, t, (w, i, on, spoken) => on ? `<b>${esc(bare(w.text))}</b>` : spoken ? `<u>${esc(bare(w.text))}</u>` : esc(bare(w.text))),
  },
  {
    id: 'marker', name: 'Marker swipe', font: 'Anton',
    description: 'Inked capitals with a slanted yellow marker bar that jumps under each word as it is said.',
    group: {maxWords: 4, maxChars: 20},
    css: `.cap-marker{bottom:17%;font:400 7.6cqw/1.5 Anton;color:${PAPER};text-transform:uppercase;letter-spacing:.03em;text-shadow:${outline(.065)}}
          .cap-marker span{display:inline-block;padding:0 .1em;position:relative}
          .cap-marker span.on{color:${INK};text-shadow:none}
          .cap-marker span.on::before{content:"";position:absolute;inset:.12em -.06em .1em;background:${YELLOW};box-shadow:0 0 0 .06em ${INK},.12em .12em 0 .06em ${INK};transform:skewX(-10deg) rotate(-1.5deg);z-index:-1}`,
    render: (p, t) => eachWord(p, t, (w, i, on) => `<span class="${on ? 'on' : ''}">${esc(bare(w.text))}</span>`),
  },
  {
    id: 'speech', name: 'Speech bubble', font: 'Bangers',
    description: 'The line sits in a comic speech bubble with a tail; the spoken word turns pink and leans in.',
    group: {maxWords: 4, maxChars: 22},
    css: `.cap-speech{bottom:17%;font:400 7cqw/1.25 Bangers;color:${INK};text-transform:uppercase;letter-spacing:.04em}
          .cap-speech p{display:inline-block;margin:0;position:relative;background:${PAPER};padding:.3em .6em .34em;border-radius:.55em;box-shadow:0 0 0 .09em ${INK},.2em .2em 0 .09em ${INK}}
          .cap-speech p::after{content:"";position:absolute;left:24%;top:calc(100% + .05em);border:.34em solid transparent;border-top:.5em solid ${PAPER};border-bottom:0;filter:drop-shadow(.09em 0 0 ${INK}) drop-shadow(-.09em 0 0 ${INK}) drop-shadow(0 .09em 0 ${INK}) drop-shadow(.14em .12em 0 ${INK})}
          .cap-speech b{font-weight:400;display:inline-block;color:${PINK};transform:scale(1.15) rotate(-3deg);text-shadow:.04em .04em 0 ${INK}}`,
    render: (p, t) => `<p>${eachWord(p, t, (w, i, on) => on ? `<b>${esc(bare(w.text))}</b>` : esc(bare(w.text)))}</p>`,
  },
  {
    id: 'slam-word', name: 'Slam word', font: 'Bowlby One',
    description: 'One word at a time, slammed in huge with an overshoot and a tilt that alternates. For punchy, fast lines.',
    group: {maxWords: 1, maxChars: 12},
    css: `.cap-slam-word{bottom:18%;font:400 13cqw/1.1 "Bowlby One";text-transform:uppercase}
          .cap-slam-word b{font-weight:400;display:inline-block;color:transparent;background:linear-gradient(#fff09a 15%,${YELLOW} 40%,${ORANGE} 62%,${PINK} 88%);-webkit-background-clip:text;background-clip:text;filter:${outlineFilter(.05)}}
          .cap-slam-word b.alt{background:linear-gradient(#d5fff8 15%,${AQUA} 50%,#4aa3ff 90%);-webkit-background-clip:text;background-clip:text}`,
    render: (p, t) => {
      const w = p.words[Math.max(0, activeIndex(p, t))], q = clamp((t - w.start) / .16), n = Math.round(w.start * 10), size = Math.min(1, 9 / Math.max(1, bare(w.text).length));
      return `<b class="${n % 2 ? 'alt' : ''}" style="font-size:${size}em;transform:scale(${(2.2 - 1.2 * back(q)).toFixed(3)}) rotate(${n % 2 ? 3 : -4}deg)">${esc(bare(w.text))}</b>`;
    },
  },
  {
    id: 'brush-strip', name: 'Brush strip', font: 'Kaushan Script',
    description: 'Brush script written onto a slanted night-violet strip, word by word; the newest word glows yellow. For softer, story moments.',
    group: {maxWords: 4, maxChars: 22},
    css: `.cap-brush-strip{bottom:17%;font:400 6.6cqw/1.3 "Kaushan Script";color:${PAPER}}
          .cap-brush-strip p{display:inline-block;margin:0;background:${NIGHT};padding:.22em .7em .3em;box-shadow:0 0 0 .07em ${PAPER},0 0 0 .14em ${INK},.2em .2em 0 .14em ${INK};transform:rotate(-2.5deg) skewX(-6deg)}
          .cap-brush-strip b{font-weight:400;color:${YELLOW}} .cap-brush-strip i{font-style:normal;opacity:0}`,
    render: (p, t) => `<p>${eachWord(p, t, (w, i, on, spoken) => on ? `<b>${esc(w.text)}</b>` : spoken ? esc(w.text) : `<i>${esc(w.text)}</i>`)}</p>`,
  },
];

// Minimal theme caption styles. See /library/_shared/captions.js for the engine.
// The caption IS the headline: one line of narration at the top of the frame, revealed word by word as it is
// spoken (words still to come are not shown), the newest word coming up out of a soft blur. Plain words are a
// medium grey-white Inter; emphasis level 1 is bold white, 2 an italic serif, 3 the word on a translucent blue
// highlight with a thin cursor bar. A word with tone "light" (a light picture) is drawn in dark ink instead; tone "uv"
// (the blacklight look) glows: lavender words, neon-pink serif, a hot-pink highlight.
// Put "captionPlacement": "fixed" in the storyboard so the line stays at the top.
import {esc, bare, clamp} from '/library/_shared/captions.js';

const fx = n => n.toFixed(3);
const up = (w, t, len = .2) => 1 - Math.pow(1 - clamp((t - w.start) / len), 3);
const INK = {dark: {plain: '#b9b9be', bold: '#ffffff', serif: '#e9e9ec'}, light: {plain: '#6b6b70', bold: '#111113', serif: '#2c2c30'},
  charcoal: {plain: 'rgba(250,249,245,.62)', bold: '#faf9f5', serif: '#d97757', hl: '--hl:#d97757;--hlb:#d97757;--hlc:#ffffff;'},
  sky: {plain: 'rgba(16,19,42,.6)', bold: '#10132a', serif: '#c4461c', hl: '--hl:rgba(255,255,255,.9);--hlb:#ffffff;--hlc:#e0652f;'},
  clay: {plain: 'rgba(20,20,19,.62)', bold: '#141413', serif: '#ffffff', glow: 'text-shadow:0 1px 0 rgba(255,255,255,.18);', hl: '--hl:rgba(255,255,255,.85);--hlb:#ffffff;--hlc:#141413;'},
  claude: {plain: '#6b6a64', bold: '#141413', serif: '#c6523a', hl: '--hl:rgba(217,119,87,.32);--hlb:rgba(198,82,58,.75);--hlc:#c6523a;'},
  uv: {plain: '#cbbcff', bold: '#ffffff', serif: '#ff8be6', glow: 'text-shadow:0 0 .35em rgba(190,140,255,.75);', hl: '--hl:rgba(255,61,190,.5);--hlb:rgba(255,130,225,.95);--hlc:#ff6be0;'}};

function word(w, t, i, active) {
  if (t < w.start - .02) return '';
  const q = up(w, t), tone = INK[INK[w.tone] ? w.tone : 'dark'], lvl = w.emph ?? 0;
  const st = `opacity:${fx(Math.min(1, q * 1.6))};filter:blur(${fx((1 - q) * .14)}em);transform:translateY(${fx((1 - q) * .18)}em);${tone.glow ?? ''}${tone.hl ?? ''}`;
  const text = esc(bare(w.text));
  if (lvl === 3) {
    const hi = clamp((t - w.start) / .18);
    return `<span class="w hl" style="${st}"><em style="transform:scaleX(${fx(.2 + .8 * hi)});opacity:${fx(hi)}"></em><b style="color:${tone.bold}">${text}</b>${active ? '<u></u>' : ''}</span>`;
  }
  if (lvl === 2) return `<span class="w sf" style="${st};color:${tone.serif}">${text}</span>`;
  if (lvl === 1) return `<span class="w bd" style="${st};color:${tone.bold}">${text}</span>`;
  return `<span class="w" style="${st};color:${tone.plain}">${text}</span>`;
}

export const styles = [
  {
    id: 'top-line', name: 'Top line', font: 'Inter',
    description: 'The theme default: one sentence of narration at the top (one or two balanced lines), revealed word by word out of a soft blur; key words bold white, an italic serif accent (level 2) or a blue highlight with a cursor bar (level 3). Dark ink on light shots (tone "light").',
    group: {maxWords: 11, maxChars: 52, pause: .45},
    css: `.cap-top-line{top:13.6%;bottom:auto;transform:none;font:500 4.6cqw/1.3 Inter;letter-spacing:-.015em;white-space:normal;text-wrap:balance}
          .cap-top-line .w{display:inline-block;position:relative;margin:0 .02em}
          .cap-top-line .bd{font-weight:700}
          .cap-top-line .sf{font:400 1.18em/1 "Instrument Serif Italic";letter-spacing:0}
          .cap-top-line .hl{padding:0 .14em}
          .cap-top-line .hl em{position:absolute;inset:-.02em 0 -.04em;background:var(--hl,rgba(59,91,219,.48));border:.12cqw solid var(--hlb,rgba(123,150,255,.7));box-shadow:0 0 .5em var(--hl,transparent);border-radius:.08em;transform-origin:0 50%}
          .cap-top-line .hl b{position:relative;font-weight:700}
          .cap-top-line .hl u{position:absolute;right:-.06em;top:-.08em;bottom:-.1em;width:.25cqw;background:var(--hlc,#7b96ff)}`,
    render: (p, t) => {
      let active = -1; p.words.forEach((w, i) => { if (t >= w.start) active = i; });
      return p.words.map((w, i) => word(w, t, i, i === active)).filter(Boolean).join(' ');
    },
  },
];

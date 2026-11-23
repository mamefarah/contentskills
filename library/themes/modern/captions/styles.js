// Modern caption styles. See /library/_shared/captions.js for the engine.
// Each style is a pure function of (phrase, time). Heavy white Montserrat capitals, letters that build through a
// translucent ghost in a seeded scattered order (the kit's word build, redone here without a DOM), charcoal blocks.
import {esc, bare, clamp, eachWord, activeIndex} from '/library/_shared/captions.js';

const WHITE = '#f5f5f2', COAL = '#1c1c1e', INK = '#121213', GHOST = .3;
const hash = (n, seed = 0) => { const x = Math.sin(n * 127.1 + seed * 311.7 + 74.7) * 43758.5453; return x - Math.floor(x); };
/** rank[i]: when letter i of an n-letter word builds (seeded scatter). */
const ranks = (n, seed) => { const seq = [...Array(n).keys()].sort((a, b) => hash(a + 1, seed) - hash(b + 1, seed)), r = Array(n); seq.forEach((i, k) => { r[i] = k; }); return r; };
/** A word as letter spans: hidden -> ghost -> solid, `step` s apart in a scattered order from `start`. */
const build = (text, t, start, step = .035, hold = .06, seed = 1) => {
  const ch = [...text], r = ranks(ch.length, seed + ch.length);
  return ch.map((c, i) => { const a = start + r[i] * step, o = t < a ? 0 : t < a + hold ? GHOST : 1; return `<i style="opacity:${o}">${esc(c)}</i>`; }).join('');
};
const lift = '0 .04em .3em rgba(0,0,0,.45)';
const seedOf = w => Math.round((w.start ?? 0) * 100);

export const styles = [
  {
    id: 'heavy', name: 'Heavy', font: 'Montserrat',
    description: 'Heavy white Montserrat capitals, two or three words at a time. The spoken word is solid; words still to come wait as translucent ghosts; said words stay solid. The theme default.',
    group: {maxWords: 3, maxChars: 16},
    css: `.cap-heavy{bottom:15%;left:7%;right:7%;font:800 7cqw/1.15 Montserrat;color:${WHITE};text-transform:uppercase;letter-spacing:.02em;text-shadow:${lift}}
          .cap-heavy span{display:inline-block;padding:0 .08em}`,
    render: (p, t) => eachWord(p, t, (w, i, on, said) => `<span style="opacity:${said ? 1 : GHOST}">${esc(bare(w.text))}</span>`),
  },
  {
    id: 'one-word', name: 'One word', font: 'Montserrat',
    description: 'One huge word at a time, centred low, its letters building in a scattered order through a ghost to solid as it is spoken — the theme\'s big-word move as captions. For fast, punchy speech.',
    group: {maxWords: 1, maxChars: 12},
    css: `.cap-one-word{bottom:16%;font:800 13cqw/1.1 Montserrat;color:${WHITE};text-transform:uppercase;letter-spacing:.02em;text-shadow:${lift}}
          .cap-one-word i{font-style:normal}`,
    render: (p, t) => { const w = p.words[0]; return build(bare(w.text), t, w.start, .03, .05, seedOf(w)); },
  },
  {
    id: 'letter-stagger', name: 'Letter stagger', font: 'Montserrat',
    description: 'The phrase in heavy capitals; each word\'s letters arrive one at a time in a scattered order as the word starts (ghost, then solid). Words to come are not shown yet.',
    group: {maxWords: 3, maxChars: 16},
    css: `.cap-letter-stagger{bottom:15%;left:7%;right:7%;font:800 7.4cqw/1.15 Montserrat;color:${WHITE};text-transform:uppercase;letter-spacing:.02em;text-shadow:${lift}}
          .cap-letter-stagger span{display:inline-block;padding:0 .08em}.cap-letter-stagger i{font-style:normal}`,
    render: (p, t) => eachWord(p, t, (w, i, on, said) => `<span>${build(bare(w.text), t, w.start, .028, .05, seedOf(w))}</span>`),
  },
  {
    id: 'block', name: 'Charcoal block', font: 'Montserrat',
    description: 'Heavy white capitals; the spoken word sits on a solid charcoal block that snaps to it, the others wait in white with a soft lift. Reads on any footage, even a bright room.',
    group: {maxWords: 3, maxChars: 18},
    css: `.cap-block{bottom:15%;left:6%;right:6%;font:800 6.6cqw/1.4 Montserrat;color:${WHITE};text-transform:uppercase;letter-spacing:.02em}
          .cap-block span{display:inline-block;padding:.02em .2em;margin:0 .02em;text-shadow:${lift}}
          .cap-block span.on{background:${COAL};text-shadow:none}`,
    render: (p, t) => eachWord(p, t, (w, i, on, said) => `<span class="${on ? 'on' : ''}" style="opacity:${said ? 1 : .55}">${esc(bare(w.text))}</span>`),
  },
  {
    id: 'credit', name: 'Credit line', font: 'Inter Tight',
    description: 'Quiet subtitles like an opening credit: small widely tracked Inter Tight capitals, typed on with the voice, a short white rule above. For long explanations under busy graphics.',
    group: {maxWords: 6, maxChars: 34},
    css: `.cap-credit{bottom:13%;left:10%;right:10%;font:700 3.6cqw/1.6 "Inter Tight";color:${WHITE};text-transform:uppercase;letter-spacing:.22em;text-shadow:${lift}}
          .cap-credit b{display:block;width:8%;height:.5cqw;margin:0 auto .9em;background:${WHITE}}`,
    render: (p, t) => {
      const text = p.words.map((w, i) => { const s = bare(w.text), q = clamp((t - w.start) / Math.max(.08, Math.min(.25, w.end - w.start))); return t < w.start ? '' : (i ? ' ' : '') + s.slice(0, Math.max(1, Math.round(s.length * q))); }).join('');
      return `<b></b>${esc(text)}`;
    },
  },
  {
    id: 'ink-tab', name: 'Ink on white', font: 'Montserrat',
    description: 'For bright footage: the phrase in heavy charcoal capitals on white tabs, one tab per word, each tab wiping open from the left as its word is spoken.',
    group: {maxWords: 3, maxChars: 16},
    css: `.cap-ink-tab{bottom:15%;left:6%;right:6%;font:800 6.2cqw/1.5 Montserrat;color:${INK};text-transform:uppercase;letter-spacing:.02em}
          .cap-ink-tab span{display:inline-block;padding:.04em .22em;margin:0 .05em;background:${WHITE}}`,
    render: (p, t) => eachWord(p, t, (w, i, on, said) => { const q = said ? clamp((t - w.start) / .12) : 0; return `<span style="opacity:${said ? 1 : 0};clip-path:inset(0 ${((1 - q) * 100).toFixed(1)}% 0 0)">${esc(bare(w.text))}</span>`; }),
  },
  {
    id: 'coal-tab', name: 'White on charcoal', font: 'Montserrat',
    description: 'Ink-tab reversed, for white screens (a browser page, a document): the phrase in heavy white capitals on charcoal tabs, one tab per word, each wiping open from the left as its word is spoken.',
    group: {maxWords: 3, maxChars: 16},
    css: `.cap-coal-tab{bottom:15%;left:6%;right:6%;font:800 6.2cqw/1.5 Montserrat;color:${WHITE};text-transform:uppercase;letter-spacing:.02em}
          .cap-coal-tab span{display:inline-block;padding:.04em .22em;margin:0 .05em;background:${COAL};box-shadow:0 .06em .3em rgba(0,0,0,.35)}`,
    render: (p, t) => eachWord(p, t, (w, i, on, said) => { const q = said ? clamp((t - w.start) / .12) : 0; return `<span style="opacity:${said ? 1 : 0};clip-path:inset(0 ${((1 - q) * 100).toFixed(1)}% 0 0)">${esc(bare(w.text))}</span>`; }),
  },
];

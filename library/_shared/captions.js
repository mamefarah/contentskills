// Caption engine, shared by every theme. A theme's captions/styles.js exports `styles`;
// each style is a pure function of (phrase, time) -> HTML, so it can be
// previewed live, scrubbed, or rendered frame by frame. Sizes use cqw (percent of the
// video width), so the same style works on a small card and on a 1080-wide frame.
// Words are [{text, start, end}] in seconds, e.g. straight from a Whisper transcript.
// A word may also carry `shotEnd` (seconds): phrases then never run across a cut; `breakBefore` (a new
// phrase starts at this word), `solo` (the word is a phrase on its own) and `emph` (an emphasis level a style may draw).

export const esc = s => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
export const bare = s => s.replace(/[,.…]+$/, '');
export const clamp = x => Math.max(0, Math.min(1, x));
export const back = x => { x = clamp(x); return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2); };

/** Group words into short phrases: break on long pauses, sentence ends, or size limits. */
export function phrases(words, {maxWords = 4, maxChars = 20, pause = .3} = {}) {
  const out = [];
  let current = [];
  const flush = () => { if (current.length) { out.push({start: current[0].start, end: current.at(-1).end, words: current}); current = []; } };
  for (const word of words) {
    const prev = current.at(-1), chars = current.reduce((n, w) => n + w.text.length + 1, 0);
    if (prev && (prev.solo || word.solo || word.breakBefore || prev.shotEnd !== word.shotEnd || current.length >= maxWords || chars + word.text.length > maxChars || word.start - prev.end > pause || /[.!?…]$/.test(prev.text))) flush();
    current.push(word);
  }
  flush();
  // Hold each phrase until the next one starts (or a short beat after its last word).
  out.forEach((p, i) => { p.end = Math.min(out[i + 1]?.start ?? Infinity, p.end + .6, p.words.at(-1).shotEnd ?? Infinity); });
  return out;
}

/** Index of the word being spoken at t; a word stays active until the next one starts. */
export const activeIndex = (phrase, t) => { let idx = -1; phrase.words.forEach((w, i) => { if (t >= w.start) idx = i; }); return idx; };
export const eachWord = (phrase, t, fn) => { const active = activeIndex(phrase, t); return phrase.words.map((w, i) => fn(w, i, i === active, i <= active)).join(' '); };

const base = `.cap{position:absolute;left:6%;right:6%;text-align:center;pointer-events:none;transform:translateY(50%)}
.cap-host{container-type:inline-size}`;

/** Mount a caption overlay in `el` (which should cover the video). `style` is one entry of a theme's styles. Returns {seek(t)}. */
export function mountCaptions(el, style, words) {
  if (!style) throw Error('Unknown caption style');
  const ensure = (id, css) => { if (!document.getElementById(id)) { const tag = document.createElement('style'); tag.id = id; tag.textContent = css; document.head.append(tag); } };
  ensure('cap-base', base); ensure('cap-css-' + style.id, style.css);
  el.classList.add('cap-host');
  const box = document.createElement('div'); box.className = `cap cap-${style.id}`; el.append(box);
  const list = phrases(words, style.group);
  let shown = null;
  return {
    box,
    /** The phrase on screen at t (or undefined): lets the footage player keep one placement per phrase. */
    phraseAt: t => list.find(p => t >= p.start && t < p.end),
    seek(t) {
      const phrase = list.find(p => t >= p.start && t < p.end);
      const html = phrase ? style.render(phrase, t) : '';
      if (html !== shown) { box.innerHTML = html; shown = html; }
    },
  };
}

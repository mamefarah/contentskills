import {FS, say, C, stage, group, rr, text, topBar, spark, keyboard, KEYS, KB_Y, iconPlus, iconSliders, iconMic, iconArrowUp, EDGE} from '../../ui.js';

// A new chat: the spark and a greeting in the middle, an empty composer, and a short message typed letter by letter
// on the keyboard, then sent. The opening of a "comment <keyword>" ending. It fills the frame (an overlay over the footage).
// Timing: `typeAt` .. `typeAt + typeFor` typing, the send at `sendAt`.
export const meta = {duration: 0.95, live: true};   // live: a longer overlay (a "hold") keeps the timing running instead of freezing at 0.95 s
export const defaults = {greeting: 'Evening', message: 'claude', typeAt: 0.12, typeFor: 0.55, sendAt: 0.8};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), base = group(svg), live = group(svg), msg = String(p.message);
  topBar(base);
  // As on claude.ai: a light serif greeting with the spark sitting just left of it, the pair centred together.
  const hello = text(base, 540, 640, p.greeting, 72, 300, C.text, 'start', {'font-family': FS});
  const wide = hello.getComputedTextLength?.() || p.greeting.length * 34, gap = 92, left = 540 - (wide + gap) / 2;
  hello.setAttribute('x', left + gap);
  rr(base, 38, 980, 1048, 1220, 48, C.surf, EDGE);
  iconPlus(base, 88, 1152); iconSliders(base, 162, 1152); iconMic(base, 888, 1152);
  keyboard(base);
  return {
    seek(t) {
      live.replaceChildren();
      spark(live, left + 30, 640, 32, t * 2);
      const n = Math.max(0, Math.min(msg.length, Math.floor((t - p.typeAt) / p.typeFor * msg.length + 1e-6) + (t >= p.typeAt ? 1 : 0)));
      const typed = msg.slice(0, n), ty = 1050, sent = t >= p.sendAt;
      if (typed) {
        const tx = text(live, 76, ty, typed, 50, 450, C.text);
        const w = tx.getComputedTextLength ? tx.getComputedTextLength() : typed.length * 25;
        if (!sent) rr(live, 76 + w + 4, ty - 30, 80 + w + 4, ty + 30, 0, C.orange);
      } else { rr(live, 76, ty - 30, 80, ty + 30, 0, C.orange); text(live, 90, ty, 'Chat with Claude', 44, 450, C.placeholder); }
      rr(live, 936, 1110, 1020, 1194, 26, sent ? C.orangeHot : C.orange); iconArrowUp(live, 978, 1152);
      if (typed && !sent) text(live, 260, KB_Y + 44, `“${typed}”`, 38, 500, C.text);
      const key = n > 0 && !sent ? msg[n - 1].toLowerCase() : null, keyAt = p.typeAt + (n - 1) * p.typeFor / msg.length;
      if (key && KEYS[key] && t - keyAt < .09) {                                         // key pop-up while pressed
        const [x0, y0, x1, y1] = KEYS[key], cx = (x0 + x1) / 2;
        rr(live, cx - 64, y0 - 150, cx + 64, y1 + 4, 22, C.keyHi); text(live, cx, y0 - 72, key, 92, 400, '#fafaf8', 'middle');
      }
    },
  };
}

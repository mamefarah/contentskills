import {say, C, CARD, stage, group, rr, circle, text, image, topBar, spark, iconPlus, iconMic, iconArrowUp, EDGE} from '../../ui.js';

// The chat after sending: the command as a pill, Claude's spinning spark with "Editing with <name>..." and
// SPED UP, an empty dark result card, and the reply bar. Draw it behind the clip ("behind": true) and put the clip
// in a layout window over the card: {"to": "card", "x": 30, "y": 545, "width": 632, "height": 1125, "radius": 30}.
// With `reply` it is a plain answer instead: the message is the pill (no attached clip unless `thumb`), and Claude's reply
// streams in word by word from `replyAt` over `replyFor` seconds, wrapping onto a second line.
export const meta = {duration: 1.3, live: true};
export const defaults = {command: '/effects glitch', name: 'glitch', thumb: '', label: 'SPED UP', reply: '', replyAt: 0.1, replyFor: 0.5, card: true};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), base = group(svg), live = group(svg);
  topBar(base);
  const chatty = !!p.reply, py = chatty && !p.thumb ? 229 : 429;                  // a plain message sits at the top
  if (p.thumb) image(base, p.thumb, 902, 195, 110, 175, 18);
  const pill = text(base, 982, py, p.command, 40, 500, chatty ? C.text : C.pillFg, 'end');
  const w = pill.getComputedTextLength ? pill.getComputedTextLength() : p.command.length * 21;
  const pillBg = rr(base, 1012 - w - 60, py - 37, 1012, py + 37, 37, chatty ? C.surf2 : C.pillBg); base.insertBefore(pillBg, pill);
  const ry = py + 76;
  if (!chatty) {
    say(base, 110, 505, `Editing with ${p.name}...`, 37);
    text(base, 1010, 505, p.label, 24, 700, C.muted, 'end', {'letter-spacing': 7});
  }
  const words = String(p.reply).split(/\s+/).filter(Boolean), lines = [];
  for (const wd of words) { const last = lines[lines.length - 1]; if (last && (last + ' ' + wd).length <= 44) lines[lines.length - 1] = last + ' ' + wd; else lines.push(wd); }
  if (p.card !== false) rr(base, CARD.x, CARD.y, CARD.x + CARD.width, CARD.y + CARD.height, 30, C.card);   // card: false, just the conversation
  rr(base, 24, 1748, 1056, 1868, 60, C.surf, EDGE); iconPlus(base, 80, 1808, 20);
  text(base, 122, 1808, 'Reply to Claude...', 38, 450, C.placeholder); iconMic(base, 880, 1808);
  circle(base, 988, 1808, 40, C.surf2); iconArrowUp(base, 988, 1808, C.muted, 17);
  return {seek(t) {
    live.replaceChildren(); spark(live, 68, chatty ? ry : 505, 23, t * 5);
    if (!chatty) return;
    let left = Math.floor(words.length * Math.max(0, Math.min(1, (t - p.replyAt) / p.replyFor)));      // words streamed so far
    lines.forEach((ln, i) => { if (left <= 0) return; const ws = ln.split(' '), shown = ws.slice(0, left).join(' '); left -= ws.length; say(live, 110, ry + i * 50, shown, 37); });
  }};
}

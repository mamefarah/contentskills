import {say, C, F, stage, group, rr, circle, node, text, topBar, spark, iconPlus, iconMic, iconArrowUp, EDGE} from '../../ui.js';

// The "comment <keyword>" ending. Claude answers the keyword in the chat (the reply streams in), a card in the chat
// resolves from a dot matrix (pixels popping at random in blacklight colours with little mushrooms, the showcase's working look)
// into a grid of every result (numbered tiles with their names, plus a "+N more"
// tile), then the card grows to fill the screen and holds. It fills the frame (an overlay over the footage).
// Timing: reply 0.05-0.55 s, dot resolve `resolveAt` for 0.8 s, zoom at `zoomAt` (0.18 s), then the hold.
export const meta = {duration: 3.2, live: true};
// keyword, reply and title default to the user's call-to-action keyword (settings: me.keyword).
export const defaults = {keyword: '{me.keyword}', reply: 'Comment "{me.keyword}" and I\'ll send you every effect', title: 'Comment “{me.keyword}”',
  subtitle: 'for all the effects', tiles: [], more: 0, resolveAt: 0.45, zoomAt: 1.35};

const CARD = {x: 30, y: 545, s: 632 / 1080};
const clamp = x => Math.max(0, Math.min(1, x)), ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
let ids = 0;
// The showcase's working look (templates/effects-showcase/assemble.py, Reveal): popping pixels in a dimmed
// blacklight palette (indigo, electric blue, violet, magenta), each pixel popping on its own beat, with little pixel mushrooms, so the end card resolves the same way.
// Every pixel pops on its own random beat (a sharp flash fading back to dim); no waves.
const pop01 = (h, t) => { const f = ((t * h.rate + h.ph) % 1 + 1) % 1; return Math.min(1, Math.max(0, 1 - f * 2) ** 2 * .85 + h.jit); };
const STOPS = [[0, [12, 8, 26]], [.3, [34, 22, 96]], [.58, [58, 40, 190]], [.8, [120, 34, 184]], [1, [176, 40, 150]]];   // RGB
const CAPS = ['rgb(166,36,108)', 'rgb(184,76,44)', 'rgb(50,173,86)', 'rgb(137,65,173)'];   // magenta, hot coral, neon green, violet (dimmed)
const STEM = 'rgb(86,158,166)', SPOT = 'rgb(180,173,184)';
const MUSHROOM = ['.CCC.', 'CWCCC', 'CCCCC', '..S..', '.SSS.'];

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), id = 'ec' + (++ids);
  const tiles = (p.tiles ?? []).slice(0, 29), count = tiles.length + (p.more > 0 ? 1 : 0);
  // grid geometry inside the full-screen card (1080 x 1920): tiles 9:16, fitted to x 60..1020, y 540..1470 (the Reels
  // safe zone: nothing under the app's caption and buttons), with whichever column count gives the biggest tiles
  // Tiles narrower than 110 px drop their name labels (and the 44 px under each row the label needs).
  const gap = 18, fitL = (c, lab) => { const r = Math.ceil(count / c); return Math.min((960 - gap * (c - 1)) / c, ((930 - gap * (r - 1)) / r - lab) * 9 / 16); };
  const best = lab => [2, 3, 4, 5, 6, 7, 8].reduce((a, c) => fitL(c, lab) > fitL(a, lab) + .5 ? c : a, 2);
  const labels = fitL(best(44), 44) >= 110, lab = labels ? 44 : 0, cols = best(lab), rows = Math.ceil(count / cols), tw = fitL(cols, lab), th = tw * 16 / 9;
  const gx = 540 - (cols * tw + (cols - 1) * gap) / 2, gy = 540;

  // ---- the chat behind the card
  const chat = group(svg);
  topBar(chat);
  const pill = text(chat, 982, 229, p.keyword, 40, 500, C.text, 'end');
  const w = pill.getComputedTextLength ? pill.getComputedTextLength() : p.keyword.length * 21;
  chat.insertBefore(rr(chat, 1012 - w - 60, 192, 1012, 266, 37, C.surf2), pill);
  rr(chat, 24, 1748, 1056, 1868, 60, C.surf, EDGE); iconPlus(chat, 80, 1808, 20);
  text(chat, 122, 1808, 'Reply to Claude...', 38, 450, C.placeholder); iconMic(chat, 880, 1808);
  circle(chat, 988, 1808, 40, C.surf2); iconArrowUp(chat, 988, 1808, C.muted, 17);
  const live = group(svg);

  // ---- the end screen, drawn once at full size; a transform places it in the chat card, a dot mask resolves it
  const defs = node(svg, 'defs');
  const mask = node(defs, 'mask', {id: id + 'm', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1080, height: 1920});
  const full = rr(mask, 0, 0, 1080, 1920, 0, '#000');
  const D = 24, holes = [];          // one dot per 24 px cell: white in the mask shows the end screen through it
  for (let y = D / 2; y < 1920; y += D) for (let x = D / 2; x < 1080; x += D) holes.push({x: x / 1080, y: y / 1080, m: circle(mask, x, y, 0, '#fff')});
  const gw = Math.ceil(1080 / D), gh = Math.ceil(1920 / D);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const h of holes) Object.assign(h, {rate: 1.2 + 2 * rnd(), ph: rnd(), jit: .15 * rnd(), hue: STOPS[1 + Math.floor(rnd() * (STOPS.length - 1))][1]});
  for (let row = 0, gy = 3; gy < gh - 6; row++, gy += 13) for (let gx = 2 + (row % 2) * 5; gx < gw - 5; gx += 10) {   // mushrooms on a staggered lattice
    const ox = gx + Math.floor(rnd() * 3) - 1, oy = gy + Math.floor(rnd() * 5) - 2, cap = CAPS[Math.floor(rnd() * CAPS.length)], at = rnd() * .12;
    MUSHROOM.forEach((line, j) => [...line].forEach((ch, i) => {
      const h = holes[(oy + j) * gw + ox + i];
      if (ch !== '.' && h && ox + i < gw) Object.assign(h, {mush: ch === 'C' ? cap : ch === 'W' ? SPOT : STEM, at: at + .025 * (4 - j)});   // grows up from the stem
    }));
  }
  const clip = node(defs, 'clipPath', {id: id + 'c'}); const clipRect = rr(clip, 0, 0, 1080, 1920, 54, '#000');
  const card = group(svg), inner = group(card, {mask: `url(#${id}m)`, 'clip-path': `url(#${id}c)`});
  rr(inner, 0, 0, 1080, 1920, 0, C.bg);
  text(inner, 540, 330, p.title, 92, 800, '#fafaf8', 'middle', {'letter-spacing': -1});
  const sub = text(inner, 540, 446, p.subtitle, 40, 700, '#fff', 'middle');
  const sw = sub.getComputedTextLength ? sub.getComputedTextLength() : p.subtitle.length * 21;
  inner.insertBefore(rr(inner, 540 - sw / 2 - 30, 412, 540 + sw / 2 + 30, 480, 14, C.orange), sub);
  const pulse = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols, r = Math.floor(i / cols), x = gx + c * (tw + gap), y = gy + r * (th + lab + gap);
    const cp = node(defs, 'clipPath', {id: `${id}t${i}`}); rr(cp, x, y, x + tw, y + th, 16, '#000');
    if (i < tiles.length) {
      const t = tiles[i];
      if (t.image) node(inner, 'image', {href: t.image, x, y, width: tw, height: th, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${id}t${i})`});
      else rr(inner, x, y, x + tw, y + th, 16, C.surf2);
      circle(inner, x + 26, y + 26, 19, C.orange); text(inner, x + 26, y + 27, String(i + 1), 22, 800, '#fff', 'middle');
      if (labels) text(inner, x + tw / 2, y + th + 24, `/${t.name}`, Math.min(26, (tw + gap) / (Math.max(6, t.name.length + 1) * .64)), 600, C.sub, 'middle');
    } else {
      const g = group(inner); pulse.push({g, cx: x + tw / 2, cy: y + th / 2});
      rr(g, x, y, x + tw, y + th, 16, '#3a2a24', {stroke: C.orange, 'stroke-width': 3});
      text(g, x + tw / 2, y + th / 2 - 18, `+${p.more}`, Math.min(84, tw * .42), 800, '#fafaf8', 'middle');
      text(g, x + tw / 2, y + th / 2 + Math.min(52, tw * .26), 'more', Math.min(34, tw * .18), 600, C.sub, 'middle');
    }
  }
  const tint = group(card, {'clip-path': `url(#${id}c)`});        // the same dots, coloured per pixel, fading off the picture
  for (const h of holes) h.c = circle(tint, h.x * 1080, h.y * 1080, 0, '#000');

  const words = String(p.reply).split(/\s+/).filter(Boolean), lines = [];
  for (const wd of words) { const l = lines[lines.length - 1]; if (l && (l + ' ' + wd).length <= 44) lines[lines.length - 1] = l + ' ' + wd; else lines.push(wd); }

  return {
    seek(t) {
      live.replaceChildren();
      spark(live, 68, 305, 23, t * 5);
      let left = Math.floor(words.length * clamp((t - .05) / .5));
      lines.forEach((ln, i) => { if (left <= 0) return; const ws = ln.split(' '); say(live, 110, 305 + i * 50, ws.slice(0, left).join(' '), 37); left -= ws.length; });
      // resolve: a dim dot matrix wakes with pixels popping, then dots take the picture and grow, popping ones first
      const k = clamp((t - p.resolveAt) / .8), done = k >= 1;
      card.setAttribute('visibility', t < p.resolveAt ? 'hidden' : 'visible');
      full.setAttribute('fill', done ? '#fff' : '#000'); tint.setAttribute('visibility', done ? 'hidden' : 'visible');
      if (!done) for (const h of holes) {
        const v = pop01(h, t * 1.8), w = clamp(k * 1.7 - .7 + v * .6), pop = h.mush ? clamp((t - p.resolveAt - h.at) / .08) : 0;
        const r = Math.max((2.5 + 6 * v) * ease(k * 4) * (1 - pop) + 12 * pop, 17.5 * ease(w));
        h.m.setAttribute('r', r.toFixed(1)); h.c.setAttribute('r', r.toFixed(1));
        h.c.setAttribute('fill', pop > .5 ? h.mush : `rgb(${h.hue.map(c => Math.round(c * (.2 + .8 * v))).join(',')})`); h.c.setAttribute('opacity', (.95 * (1 - ease(w * 1.25))).toFixed(2));
      }
      // zoom from the chat card to the full screen
      const z = ease((t - p.zoomAt) / .18), s = CARD.s + (1 - CARD.s) * z;
      card.setAttribute('transform', `translate(${(CARD.x * (1 - z)).toFixed(2)} ${(CARD.y * (1 - z)).toFixed(2)}) scale(${s.toFixed(4)})`);
      clipRect.setAttribute('rx', (54 * (1 - z)).toFixed(1));
      chat.setAttribute('opacity', z >= 1 ? 0 : 1); live.setAttribute('opacity', z >= 1 ? 0 : 1);
      // the hold keeps a little life: the "+N more" tile breathes
      const b = 1 + .035 * Math.sin(Math.max(0, t - p.zoomAt) * 6);
      for (const q of pulse) q.g.setAttribute('transform', `translate(${q.cx} ${q.cy}) scale(${b.toFixed(4)}) translate(${-q.cx} ${-q.cy})`);
    },
  };
}

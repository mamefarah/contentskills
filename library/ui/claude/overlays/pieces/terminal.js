import {C, stage, group, rr, circle, line, text, spark} from '../../ui.js';

// Claude Code in a terminal, as a floating window (transparent around it): a shell prompt with a blinking caret; at
// `launchAt` `claude` is typed and Claude Code opens (the welcome box with the orange border); the request types into
// the input box letter by letter from `typeAt` over `typeFor` and is sent at `sendAt` (it moves up into the history
// and Claude starts working with the spinning spark and `reply`); at `dropAt` a video file falls into the input box and
// lands as an attachment chip. All times in seconds from the overlay's start. Place it with x, y, w.
// open: Claude Code is already running (no shell, no launch). When dropAt comes before typeAt the file lands first
// and the request types after its chip; on send both move up into the history.
// log: Claude's output streaming in after send (one line every `logEvery` s from `logAt`, default sendAt + .25), the
// history scrolling up inside the window as it fills; `reply` then stays pinned above the input box with the spinner.
// A line starting with "● " is a tool call (green dot), "⎿ " its result (dimmed, indented); anything else plain text.
export const meta = {duration: 6, live: true};
export const defaults = {
  command: 'edit my-video.mov into a reel', file: 'my-video.mov', reply: 'Editing my-video.mov…', cwd: '~/videos',
  open: false, launchAt: .4, typeAt: 1.6, typeFor: 1.6, sendAt: 3.4, dropAt: 4.2, x: 50, y: 270, w: 980, h: 760, size: 34,
  log: [], logEvery: .12,
};
let clipN = 0;

const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - Math.pow(1 - clamp(x), 4);
const back = x => { x = clamp(x); const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace';
const T = '#e8e6df', DIM = '#8f8d86', BG = '#1d1d1b', BAR = '#2a2a28';

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el, null), root = group(svg), live = group(root);
  const {x, y, w, size} = p, life = p.life ?? meta.duration, pad = 40, lh = size * 1.55, h = p.h;
  const mono = (g, x0, y0, s, fill = T, weight = 500, extra = {}) => text(g, x0, y0, s, size, weight, fill, 'start', {'font-family': MONO, 'xml:space': 'preserve', ...extra});
  const cw = size * .6;                                                       // monospace advance, for the caret and chips
  rr(root, x, y + 14, x + w, y + h + 14, 28, 'rgba(0,0,0,.35)', {filter: 'blur(18px)'});
  rr(root, x, y, x + w, y + h, 28, BG, {stroke: '#3a3a37', 'stroke-width': 2});
  rr(root, x, y, x + w, y + 70, 28, BAR); rr(root, x, y + 42, x + w, y + 70, 0, BAR);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => circle(root, x + 40 + i * 34, y + 35, 11, c));
  text(root, x + w / 2, y + 36, 'claude — zsh', 26, 500, DIM, 'middle');
  root.insertBefore(live, null);
  // with a log, the input box sits fixed at the bottom of the window and the history scrolls in a clipped body above it
  const LOG = p.log?.length ? p.log : null, inY = y + h - 140, spinY = inY - 36, cid = `term-clip-${++clipN}`;
  if (LOG) {
    const NS = 'http://www.w3.org/2000/svg', defs = svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild);
    const cp = defs.appendChild(document.createElementNS(NS, 'clipPath')), cr = cp.appendChild(document.createElementNS(NS, 'rect'));
    cp.setAttribute('id', cid);
    Object.entries({x, y: y + 72, width: w, height: spinY - 30 - (y + 72)}).forEach(([k, v]) => cr.setAttribute(k, v));
  }

  return {seek(t) {
    live.replaceChildren();
    const a = ease(t / .3), b = life ? Math.pow(clamp((t - (life - .25)) / .25), 3) : 0;
    root.setAttribute('opacity', (Math.min(1, t / .15) * (1 - b)).toFixed(3));
    root.setAttribute('transform', `translate(0 ${((1 - a) * 70 + b * 40).toFixed(1)})`);
    const blink = Math.floor(t * 2.2) % 2 === 0, left = x + pad;
    let cy = y + 70 + 52;

    // 1. the shell: `claude` typed at launchAt (skipped when open)
    if (p.open) return frame(t, cy, true);
    const shellTyped = 'claude'.slice(0, Math.floor(clamp((t - p.launchAt) / .35) * 6));
    mono(live, left, cy, `${p.cwd} %`, '#7fb37a', 600); mono(live, left + cw * (p.cwd.length + 3), cy, shellTyped);
    const launched = t >= p.launchAt + .5;
    if (!launched) { if (blink) rr(live, left + cw * (p.cwd.length + 3 + shellTyped.length) + 2, cy - size * .62, left + cw * (p.cwd.length + 3 + shellTyped.length) + cw, cy + size * .62, 2, T); return; }
    frame(t, cy, false);
  }};

  function frame(t, cy, open) {
    const blink = Math.floor(t * 2.2) % 2 === 0, left = x + pad;
    const L = LOG && t >= p.sendAt ? LOG : null, inner = L ? group(group(live, {'clip-path': `url(#${cid})`})) : null, tgt = inner ?? live;
    // 2. the welcome box, drawing open
    const k = open ? 1 : ease((t - p.launchAt - .5) / .35), bx0 = left, bx1 = x + w - pad, by0 = cy + 40, by1 = by0 + 190;
    const g = group(tgt, {opacity: k.toFixed(3), transform: `translate(0 ${((1 - k) * 16).toFixed(1)})`});
    rr(g, bx0, by0, bx1, by1, 18, 'none', {stroke: C.orange, 'stroke-width': 3});
    spark(g, bx0 + 52, by0 + 62, 22, 0);
    text(g, bx0 + 92, by0 + 64, 'Welcome to Claude Code!', size * 1.05, 700, T, 'start', {'font-family': MONO});
    mono(g, bx0 + 92, by0 + 122, '/help for help, /status for your setup', DIM, 400, {'font-size': size * .72});
    cy = by1 + 56;

    // 3. history once sent: the request, then Claude working
    const sent = t >= p.sendAt, first = p.dropAt < p.typeAt;       // first: the file goes in before the request
    if (sent) {
      if (first) {
        const chip = `▶ ${p.file}`, chipW = cw * .86 * chip.length + 36, c0 = left + cw * 2;
        mono(tgt, left, cy, '>', DIM); rr(tgt, c0, cy - 24, c0 + chipW, cy + 24, 12, C.pillBg, {opacity: .7});
        text(tgt, c0 + 18, cy, chip, size * .86, 600, C.pillFg, 'start', {'font-family': MONO, opacity: .8});
        mono(tgt, c0 + chipW + 14, cy, p.command, DIM);
      } else mono(tgt, left, cy, `> ${p.command}`, DIM);
      cy += lh;
      const q = ease((t - p.sendAt) / .25), r = group(L ? live : tgt, {opacity: q.toFixed(3)}), ry = L ? spinY : cy;
      spark(r, left + 16, ry, 15, t * 6);
      mono(r, left + 44, ry, p.reply, C.orangeHot, 600);
      if (L) {
        // 3b. the log streaming in, the history scrolling up so the newest line stays just above the spinner
        const ls = size * .66, lhL = ls * 1.55, at0 = p.logAt ?? p.sendAt + .25, every = p.logEvery;
        const nf = (t - at0) / every, n = Math.max(0, Math.min(L.length, Math.floor(nf) + 1));
        L.slice(0, n).forEach((s, i) => {
          const ly = cy + i * lhL, lg = group(inner, {opacity: ease((t - at0 - i * every) / .08).toFixed(3)});
          if (s.startsWith('● ')) { circle(lg, left + 9, ly, ls * .22, '#7fb37a'); mono(lg, left + 32, ly, s.slice(2), T, 600, {'font-size': ls}); }
          else if (s.startsWith('⎿ ')) mono(lg, left + 32, ly, s, DIM, 400, {'font-size': ls});
          else mono(lg, left + 32, ly, s, T, 400, {'font-size': ls});
        });
        const f = Math.max(-1, Math.min(nf, L.length - 1)), fl = Math.floor(f), sm = fl + ease((f - fl) / .5);
        const shift = Math.max(0, cy + sm * lhL - (spinY - 30 - ls * .8));
        inner.setAttribute('transform', `translate(0 ${(-shift).toFixed(1)})`);
      }
      cy += lh * 1.4;
    }

    // 4. the input box: typing, then empty after send, then the dropped file lands in it as a chip
    const ix0 = left, ix1 = x + w - pad, iy0 = L ? inY : Math.max(cy, y + h - 190), iy1 = iy0 + 108;
    rr(live, ix0, iy0, ix1, iy1, 16, 'none', {stroke: '#5c5b56', 'stroke-width': 2.5});
    const icy = (iy0 + iy1) / 2;
    mono(live, ix0 + 26, icy, '>', T, 700);
    const typed = sent ? '' : p.command.slice(0, Math.round(clamp((t - p.typeAt) / p.typeFor) * p.command.length));
    const landed = t >= p.dropAt + .45 && !(first && sent);
    const chipW0 = cw * .86 * (p.file.length + 2) + 36, tx = ix0 + 26 + cw * 2 + (first && landed ? chipW0 + 14 : 0);
    let caretX = tx + cw * typed.length;
    mono(live, tx, icy, typed);
    if (landed) {
      const chip = `▶ ${p.file}`, chipW = cw * .86 * chip.length + 36, c0 = ix0 + 26 + cw * 2, pop = back((t - p.dropAt - .45) / .25);
      const cg = group(live, {transform: `translate(${c0 + chipW / 2} ${icy}) scale(${pop.toFixed(3)}) translate(${-(c0 + chipW / 2)} ${-icy})`});
      rr(cg, c0, icy - 26, c0 + chipW, icy + 26, 12, C.pillBg); text(cg, c0 + 18, icy, chip, size * .86, 600, C.pillFg, 'start', {'font-family': MONO});
      if (!first) caretX = c0 + chipW + 12;
    }
    if (blink || (t > p.typeAt && t < p.typeAt + p.typeFor)) rr(live, caretX, icy - size * .62, caretX + cw, icy + size * .62, 2, T, {opacity: .85});
    if (!sent) mono(live, ix0 + 4, iy1 + 34, '? for shortcuts', DIM, 400, {'font-size': size * .66});

    // 5. the video file falling in from above the window, with a little tilt
    if (t >= p.dropAt && t < p.dropAt + .45) {
      const q = clamp((t - p.dropAt) / .45), e = q * q, fx = ix0 + 260, fy0 = y - 260, fy1 = icy - 40, fy = fy0 + (fy1 - fy0) * e, s = 1 - .45 * e;
      const fg = group(live, {transform: `translate(${fx} ${fy}) rotate(${(-12 * (1 - e)).toFixed(1)}) scale(${s.toFixed(3)})`});
      rr(fg, -90, -110, 90, 110, 16, '#f0eee8', {stroke: '#c9c6bd', 'stroke-width': 3});
      node3(fg); text(fg, 0, 76, p.file, 30, 700, '#30302e', 'middle', {'font-family': MONO});
    }
  }
}

// a play triangle on a dark rounded square: the file icon's picture
function node3(g) { rr(g, -54, -80, 54, 28, 12, '#30302e'); line(g, [[-14, -48], [-14, -4], [22, -26], [-14, -48]], '#f0eee8', 6); }

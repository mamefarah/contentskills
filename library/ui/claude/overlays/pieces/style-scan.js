import {C, stage, group, rr, circle, line, text, image, spark, EDGE} from '../../ui.js';

// Claude learning a creator's style, as a floating dark card (transparent around it). First the user's reel covers stream in
// from both sides and shrink into the spinning spark ("reading your reels"); at `cardAt` the spark settles and the card
// resolves into what it learned: colour swatches with their hex codes, the user's fonts set in those fonts, and short facts
// (captions, pace). Give it the user's real covers and the user's real style (style/profile.json); the piece invents nothing.
export const meta = {duration: 3.2, live: true};
export const defaults = {
  title: 'Reading your reels', done: 'Learned your style', label: 'STYLE', images: [], cardAt: 2.2,
  colors: [{hex: '#1B3D2B', label: 'ink'}, {hex: '#95B496', label: 'accent'}, {hex: '#C9A27A', label: 'warm'}, {hex: '#ECE8DA', label: 'paper'}],
  fonts: [{family: 'Instrument Serif', label: 'Display'}, {family: 'Inter Tight', label: 'Text'}],
  facts: [], x: 60, y: 270, w: 960,
};

const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - Math.pow(1 - clamp(x), 4);
const inOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el, null), root = group(svg);
  const {x, y, w} = p, pad = 48, head = 128, life = p.life ?? meta.duration;
  const swH = 150, fontH = 96, factH = 64, h = head + 40 + swH + 34 + fontH + (p.facts.length ? 24 + p.facts.length * factH : 0) + 40;
  const sx = x + w / 2, sy = y + head + 40 + swH / 2 + 30;                 // where the reels fly to: the middle of the card
  const shadow = rr(root, x, y + 12, x + w, y + h + 12, 40, 'rgba(0,0,0,.3)', {filter: 'blur(16px)'});
  const card = rr(root, x, y, x + w, y + h, 40, C.bg, EDGE);
  text(root, x + w - pad, y + 70, p.label, 26, 700, C.muted, 'end', {'letter-spacing': 7});
  line(root, [[x + pad, y + head - 20], [x + w - pad, y + head - 20]], C.surf2, 2);
  const headLive = group(root), sparkG = group(root);

  // the reels: built once, moved each frame. Each cover 220 x 345 and arrives from alternate sides.
  const TW = 220, TH = 345, covers = p.images.length ? p.images : [null], n = Math.max(8, covers.length);
  const tiles = Array.from({length: n}, (_, i) => {
    const g = group(root); image(g, covers[i % covers.length], -TW / 2, -TH / 2, TW, TH, 14);
    const side = i % 2 ? 1 : -1, from = [sx + side * (w / 2 + 120), sy - 60 + ((i * 97) % 200)];
    return {g, from, at: .05 + i * (Math.max(.5, p.cardAt - .9) / n), rot: side * (8 + (i * 13) % 10)};
  });

  // what it learned, revealed row by row after cardAt
  const learned = group(root);
  const sw = p.colors.slice(0, 5), gap = 22, swW = (w - pad * 2 - gap * (sw.length - 1)) / Math.max(1, sw.length), rowY = y + head + 20;
  const swatches = sw.map((c, i) => {
    const g = group(learned), x0 = x + pad + i * (swW + gap);
    rr(g, x0, rowY, x0 + swW, rowY + swH - 46, 18, c.hex, {stroke: 'rgba(255,255,255,.14)', 'stroke-width': 2});
    text(g, x0 + 4, rowY + swH - 20, c.hex.toUpperCase(), 26, 600, C.text, 'start', {'font-family': '"JetBrains Mono", ui-monospace, monospace'});
    if (c.label) text(g, x0 + swW - 4, rowY + swH - 20, c.label, 24, 500, C.muted, 'end');
    return g;
  });
  const fy = rowY + swH + 34, fw = (w - pad * 2 - gap) / 2;
  const fonts = p.fonts.slice(0, 2).map((f, i) => {
    const g = group(learned), x0 = x + pad + i * (fw + gap);
    rr(g, x0, fy, x0 + fw, fy + fontH, 18, C.surf);
    text(g, x0 + 26, fy + fontH / 2 - 2, 'Aa', 58, 400, C.text, 'start', {'font-family': `"${f.family}", Georgia, serif`});
    text(g, x0 + 116, fy + fontH / 2 - 16, f.family, 32, 500, C.text, 'start', {'font-family': `"${f.family}", "Inter Tight", sans-serif`});
    text(g, x0 + 116, fy + fontH / 2 + 22, f.label, 22, 500, C.muted);
    return g;
  });
  const facts = p.facts.map((f, i) => {
    const g = group(learned), cy = fy + fontH + 24 + factH * (i + .5);
    circle(g, x + pad + 12, cy, 9, C.orange);
    text(g, x + pad + 40, cy, f.label, 34, 500, C.muted);
    text(g, x + w - pad, cy, f.value, 34, 600, C.text, 'end');
    return g;
  });
  const rows = [...swatches, ...fonts, ...facts];

  return {seek(t) {
    const a = ease(t / .3), b = life ? Math.pow(clamp((t - (life - .26)) / .26), 3) : 0, done = t >= p.cardAt;
    root.setAttribute('opacity', (Math.min(1, t / .16) * (1 - b)).toFixed(3));
    root.setAttribute('transform', `translate(0 ${((1 - a) * 60 + b * 40).toFixed(1)})`);
    headLive.replaceChildren(); sparkG.replaceChildren();
    spark(headLive, x + pad + 26, y + 66, 26, done ? 0 : t * 5);
    text(headLive, x + pad + 72, y + 68, done ? p.done : p.title, 42, 500, C.reply);
    // reels fly in and shrink into the spark at the centre; the spark grows with each one swallowed, then gives way
    let eaten = 0;
    for (const tile of tiles) {
      const q = (t - tile.at) / .75;
      if (q <= 0 || q >= 1 || done) { tile.g.setAttribute('opacity', 0); if (q >= 1) eaten++; continue; }
      const e = inOut(q), px = tile.from[0] + (sx - tile.from[0]) * e, py = tile.from[1] + (sy - tile.from[1]) * e, s = 1 - .85 * e;
      tile.g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(tile.rot * (1 - e)).toFixed(1)}) scale(${s.toFixed(3)})`);
      tile.g.setAttribute('opacity', (Math.min(1, q * 5) * (1 - clamp((q - .8) / .2))).toFixed(3));
    }
    const out = clamp((t - p.cardAt) / .25);
    if (out < 1) {
      const r = (46 + Math.min(eaten, n) * 3) * (1 + .12 * Math.sin(t * 14)) * (1 - out);
      circle(sparkG, sx, sy, r * 1.9, C.orange, {opacity: (.16 * (1 - out)).toFixed(3), filter: 'blur(18px)'});
      spark(sparkG, sx, sy, r, t * 6);
    }
    // what it learned arrives one row at a time
    rows.forEach((g, i) => {
      const q = ease((t - p.cardAt - .08 * i) / .3);
      g.setAttribute('opacity', q.toFixed(3)); g.setAttribute('transform', `translate(0 ${((1 - q) * 24).toFixed(1)})`);
    });
    shadow.setAttribute('opacity', 1); card.setAttribute('opacity', 1);
  }};
}

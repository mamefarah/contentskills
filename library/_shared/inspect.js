// Measuring what is on screen, for the quality check (pipeline/qa.py): the caption's box, words, size and colours,
// and the size of the text inside graphics. Used by both draft players' window.draft.layout().
// All sizes are frame pixels (1080x1920), whatever the preview's zoom.

const rgba = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [r, g, b, a]; };
const rgb = c => c && c.slice(0, 3).map(Math.round);
/** WCAG relative luminance and contrast ratio (1 to 21). */
export const luminance = ([r, g, b]) => { const f = v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

/** The first background behind `node` (up to `stop`) solid enough to read against (alpha 0.5 or more). */
function backing(node, stop) {
  for (let n = node; n; n = n.parentElement) { const bg = rgba(getComputedStyle(n).backgroundColor); if (bg && bg[3] >= .5) return bg; if (n === stop) break; }
  return null;
}
/** An outline that separates text from any picture: a text stroke of 1 px or more, or two or more solid text shadows (a glow). */
function halo(cs) {
  const stroke = parseFloat(cs.webkitTextStrokeWidth) || 0;
  if (stroke >= 1) return rgba(cs.webkitTextStrokeColor);
  const shadows = (cs.textShadow || '').match(/rgba?\([^)]+\)/g) ?? [], solid = shadows.map(rgba).filter(c => c && c[3] >= .5);
  return solid.length >= 2 ? solid[0] : null;
}

/** How many frame pixels one CSS pixel of `node` covers, transforms and preview zoom included. */
const scaleOf = (node, frame, W) => (node.getBoundingClientRect().width / Math.max(1, node.offsetWidth)) * (W / frame.getBoundingClientRect().width);

/**
 * The caption in `box`: {rect, text, font (smallest letter size in frame px), runs: [{color, back, halo, ratio, rect}]}.
 * `back` is a solid background behind the words, `halo` an outline or glow; `ratio` the contrast against whichever
 * of them reads best (null when the words sit straight on the picture: pipeline/qa.py then measures the picture).
 */
export function measureCaption(box, frame, W) {
  const f = frame.getBoundingClientRect(), k = W / f.width, range = document.createRange(); range.selectNodeContents(box);
  const b = range.getBoundingClientRect(); if (!(b.width > 0 && b.height > 0)) return null;
  const s = scaleOf(box, frame, W), runs = new Map(); let font = Infinity;
  const walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement, cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    font = Math.min(font, parseFloat(cs.fontSize) * s);
    const color = rgba(cs.color), back = backing(el, box), ring = halo(cs);
    if (!color || color[3] < .05) continue;
    const ratio = Math.max(back ? contrast(color, back) : 0, ring ? contrast(color, ring) : 0) || null;
    const run = {color: rgb(color), back: rgb(back), halo: rgb(ring), ratio: ratio && Math.round(ratio * 10) / 10}, key = JSON.stringify(run);
    // where this run's letters are (frame px), so pipeline/qa.py measures each run against the picture behind it, not
    // against a highlight box or other words elsewhere in the caption
    const tr = document.createRange(); tr.selectNodeContents(n); const r = tr.getBoundingClientRect();
    const at = [(r.left - f.left) * k, (r.top - f.top) * k, (r.right - f.left) * k, (r.bottom - f.top) * k], had = runs.get(key)?.rect;
    run.rect = (had ? [Math.min(had[0], at[0]), Math.min(had[1], at[1]), Math.max(had[2], at[2]), Math.max(had[3], at[3])] : at).map(Math.round);
    runs.set(key, run);
  }
  return {rect: [(b.left - f.left) * k, (b.top - f.top) * k, (b.right - f.left) * k, (b.bottom - f.top) * k].map(Math.round),
    text: box.textContent.replace(/\s+/g, ' ').trim(), font: Number.isFinite(font) ? Math.round(font) : null, runs: [...runs.values()]};
}

/** Text inside graphics that carries content (8 or more letters) and is visible: [[label, text, height in frame px]]. */
export function measureTexts(roots, frame, W) {
  const f = frame.getBoundingClientRect(), k = W / f.width, out = [];
  for (const [label, root] of roots) for (const el of root.querySelectorAll('text, p, h1, h2, h3, div:not(:has(*)), span:not(:has(*))')) {
    // short words count too (a terminal prompt, a chip): pipeline/qa.py checks captions against every word's box, and
    // judges letter size only on texts of 8+ letters
    const text = el.textContent.replace(/\s+/g, ' ').trim(); if (text.replace(/[^A-Za-z0-9]/g, '').length < 2) continue;
    let opacity = 1; for (let n = el; n && n !== root.parentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') { opacity = 0; break; } opacity *= +cs.opacity * (n instanceof SVGElement ? +(cs.fillOpacity || 1) : 1); }
    const r = el.getBoundingClientRect(); if (opacity < .5 || !(r.height > 0) || r.bottom < f.top || r.top > f.bottom) continue;
    out.push([label, text.slice(0, 40), Math.round(r.height * k), [(r.left - f.left) * k, (r.top - f.top) * k, (r.right - f.left) * k, (r.bottom - f.top) * k].map(Math.round)]);
  }
  return out;
}

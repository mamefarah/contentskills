import {C, SAFE, SERIF, brand, clamp, easeOut, easeInOut, fadeOut, stage, group, rr, line, text, image, fit, loadImages} from '../../ui.js';

// Claude's plan as storyboard pages above your head: each shot's thumbnail, its spoken line in serif italic and a note
// in the accent colour, three to a page; the pages flip over the overlay's life.
// Thumbnails are picture addresses from the server root, e.g. "/projects/<name>/thumbs/01.jpg" (stills of the clip).
export const meta = {duration: 3};
export const defaults = {
  rows: [
    {line: "I didn't make a single cut", note: 'hook card, wipe on "cut"'},
    {line: 'No editing apps', note: 'tiles struck through'},
    {line: 'One message', note: 'prompt types, sends'},
  ],
  images: [], title: '', perPage: 3, x: SAFE.left, y: SAFE.top + 8, width: SAFE.right - SAFE.left, ...brand({}),
};

export async function mount(el, props = defaults) {
  const p = {...defaults, ...props}, b = brand(p), svg = stage(el), root = group(svg);
  const rows = p.rows.map(r => typeof r === 'string' ? {line: r.split('::')[0], note: r.split('::')[1]} : r);
  const W = p.width, rh = 135, hh = 81, H = hh + rh * p.perPage + 22, pad = 38, pages = Math.max(1, Math.ceil(rows.length / p.perPage));
  const thumbs = await loadImages(rows.map((r, i) => r.image ?? p.images[i]), 168, 228);
  const title = p.title || `storyboard  ·  ${rows.length} shots`;
  // Draw every page once; seek() only shows one and squeezes it during a flip.
  const pageEls = [...Array(pages)].map((_, pg) => {
    const g = group(root, {display: 'none'});
    rr(g, 0, 0, W, H, 38, C.card, {filter: svg.shadow});
    text(g, pad, hh * .55, title, 28, 600, C.muted);
    text(g, W - pad, hh * .55, `page ${pg + 1} / ${pages}`, 28, 600, C.muted, 'end');
    for (let j = 0; j < p.perPage; j++) {
      const i = pg * p.perPage + j; if (i >= rows.length) break;
      const y0 = hh + j * rh, tw = rh * .62, th = rh * .84;
      image(svg, g, thumbs[i], pad, y0 + (rh - th) / 2, tw, th, 11);
      const x = pad + tw + 32;
      text(g, x, y0 + rh * .34, String(i + 1).padStart(2, '0'), 28, 700, b.accent);
      const quoted = fit(svg, `“${rows[i].line}”`, W - x - pad - 65, 54, 400, SERIF, '…”');
      text(g, x + 59, y0 + rh * .34, quoted.endsWith('”') ? quoted : quoted + '”', 54, 400, b.ink, 'start', {'font-family': SERIF});
      if (rows[i].note) text(g, x + 59, y0 + rh * .72, rows[i].note, 31, 500, b.accent);
      if (j < p.perPage - 1 && i + 1 < rows.length) line(g, [[pad, y0 + rh], [W - pad, y0 + rh]], C.line, 2);
    }
    return g;
  });
  const life = p.life ?? meta.duration, period = life / pages, flip = .16;
  return {
    seek(t) {
      const pg = Math.min(pages - 1, Math.floor(t / period)), ph = t - pg * period;
      let sx = 1;
      if (pg > 0 && ph < flip) sx = easeOut(ph / flip);                                    // new page opens
      else if (pg < pages - 1 && ph > period - flip) sx = 1 - easeInOut((ph - (period - flip)) / flip);   // page closes
      sx = Math.max(.02, sx);
      pageEls.forEach((g, i) => g.setAttribute('display', i === pg ? 'inline' : 'none'));
      const k = easeOut(t / .3), cx = p.x + W / 2, y = p.y - (1 - k) * 38;
      root.setAttribute('transform', `translate(${cx} ${y}) scale(${sx} 1) translate(${-W / 2} 0)`);
      root.setAttribute('opacity', k * fadeOut(t, p.life));
    },
  };
}

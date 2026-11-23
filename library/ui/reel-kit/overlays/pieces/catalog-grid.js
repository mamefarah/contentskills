import {C, SAFE, brand, clamp, easeOut, easeBack, fadeOut, stage, group, rr, text, image, measure, fit, backdrop, loadImages} from '../../ui.js';

// End card: the theme background fades in over the clip, "Comment “KEYWORD”" lands with a highlight pill
// ("and I'll send all N effects"), then a numbered grid of your effects or reels fills in tile by tile, each with a label.
// When total is more than the grid holds, the last tile reads "+N more".
// images are picture addresses from the server root (reel covers, stills of each effect).
export const meta = {duration: 3};
export const defaults = {keyword: 'REEL', total: 10, sub: '', labels: [], images: [], cols: 4, rows: 3, step: .1, ...brand({})};

const pop = (t, t0, d = .25) => t >= t0 ? easeBack((t - t0) / d) : 0;

export async function mount(el, props = defaults) {
  const p = {...defaults, ...props}, b = brand(p), svg = stage(el), bgLayer = group(svg), bg = backdrop(svg, bgLayer, b), fg = group(svg);
  const n = Math.min(p.cols * p.rows, Math.max(1, p.total)), left = SAFE.left, right = SAFE.right, bottom = SAFE.bottom;
  const gap = 27, labH = 43, tw = ((right - left) - gap * (p.cols - 1)) / p.cols;
  const y = SAFE.top + 19, ttlSize = 92, title = `Comment “${p.keyword}”`;
  const sub = p.sub || `and I'll send all ${p.total} effects`, subW = measure(svg, sub, 39, 700), pillW = subW + 65, pillH = 39 * 1.25 + 32;
  const py = y + ttlSize * 1.15 + 32 + pillH / 2, gy0 = py + pillH / 2 + 54;
  const rowsShown = Math.ceil(n / p.cols), th = Math.min(tw * 1.33, ((bottom - gy0) - (gap + labH) * (rowsShown - 1) - labH) / rowsShown);
  const pics = await loadImages(p.images.slice(0, n), Math.round(tw * 2), Math.round(th * 2));
  const titleG = group(fg), pillG = group(fg);
  text(titleG, 540, y + ttlSize * .58, title, ttlSize, 800, C.white, 'middle', {filter: svg.softShadow});
  rr(pillG, 540 - pillW / 2, py - pillH / 2, pillW, pillH, pillH / 2, b.highlight);
  text(pillG, 540, py, sub, 39, 700, b.ink, 'middle');
  const tiles = [...Array(n)].map((_, i) => {
    const cx = left + tw / 2 + (i % p.cols) * (tw + gap), cy = gy0 + th / 2 + Math.floor(i / p.cols) * (th + gap + labH);
    const g = group(fg), inner = group(g, {filter: svg.softShadow}), last = i === n - 1 && p.total > n;
    if (last) {
      rr(inner, cx - tw / 2, cy - th / 2, tw, th, 27, b.ink);
      text(inner, cx, cy - 10, `+${p.total - n + 1}`, 76, 800, C.white, 'middle');
      text(inner, cx, cy + 50, 'more', 32, 700, '#C8CCD4', 'middle');
    } else {
      image(svg, inner, pics[i], cx - tw / 2, cy - th / 2, tw, th, 27, '#DCDEE4');
      const bs = 54, bx = cx - tw / 2 + 13, by = cy - th / 2 + 13;
      rr(inner, bx, by, bs, bs, bs * .25, b.ink); text(inner, bx + bs / 2, by + bs / 2, String(i + 1), 30, 800, C.white, 'middle');
      const label = p.labels[i];
      if (label) text(g, cx, cy + th / 2 + labH * .55, fit(svg, label, tw, 28, 600), 28, 600, C.white, 'middle', {filter: svg.softShadow});
    }
    return {g, cx, cy};
  });
  return {
    seek(t) {
      bg.seek(t);
      const out = fadeOut(t, p.life, .2);
      bgLayer.setAttribute('opacity', easeOut(t / .25) * out);
      const k1 = easeBack(t / .3), k2 = pop(t, .15, .3);
      titleG.setAttribute('opacity', clamp(k1 * 2) * out); titleG.setAttribute('transform', `translate(540 ${y + ttlSize * .58}) scale(${.9 + .1 * k1}) translate(-540 ${-(y + ttlSize * .58)})`);
      pillG.setAttribute('opacity', clamp(k2 * 2) * out); pillG.setAttribute('transform', `translate(540 ${py}) scale(${.85 + .15 * k2}) translate(-540 ${-py})`);
      tiles.forEach(({g, cx, cy}, i) => {
        const kk = pop(t, .35 + i * p.step);
        g.setAttribute('opacity', clamp(kk * 2) * out);
        g.setAttribute('transform', `translate(${cx} ${cy}) scale(${.7 + .3 * kk}) translate(${-cx} ${-cy})`);
      });
    },
  };
}

import {IG, SAFE, COVERS, clamp, easeInOut, easeBack, fadeOut, stage, node, group, rr, circle, poly, text, measure, clipRect, loadImages} from '../../ui.js';

// A phone-style card above your head swipes up through your best reels like the feed, each cover with its view
// count; dots on the side show which one is up. images are reel covers from the server
// root (default: four of the user's reel covers in this kit); views are labels, one per image (pass the real counts).
export const meta = {duration: 3};
// The numbers are illustrative placeholders, not anyone's real stats: pass real ones in props.
export const defaults = {images: COVERS.slice(0, 3), views: ['212K', '1.1M', '486K'], count: 3, size: .36, x: 540, y: SAFE.top + 15};

export async function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), root = group(svg);
  const n = Math.max(1, Math.min(p.images.length, p.count)), w = 1080 * p.size, h = w * 1.3, r = w * .09;
  const pics = await loadImages(p.images.slice(0, n), Math.round(w * 2), Math.round(h * 2));
  // Frame: white border, the scrolling window inside, dots on top.
  const frame = group(root, {filter: svg.shadow});
  rr(frame, -6, -6, w + 12, h + 12, r + 6, IG.white);
  rr(root, 0, 0, w, h, r, '#000');
  const win = group(root, {'clip-path': clipRect(svg, 0, 0, w, h, r)}), strip = group(win);
  pics.forEach((src, i) => {
    const y = i * h;
    if (src) node(strip, 'image', {href: src, x: 0, y, width: w, height: h, preserveAspectRatio: 'xMidYMid slice'}); else rr(strip, 0, y, w, h, 0, '#2A2A2A');
    const v = p.views[i]; if (!v) return;
    const s = 32, tw = measure(svg, v, s, 700), ph = s * 1.35, pw = tw + s * 1.5, px = 22, py = y + h - ph - 22;
    rr(strip, px, py, pw, ph, ph / 2, '#000', {'fill-opacity': .59});
    poly(strip, [[px + s * .42, py + ph / 2 - s * .32], [px + s * .42, py + ph / 2 + s * .32], [px + s * .95, py + ph / 2]], IG.white);
    text(strip, px + s * 1.15, py + ph / 2, v, s, 700, IG.white);
  });
  const dots = [...Array(n)].map((_, i) => circle(root, w - 4, h / 2 + (i - (n - 1) / 2) * 26, 6.5, IG.white));
  const life = p.life ?? meta.duration, per = life / n;
  return {
    seek(t) {
      const idx = Math.min(n - 1, Math.floor(t / per)), fr = (t - idx * per) / per;
      const pos = idx + (idx < n - 1 ? easeInOut((fr - .72) / .28) : 0);
      strip.setAttribute('transform', `translate(0 ${-pos * h})`);
      dots.forEach((d, i) => d.setAttribute('fill-opacity', i === Math.round(pos) ? 1 : .43));
      const k = easeBack(t / .3), fx = Math.sin(t * 1.3) * 5, fy = Math.sin(t * 1.7 + 1) * 5, rot = Math.sin(t * 1.1) * .25;
      root.setAttribute('opacity', clamp(k * 2) * fadeOut(t, p.life));
      root.setAttribute('transform', `translate(${p.x + fx} ${p.y + h / 2 + fy}) rotate(${rot}) scale(${.8 + .2 * k}) translate(${-w / 2} ${-h / 2})`);
    },
  };
}


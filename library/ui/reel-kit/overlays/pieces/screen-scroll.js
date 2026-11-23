import {clamp, easeOut, fadeOut, stage, group, rr, circle, text, node, F} from '../../ui.js';

// A screen recording made from one tall screenshot: the page sits in a browser window that fills the frame and scrolls
// down it smoothly (ease in and out), with a cursor drifting over it. Deterministic: the scroll is a function of t.
// Props: src (image URL), imgWidth / imgHeight (its pixel size), from / to (the image's y, in image px, at the top of the
// window at the start and the end), url (shown in the address bar), title (the tab), dark (the frame around it).
// stops (optional, for a fast-paced cut): [{at, y, cx, cy}, …] — at each `at` (seconds into the piece) the page snaps
// (0.22 s) to image y `y`, the window punches in a little and the cursor jumps to (cx, cy) as fractions of the view.
// Without stops it is the one smooth scroll from `from` to `to`.
export const meta = {duration: 5, live: true};
export const defaults = {src: '', imgWidth: 680, imgHeight: 6600, from: 0, to: 2400, url: 'localhost:4600/storyboard', title: 'Storyboard', dark: '#15161A'};

const W = 1080, H = 1920;
let ids = 0;
export async function mount(el, props = defaults) {
  const p = {...defaults, ...props};
  if (p.src) { const pic = new Image(); pic.src = p.src; await pic.decode().catch(() => {}); }     // decoded before the first seek
  const svg = stage(el), g = group(svg);
  rr(g, 0, 0, W, H, 0, p.dark);
  const top = 150, bar = 96, x0 = 36, wWin = W - 72, hWin = H - top - 120;
  rr(g, x0, top, wWin, hWin, 34, '#FFFFFF');
  rr(g, x0, top, wWin, bar, 34, '#EDEDF0'); rr(g, x0, top + bar - 34, wWin, 34, 0, '#EDEDF0');
  ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => circle(g, x0 + 44 + i * 36, top + bar / 2, 11, c));
  rr(g, x0 + 170, top + 22, wWin - 210, bar - 44, 26, '#FFFFFF');
  text(g, x0 + 200, top + bar / 2, p.url, 30, 500, '#55565C', 'start', {'font-family': F});
  const view = {x: x0, y: top + bar, w: wWin, h: hWin - bar}, s = view.w / p.imgWidth;
  const id = 'ss' + (++ids);
  const defs = node(svg, 'defs'), cp = node(defs, 'clipPath', {id}); node(cp, 'rect', {x: view.x, y: view.y, width: view.w, height: view.h, rx: 0});
  const holder = group(svg, {'clip-path': `url(#${id})`});
  const img = node(holder, 'image', {href: p.src, x: view.x, y: view.y, width: p.imgWidth * s, height: p.imgHeight * s, preserveAspectRatio: 'none'});
  const cur = group(svg);
  node(cur, 'path', {d: 'M0 0 L0 46 L12 35 L21 56 L30 52 L21 32 L37 32 Z', fill: '#111', stroke: '#fff', 'stroke-width': 3.5, 'stroke-linejoin': 'round'});
  return {
    seek(t) {
      const life = p.life ?? meta.duration;
      let y, cx, cy, punch = 0;
      if (p.stops?.length) {
        // snap-scroll: hold, then a 0.22 s fast ease to the next stop; a decaying punch-in on each landing
        let a = {y: p.from, cx: .62, cy: .42}, b = a, last = null;              // a: where the last move started, b: its stop
        for (const st of p.stops) {
          if (t < st.at) break;
          a = b; b = {y: st.y, cx: st.cx ?? a.cx, cy: st.cy ?? a.cy}; last = st.at;
        }
        const e = last === null ? 1 : 1 - (1 - clamp((t - last) / .22)) ** 3;   // fast ease out
        y = a.y + (b.y - a.y) * e;
        const fx = a.cx + (b.cx - a.cx) * e, fy = a.cy + (b.cy - a.cy) * e;
        cx = view.x + view.w * (fx + .015 * Math.sin(t * 2.1)); cy = view.y + view.h * (fy + .01 * Math.sin(t * 1.7 + 1));
        if (last !== null) { const d = t - last - .18; punch = d < 0 ? 0 : .035 * Math.exp(-d * 7) * Math.min(1, d / .04); }
      } else {
        const k = clamp((t - .25) / Math.max(.5, life - .6));
        const e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;               // ease in and out
        y = p.from + (p.to - p.from) * e;
        cx = view.x + view.w * (.62 + .12 * Math.sin(t * 1.3)); cy = view.y + view.h * (.42 + .1 * Math.sin(t * .9 + 1));
      }
      img.setAttribute('y', (view.y - y * s).toFixed(1));
      cur.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)})`);
      if (p.stops?.length) {
        const zs = (1 + punch).toFixed(4), tf = `translate(${W / 2} ${H / 2}) scale(${zs}) translate(${-W / 2} ${-H / 2})`;
        g.setAttribute('transform', tf); holder.setAttribute('transform', tf);
        cur.setAttribute('transform', `${tf} translate(${cx.toFixed(1)} ${cy.toFixed(1)})`);
      }
      const a = easeOut(t / .25) * fadeOut(t, life, .2);
      g.setAttribute('opacity', a.toFixed(3)); holder.setAttribute('opacity', a.toFixed(3)); cur.setAttribute('opacity', a.toFixed(3));
    },
  };
}

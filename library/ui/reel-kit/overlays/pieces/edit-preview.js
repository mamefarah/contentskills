import {C, brand, clamp, stage, group, rr, poly, text, spinner, clipRect, measure} from '../../ui.js';

// The "Editing with…" frame around your clip while it sits in a card: a spinner and the title above the card,
// a SPED UP pill in its top corner, a shimmer sweeping across it and a progress line filling along its bottom edge.
// The card itself is a layout: put the clip in a window at the same rect (defaults below) and this piece over it,
// with ui/reel-kit "overlays/backdrop" behind. (The clip plays the clip at its own speed;
// the pill is a label). It shows once the window has arrived (delay, 0.35 s for a 0.4 s ramp) and is gone that long before its end.
export const meta = {duration: 3};
export const defaults = {title: 'Editing with reel-edit…', label: 'SPED UP 3×', shimmer: true, delay: .35,
  card: {x: 238, y: 365, width: 605, height: 1075, radius: 65}, ...brand({})};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, b = brand(p), svg = stage(el), root = group(svg), live = group(root);
  const {x, y, width: w, height: h, radius: r = 65} = {...defaults.card, ...p.card}, clip = clipRect(svg, x, y, w, h, r);
  const head = group(root), yy = y - 65;
  const spinR = 17, tx = x + spinR * 2 + 22;
  text(head, tx, yy, p.title, 45, 600, '#ECEEF2', 'start', {filter: svg.softShadow});
  const pillW = measure(svg, p.label, 28, 700) + 26, pillH = 38;
  const pill = group(root); rr(pill, x + w - pillW - 27, y + 27, pillW, pillH, 13, '#000', {'fill-opacity': .63});
  text(pill, x + w - 27 - pillW / 2, y + 27 + pillH / 2, p.label, 28, 700, C.white, 'middle');
  const life = p.life ?? meta.duration;
  return {
    seek(t) {
      live.replaceChildren();
      root.setAttribute('opacity', clamp((t - p.delay) / .1) * clamp((life - p.delay - t) / .1));
      spinner(live, x + spinR + 3, yy, spinR, t, b.highlight, 6);
      const inCard = group(live, {'clip-path': clip});
      if (p.shimmer) {
        const ph = (t * .9) % 1, bx = x - w * .6 + ph * w * 2.2;
        poly(inCard, [[bx, y], [bx + w * .25, y], [bx + w * .05, y + h], [bx - w * .2, y + h]], '#fff', {'fill-opacity': .27});
      }
      rr(inCard, x, y + h - 8, w * clamp((t - .4) / Math.max(.5, life - .9)), 8, 0, b.highlight);
    },
  };
}

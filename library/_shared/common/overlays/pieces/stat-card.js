import {stage, card, text, measure, fade, leave, glide, span, mix} from '../../kit.js';

// A card with one big number and a label under it: the number counts up, a thin accent bar fills.
// Shared piece: drawn in the theme's look. (x, y) is the card's top-left; keep it off the face.
export const meta = {duration: 3, live: true};
export const defaults = {value: 87, prefix: '', suffix: '%', label: 'of creators never post twice', decimals: 0, x: 140, y: 1180, w: 800};

export function mount(el, props = defaults, {look} = {}) {
  const p = {...defaults, ...props}, st = stage(el, look), g = st.root.append('g'), h = 300;
  const c = card(g, st, p.x, p.y, p.w, h);
  const num = text(c, p.x + 56, p.y + 150, '', {size: 120, role: 'head', color: look.accent}, look);
  text(c, p.x + 60, p.y + 220, p.label, {size: Math.min(40, 40 * (p.w - 120) / Math.max(1, measure(p.label, look, 'body', 40))), role: 'body', color: look.dim}, look);
  c.append('rect').attr('x', p.x + 60).attr('y', p.y + 252).attr('width', p.w - 120).attr('height', 8).attr('rx', 4).attr('fill', look.line).attr('opacity', .5);
  const bar = c.append('rect').attr('x', p.x + 60).attr('y', p.y + 252).attr('height', 8).attr('rx', 4).attr('fill', look.accent);
  const share = typeof p.value === 'number' && p.suffix === '%' ? Math.min(1, p.value / 100) : 1;
  return {
    seek(t) {
      const into = glide(span(t, 0, .4)), q = glide(span(t, .25, 1.1));
      g.attr('opacity', fade(t, 0, .2) * (1 - leave(t, p.life))).attr('transform', `translate(0 ${(1 - into) * 70})`);
      const v = typeof p.value === 'number' ? (p.value * q).toFixed(p.decimals) : p.value;
      num.text(`${p.prefix}${v}${p.suffix}`);
      bar.attr('width', mix(0, (p.w - 120) * share, q));
    },
  };
}

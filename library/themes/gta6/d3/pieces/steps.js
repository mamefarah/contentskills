import {C, F, P, quad, panel, burst, inked, label, lettering, vignette, place, span, easeOut, pop} from '../../coast.js';
import {card} from './_card.js';

// A process as a strip of comic panels: each step is a small illustrated panel with a number and a
// caption, joined by fat arrows. art: 'sun' | 'city' | 'car' | 'palm' | 'flamingo' | 'chopper' | 'boat'.
export const meta = {duration: 4.2};
export const defaults = {title: 'Idea to everywhere', unit: 'How the system runs', clear: false,
  steps: [{label: 'IDEA', art: 'palm'}, {label: 'SCRIPT', art: 'city'}, {label: 'VIDEO', art: 'car'}, {label: 'POSTED', art: 'chopper'}]};

export function mount(el, props = defaults) {
  const {body, intro} = card(el, props), n = props.steps.length, cols = n > 3 ? 2 : n, rows = Math.ceil(n / cols), w = 720 / cols - 40, h = rows > 1 ? 210 : 330;
  const cells = props.steps.map((s, i) => {
    const cx = 500 + (i % cols - (cols - 1) / 2) * (w + 70), cy = (rows > 1 ? 440 : 560) + Math.floor(i / cols) * (h + 60), g = body.append('g'), tilt = i % 2 ? 10 : -10;
    const p = panel(g, quad(-w / 2, -h / 2, w, h, tilt, -tilt, 10), {fill: 'dusk', gutter: 9, shadow: 11, ink: 5}), v = vignette(g.append('g').attr('clip-path', p.clip), s.art, -w / 2 - 6, -h / 2 - 10, w + 12, h + 20, i + 1);
    g.append('path').attr('d', p.d).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 5);
    const badge = g.append('g').attr('transform', `translate(${-w / 2 + 6} ${-h / 2 + 6})`); inked(badge, burst(0, 0, 38, 29, 10), {fill: 'yellow', ink: 5, shadow: 5}); label(badge, 0, 13, String(i + 1), {size: 36, font: F.display, color: C.ink, anchor: 'middle', spacing: 0});
    const cap = g.append('g').attr('transform', `translate(0 ${h / 2 + 10}) rotate(-2)`); lettering(cap, 0, 0, s.label, {size: 44, fit: w, fill: 'paper', outline: 7, shadow: 5});
    const arrow = i < n - 1 ? body.append('g') : null; if (arrow) inked(arrow, 'M-22 -12H4V-28L30 0L4 28V12H-22Z', {fill: 'pink', ink: 5, shadow: 5});
    return {g, v, cx, cy, arrow, wrapRow: (i + 1) % cols === 0};
  });
  return {seek(t) {
    intro(t);
    cells.forEach(({g, v, cx, cy, arrow, wrapRow}, i) => { const at = .45 + i * .5; place(g, cx, cy, pop(t, at, .34), (1 - span(t, at, .34)) * -10); v.tick(t);
      if (arrow) wrapRow ? place(arrow, 500, cy + h / 2 + 34, pop(t, at + .3), 90) : place(arrow, cx + w / 2 + 35 + Math.sin(t * 5) * 3, cy, pop(t, at + .3)); });
  }};
}

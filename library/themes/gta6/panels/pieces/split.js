import {C, coastStage, panel, burst, inked, lettering, tab, vignette, place, span, easeOut, pop, presence, leave} from '../../coast.js';

// A two-panel comparison across the top of the picture: two angled panels slide in from either side
// with a slanted gutter between them, each with a small scene and a label, and a badge lands on the seam.
// art: 'sun' | 'city' | 'car' | 'palm' | 'flamingo' | 'chopper' | 'boat'. `y` is the top edge.
export const meta = {duration: 4.5, live: true};
export const defaults = {a: 'BEFORE', b: 'AFTER', badge: 'VS', artA: 'city', artB: 'palm', y: 130, h: 430};

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), {y, h} = props, g = root.append('g');
  const sides = [{pts: [[56, y + 14], [560, y], [496, y + h], [56, y + h - 10]], art: props.artA, label: props.a, dir: -1, fill: 'pink'}, {pts: [[606, y - 2], [1024, y - 14], [1024, y + h + 8], [542, y + h]], art: props.artB, label: props.b, dir: 1, fill: 'yellow'}].map((s, i) => {
    const sg = g.append('g'), p = panel(sg, s.pts, {fill: 'dusk'}), xs = s.pts.map(q => q[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const v = vignette(sg.append('g').attr('clip-path', p.clip), s.art, x0, y - 20, x1 - x0, h + 40, i + 2);
    sg.append('path').attr('d', p.d).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 6);
    const t = tab(sg, 0, 0, s.label, {size: 50, fill: s.fill, color: s.fill === 'yellow' ? C.ink : C.paper}); place(t.g, s.dir < 0 ? 40 : 1040 - t.w, y + h - 6, 1, -3);
    return {...s, sg, v};
  });
  const badge = g.append('g'); inked(badge, burst(0, 0, 96, 70, 12), {fill: 'paper', ink: 8, shadow: 10}); lettering(badge, 0, 26, props.badge, {size: 76, fit: 110, fill: 'hot'});
  return {
    seek(t) {
      root.attr('opacity', presence(t, props.life)); const out = leave(t, props.life);
      sides.forEach((s, i) => { const q = easeOut(span(t, i * .12, .38)) * (1 - out); s.sg.attr('transform', `translate(${s.dir * (1 - q) * 700} ${(1 - q) * -40}) rotate(${s.dir * (1 - q) * 6} 540 ${y})`); s.v.tick(t); });
      place(badge, 548, y + h / 2, pop(t, .45, .36) * (1 - out), -8 + Math.sin(t * 2.2) * 5);
    },
  };
}

import {C, coastStage, panel, tab, vignette, place, span, easeOut, presence, leave} from '../../coast.js';

// A comic-page collage across the top of the picture: three angled panels slide in from different
// sides and lock together with pale gutters, each showing a small moving scene and a label.
// items: up to three {art, label}; art: 'sun' | 'city' | 'car' | 'palm' | 'flamingo' | 'chopper' | 'boat'.
// `times` (seconds after the overlay starts) can bring each panel in on its word. `y` is the top edge.
export const meta = {duration: 5, live: true};
export const defaults = {items: [{art: 'palm', label: 'THE DREAM'}, {art: 'car', label: 'THE HUSTLE'}, {art: 'city', label: 'THE PAYOFF'}], times: null, y: 120, h: 480};

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), {y, h} = props, g = root.append('g');
  const shapes = [
    {pts: [[56, y + 12], [452, y], [408, y + h], [56, y + h - 8]], from: [-700, 0]},
    {pts: [[498, y - 2], [1024, y - 16], [1024, y + h * .47], [476, y + h * .5]], from: [0, -600]},
    {pts: [[470, y + h * .58], [1024, y + h * .55], [1024, y + h + 6], [448, y + h]], from: [700, 0]},
  ];
  const cells = props.items.slice(0, 3).map((item, i) => {
    const s = shapes[i], sg = g.append('g'), p = panel(sg, s.pts, {fill: 'dusk', gutter: 12}), xs = s.pts.map(q => q[0]), ys = s.pts.map(q => q[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
    const v = vignette(sg.append('g').attr('clip-path', p.clip), item.art, x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0, i + 1);
    sg.append('path').attr('d', p.d).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 6);
    if (item.label) { const t = tab(sg, 0, 0, item.label, {size: 40, fill: ['pink', 'yellow', 'night'][i], color: i === 1 ? C.ink : C.paper}); place(t.g, i ? Math.max(...xs) - t.w - 30 : x0 + 24, i ? Math.max(...ys) - 44 : Math.max(...ys) - 50, 1, -2.5); }
    return {sg, v, from: s.from};
  });
  return {
    seek(t) {
      root.attr('opacity', presence(t, props.life)); const out = leave(t, props.life);
      cells.forEach(({sg, v, from}, i) => { const at = props.times?.[i] ?? i * .22, q = easeOut(span(t, at, .36)) * (1 - out), k = t - at - .36, land = k > 0 ? Math.sin(k * 30) * 5 * Math.exp(-k * 10) : 0;
        sg.attr('transform', `translate(${from[0] * (1 - q)} ${from[1] * (1 - q) + land})`).attr('opacity', span(t, at, .04)); v.tick(t); });
    },
  };
}

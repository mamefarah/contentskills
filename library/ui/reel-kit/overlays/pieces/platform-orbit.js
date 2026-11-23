import {clamp, easeOut, easeBack, fadeOut, stage, group, rr, circle, poly, line, text, node, F} from '../../ui.js';

// "Posted to nine platforms": a tilted ring of round platform badges spinning around the speaker's head, like a
// planet's ring. The front of the ring passes below the chin and the back behind the head (hidden by the person), so the
// badges really go round the speaker and nothing crosses the face.
// For depth, use it twice: once with half "back" and "behind": "person" (those badges pass behind the speaker), once with
// half "front" on top. Follows the face (the player supplies `locate`; a fixed `box`, 0..1 of the frame, otherwise).
// The badges are simple drawn marks in each platform's colour, not the platforms' own logo artwork.
// glow (0..1, default 0): a pulsing halo in each badge's colour, for a dark, dramatic shot (pair it with a lighting effect).
// Times: the ring pops in over `inFor` seconds (badge by badge), spins `turns` per second, fades at the end.
export const meta = {duration: 3, live: true, wantsFaces: true};
export const defaults = {platforms: ['instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'facebook', 'threads', 'pinterest', 'bluesky'],
  half: 'all', turns: .35, inFor: .6, size: 62, glow: 0, box: {x: .33, y: .3, w: .34, h: .2}};

const W = 1080, H = 1920;
const BADGE = {
  instagram: {fill: ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF'], mark: (g, r) => {
    rr(g, -r * .5, -r * .5, r, r, r * .3, 'none', {stroke: '#fff', 'stroke-width': r * .1});
    circle(g, 0, 0, r * .22, 'none', {stroke: '#fff', 'stroke-width': r * .1}); circle(g, r * .29, -r * .29, r * .065, '#fff'); }},
  tiktok: {fill: '#111111', mark: (g, r) => {
    for (const [dx, col] of [[-r * .05, '#25F4EE'], [r * .05, '#FE2C55'], [0, '#fff']]) {
      const q = group(g, {transform: `translate(${dx} ${dx})`});
      line(q, [[r * .08, -r * .52], [r * .08, r * .22]], col, r * .14, {'stroke-linecap': 'butt'});
      circle(q, -r * .12, r * .24, r * .2, 'none', {stroke: col, 'stroke-width': r * .13});
      line(q, [[r * .08, -r * .48], [r * .22, -r * .3], [r * .4, -r * .24]], col, r * .12); } }},
  youtube: {fill: '#FF0033', mark: (g, r) => poly(g, [[-r * .22, -r * .32], [-r * .22, r * .32], [r * .36, 0]], '#fff')},
  x: {fill: '#000000', mark: (g, r) => { line(g, [[-r * .36, -r * .4], [r * .36, r * .4]], '#fff', r * .12); line(g, [[r * .36, -r * .4], [-r * .36, r * .4]], '#fff', r * .07); }},
  linkedin: {fill: '#0A66C2', mark: (g, r) => text(g, 0, r * .06, 'in', r * 1.0, 800, '#fff', 'middle', {'dominant-baseline': 'central', 'font-family': F})},
  facebook: {fill: '#1877F2', mark: (g, r) => text(g, r * .06, r * .14, 'f', r * 1.35, 800, '#fff', 'middle', {'dominant-baseline': 'central', 'font-family': F})},
  threads: {fill: '#101010', mark: (g, r) => text(g, 0, r * .04, '@', r * 1.05, 600, '#fff', 'middle', {'dominant-baseline': 'central', 'font-family': F})},
  pinterest: {fill: '#E60023', mark: (g, r) => text(g, 0, r * .08, 'P', r * 1.05, 800, '#fff', 'middle', {'dominant-baseline': 'central', 'font-family': F})},
  bluesky: {fill: '#1185FE', mark: (g, r) => { for (const s of [-1, 1]) { node(g, 'ellipse', {cx: s * r * .24, cy: -r * .1, rx: r * .26, ry: r * .2, fill: '#fff', transform: `rotate(${s * 25} ${s * r * .24} ${-r * .1})`});
    node(g, 'ellipse', {cx: s * r * .17, cy: r * .2, rx: r * .16, ry: r * .13, fill: '#fff'}); } }},
};

let ids = 0;
export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), id = 'po' + (++ids);
  const defs = node(svg, 'defs'), glow = clamp(+p.glow || 0), halos = [];
  if (glow) { const fl = node(defs, 'filter', {id: `${id}blur`, x: '-100%', y: '-100%', width: '300%', height: '300%'}); node(fl, 'feGaussianBlur', {stdDeviation: p.size * .45}); }
  const badges = p.platforms.map((name, i) => {
    const b = BADGE[name] ?? {fill: '#444', mark: (g, r) => text(g, 0, 0, String(name)[0].toUpperCase(), r, 800, '#fff', 'middle', {'dominant-baseline': 'central', 'font-family': F})};
    let fill = b.fill;
    if (Array.isArray(fill)) {                     // a gradient badge
      const gr = node(defs, 'linearGradient', {id: `${id}g${i}`, x1: 0, y1: 1, x2: 1, y2: 0});
      fill.forEach((c, k) => node(gr, 'stop', {offset: k / (fill.length - 1), 'stop-color': c})); fill = `url(#${id}g${i})`;
    }
    const g = group(svg), r = p.size;
    if (glow) {                                    // the halo: the badge's own colour, blurred wide, plus a white core
      const hue = Array.isArray(b.fill) ? b.fill[2] : (b.fill === '#111111' || b.fill === '#101010' || b.fill === '#000000' ? '#ffffff' : b.fill);
      const h = group(g); circle(h, 0, 0, r * 1.7, hue, {filter: `url(#${id}blur)`}); circle(h, 0, 0, r * 1.25, '#ffffff', {filter: `url(#${id}blur)`, opacity: .55}); halos.push(h);
    } else circle(g, 0, r * .12, r * 1.02, 'rgba(0,0,0,.28)');            // soft drop shadow
    circle(g, 0, 0, r, fill, {stroke: '#fff', 'stroke-width': r * .09});
    b.mark(g, r);
    return g;
  });
  const boxAt = t => (p.locate ? p.locate(t) : p.box);
  return {
    seek(t) {
      const f = boxAt((p.at ?? 0) + t), head = p.around === 'head', cx = (f.x + f.w / 2) * W;
      // a tilted ring. Default (around "chin"): centred about the chin, the back arc behind the head, the front arc below the chin.
      // around "head": a flatter ring at the crown, like a halo: the back arc rises above the hair, the front arc dips across the hairline, the sides beside the temples
      const cy = (head ? (f.y - f.h * .26) * H : (f.y + f.h * .85) * H) - (+p.rise || 0);      // rise: px to lift the ring (keep the badges off a forehead)
      const rx = head ? f.w * W / 2 + 150 : f.w * W / 2 + 190, ry = f.h * H * (head ? .07 : .55), out = fadeOut(t, p.life, .25), grow = .7 + .3 * easeOut(t / Math.max(.01, p.inFor));
      const spin = t * p.turns * Math.PI * 2, n = badges.length;
      const order = badges.map((g, i) => {
        const a = spin + i * Math.PI * 2 / n, depth = Math.sin(a);                     // depth > 0: in front (lower), < 0: behind (higher)
        const x = cx + Math.cos(a) * rx * grow, y = cy + depth * ry * grow;
        const k = easeBack((t - i * p.inFor / n * .8) / .3), s = (head ? .6 + .45 * (depth + 1) / 2 : .78 + .22 * (depth + 1) / 2) * k;      // the halo shows more depth: far badges smaller
        const show = p.half === 'all' || (p.half === 'front' ? depth >= 0 : depth < 0);
        g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${Math.max(0, s).toFixed(3)})`);
        g.setAttribute('opacity', show ? (clamp(k * 2) * out * (depth < 0 ? .85 : 1)).toFixed(3) : 0);
        return {g, depth};
      });
      halos.forEach((h, i) => h.setAttribute('opacity', (glow * (.75 + .25 * Math.sin(t * 7 + i * 1.3))).toFixed(3)));
      for (const {g} of order.sort((a, b) => a.depth - b.depth)) svg.append(g);    // nearer badges drawn last
    },
  };
}

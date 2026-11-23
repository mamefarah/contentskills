import {brand, clamp, easeOut, easeBack, stage, group, node, rr, text, measure, loadImages, backdrop, line} from '../../ui.js';

// "Claude edited THIS video": the hook that shows the payoff in the first second. Stills from the finished edit are
// dealt like cards behind the person, one every `step` seconds, flying in tilted and landing around the head and
// shoulders, each with a small tag (3D, SIRENS…); the newest is brightest. Use it twice on the same slot:
//   layer "back"  with "behind": "person"  the blue grid and the dealt cards, under the user's cut-out
//   layer "front" (over the clip)          the headline (line 1 white, line 2 in a yellow box) and a hand-drawn arrow
//                                          that draws itself down toward the speaker, ending beside the head, never on it
// Props: images [urls], tags [strings], step (s between cards), dealAt (first card), headline "LINE 1|LINE 2",
// line2At (s), arrowAt (s), y (headline top), size, arrow {from:[x,y], to:[x,y], bend}, accent, highlight.
export const meta = {duration: 2.4, live: true};
export const defaults = {layer: 'back', images: [], tags: [], step: .2, dealAt: .05, headline: 'CLAUDE EDITED|THIS VIDEO', line2At: .55, arrowAt: .9,
  y: 300, size: 118, arrow: {from: [905, 520], to: [790, 700], bend: 90}, ...brand({})};

const SLOTS = [[250, 640, -9], [830, 600, 8], [545, 520, -3], [190, 1060, 6], [890, 1080, -7], [540, 420, 4], [300, 820, -5], [800, 860, 5]];
const CW = 350, CH = 622;

export async function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), b = brand(p), life = p.life ?? meta.duration;
  if (p.layer === 'front') return front(svg, p, b, life);
  const root = group(svg), bg = backdrop(svg, root, b);
  const pics = await loadImages(p.images, CW, CH), cards = [];
  pics.forEach((src, i) => {
    const [cx, cy, rot] = SLOTS[i % SLOTS.length], g = group(root, {opacity: 0});
    node(g, 'rect', {x: -CW / 2 - 10, y: -CH / 2 - 10, width: CW + 20, height: CH + 20, rx: 30, fill: '#fff', filter: svg.shadow});
    if (src) {
      const id = `pd-${Math.random().toString(36).slice(2)}`, cp = node(svg.defs, 'clipPath', {id});
      rr(cp, -CW / 2, -CH / 2, CW, CH, 22, '#000');
      node(g, 'image', {href: src, x: -CW / 2, y: -CH / 2, width: CW, height: CH, 'clip-path': `url(#${id})`});
    } else rr(g, -CW / 2, -CH / 2, CW, CH, 22, '#D9DCE3');
    const tag = p.tags[i];
    if (tag) {
      const w = measure(svg, tag, 34, 800) + 36;
      rr(g, -CW / 2 + 18, -CH / 2 + 18, w, 54, 14, b.highlight);
      text(g, -CW / 2 + 18 + w / 2, -CH / 2 + 46, tag, 34, 800, b.ink, 'middle');
    }
    const shade = rr(g, -CW / 2, -CH / 2, CW, CH, 22, '#0B1A4A', {opacity: 0});
    cards.push({g, shade, cx, cy, rot, at: p.dealAt + i * p.step, side: cx < 540 ? -1 : 1});
  });
  const flash = rr(root, 0, 0, 1080, 1920, 0, '#fff', {opacity: 0});
  return {seek(t) {
    bg.seek(t);
    for (const c of cards) {
      const q = clamp((t - c.at) / .22), k = easeBack(q);
      if (t < c.at) { c.g.setAttribute('opacity', 0); continue; }
      const x = c.cx + c.side * 700 * (1 - k), y = c.cy + 260 * (1 - k), r = c.rot + c.side * 28 * (1 - k), s = .9 + .1 * k;
      c.g.setAttribute('opacity', 1);
      c.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${r.toFixed(2)}) scale(${s.toFixed(3)})`);
      const newer = cards.filter(d => d.at > c.at && t >= d.at).length;       // older cards sink back a little
      c.shade.setAttribute('opacity', Math.min(.45, newer * .12).toFixed(3));
    }
    flash.setAttribute('opacity', (.55 * (1 - clamp(t / .12))).toFixed(3));
    root.setAttribute('opacity', clamp((life - t) / .08).toFixed(3));
  }};
}

function front(svg, p, b, life) {
  const [l1, l2 = ''] = String(p.headline).split('|'), s = p.size, top = p.y;
  const g1 = group(svg), g2 = group(svg), ga = group(svg);
  const w1 = measure(svg, l1, s, 900) + 60;                       // both lines sit on solid boxes: the cards behind are busy
  rr(g1, 540 - w1 / 2, top - s * .04, w1, s * 1.08, 18, b.ink, {filter: svg.softShadow});
  text(g1, 540, top + s * .5, l1, s, 900, '#fff', 'middle', {'letter-spacing': -2});
  const w2 = measure(svg, l2, s, 900) + 60, y2 = top + s * 1.12;
  rr(g2, 540 - w2 / 2, y2, w2, s * 1.08, 18, b.highlight, {filter: svg.softShadow});
  text(g2, 540, y2 + s * .56, l2, s, 900, b.ink, 'middle', {'letter-spacing': -2});
  // the arrow: a hand-drawn curve with a little wobble, drawn on with a dash, then the head snaps on
  const {from: [x0, y0], to: [x1, y1], bend = 90} = p.arrow, mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2 - bend * .3;
  const d = `M${x0} ${y0} Q${mx} ${my} ${x1} ${y1}`;
  const under = node(ga, 'path', {d, fill: 'none', stroke: b.ink, 'stroke-width': 30, 'stroke-linecap': 'round', filter: svg.softShadow});
  const path = node(ga, 'path', {d, fill: 'none', stroke: b.highlight, 'stroke-width': 18, 'stroke-linecap': 'round'});
  const len = path.getTotalLength ? path.getTotalLength() : 320;
  path.setAttribute('stroke-dasharray', len); under.setAttribute('stroke-dasharray', len);
  const ang = Math.atan2(y1 - my, x1 - mx), hl = 70, pts = [[x1 + hl * Math.cos(ang + 2.6), y1 + hl * Math.sin(ang + 2.6)], [x1, y1], [x1 + hl * Math.cos(ang - 2.6), y1 + hl * Math.sin(ang - 2.6)]].map(q => q.map(v => v.toFixed(1)).join(',')).join(' ');
  const head = group(ga);
  node(head, 'polyline', {points: pts, fill: 'none', stroke: b.ink, 'stroke-width': 30, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'});
  node(head, 'polyline', {points: pts, fill: 'none', stroke: b.highlight, 'stroke-width': 18, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'});
  return {seek(t) {
    const out = clamp((life - t) / .1);
    const a = easeBack(clamp(t / .2)), c = easeBack(clamp((t - p.line2At) / .2));
    g1.setAttribute('transform', `translate(540 ${top + s / 2}) scale(${(.6 + .4 * a).toFixed(3)}) translate(-540 ${-(top + s / 2)})`); g1.setAttribute('opacity', (clamp(t / .08) * out).toFixed(3));
    g2.setAttribute('transform', `translate(540 ${y2 + s / 2}) scale(${(.6 + .4 * c).toFixed(3)}) rotate(${(-3 * c).toFixed(2)}) translate(-540 ${-(y2 + s / 2)})`); g2.setAttribute('opacity', (t < p.line2At ? 0 : out).toFixed(3));
    const q = easeOut(clamp((t - p.arrowAt) / .3));
    for (const n of [path, under]) { n.setAttribute('stroke-dashoffset', (len * (1 - q)).toFixed(1)); n.setAttribute('opacity', (t < p.arrowAt ? 0 : out).toFixed(3)); }
    head.setAttribute('opacity', (q >= 1 ? out : 0).toFixed(3));
    const wig = t > p.arrowAt + .3 ? Math.sin((t - p.arrowAt) * 14) * 6 : 0;                  // the arrow keeps nudging toward the speaker
    ga.setAttribute('transform', `translate(${(wig * .5).toFixed(1)} ${wig.toFixed(1)})`);
  }};
}

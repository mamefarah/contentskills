import {brand, clamp, easeOut, easeInOut, fadeOut, stage, group, node, uid, backdrop} from '../../ui.js';

// The reel kit's full-frame background: the accent colour with a soft top-light and a graph-paper grid drifting
// diagonally (background "solid" drops the grid). Put it under the clip's window with "behind": true while a layout
// shrinks the clip into a card (edit-preview) or a split (raw-vs-edit). fadeIn > 0 fades it in over the footage instead.
// wipe > 0: instead of appearing at once, a glowing line sweeps down from the top over that many seconds; the colour
// fills everything above the line and the footage still shows below it.
// iris > 0: instead, the colour bursts out as a circle from (irisX, irisY) over that many seconds, a glowing ring on
// its edge, the footage still showing outside it (a radial reveal, for a scene next to one that already used the wipe).
export const meta = {duration: 3, live: true};
export const defaults = {fadeIn: 0, fadeOutTime: 0, wipe: 0, iris: 0, irisX: 540, irisY: 760, ...brand({})};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), g = group(svg), bg = backdrop(svg, g, brand(p));
  let clip = null, line = null, disc = null, ring = null;
  const R = Math.hypot(Math.max(p.irisX, 1080 - p.irisX), Math.max(p.irisY, 1920 - p.irisY)) + 40;
  if (p.iris > 0) {
    const id = uid('iris'), cp = node(svg.defs, 'clipPath', {id});
    disc = node(cp, 'circle', {cx: p.irisX, cy: p.irisY, r: 0});
    g.setAttribute('clip-path', `url(#${id})`);
    ring = group(svg);
    [[36, .18], [14, .35], [5, 1]].forEach(([w, o]) => node(ring, 'circle', {cx: p.irisX, cy: p.irisY, r: 0, fill: 'none', stroke: '#fff', 'stroke-width': w, opacity: o}));
  }
  if (p.wipe > 0) {
    const id = uid('wipe'), cp = node(svg.defs, 'clipPath', {id});
    clip = node(cp, 'rect', {x: 0, y: 0, width: 1080, height: 0});
    g.setAttribute('clip-path', `url(#${id})`);
    line = group(svg);
    node(line, 'rect', {x: 0, y: -18, width: 1080, height: 36, fill: '#fff', opacity: .18});
    node(line, 'rect', {x: 0, y: -7, width: 1080, height: 14, fill: '#fff', opacity: .35});
    node(line, 'rect', {x: 0, y: -2.5, width: 1080, height: 5, fill: '#fff'});
  }
  return {seek(t) {
    bg.seek(t);
    g.setAttribute('opacity', (p.fadeIn > 0 ? easeOut(t / p.fadeIn) : 1) * (p.fadeOutTime > 0 ? fadeOut(t, p.life, p.fadeOutTime) : 1));
    if (clip) {
      const y = 1960 * easeInOut(t / p.wipe);
      clip.setAttribute('height', y.toFixed(1));
      line.setAttribute('transform', `translate(0 ${y.toFixed(1)})`);
      line.setAttribute('opacity', (1 - clamp((t - p.wipe) / .15)).toFixed(3));
    }
    if (disc) {
      const r = (R * easeInOut(clamp(t / p.iris))).toFixed(1);
      disc.setAttribute('r', r);
      for (const c of ring.children) c.setAttribute('r', r);
      ring.setAttribute('opacity', (1 - clamp((t - p.iris) / .15)).toFixed(3));
    }
  }};
}

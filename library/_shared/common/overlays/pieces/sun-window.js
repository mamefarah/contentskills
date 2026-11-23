import {stage, text, measure, fade, leave, glide, span, mix, easeInOut, easeBack, shade} from '../../kit.js';

// A window whose curtains slide open while the sun comes up behind the glass and its rays turn on, with a small line
// above it and a big label landing under it. Shared piece: drawn in the theme's look. `from` and `to` are how far the
// curtains are open (0 closed, 1 fully open) and show a state, not a measurement: no figures are printed.
// Props: from, to (0..1), at, dur (when and how long the curtains move), kicker, label, labelAt, warn (label in the
// accent), color (the sun and the daylight; the theme's accent when not given), cx, top, w, h (the window).
export const meta = {duration: 3, live: true};
export const defaults = {from: 0, to: 1, at: .3, dur: 1, kicker: 'FIRST THING', label: 'LET THE LIGHT IN', labelAt: 1.2, warn: false, color: null, cx: 540, top: 470, w: 620, h: 640};

const RAYS = 12, FOLDS = 4;

export function mount(el, props = defaults, {look} = {}) {
  const p = {...defaults, ...props}, st = stage(el, look), g = st.root.append('g');
  const {cx, top: y0, w, h} = p, x0 = cx - w / 2, x1 = cx + w / 2, y1 = y0 + h, half = w / 2;
  const sun = p.color ?? look.accent, pale = shade(sun, .45), cloth = look.accent2 ?? look.ink, fold = shade(cloth, -.18);
  const sunR = w * .17, sunX = cx + w * .1;

  st.defs.append('clipPath').attr('id', `${st.id}-pane`).append('rect').attr('x', x0).attr('y', y0).attr('width', w).attr('height', h).attr('rx', 10);
  // daylight falling on the floor under the sill
  const spill = g.append('path').attr('d', `M${x0 + 30} ${y1 + 34} L${x1 - 30} ${y1 + 34} L${x1 + 90} ${y1 + 150} L${x0 - 90} ${y1 + 150} Z`).attr('fill', pale);
  g.append('rect').attr('x', x0).attr('y', y0).attr('width', w).attr('height', h).attr('rx', 10).attr('fill', look.ink).attr('fill-opacity', .06);
  const pane = g.append('g').attr('clip-path', `url(#${st.id}-pane)`);
  const sky = pane.append('rect').attr('x', x0).attr('y', y0).attr('width', w).attr('height', h).attr('fill', pale);
  const rays = Array.from({length: RAYS}, () => pane.append('line').attr('stroke', sun).attr('stroke-width', 14).attr('stroke-linecap', 'round'));
  const halo = pane.append('circle').attr('cx', sunX).attr('r', sunR * 1.55).attr('fill', sun).attr('opacity', .25);
  const disc = pane.append('circle').attr('cx', sunX).attr('r', sunR).attr('fill', sun);
  // the mullions, then the curtains in front of the glass
  const bar = (xa, ya, xb, yb) => pane.append('line').attr('x1', xa).attr('y1', ya).attr('x2', xb).attr('y2', yb).attr('stroke', look.ink).attr('stroke-width', 10);
  bar(cx, y0, cx, y1); bar(x0, y0 + h * .5, x1, y0 + h * .5);
  const curtain = side => {
    const c = pane.append('g');
    const body = c.append('rect').attr('y', y0 - 4).attr('height', h + 8).attr('fill', cloth);
    const folds = Array.from({length: FOLDS}, () => c.append('line').attr('y1', y0 + 6).attr('y2', y1 - 6).attr('stroke', fold).attr('stroke-width', 9).attr('stroke-linecap', 'round'));
    return {side, body, folds};
  };
  const curtains = [curtain(-1), curtain(1)];
  g.append('rect').attr('x', x0).attr('y', y0).attr('width', w).attr('height', h).attr('rx', 10).attr('fill', 'none').attr('stroke', look.ink).attr('stroke-width', 14);
  g.append('rect').attr('x', x0 - 34).attr('y', y1 + 4).attr('width', w + 68).attr('height', 26).attr('rx', 10).attr('fill', look.ink);              // the sill
  g.append('line').attr('x1', x0 - 56).attr('x2', x1 + 56).attr('y1', y0 - 34).attr('y2', y0 - 34).attr('stroke', look.ink).attr('stroke-width', 12).attr('stroke-linecap', 'round');   // the rod
  for (const x of [x0 - 56, x1 + 56]) g.append('circle').attr('cx', x).attr('cy', y0 - 34).attr('r', 15).attr('fill', look.ink);

  const kick = p.kicker ? text(g, cx, y0 - 104, p.kicker, {size: 36, role: 'mono', color: look.dim, anchor: 'middle'}, look).style('letter-spacing', '.22em') : null;
  const size = p.label ? Math.min(128, 128 * 660 / Math.max(1, measure(p.label, look, 'head', 128))) : 0;
  const lab = p.label ? st.root.append('g') : null;
  if (lab) text(lab, 0, 0, p.label, {size, role: 'head', color: p.warn ? look.accent : look.ink, anchor: 'middle'}, look);

  return {
    seek(t) {
      const into = glide(span(t, 0, .35)), gone = 1 - leave(t, p.life);
      g.attr('opacity', fade(t, 0, .18) * gone).attr('transform', `translate(0 ${(1 - into) * 70})`);
      const open = mix(p.from, p.to, easeInOut(span(t, p.at, p.dur)));
      // each curtain gathers toward its own side: full half-width when closed, a narrow bunch when open
      const cw = half * mix(1.02, .2, open);
      for (const c of curtains) {
        const left = c.side < 0 ? x0 : x1 - cw;
        c.body.attr('x', left).attr('width', cw);
        c.folds.forEach((f, i) => { const x = left + cw * (i + .5) / FOLDS + 3 * Math.sin(t * 2.2 + i * 1.7 + c.side); f.attr('x1', x).attr('x2', x); });
      }
      const sunY = mix(y1 + sunR * 1.2, y0 + h * .34, easeInOut(open));
      disc.attr('cy', sunY); halo.attr('cy', sunY).attr('r', sunR * (1.5 + .08 * Math.sin(t * 3)));
      sky.attr('opacity', .1 + .6 * open);
      spill.attr('opacity', .3 * open * open);
      rays.forEach((r, i) => {
        const a = i / RAYS * Math.PI * 2 + t * .35, r0 = sunR * 1.75, r1 = sunR * (2.25 + .28 * Math.sin(t * 3.4 + i * 2.1));
        r.attr('x1', sunX + r0 * Math.cos(a)).attr('y1', sunY + r0 * Math.sin(a)).attr('x2', sunX + r1 * Math.cos(a)).attr('y2', sunY + r1 * Math.sin(a)).attr('opacity', span(open, .45, .4));
      });
      kick?.attr('opacity', fade(t, .1, .2));
      if (lab) {
        const a = span(t, p.labelAt, .28);
        lab.attr('opacity', (a > 0 ? 1 : 0) * gone).attr('transform', `translate(${cx} ${y1 + 285}) scale(${(.6 + .4 * easeBack(a)).toFixed(4)})`);
      }
    },
  };
}

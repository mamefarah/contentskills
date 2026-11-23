import {stage, text, measure, fade, leave, glide, span, mix, easeInOut, easeBack} from '../../kit.js';

// A front-on stick figure that moves between two poses: 'stiff' (hunched, arms tucked in) and 'reach' (tall, arms
// overhead). A small line above it and a big label landing under it. Shared piece: drawn in the theme's look.
// It shows a state (stiff / loose), not a measurement: no figures are printed.
// Props: from, to (pose names), at, dur (when and how long the pose changes), kicker, label, labelAt, warn (pulsing
// marks on neck, back and knees; label in the accent), flow (dots run from the chest out along the limbs from flowAt),
// color (marks and dots; the theme's accent when not given), cx, ground (y of the feet), scale.
export const meta = {duration: 3, live: true};
export const defaults = {from: 'stiff', to: 'reach', at: .3, dur: .7, kicker: '', label: 'LOOSEN UP', labelAt: 1, warn: false, flow: false, flowAt: 0, color: null, cx: 540, ground: 1230, scale: .92};

// joints, in figure units: x from the centre line, y up from the ground
const POSES = {
  stiff: {hip: [8, 318], neck: [14, 540], head: [24, 618], shL: [-74, 556], shR: [98, 556], elL: [-112, 446], elR: [128, 446], haL: [-62, 366], haR: [84, 366], hpL: [-38, 318], hpR: [54, 318], knL: [-62, 168], knR: [70, 168], ftL: [-66, 0], ftR: [74, 0]},
  reach: {hip: [0, 360], neck: [0, 618], head: [0, 704], shL: [-88, 606], shR: [88, 606], elL: [-140, 760], elR: [140, 760], haL: [-112, 916], haR: [112, 916], hpL: [-46, 360], hpR: [46, 360], knL: [-50, 182], knR: [50, 182], ftL: [-78, 0], ftR: [78, 0]},
};
const LIMBS = [['neck', 'shL', 'elL', 'haL'], ['neck', 'shR', 'elR', 'haR'], ['hip', 'hpL', 'knL', 'ftL'], ['hip', 'hpR', 'knR', 'ftR']];
const frac = x => x - Math.floor(x);

export function mount(el, props = defaults, {look} = {}) {
  const p = {...defaults, ...props}, st = stage(el, look), g = st.root.append('g');
  const {cx, ground, scale: s} = p, A = POSES[p.from] ?? POSES.stiff, B = POSES[p.to] ?? POSES.reach;
  const tint = p.color ?? look.accent, stroke = 46 * s;
  const at = (j, q, sway = 0) => { const a = A[j], b = B[j], y = mix(a[1], b[1], q); return [cx + (mix(a[0], b[0], q) + sway * y) * s, ground - y * s]; };
  const line = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

  g.append('ellipse').attr('cx', cx).attr('cy', ground + 34 * s).attr('rx', 190 * s).attr('ry', 20 * s).attr('fill', look.ink).attr('fill-opacity', .12);
  const body = g.append('path').attr('fill', 'none').attr('stroke', look.ink).attr('stroke-width', stroke).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
  const head = g.append('circle').attr('r', 64 * s).attr('fill', look.ink);
  const dots = p.flow ? LIMBS.flatMap((limb, l) => [0, 1, 2].map(i => ({limb, ph: i / 3 + l * .17, node: g.append('circle').attr('r', 19 * s).attr('fill', tint)}))) : [];
  const marks = p.warn ? ['neck', 'hip', 'knL', 'knR'].map((j, i) => ({j, i, ring: g.append('circle').attr('fill', 'none').attr('stroke', tint).attr('stroke-width', 9 * s), core: g.append('circle').attr('r', 15 * s).attr('fill', tint)})) : [];

  const kick = p.kicker ? text(g, cx, ground - 1010 * s, p.kicker, {size: 36, role: 'mono', color: look.dim, anchor: 'middle'}, look).style('letter-spacing', '.22em') : null;
  const size = p.label ? Math.min(128, 128 * 760 / Math.max(1, measure(p.label, look, 'head', 128))) : 0;
  const lab = p.label ? st.root.append('g') : null;
  if (lab) text(lab, 0, 0, p.label, {size, role: 'head', color: p.warn ? look.accent : p.flow ? tint : look.ink, anchor: 'middle'}, look);

  const along = (pts, f) => {                                           // a point a fraction f of the way along a polyline
    const lens = pts.slice(1).map((b, i) => Math.hypot(b[0] - pts[i][0], b[1] - pts[i][1])), total = lens.reduce((a, b) => a + b, 0);
    let d = f * total;
    for (let i = 0; i < lens.length; i++) { if (d <= lens[i] || i === lens.length - 1) { const k = lens[i] ? d / lens[i] : 0; return [mix(pts[i][0], pts[i + 1][0], k), mix(pts[i][1], pts[i + 1][1], k)]; } d -= lens[i]; }
    return pts[0];
  };

  return {
    seek(t) {
      const into = glide(span(t, 0, .35)), gone = 1 - leave(t, p.life);
      g.attr('opacity', fade(t, 0, .18) * gone).attr('transform', `translate(0 ${(1 - into) * 70})`);
      const m = span(t, p.at, p.dur), q = p.from === p.to ? 1 : mix(easeInOut(m), easeBack(m), .5);
      // a held 'stiff' pose trembles a little; a 'reach' sways slowly from the feet
      const end = q < .5 ? p.from : p.to;
      const sway = end === 'reach' ? .028 * Math.sin(t * 2.4) * Math.min(1, q + .2) : .006 * Math.sin(t * 31);
      const J = Object.fromEntries(Object.keys(A).map(j => [j, at(j, q, sway)]));
      body.attr('d', [line([J.hip, J.neck]), line([J.shL, J.shR]), line([J.shL, J.elL, J.haL]), line([J.shR, J.elR, J.haR]), line([J.hpL, J.hpR]), line([J.hpL, J.knL, J.ftL]), line([J.hpR, J.knR, J.ftR])].join(' '));
      head.attr('cx', J.head[0]).attr('cy', J.head[1]);
      for (const d of dots) {
        const f = frac((t - p.flowAt) * .95 + d.ph), on = t >= p.flowAt ? fade(t, p.flowAt, .2) : 0, [x, y] = along(d.limb.map(j => J[j]), f);
        d.node.attr('cx', x).attr('cy', y).attr('opacity', on * Math.sin(Math.PI * f));
      }
      for (const k of marks) {
        const f = frac(t * 1.5 + k.i * .27), show = fade(t, .2 + k.i * .1, .15) * (1 - span(t, p.at, p.dur * .6) * (p.from === p.to ? 0 : 1));
        k.core.attr('cx', J[k.j][0]).attr('cy', J[k.j][1]).attr('opacity', show);
        k.ring.attr('cx', J[k.j][0]).attr('cy', J[k.j][1]).attr('r', (20 + 46 * f) * s).attr('opacity', show * (1 - f));
      }
      kick?.attr('opacity', fade(t, .1, .2));
      if (lab) {
        const a = span(t, p.labelAt, .28);
        lab.attr('opacity', (a > 0 ? 1 : 0) * gone).attr('transform', `translate(${cx} ${ground + 185}) scale(${(.6 + .4 * easeBack(a)).toFixed(4)})`);
      }
    },
  };
}

import {C, stage, group, node, rr, circle} from '../../ui.js';

// It rains little Claude agents: small clay-orange helpers (a rounded body, two eyes, stubby legs and a spark on top)
// tumble down over the picture, big ones in front and fast, small ones behind, slower and paler. Original drawing.
// Transparent: only the agents are drawn. Deterministic: every agent's path is a pure function of t.
export const meta = {duration: 1.2, live: true};
export const defaults = {count: 34, speed: 1, lead: 0.25, size: 1};
// count: how many agents; speed: fall speed (1 = about 1.5 screens a second for the front ones);
// lead: seconds over which the first agents enter (they fall in from the top, staggered); size: scale of every agent

const rand = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function agent(p, s) {
  // one agent at the origin, height about 100*s
  const g = group(p);
  const body = C.orange, dark = '#1f1e1d';
  // spark antenna
  const sp = group(g, {transform: `translate(0 ${-58 * s})`});
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, r = (k % 2 ? 9 : 14) * s;
    node(sp, 'line', {x1: 0, y1: 0, x2: Math.cos(a) * r, y2: Math.sin(a) * r, stroke: C.orangeHot, 'stroke-width': 4.5 * s, 'stroke-linecap': 'round'});
  }
  node(g, 'line', {x1: 0, y1: -44 * s, x2: 0, y2: -30 * s, stroke: C.orangeHot, 'stroke-width': 4 * s, 'stroke-linecap': 'round'});
  // legs
  for (const x of [-16, 16]) rr(g, (x - 6) * s, 22 * s, (x + 6) * s, 42 * s, 5 * s, '#b85f42');
  // arms
  for (const x of [-1, 1]) rr(g, (x * 38 - 6) * s, -6 * s, (x * 38 + 6) * s, 14 * s, 6 * s, '#c96a4b');
  // body
  rr(g, -34 * s, -32 * s, 34 * s, 28 * s, 18 * s, body, {stroke: dark, 'stroke-width': 4 * s});
  // face screen + eyes
  rr(g, -24 * s, -20 * s, 24 * s, 8 * s, 10 * s, '#2a2624');
  for (const x of [-10, 10]) rr(g, (x - 4) * s, -12 * s, (x + 4) * s, 0, 3 * s, '#f6efe6');
  return g;
}

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el, null), root = group(svg);
  const agents = Array.from({length: p.count}, (_, i) => {
    const depth = rand(i + 3);                                   // 0 far, 1 near
    const s = (0.45 + depth * 0.75) * p.size;
    const g = agent(root, s);
    g.setAttribute('opacity', (0.55 + depth * 0.45).toFixed(2));
    return {g, depth, x: 60 + rand(i) * 960, start: rand(i + 9) * p.lead + (i % 5) * 0.02,
      y0: -140 - rand(i + 5) * 900, spin: (rand(i + 11) - .5) * 520, sway: 20 + rand(i + 13) * 40, phase: rand(i + 17) * 6.28};
  });
  agents.sort((a, b) => a.depth - b.depth).forEach(a => root.appendChild(a.g));   // near ones in front
  return {seek(t) {
    for (const a of agents) {
      const k = t - a.start;
      if (k < 0) { a.g.setAttribute('visibility', 'hidden'); continue; }
      const v = (1300 + a.depth * 1700) * p.speed;              // px per second, near ones faster
      const y = a.y0 + k * v + 60 * k * k * 9.8 * .1;
      const x = a.x + Math.sin(k * 5 + a.phase) * a.sway;
      // 'inherit', not 'visible': an explicit 'visible' overrides the hidden overlay box, so agents frozen at their last
      // position leaked into every later frame the same page drew (user note m31)
      a.g.setAttribute('visibility', y > 2100 ? 'hidden' : 'inherit');
      a.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(a.spin * k + Math.sin(a.phase) * 25).toFixed(1)})`);
    }
  }};
}

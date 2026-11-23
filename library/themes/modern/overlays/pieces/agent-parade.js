import {C, stage, word, fit, capH, up, hash} from '../../kit.js';

// A full-frame card for behind the person ("behind": "person"): a psychedelic purple field of wavy rings pulsing out
// from behind the head, a parade of little orange agents marching down the frame in columns (near ones big and fast,
// far ones small and slow), and the theme's big white words building over the top. Use it with "exit": "slice".
// Props: titles [{lines: [...], at, until?, times?}] (times: when each line lands, seconds into the piece),
// y (centre of the words, frame px), size (max type size), count (columns of agents), speed (px/s of the near column),
// agent (body colour), palette (ring colours, outermost first), cy (ring centre, frame px), seed.
// Optional: titles[].color (a line block's colour), font / weight (the title face, e.g. "Archivo Black"), slam (each
// line lands all at once from big with an overshoot, a white flash and a screen shake, instead of building letter by letter).
export const meta = {duration: 1.7, live: true};
export const defaults = {
  titles: [{lines: ['IN THIS', 'VIDEO'], at: 0.04, until: 0.72, times: [0.04, 0.34]}, {lines: ['CLAUDE', 'DID'], at: 0.74, times: [0.74, 1.08]}],
  y: 440, size: 230, count: 9, speed: 520, agent: '#D97757', cy: 760, seed: 5,
  palette: ['#2a0a5e', '#6a1fd1', '#b23cff', '#ff4fd8', '#8a2be2', '#3d0f8f', '#e06bff', '#5b22c9'],
};

const NS = 'http://www.w3.org/2000/svg';

export async function mount(el, props = defaults) {
  const p = {...defaults, ...props};
  if (p.font) await document.fonts?.load(`${p.weight ?? 900} 100px "${p.font}"`).catch(() => {});   // measured below, so loaded first
  const st = stage(el, {mode: 'overlay'}), {W, H} = st;
  const bg = st.back.append('g'), crowd = st.root.append('g'), type = st.root.append('g'), flash = st.root.append('rect').attr('width', W).attr('height', H).attr('fill', '#fff').attr('opacity', 0);
  bg.append('rect').attr('width', W).attr('height', H).attr('fill', '#14042b');

  // ---- the psychedelic field: wavy rings that keep pulsing outward, colours cycling as they travel
  const N = 18, step = Math.hypot(W, H) / N * 1.05, cx = W / 2, cy = p.cy;
  const rings = Array.from({length: N}, () => bg.append('path'));
  const rays = bg.append('g').style('mix-blend-mode', 'screen');
  for (let k = 0; k < 14; k++) {
    const a0 = k / 14 * Math.PI * 2, a1 = a0 + Math.PI / 28, R = Math.hypot(W, H);
    rays.append('path').attr('d', `M0 0L${R * Math.cos(a0)} ${R * Math.sin(a0)}L${R * Math.cos(a1)} ${R * Math.sin(a1)}Z`)
      .attr('fill', k % 2 ? '#ff7af0' : '#9d6bff').attr('opacity', .1);
  }
  const ringPath = (R, ph) => {
    let d = '';
    for (let j = 0; j <= 72; j++) {
      const a = j / 72 * Math.PI * 2, r = Math.max(0, R * (1 + .07 * Math.sin(5 * a + ph) + .04 * Math.sin(3 * a - ph * 1.3)));
      d += `${j ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
    }
    return d + 'Z';
  };

  // ---- the agents: columns marching down, parallax by depth
  const cols = [];
  for (let c = 0; c < p.count; c++) {
    const depth = .45 + .55 * hash(c, p.seed);                                   // 0.45 far .. 1 near
    const s = 60 + 70 * depth, gap = s * (1.7 + .5 * hash(c, p.seed + 3));
    const x = W * (c + .5) / p.count + (hash(c, p.seed + 7) - .5) * W / p.count * .5;
    const n = Math.ceil((H + 2 * s) / gap) + 1, off = hash(c, p.seed + 11) * gap;
    const agents = Array.from({length: n}, (_, i) => drawAgent(crowd, s, p.agent, depth));
    cols.push({depth, s, gap, x, n, off, agents});
  }
  cols.sort((a, b) => a.depth - b.depth).forEach(c => c.agents.forEach(a => a.g.raise()));   // near ones in front

  // ---- the words, in the theme's big white type
  const blocks = (p.titles ?? []).map((tt, b) => {
    const fo = p.font ? {font: p.font, weight: p.weight ?? 900} : {};
    const lines = (tt.lines ?? []).map(up), size = fit(lines, W * .86, p.size, fo), cap = capH(size, fo), pitch = cap * 1.22;
    const top = p.y - ((lines.length - 1) * pitch + cap) / 2;
    const rows = lines.map((l, i) => { const g = type.append('g'); return Object.assign(word(g, l, W / 2, top + cap + i * pitch, size, {color: tt.color ?? C.white, seed: 3 + b * 7 + i * 5, lift: st, ...fo}), {g, cy: top + cap / 2 + i * pitch}); });
    return {rows, at: tt.at ?? 0, until: tt.until ?? null, times: tt.times ?? lines.map((_, i) => (tt.at ?? 0) + i * .18)};
  });

  return {seek(t) {
    for (let i = 0; i < N; i++) {
      const v = i + t * 2.2, u = v % N, wraps = Math.floor(v / N);           // u: how far the ring has grown out
      const R = (u + .05) * step;
      rings[i].attr('d', ringPath(R, t * 3 + i * .7)).attr('fill', p.palette[(i + wraps * 3) % p.palette.length]);
    }
    // paint order largest -> smallest, so every ring shows as a band
    rings.map((r, i) => [r, (i + t * 2.2) % N]).sort((a, b) => b[1] - a[1]).forEach(([r]) => r.raise());
    rays.raise().attr('transform', `translate(${cx} ${cy}) rotate(${(t * 38).toFixed(2)})`);

    for (const c of cols) {
      const v = p.speed * (.35 + .65 * c.depth), span = c.n * c.gap;
      c.agents.forEach((a, i) => {
        const y = ((i * c.gap + c.off + t * v) % span + span) % span - c.s * 1.2;
        const ph = t * 13 + i * 1.7 + c.x * .01, bob = Math.abs(Math.sin(ph)) * c.s * .08;
        a.g.attr('transform', `translate(${(c.x + Math.sin(ph * .5) * c.s * .06).toFixed(1)} ${(y - bob).toFixed(1)}) rotate(${(Math.sin(ph) * 7).toFixed(1)})`);
        a.legs.forEach((l, k) => l.attr('transform', `translate(0 ${(k % 2 ? 1 : -1) * Math.sin(ph) * c.s * .06})`));
        a.arms.forEach((l, k) => l.attr('transform', `rotate(${((k ? 1 : -1) * (20 + 25 * Math.sin(ph + k))).toFixed(1)} ${k ? c.s * .5 : -c.s * .5} ${-c.s * .05})`));
      });
    }

    let shake = 0, white = 0;
    for (const b of blocks) {
      b.rows.forEach((r, i) => {
        const at = b.times[i] ?? b.at;
        if (!p.slam) return r.seek(t, {at, step: .03, hold: .05, out: b.until != null ? b.until - .12 : null, outStep: .015});
        // slam: every letter at once, dropping from 2.6x with an overshoot; a flash and a shake on impact
        r.seek(t, {at, step: 0, hold: 0, out: b.until != null ? b.until - .06 : null, outStep: .008});
        const q = (t - at) / .16, k = q <= 0 ? 0 : q >= 1 ? 1 : 1 - Math.pow(1 - q, 3), over = q > 1 ? Math.sin(Math.min(1, (q - 1) / 1.2) * Math.PI) * .06 * Math.exp(-(q - 1)) : 0;
        const sc = q <= 0 ? 1 : 2.6 - 1.6 * k - over, rot = q > 0 && q < 1 ? (1 - k) * (i % 2 ? 7 : -7) : 0;
        r.g.attr('transform', `translate(${W / 2} ${r.cy}) rotate(${rot.toFixed(2)}) scale(${sc.toFixed(3)}) translate(${-W / 2} ${-r.cy})`).attr('opacity', q <= 0 ? 0 : Math.min(1, q * 4));
        const hit = t - (at + .16);
        if (hit >= 0 && hit < .28) { shake = Math.max(shake, 1 - hit / .28); white = Math.max(white, Math.max(0, .55 - hit / .12 * .55)); }
      });
    }
    if (p.slam) {
      const a = shake * 26, dx = Math.sin(t * 97) * a, dy = Math.cos(t * 83) * a;
      for (const g of [bg, crowd, type]) g.attr('transform', shake ? `translate(${dx.toFixed(1)} ${dy.toFixed(1)})` : null);
      flash.attr('opacity', white.toFixed(3));
    }
  }};
}

/** One little agent, drawn around (0, 0) at size s: a rounded orange block with eyes, waving arms, stepping legs and a spark on top. */
function drawAgent(parent, s, col, depth) {
  const g = parent.append('g').attr('opacity', .7 + .3 * depth);
  const dark = '#a9503a', light = '#f0a385';
  const legs = [-.34, -.12, .12, .34].map(x => g.append('rect').attr('x', (x - .055) * s).attr('y', .22 * s).attr('width', .11 * s).attr('height', .22 * s).attr('rx', .04 * s).attr('fill', dark));
  const arms = [0, 1].map(k => g.append('rect').attr('x', k ? .46 * s : -.62 * s).attr('y', -.1 * s).attr('width', .16 * s).attr('height', .1 * s).attr('rx', .05 * s).attr('fill', col));
  g.append('rect').attr('x', -.5 * s).attr('y', -.42 * s).attr('width', s).attr('height', .72 * s).attr('rx', .16 * s).attr('fill', col);
  g.append('rect').attr('x', -.4 * s).attr('y', -.36 * s).attr('width', .8 * s).attr('height', .12 * s).attr('rx', .06 * s).attr('fill', light).attr('opacity', .55);
  for (const x of [-.18, .18]) g.append('rect').attr('x', (x - .05) * s).attr('y', -.2 * s).attr('width', .1 * s).attr('height', .17 * s).attr('rx', .03 * s).attr('fill', '#1b1410');
  const spark = g.append('g').attr('transform', `translate(0 ${-.56 * s})`);
  for (let k = 0; k < 4; k++) spark.append('rect').attr('x', -.03 * s).attr('y', -.12 * s).attr('width', .06 * s).attr('height', .24 * s).attr('rx', .03 * s)
    .attr('fill', '#fff3e6').attr('transform', `rotate(${k * 45})`);
  return {g, legs, arms};
}

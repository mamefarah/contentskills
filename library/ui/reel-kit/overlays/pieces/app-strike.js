import {clamp, easeOut, easeBack, fadeOut, stage, group, rr, circle, line, node, text, F} from '../../ui.js';

// "No apps, no editing" as pictures instead of words. First a row of video-app tiles (TikTok, Edits, CapCut, drawn as
// simple original icons, not the brands' artwork) pops in and each gets a red cross; then the row slides away and a
// video-editor timeline (tracks of clips, a waveform, a moving playhead) slides in and gets a red slash. Both sit in one
// band (y = top of the band, about `height` + 20 px tall), above the head or below the chin. Times are seconds into the
// overlay. Props: y, height (timeline height, default 290; app tiles plus names take about 215 px), apps [{name, kind (tiktok|edits|capcut), at, strike}], swap (apps leave, timeline arrives), strike (timeline
// slash), strikeColor, life.
export const meta = {duration: 2, live: true};
export const defaults = {
  y: 1090, strikeColor: '#FF3B47', swap: .9, strike: 1.2,
  apps: [{name: 'TikTok', kind: 'tiktok', at: 0, strike: .36}, {name: 'Edits', kind: 'edits', at: .08, strike: .42},
    {name: 'CapCut', kind: 'capcut', at: .16, strike: .48}],
};

let gid = 0;
function gradient(svg, stops, x2 = 1, y2 = 1) {
  const id = `as-g-${++gid}`, g = node(svg.defs, 'linearGradient', {id, x1: 0, y1: 0, x2, y2});
  stops.forEach(([o, c]) => node(g, 'stop', {offset: o, 'stop-color': c}));
  return `url(#${id})`;
}

// A note glyph: head, stem, flag. Drawn three times with offsets for the app's chromatic look.
function note(p, cx, cy, s, fill) {
  const g = group(p);
  circle(g, cx - s * .14, cy + s * .2, s * .17, 'none', {stroke: fill, 'stroke-width': s * .1});
  node(g, 'path', {d: `M${cx + s * .03} ${cy + s * .2} V${cy - s * .32} q${s * .04} ${s * .2} ${s * .26} ${s * .24}`, fill: 'none', stroke: fill,
    'stroke-width': s * .1, 'stroke-linecap': 'round'});
  return g;
}

function icon(svg, p, kind, x, y, s) {
  const g = group(p, {filter: svg.shadow}), r = s * .23, cx = x + s / 2, cy = y + s / 2;
  if (kind === 'tiktok') {
    rr(g, x, y, s, s, r, '#0B0B0F');
    note(g, cx - s * .025, cy - s * .02, s * .8, '#25F4EE');
    note(g, cx + s * .025, cy + s * .02, s * .8, '#FE2C55');
    note(g, cx, cy, s * .8, '#FFFFFF');
  } else if (kind === 'edits') {
    rr(g, x, y, s, s, r, gradient(svg, [[0, '#7A3CF0'], [.55, '#E1306C'], [1, '#FFB347']]));
    rr(g, cx - s * .27, cy - s * .2, s * .54, s * .4, s * .08, 'none', {stroke: '#FFFFFF', 'stroke-width': s * .055});
    for (const k of [-1, 1]) for (const j of [-.1, 0, .1]) rr(g, cx + k * s * .2 - s * .025, cy + j * s - s * .02, s * .05, s * .04, s * .01, '#FFFFFF');
    node(g, 'polygon', {points: `${cx - s * .06},${cy - s * .09} ${cx - s * .06},${cy + s * .09} ${cx + s * .09},${cy}`, fill: '#FFFFFF'});
  } else {
    rr(g, x, y, s, s, r, '#FFFFFF');
    const w = s * .07;
    line(g, [[cx - s * .26, cy - s * .2], [cx + s * .02, cy - s * .2], [cx + s * .26, cy + s * .2], [cx - s * .02, cy + s * .2], [cx - s * .26, cy - s * .2]], '#0B0B0F', w);
    line(g, [[cx + s * .26, cy - s * .2], [cx + s * .1, cy - s * .2]], '#0B0B0F', w);
    line(g, [[cx - s * .26, cy + s * .2], [cx - s * .1, cy + s * .2]], '#0B0B0F', w);
  }
  return g;
}

function cross(p, cx, cy, h, col) {
  const g = group(p);
  line(g, [[cx - h, cy - h], [cx + h, cy + h]], '#160C24', h * .34);
  line(g, [[cx + h, cy - h], [cx - h, cy + h]], '#160C24', h * .34);
  line(g, [[cx - h, cy - h], [cx + h, cy + h]], col, h * .22);
  line(g, [[cx + h, cy - h], [cx - h, cy + h]], col, h * .22);
  return g;
}

function timeline(svg, p, x, y, w, h) {
  const g = group(p, {filter: svg.shadow});
  rr(g, x, y, w, h, 30, '#17181D');
  rr(g, x, y, w, 54, 30, '#22242B'); rr(g, x, y + 30, w, 24, 0, '#22242B');
  [['#FF5F57', 0], ['#FEBC2E', 1], ['#28C840', 2]].forEach(([c, i]) => circle(g, x + 34 + i * 26, y + 27, 8, c));
  text(g, x + w / 2, y + 28, '00:00:08:15', 24, 700, '#C9CCD6', 'middle', {'font-family': '"JetBrains Mono", "Space Mono", monospace'});
  node(g, 'polygon', {points: `${x + w - 70},${y + 16} ${x + w - 70},${y + 38} ${x + w - 52},${y + 27}`, fill: '#C9CCD6'});
  const tx = x + 40, tw = w - 70, ry = y + 70;
  for (let i = 0; i <= 40; i++) line(g, [[tx + tw * i / 40, ry], [tx + tw * i / 40, ry + (i % 5 ? 8 : 16)]], '#5B5F6B', 2);
  const rows = [
    {y: ry + 30, h: 70, clips: [[0, .22, '#3D6DF2'], [.23, .47, '#5A86FF'], [.48, .63, '#3D6DF2'], [.64, .9, '#5A86FF'], [.91, 1, '#3D6DF2']]},
    {y: ry + 110, h: 34, clips: [[.05, .3, '#B062FF'], [.38, .55, '#B062FF'], [.7, .95, '#B062FF']]},
  ];
  for (const r of rows) for (const [a, b, c] of r.clips) {
    rr(g, tx + tw * a, r.y, tw * (b - a) - 4, r.h, 10, c);
    if (r.h > 50) for (let k = 0; k < 3; k++) rr(g, tx + tw * a + 8 + k * 34, r.y + 8, 28, r.h - 16, 5, '#FFFFFF', {opacity: .22});
  }
  const wy = ry + 172;
  for (let i = 0; i < 90; i++) {
    const a = 6 + 16 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .43));
    line(g, [[tx + tw * i / 90, wy - a], [tx + tw * i / 90, wy + a]], '#2FD07A', 4);
  }
  const head = group(g);
  line(head, [[0, ry - 4], [0, wy + 26]], '#FFFFFF', 4);
  node(head, 'polygon', {points: `-12,${ry - 8} 12,${ry - 8} 0,${ry + 8}`, fill: '#FFFFFF'});
  return {g, head, tx, tw};
}

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el);
  const s = 150, gap = 70, n = p.apps.length, x0 = 540 - (n * s + (n - 1) * gap) / 2, iy = p.y + 20;
  const appsG = group(svg);
  const apps = p.apps.map((a, i) => {
    const x = x0 + i * (s + gap), g = group(appsG), ig = icon(svg, g, a.kind, x, iy, s);
    text(g, x + s / 2, iy + s + 42, a.name, 40, 800, '#FFFFFF', 'middle', {stroke: '#160C24', 'stroke-width': 7, 'paint-order': 'stroke fill', 'stroke-linejoin': 'round'});
    const c = cross(g, x + s / 2, iy + s / 2, s * .42, p.strikeColor);
    return {a, g, ig, c, cx: x + s / 2, cy: iy + s / 2};
  });
  // The timeline is drawn 900 x 290 and scaled to `height`, centred.
  const tlG = group(svg), k = (p.height ?? 290) / 290, W = 900 * k, H = 290 * k, X = 540 - W / 2, Y = p.y + 10;
  const inner = group(tlG, {transform: `translate(${X} ${Y}) scale(${k})`}), tl = timeline(svg, inner, 0, 0, 900, 290);
  const slash = line(tlG, [[0, 0], [0, 0]], p.strikeColor, 24, {filter: svg.softShadow});
  const s0 = [X + 40 * k, Y + H - 36 * k], s1 = [X + W - 40 * k, Y + 36 * k];
  return {
    seek(t) {
      const out = fadeOut(t, p.life, .2);
      const leave = easeOut((t - p.swap) / .25);
      appsG.setAttribute('opacity', ((1 - leave) * out).toFixed(3));
      appsG.setAttribute('transform', `translate(${(-leave * 160).toFixed(1)} 0)`);
      for (const r of apps) {
        const k = easeBack((t - r.a.at) / .3), st = easeBack((t - r.a.strike) / .22);
        r.g.setAttribute('opacity', clamp(k * 2).toFixed(3));
        r.g.style.transformOrigin = `${r.cx}px ${r.cy}px`;
        r.g.style.transform = `scale(${(.6 + .4 * Math.max(0, k)).toFixed(3)})`;
        r.ig.setAttribute('opacity', t >= r.a.strike ? .55 : 1);
        r.c.setAttribute('opacity', t >= r.a.strike ? 1 : 0);
        r.c.style.transformOrigin = `${r.cx}px ${r.cy}px`;
        r.c.style.transform = `scale(${Math.max(0, st).toFixed(3)})`;
      }
      const come = easeOut((t - p.swap - .05) / .3);
      tlG.setAttribute('opacity', (clamp(come * 1.5) * out).toFixed(3));
      tlG.setAttribute('transform', `translate(${((1 - come) * 200).toFixed(1)} 0)`);
      const ph = clamp((t - p.swap) / 1.4);
      tl.head.setAttribute('transform', `translate(${(tl.tx + tl.tw * (.08 + .5 * ph)).toFixed(1)} 0)`);
      const sl = easeOut((t - p.strike) / .18);
      slash.setAttribute('points', `${s0[0]},${s0[1]} ${(s0[0] + (s1[0] - s0[0]) * sl).toFixed(1)},${(s0[1] + (s1[1] - s0[1]) * sl).toFixed(1)}`);
      slash.setAttribute('opacity', sl > 0 ? 1 : 0);
      tl.g.setAttribute('opacity', t >= p.strike ? .6 : 1);
    },
  };
}

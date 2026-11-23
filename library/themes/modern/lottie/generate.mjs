#!/usr/bin/env node
// Writes the modern theme's original Lottie accents in animations/*.json.
// Authored as code so they stay small, editable and licence-clean. The look follows the theme kit:
// heavy white strokes with butt ends and mitred corners (no round caps, no glow), charcoal ground,
// picture strips filled with the kit's studio-light tones (radial gradients), and the beat: arrivals
// are expo-out (fast, hard landing) with a small overshoot where something punches, on a 0.2 s grid
// (6 frames at 30 fps). Ghost states (30 % white) come before solid, as with the kit's big word.
// Run: node library/themes/modern/lottie/generate.mjs
import {writeFileSync, mkdirSync} from 'node:fs';

const P = {bg: '#1c1c1e', white: '#f5f5f2', bone: '#e8e5de', dim: '#9a9a9f', mute: '#5d5d62', graphite: '#2b2b2e', signal: '#ff5a1f'};
const TONES = {
  ember: ['#ffb070', '#e2632a', '#5a2010', '#140b08'], teal: ['#4f7c80', '#24464b', '#11222a', '#0a1215'],
  bone: ['#f1eee8', '#d9d4ca', '#b5afa4', '#8e897f'], rose: ['#f2b8c0', '#c96a7c', '#5e2533', '#1d0b10'],
  steel: ['#c3ccd4', '#7d8b97', '#39424b', '#15191d'], sand: ['#f0d3a8', '#d1a46e', '#7c5833', '#2a1c0f'], cobalt: ['#7d9bff', '#3554d1', '#14215c', '#080c22'],
};
const B = 6;   // one beat in frames (0.2 s at 30 fps)
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const rgba = h => rgb(h).concat(1);
const arr = v => Array.isArray(v) ? v : [v];
const hash = (n, seed = 0) => { const x = Math.sin(n * 127.1 + seed * 311.7 + 74.7) * 43758.5453; return x - Math.floor(x); };

// Keyframes: [[frame, value, ease?], ...]. ease (for the move out of that key): 'snap' expo-out
// (default), 'io' cubic in-out, 'in' cubic in, 'lin' linear, 'hold' a hard cut.
const EASE = {snap: [[.16, 1], [.3, 1]], io: [[.65, 0], [.35, 1]], in: [[.55, 0], [.85, .3]], lin: [[0, 0], [1, 1]]};
const keys = frames => ({a: 1, k: frames.map(([t, s, e = 'snap'], i) => {
  if (i === frames.length - 1) return {t, s: arr(s)};
  if (e === 'hold') return {t, s: arr(s), h: 1};
  const [o, ii] = EASE[e]; return {t, s: arr(s), o: {x: [o[0]], y: [o[1]]}, i: {x: [ii[0]], y: [ii[1]]}};
})});
const isKeys = v => Array.isArray(v) && v.length > 1 && v.every(k => Array.isArray(k) && typeof k[0] === 'number' && k.length >= 2 && k.length <= 3 && (typeof k[1] === 'number' || Array.isArray(k[1])));
const prop = v => v && v.a !== undefined ? v : isKeys(v) ? keys(v) : {a: 0, k: v};

const fill = (color, o = 100) => ({ty: 'fl', c: prop(rgba(color)), o: prop(o), r: 1});
const stroke = (color, width, o = 100) => ({ty: 'st', c: prop(rgba(color)), o: prop(o), w: prop(width), lc: 1, lj: 1, ml: 4});
/** A radial "studio light" gradient fill from a kit tone, lit at (lx, ly) and reaching radius r. */
const toneFill = (name, [lx, ly], r) => { const s = TONES[name] ?? TONES.ember, at = [0, .28, .7, 1];
  return {ty: 'gf', o: prop(100), r: 1, t: 2, s: prop([lx, ly]), e: prop([lx + r, ly]), h: prop(0), a: prop(0), g: {p: 4, k: prop(s.flatMap((c, i) => [at[i], ...rgb(c)]))}}; };
const rect = (size, at = [0, 0]) => ({ty: 'rc', p: prop(at), s: prop(size), r: prop(0)});
const ellipse = (size, at = [0, 0]) => ({ty: 'el', p: prop(at), s: prop(size)});
const trim = (s, e, o = 0) => ({ty: 'tm', s: prop(s), e: prop(e), o: prop(o), m: 1});
const path = (points, closed = false) => ({ty: 'sh', ks: prop({v: points, i: points.map(() => [0, 0]), o: points.map(() => [0, 0]), c: closed})});
const circle = (r, a0 = -90, n = 64) => path(Array.from({length: n + 1}, (_, i) => { const a = (a0 + 360 * i / n) * Math.PI / 180; return [Math.cos(a) * r, Math.sin(a) * r]; }));
const group = (items, tr = {}) => ({ty: 'gr', it: [...items, {ty: 'tr', p: prop(tr.p ?? [0, 0]), a: prop(tr.a ?? [0, 0]), s: prop(tr.s ?? [100, 100]), r: prop(tr.r ?? 0), o: prop(tr.o ?? 100)}]});
let index = 0;
/** A shape layer; ks: {p, a, s, r, o} (values or key lists), centred at 200,200 by default. */
const layer = (name, shapes, ks = {}) => ({ddd: 0, ind: ++index, ty: 4, nm: name, sr: 1, ao: 0, bm: 0, ip: ks.ip ?? 0, op: ks.op ?? 9999, st: 0,
  ks: {o: prop(ks.o ?? 100), r: prop(ks.r ?? 0), p: prop(ks.p ?? [200, 200, 0]), a: prop(ks.a ?? [0, 0, 0]), s: prop(ks.s ?? [100, 100, 100])}, shapes});
const doc = (name, frames, layers, loop = false) => { index = 0; return {v: '5.12.2', fr: 30, ip: 0, op: frames, w: 400, h: 400, nm: name, ddd: 0, assets: [],
  layers: layers().filter(Boolean).map((l, i) => ({...l, ind: i + 1})), meta: {g: 'library/themes/modern/lottie/generate.mjs', background: P.bg, loop}}; };
/** Opacity keys for ghost -> solid at frame f (ghost for g frames), and back out at `out` (optional). */
const ghost = (f, g = 3, out = null) => [[0, 0, 'hold'], [f, 30, 'hold'], [f + g, 100, 'hold'], ...(out == null ? [] : [[out, 30, 'hold'], [out + g, 0, 'hold']]), [Math.max(f + g, out ?? 0) + g + 1, out == null ? 100 : 0]];
const S = v => [v, v, 100];

const animations = {
  'underline-swipe': doc('Underline swipe', 60, () => [
    layer('bar', [group([path([[-150, 0], [150, 0]]), trim([[0, 0], [30, 0, 'in'], [40, 100]], [[3, 0], [3 + B * 2, 100]]), stroke(P.white, 16)])], {p: [200, 240, 0]}),
    layer('ghost', [group([path([[-150, 0], [150, 0]]), trim(0, [[0, 0], [B * 2, 100]]), stroke(P.white, 16, 30)])], {p: [200, 240, 0], o: [[0, 100, 'hold'], [B * 2 + 3, 0]]}),
  ]),
  'arrow': doc('Arrow', 60, () => [
    layer('arrow', [
      group([path([[-130, 0], [110, 0]]), trim(0, [[2, 0], [2 + B * 2, 100]]), stroke(P.white, 18)]),
      group([path([[54, -58], [116, 0], [54, 58]]), trim([[0, 50], [B * 2, 50], [B * 3, 0]], [[0, 50], [B * 2, 50], [B * 3, 100]]), stroke(P.white, 18)]),
    ], {p: [[0, [190, 200, 0]], [B * 3, [190, 200, 0]], [B * 4, [214, 200, 0]], [B * 5, [200, 200, 0]]]}),
  ]),
  'plus': doc('Plus', 45, () => [
    layer('plus', [group([path([[-70, 0], [70, 0]]), path([[0, -70], [0, 70]]), stroke(P.white, 22)])],
      {s: [[0, S(0)], [B * 1.5, S(115)], [B * 2.5, S(100)]], r: [[0, -90], [B * 2, 0, 'hold'], [B * 4, 0], [B * 5.5, 90]]}),
    layer('ghost', [group([path([[-70, 0], [70, 0]]), path([[0, -70], [0, 70]]), stroke(P.white, 22, 30)])], {s: [[0, S(60)], [B * 2, S(140)]], o: [[0, 100], [B * 2, 0]]}),
  ]),
  'ring-draw': doc('Ring draw', 60, () => [
    layer('ring', [group([circle(110), trim(0, [[2, 0], [2 + B * 3, 100]]), stroke(P.white, 18)])], {r: [[0, -60], [2 + B * 3, 0]]}),
    layer('inner', [group([circle(78), trim(0, [[B * 2, 0], [B * 4, 100]]), stroke(P.white, 4, 30)])], {r: [[0, 60], [B * 4, 0]]}),
    layer('tick', [group([rect([18, 18], [0, -110]), fill(P.white)])], {o: [[0, 0, 'hold'], [2 + B * 3, 100]], s: [[2 + B * 3, S(60)], [2 + B * 4, S(100)]]}),
  ]),
  'strip-bars': doc('Strip bars', 48, () => {
    // Five picture strips bouncing to the beat: each bar's height jumps on its beat, lands hard and eases down.
    const tones = ['ember', 'steel', 'bone', 'teal', 'rose'], w = 54, gap = 12, base = 300, x0 = 200 - (5 * w + 4 * gap) / 2 + w / 2;
    return tones.map((tn, i) => {
      const hs = Array.from({length: 8}, (_, k) => 70 + Math.round(hash(i * 8 + k, 3) * 150)), ks = [];
      hs.forEach((h, k) => { ks.push([k * B, [w, h * .55]], [k * B + 2, [w, h]]); }); ks.push([48, [w, hs[0] * .55]]);
      const sizeKeys = ks.map(([t, s], j) => [t, s, j % 2 ? 'io' : 'snap']);
      const posKeys = ks.map(([t, s], j) => [t, [0, -s[1] / 2], j % 2 ? 'io' : 'snap']);
      return layer('strip ' + i, [group([{ty: 'rc', p: prop(posKeys), s: prop(sizeKeys), r: prop(0)}, toneFill(tn, [-8, -200], 260)])], {p: [x0 + i * (w + gap), base, 0]});
    }).concat([layer('base', [group([path([[-160, 0], [160, 0]]), stroke(P.white, 4)])], {p: [200, 306, 0]})]);
  }, true),
  'counter-ticks': doc('Counter ticks', 60, () => {
    // A ruler of 21 ticks lighting up one per two frames (ghost dim -> white), long ticks every fifth, with a marker riding the front.
    const n = 21, x0 = -150, dx = 15, out = [];
    for (let i = 0; i < n; i++) {
      const h = i % 5 ? 30 : 64, at = 4 + i * 2;
      out.push(layer('tick ' + i, [group([path([[0, 0], [0, -h]]), stroke(P.white, 5)])], {p: [200 + x0 + i * dx, 240, 0], o: [[0, 24, 'hold'], [at, 100]]}));
    }
    out.push(layer('marker', [group([path([[-12, -20], [0, -2], [12, -20]], true), fill(P.white)])], {p: [[0, [200 + x0, 168, 0], 'lin'], [4 + (n - 1) * 2, [200 + x0 + (n - 1) * dx, 168, 0]]]}));
    out.push(layer('base', [group([path([[-160, 0], [160, 0]]), stroke(P.white, 3, 60)])], {p: [200, 242, 0]}));
    return out;
  }),
  'corner-brackets': doc('Corner brackets', 60, () => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => {
    const L = 46, c = [sx * 140, sy * 140];
    return layer('corner ' + i, [group([path([[c[0], c[1] - sy * L], c, [c[0] - sx * L, c[1]]]), stroke(P.white, 12)])],
      {p: [[0, [200 + sx * 70, 200 + sy * 70, 0]], [2 + i, [200 + sx * 70, 200 + sy * 70, 0]], [2 + i + B * 2, [200, 200, 0]]], o: [[0, 0, 'hold'], [2 + i, 30, 'hold'], [5 + i, 100]]});
  })),
  'slash-wipe': doc('Slash wipe', 45, () => [
    // A heavy diagonal slash slams in from the left, holds on the centre for a beat and a half, and
    // leaves to the right; a ghost slash trails it both ways.
    layer('white', [group([path([[10, -150], [90, -150], [-10, 150], [-90, 150]], true), fill(P.white)])], {p: [[0, [-160, 200, 0]], [B * 2, [200, 200, 0], 'hold'], [26, [200, 200, 0], 'in'], [26 + B * 2, [560, 200, 0]]]}),
    layer('ghost', [group([path([[10, -150], [90, -150], [-10, 150], [-90, 150]], true), fill(P.white, 30)])], {p: [[2, [-200, 200, 0]], [2 + B * 2, [150, 200, 0], 'hold'], [29, [150, 200, 0], 'in'], [29 + B * 2, [600, 200, 0]]]}),
  ]),
  'dot-grid': doc('Dot grid', 60, () => {
    // A 5x5 grid of square dots arriving in a scattered order, each ghost first then solid.
    const out = [], order = [...Array(25).keys()].sort((a, b) => hash(a + 1, 9) - hash(b + 1, 9));
    order.forEach((i, r) => { const x = (i % 5 - 2) * 56, y = (Math.floor(i / 5) - 2) * 56, at = 2 + r * 1.4;
      out.push(layer('dot ' + i, [group([rect([22, 22]), fill(P.white)])], {p: [200 + x, 200 + y, 0], o: ghost(Math.round(at), 3), s: [[Math.round(at), S(160)], [Math.round(at) + 5, S(100)]]})); });
    return out;
  }),
  'check': doc('Check', 54, () => [
    layer('box', [group([rect([200, 200]), stroke(P.white, 6)])], {s: [[0, S(80)], [B * 1.5, S(100)]], o: [[0, 0, 'hold'], [1, 30, 'hold'], [4, 100]]}),
    layer('check', [group([path([[-60, 4], [-18, 46], [64, -42]]), trim(0, [[B * 1.5, 0], [B * 3.5, 100]]), stroke(P.white, 22)])], {s: [[B * 3.5, S(100)], [B * 4, S(108)], [B * 5, S(100)]]}),
  ]),
  'strip-reveal': doc('Strip reveal', 60, () => ['ember', 'steel', 'teal'].map((tn, i) => {
    // Three picture strips with staggered edges slide in from alternate ends, then leave the same way.
    const w = 104, x = 200 + (i - 1) * (w + 8), y = 200 + (i % 2 ? -14 : 10), d = i % 2 ? -1 : 1;
    return layer('strip ' + i, [group([rect([w, 290]), toneFill(tn, [-10, -100], 300)])],
      {p: [[0, [x, y + d * 420, 0]], [2 + i * 3, [x, y + d * 420, 0]], [2 + i * 3 + B * 2, [x, y, 0], 'hold'], [40 + i * 2, [x, y, 0], 'in'], [40 + i * 2 + B * 1.5, [x, y - d * 420, 0]]]});
  })),
  'beat-square': doc('Beat square', 24, () => [
    // A solid square that punches on every beat, with a ghost outline expanding off it. Loops (4 beats).
    layer('square', [group([rect([90, 90]), fill(P.white)])], {s: [0, 1, 2, 3].flatMap(k => [[k * B, S(118)], [k * B + 4, S(100), 'hold']]).concat([[24, S(118)]])}),
    layer('echo', [group([rect([90, 90]), stroke(P.white, 4, 30)])], {s: [0, 1, 2, 3].flatMap(k => [[k * B, S(100), 'lin'], [k * B + 5.9, S(190), 'hold']]).concat([[24, S(100)]]), o: [0, 1, 2, 3].flatMap(k => [[k * B, 100, 'lin'], [k * B + 5.9, 0, 'hold']]).concat([[24, 100]])}),
  ], true),
};

const dir = new URL('./animations/', import.meta.url);
mkdirSync(dir, {recursive: true});
for (const [id, data] of Object.entries(animations)) writeFileSync(new URL(`${id}.json`, dir), JSON.stringify(data));
console.log(`Wrote ${Object.keys(animations).length} animations`);

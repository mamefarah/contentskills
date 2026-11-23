#!/usr/bin/env node
// Writes the GTA6 theme's original Lottie animations in animations/*.json.
// They are authored here as code so they stay small, editable and license-clean: flat shapes with
// a fat ink outline and a hard offset shadow, in the theme colours.
// Run: node library/themes/gta6/lottie/generate.mjs
import {writeFileSync} from 'node:fs';

const P = {ink: '#190b33', paper: '#fff4e0', night: '#24104f', plum: '#3b1a78', violet: '#7a3cf0', pink: '#ff3f97', orange: '#ff8a30', yellow: '#ffd447', teal: '#12c4c0', aqua: '#6ff2e3', coral: '#ff6a5c'};
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).concat(1);
const still = k => ({a: 0, k});
const arr = v => Array.isArray(v) ? v : [v];
/** Animated property from [[frame, value], ...] with a soft ease between keys. */
const keys = frames => ({a: 1, k: frames.map(([t, s], i) => i < frames.length - 1 ? {t, s: arr(s), i: {x: [.2], y: [1]}, o: {x: [.4], y: [0]}} : {t, s: arr(s)})});
/** The same, moving at constant speed: for spins and scrolls that must loop without a hitch. */
const linear = frames => ({a: 1, k: frames.map(([t, s], i) => i < frames.length - 1 ? {t, s: arr(s), i: {x: [1], y: [1]}, o: {x: [0], y: [0]}} : {t, s: arr(s)})});
const prop = v => v && v.a !== undefined ? v : Array.isArray(v) && Array.isArray(v[0]) ? keys(v) : still(v);

const fill = color => ({ty: 'fl', c: still(rgb(color)), o: still(100), r: 1});
const stroke = (color, width) => ({ty: 'st', c: still(rgb(color)), o: still(100), w: still(width), lc: 2, lj: 2});
const ellipse = (size, at = [0, 0]) => ({ty: 'el', p: prop(at), s: prop(size)});
const rect = (size, at = [0, 0], radius = 0) => ({ty: 'rc', p: prop(at), s: prop(size), r: still(radius)});
const trim = (end, start = 0) => ({ty: 'tm', s: prop(start), e: prop(end), o: still(0), m: 1});
const line = (points, closed = false) => ({ty: 'sh', ks: still({v: points, i: points.map(() => [0, 0]), o: points.map(() => [0, 0]), c: closed})});
const curve = (v, i, o, closed = true) => ({ty: 'sh', ks: still({v, i, o, c: closed})});
const group = (items, tr = {}) => ({ty: 'gr', it: [...items, {ty: 'tr', p: prop(tr.p ?? [0, 0]), a: still([0, 0]), s: prop(tr.s ?? [100, 100]), r: prop(tr.r ?? 0), o: prop(tr.o ?? 100)}]});
/** The theme's look for one shape: a hard shadow, then the shape filled and inked. */
const inked = (shape, color, tr = {}, {ink = 9, shadow = 8} = {}) => group([group([shape, stroke(P.ink, ink), fill(color)]), ...(shadow ? [group([shape, fill(P.ink), stroke(P.ink, ink)], {p: [shadow, shadow]})] : [])], tr);
const burst = (r1, r2, n, rot = 0) => line(Array.from({length: n * 2}, (_, i) => { const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; return [Math.cos(a) * r, Math.sin(a) * r]; }), true);
let index = 0;
const layer = (name, shapes, ks = {}) => ({ddd: 0, ind: ++index, ty: 4, nm: name, sr: 1, ao: 0, bm: 0, ip: 0, op: 9999, st: 0,
  ks: {o: prop(ks.o ?? 100), r: prop(ks.r ?? 0), p: prop(ks.p ?? [200, 200, 0]), a: still([0, 0, 0]), s: prop(ks.s ?? [100, 100, 100])}, shapes});
/** loop: true means the last frame flows into the first, so players should not pause on the end. */
const doc = (name, frames, layers, loop = false, background = P.night) => { index = 0; return {v: '5.12.2', fr: 30, ip: 0, op: frames, w: 400, h: 400, nm: name, ddd: 0, assets: [], layers: layers(), meta: {g: 'library/themes/gta6/lottie/generate.mjs', background, loop}}; };
const popS = (at, big = 118) => [[0, [0, 0, 100]], [at, [0, 0, 100]], [at + 6, [big, big, 100]], [at + 11, [100, 100, 100]]];
const heart = curve([[0, 46], [-60, -14], [-30, -58], [0, -32], [30, -58], [60, -14]], [[0, 0], [0, 26], [-26, 0], [-8, -12], [-14, 0], [0, -30]], [[-20, -18], [0, -30], [14, 0], [8, -12], [26, 0], [0, 26]]);
const pin = curve([[0, 70], [-52, -30], [0, -84], [52, -30]], [[0, 0], [0, 34], [-30, 0], [0, -30]], [[-14, -34], [0, -30], [30, 0], [0, 34]]);
const wave = y => { const v = [], i = [], o = []; for (let k = 0; k <= 10; k++) { v.push([-400 + k * 80, y + (k % 2 ? -14 : 14)]); i.push([-26, 0]); o.push([26, 0]); } return curve(v, i, o, false); };

const animations = {
  'sun-rise': doc('Sun rise', 90, () => [
    layer('sea', [group([rect([400, 110], [0, 145]), fill(P.teal)]), group([line([[-200, 90], [200, 90]]), stroke(P.ink, 8)])]),
    layer('glints', [group([line([[-60, 120], [60, 120]]), stroke(P.paper, 6)]), group([line([[-36, 150], [36, 150]]), stroke(P.paper, 6)])], {o: [[0, 0], [40, 0], [55, 100], [70, 40], [89, 100]]}),
    layer('sun', [...[26, 48, 66].map((y, k) => group([rect([240, 8 + k * 3], [0, y]), fill(P.night)])), inked(ellipse([200, 200]), P.yellow, {}, {shadow: 0})], {p: [[0, [200, 330, 0]], [50, [200, 200, 0]]]}),
    layer('rays', Array.from({length: 12}, (_, k) => group([line([[0, -122], [0, -150]]), stroke(P.orange, 10)], {r: k * 30})), {r: linear([[0, 0], [89, 30]]), p: [[0, [200, 330, 0]], [50, [200, 200, 0]]], o: [[0, 0], [30, 0], [50, 100]]}),
  ]),

  'palm-sway': doc('Palm sway', 90, () => [
    layer('crown', [inked(ellipse([30, 30]), P.orange, {}, {shadow: 0, ink: 7}), ...[[-110, 10], [-90, -50], [-30, -84], [40, -80], [96, -40], [112, 20]].map(([x, y], k) => group([curve([[0, 0], [x, y]], [[0, 0], [-x * .3, -40]], [[x * .3, -50], [0, 0]], false), stroke(k % 2 ? P.aqua : P.teal, 16)])),
      ...[[-110, 10], [-90, -50], [-30, -84], [40, -80], [96, -40], [112, 20]].map(([x, y]) => group([curve([[0, 0], [x, y]], [[0, 0], [-x * .3, -40]], [[x * .3, -50], [0, 0]], false), stroke(P.ink, 30)]))],
      {p: [[0, [222, 150, 0]], [45, [234, 152, 0]], [89, [222, 150, 0]]], r: [[0, -5], [45, 6], [89, -5]]}),
    layer('trunk', [group([curve([[-20, 150], [22, -50]], [[0, 0], [-30, 70]], [[0, -90], [0, 0]], false), stroke(P.pink, 14)]), group([curve([[-20, 150], [22, -50]], [[0, 0], [-30, 70]], [[0, -90], [0, 0]], false), stroke(P.ink, 30)])], {r: [[0, -1], [45, 2], [89, -1]], p: [200, 200, 0]}),
    layer('ground', [inked(ellipse([220, 50], [0, 152]), P.yellow, {}, {shadow: 6})]),
  ], true),

  'wave-loop': doc('Wave loop', 60, () => [
    ...[[-70, P.paper, 10, 160], [0, P.aqua, 14, -160], [70, P.teal, 18, 160]].map(([y, color, w, dx], n) => layer('wave ' + n, [group([wave(0), stroke(color, w)]), group([wave(0), stroke(P.ink, w + 14)])], {p: linear([[0, [200, 200 + y, 0]], [59, [200 + dx, 200 + y, 0]]])})),
  ], true, P.plum),

  'burst-pop': doc('Burst pop', 60, () => [
    layer('core', [inked(burst(60, 28, 5, -Math.PI / 2), P.paper, {}, {shadow: 6})], {s: popS(8), r: [[8, -40], [19, 0]]}),
    layer('burst', [inked(burst(150, 100, 14), P.yellow)], {s: popS(2), r: linear([[0, 0], [59, 26]])}),
    layer('sparks', Array.from({length: 8}, (_, k) => group([line([[0, -165], [0, -190]]), stroke(k % 2 ? P.pink : P.aqua, 12)], {r: k * 45})), {s: [[0, [40, 40, 100]], [6, [40, 40, 100]], [20, [108, 108, 100]]], o: [[0, 0], [6, 0], [9, 100], [30, 100], [44, 0]]}),
  ]),

  'coin-flip': doc('Coin flip', 60, () => [
    layer('coin', [group([burst(46, 20, 5, -Math.PI / 2), fill(P.orange), stroke(P.ink, 6)]), group([ellipse([170, 170]), stroke(P.orange, 8)]), inked(ellipse([230, 230]), P.yellow)],
      {s: linear([[0, [100, 100, 100]], [15, [4, 100, 100]], [30, [100, 100, 100]], [45, [4, 100, 100]], [59, [100, 100, 100]]]), p: [[0, [200, 215, 0]], [30, [200, 185, 0]], [59, [200, 215, 0]]]}),
    layer('shadow', [group([ellipse([[0, [180, 26]], [30, [130, 20]], [59, [180, 26]]], [0, 0]), fill(P.ink)])], {p: [200, 362, 0], o: 60}),
  ], true),

  'pin-drop': doc('Pin drop', 60, () => [
    layer('pin', [group([ellipse([44, 44], [0, -30]), fill(P.paper), stroke(P.ink, 8)]), inked(pin, P.pink)], {p: [[0, [200, -120, 0]], [12, [200, 250, 0]], [17, [200, 222, 0]], [22, [200, 250, 0]]], s: [[10, [100, 100, 100]], [13, [112, 88, 100]], [18, [100, 100, 100]]]}),
    ...[0, 14].map((d, n) => layer('ring ' + n, [group([ellipse([[12 + d, [40, 14]], [44 + d, [260, 84]]]), stroke(P.paper, 8)])], {p: [200, 324, 0], o: [[0, 0], [12 + d, 0], [13 + d, 100], [44 + d, 0]]})),
    layer('spot', [group([ellipse([90, 26]), fill(P.ink)])], {p: [200, 324, 0], o: [[0, 0], [8, 0], [12, 60]]}),
  ]),

  'check-stamp': doc('Check stamp', 60, () => [
    layer('check', [group([line([[-54, 6], [-16, 44], [62, -42]]), trim([[18, 0], [30, 100]]), stroke(P.paper, 30)]), group([line([[-54, 6], [-16, 44], [62, -42]]), trim([[18, 0], [30, 100]]), stroke(P.ink, 50)])]),
    layer('disc', [inked(ellipse([250, 250]), P.teal)], {s: [[0, [0, 0, 100]], [4, [0, 0, 100]], [11, [116, 116, 100]], [17, [100, 100, 100]]]}),
    layer('sparks', Array.from({length: 10}, (_, k) => group([line([[0, -150], [0, -178]]), stroke(k % 2 ? P.yellow : P.pink, 12)], {r: k * 36})), {s: [[0, [50, 50, 100]], [28, [50, 50, 100]], [40, [110, 110, 100]]], o: [[0, 0], [28, 0], [30, 100], [46, 100], [58, 0]]}),
  ]),

  'heart-beat': doc('Heart beat', 45, () => [
    layer('shine', [group([curve([[-34, -24], [-14, -38]], [[0, 0], [-10, -2]], [[2, -10], [0, 0]], false), stroke(P.paper, 9)])], {s: [[0, [200, 200, 100]], [8, [236, 236, 100]], [16, [200, 200, 100]], [24, [222, 222, 100]], [34, [200, 200, 100]]]}),
    layer('heart', [inked(heart, P.pink, {}, {ink: 6, shadow: 5})], {s: [[0, [200, 200, 100]], [8, [236, 236, 100]], [16, [200, 200, 100]], [24, [222, 222, 100]], [34, [200, 200, 100]]]}),
    ...[0, 16].map((d, n) => layer('pulse ' + n, [group([heart, stroke(P.yellow, 3)])], {s: [[d, [200, 200, 100]], [d + 22, [330, 330, 100]]], o: [[0, 0], [d, 0], [d + 2, 90], [d + 22, 0]]})),
  ], true),

  'arrow-bounce': doc('Arrow bounce', 45, () => [
    layer('arrow', [inked(line([[-40, -110], [40, -110], [40, 0], [96, 0], [0, 116], [-96, 0], [-40, 0]], true), P.yellow)], {p: [[0, [200, 170, 0]], [14, [200, 226, 0]], [22, [200, 204, 0]], [30, [200, 222, 0]], [44, [200, 170, 0]]], s: [[10, [100, 100, 100]], [14, [108, 92, 100]], [20, [100, 100, 100]]]}),
    layer('ticks', [group([line([[-150, 150], [-110, 130]]), stroke(P.pink, 12)]), group([line([[150, 150], [110, 130]]), stroke(P.pink, 12)]), group([line([[-170, 100], [-130, 100]]), stroke(P.aqua, 12)]), group([line([[170, 100], [130, 100]]), stroke(P.aqua, 12)])], {o: [[0, 0], [12, 0], [15, 100], [26, 100], [36, 0]]}),
  ], true),

  'speed-lines': doc('Speed lines', 30, () => Array.from({length: 9}, (_, n) => {
    const len = [150, 90, 220, 120, 260, 80, 180, 130, 200][n], y = 50 + n * 38, speed = n % 3 + 1;
    return layer('line ' + n, [group([line([[-len / 2, 0], [len / 2, 0]]), stroke([P.paper, P.pink, P.yellow, P.aqua][n % 4], 8 + (n % 3) * 4)]), group([line([[-len / 2, 0], [len / 2, 0]]), stroke(P.ink, 20 + (n % 3) * 4)])], {p: linear([[0, [600 + n * 40, y, 0]], [29, [600 + n * 40 - 800 * speed, y, 0]]])});
  }).flatMap((l, n) => { const copy = JSON.parse(JSON.stringify(l)); copy.ind = 100 + n; copy.ks.p.k.forEach(k => { k.s[0] += 800; }); return [l, copy]; }), true, P.plum),

  'star-meter': doc('Star meter', 75, () => [
    ...[0, 1, 2].map(n => layer('star ' + n, [inked(burst(56, 25, 5, -Math.PI / 2), P.yellow, {}, {ink: 8, shadow: 7})], {p: [90 + n * 110, 200 - (n === 1 ? 18 : 0), 0], s: popS(8 + n * 14, 140), r: [[8 + n * 14, -50], [20 + n * 14, 0]]})),
    ...[0, 1, 2].map(n => layer('slot ' + n, [group([burst(56, 25, 5, -Math.PI / 2), fill(P.plum), stroke(P.ink, 8)])], {p: [90 + n * 110, 200 - (n === 1 ? 18 : 0), 0]})),
    layer('plate', [inked(line([[-180, -74], [190, -90], [176, 74], [-190, 86]], true), P.violet, {}, {shadow: 10})]),
  ]),

  'beat-bars': doc('Beat bars', 60, () => Array.from({length: 7}, (_, n) => {
    const tall = [110, 200, 150, 260, 180, 230, 120][n], low = tall * .4, color = [P.pink, P.orange, P.yellow, P.aqua, P.teal, P.violet, P.pink][n], k = [[0, low], [14 + n * 2, tall], [38, low * 1.5], [59, low]];
    return layer('bar ' + n, [group([rect(k.map(([t, h]) => [t, [34, h]]), k.map(([t, h]) => [t, [0, -h / 2]])), stroke(P.ink, 8), fill(color)]), group([rect(k.map(([t, h]) => [t, [34, h]]), k.map(([t, h]) => [t, [8, -h / 2 + 8]])), fill(P.ink)])], {p: [62 + n * 46, 330, 0]});
  }), true),

  'sun-spinner': doc('Sun spinner', 60, () => [
    layer('face', [group([curve([[-24, -22], [-4, -40]], [[0, 0], [-12, -2]], [[2, -12], [0, 0]], false), stroke(P.paper, 9)]), inked(ellipse([130, 130]), P.orange, {}, {shadow: 0})], {s: [[0, [100, 100, 100]], [30, [110, 110, 100]], [59, [100, 100, 100]]]}),
    layer('rays', [inked(burst(170, 96, 12), P.yellow)], {r: linear([[0, 0], [59, 30]])}),
    layer('dots', Array.from({length: 12}, (_, k) => group([ellipse([14, 14], [0, -188]), fill(k % 2 ? P.pink : P.aqua)], {r: k * 30})), {r: linear([[0, 0], [59, -30]])}),
  ], true),
};

for (const [id, data] of Object.entries(animations)) writeFileSync(new URL(`animations/${id}.json`, import.meta.url), JSON.stringify(data));
console.log(`Wrote ${Object.keys(animations).length} animations.`);

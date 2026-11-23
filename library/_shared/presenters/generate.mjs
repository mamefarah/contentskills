#!/usr/bin/env node
// Writes the presenter characters as Lottie files: <name>/body.json (an idle loop: blinks, arm swings, cap wobble)
// and <name>/mouth.json, drawn on the same canvas so they stack. The mouth file holds two shapes, each opening over
// MOUTH frames: frames 0..MOUTH a wide mouth (most sounds), frames MOUTH+1..2*MOUTH+1 a round "o" mouth.
// presenter.js plays the body on the clock and picks the mouth frame from the voice, frame by frame.
// Authored as code so they stay small, editable and license-clean.
// Run: node library/_shared/presenters/generate.mjs
import {mkdirSync, writeFileSync} from 'node:fs';

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).concat(1);
const still = k => ({a: 0, k});
const arr = v => Array.isArray(v) ? v : [v];
const EASE = {i: {x: [.42], y: [1]}, o: {x: [.58], y: [0]}};
const keys = frames => ({a: 1, k: frames.map(([t, s], i) => i < frames.length - 1 ? {t, s: arr(s), ...EASE} : {t, s: arr(s)})});
const prop = v => Array.isArray(v) && Array.isArray(v[0]) ? keys(v) : still(v);
const fill = (color, o = 100) => ({ty: 'fl', c: still(rgb(color)), o: prop(o), r: 1});
const stroke = (color, w, o = 100) => ({ty: 'st', c: still(rgb(color)), o: prop(o), w: still(w), lc: 2, lj: 2});
/** Linear gradient fill, stops [[position 0..1, colour], ...], from/to in canvas px. */
const gradient = (stops, from, to) => ({ty: 'gf', o: still(100), r: 1, t: 1, s: still(from), e: still(to),
  g: {p: stops.length, k: still([...stops.flatMap(([p, c]) => [p, ...rgb(c).slice(0, 3)]), ...stops.flatMap(([p]) => [p, 1])])}});
const ellipse = (size, at = [0, 0]) => ({ty: 'el', p: prop(at), s: prop(size)});
const path = (v, i, o, c = true) => ({ty: 'sh', ks: still({v, i, o, c})});
const line = (a, b) => path([a, b], [[0, 0], [0, 0]], [[0, 0], [0, 0]], false);
const group = (items, tr = {}) => ({ty: 'gr', it: [...items, {ty: 'tr', p: prop(tr.p ?? [0, 0]), a: prop(tr.a ?? [0, 0]), s: prop(tr.s ?? [100, 100]), r: prop(tr.r ?? 0), o: prop(tr.o ?? 100)}]});
let index = 0;
const layer = (name, shapes, {ip = 0, op = 9999, ks = {}} = {}) => ({ddd: 0, ind: ++index, ty: 4, nm: name, sr: 1, ao: 0, bm: 0, ip, op, st: 0,
  ks: {o: prop(ks.o ?? 100), r: prop(ks.r ?? 0), p: prop(ks.p ?? [0, 0, 0]), a: prop(ks.a ?? [0, 0, 0]), s: prop(ks.s ?? [100, 100, 100])}, shapes});
const comp = (name, frames, layers, meta = {}) => ({v: '5.12.2', fr: 30, ip: 0, op: frames, w: W, h: H, nm: name, ddd: 0, assets: [], layers, meta: {g: 'library/_shared/presenters/generate.mjs', ...meta}});

const W = 520, H = 600;
const C = {capTop: '#f08a68', capRim: '#c8452e', spot: '#fbf0d9', spotShade: '#ecd6b0', gill: '#c49470', gillLine: '#8f5f44',
  skin: '#f6e6c8', skinShade: '#e7cda4', line: '#4a2c22', eye: '#24150f', cheek: '#f2897c', foot: '#9b6448', mouth: '#5b1d17', tongue: '#ee7a70'};
const OUT = 5, LOOP = 120;

// ----- body (idle loop, 4 s)
const blink = [[0, [100, 100]], [46, [100, 100]], [49, [100, 6]], [52, [100, 100]], [100, [100, 100]], [103, [100, 6]], [106, [100, 100]], [LOOP, [100, 100]]];
const eye = x => group([
  group([ellipse([14, 14], [9, 11]), fill('#ffffff', 85)]),
  group([ellipse([18, 20], [-8, -9]), fill('#ffffff')]),
  group([ellipse([46, 56]), fill(C.eye)]),
], {p: [x, 330], s: blink});
// cap dome: left rim, top, right rim, underside middle
const dome = path([[34, 262], [260, 34], [486, 262], [260, 282]], [[80, 30], [-170, 0], [0, -160], [160, 0]], [[0, -160], [170, 0], [-80, 30], [-160, 0]]);
const gillLines = Array.from({length: 17}, (_, k) => { const a = Math.PI * (k + 1) / 18; return line([260 + 120 * Math.cos(a), 262 + 14 * Math.sin(a)], [260 + 205 * Math.cos(a), 266 + 40 * Math.sin(a)]); });
const cap = group([
  // highlight, spots (light shade under each), dome; first item draws on top
  group([path([[96, 186], [170, 92], [250, 64]], [[0, 0], [-30, 40], [-34, 6]], [[14, -46], [34, -18], [0, 0]], false), stroke('#ffffff', 12, 35)]),
  ...[[[96, 72], [262, 96]], [[74, 54], [140, 168]], [[70, 50], [384, 168]], [[48, 36], [190, 96]], [[44, 34], [340, 92]], [[52, 40], [262, 196]], [[34, 28], [78, 228]], [[36, 28], [446, 226]], [[24, 20], [214, 222]]]
    .flatMap(([s, p]) => [group([ellipse(s, p), fill(C.spot)]), group([ellipse([s[0], s[1] * .9], [p[0] + 3, p[1] + 5]), fill(C.spotShade)])]),
  group([dome, gradient([[0, C.capTop], [1, C.capRim]], [260, 40], [260, 280]), stroke(C.line, OUT)]),
], {p: [260, 270], a: [260, 270], r: [[0, -2], [60, 2], [LOOP, -2]]});
const gills = group([
  group([...gillLines, stroke(C.gillLine, 3)]),
  group([ellipse([420, 92], [260, 268]), fill(C.gill), stroke(C.line, OUT)]),
], {p: [260, 270], a: [260, 270], r: [[0, -2], [60, 2], [LOOP, -2]]});
// head + body: fills drawn over a fat outline of the same shapes, so only the outer silhouette is outlined (each shape
// filled in its own group: two paths in one fill cancel where they overlap if they wind opposite ways)
const headShape = () => ({ty: 'rc', p: still([260, 336]), s: still([262, 196]), r: still(96)});
const bellyShape = () => ellipse([236, 196], [260, 456]);
const skin = group([
  group([ellipse([150, 70], [260, 510]), fill(C.skinShade, 60)]),
  group([headShape(), fill(C.skin)]),
  group([bellyShape(), fill(C.skin)]),
  group([headShape(), bellyShape(), stroke(C.line, OUT * 2)]),
]);
const arm = (side, swing) => group([group([ellipse([46, 74], [0, 30]), fill(C.skin), stroke(C.line, OUT)])], {p: [260 + side * 112, 424], a: [0, 0], r: swing});
const body = comp('mushroom-body', LOOP, [
  layer('cap', [cap]),
  layer('face', [eye(214), eye(306), group([ellipse([46, 22], [176, 370]), fill(C.cheek, 75)]), group([ellipse([46, 22], [344, 370]), fill(C.cheek, 75)])]),
  layer('skin', [skin]),
  layer('arms', [arm(-1, [[0, 18], [60, 6], [LOOP, 18]]), arm(1, [[0, -18], [60, -6], [LOOP, -18]])]),
  layer('gills', [gills]),
  layer('feet', [group([ellipse([74, 40], [212, 552]), fill(C.foot), stroke(C.line, OUT)]), group([ellipse([74, 40], [308, 552]), fill(C.foot), stroke(C.line, OUT)])]),
  layer('shadow', [group([ellipse([300, 34], [260, 574]), fill('#000000', 30)])]),
], {loop: true});

// ----- mouth: wide (0..M) and round (M+1..2M+1), centred at (260, 376)
const M = 20, at = [260, 376];
const openMouth = (size0, sizeM, tongue0, tongueM, o0) => [
  group([ellipse([[0, tongue0], [M, tongueM]], [[0, [260, 380]], [M, [260, 392]]]), fill(C.tongue)]),
  group([ellipse([[0, size0], [M, sizeM]], at), fill(C.mouth), stroke(C.line, 4)]),
].map(g => ({...g, it: g.it.map(x => x.ty === 'tr' ? {...x, o: prop(o0)} : x)}));
const smile = group([path([[244, 372], [276, 372]], [[0, 0], [-10, 0]], [[10, 10], [0, 0]], false), stroke(C.line, 5)], {o: [[0, 100], [3, 0], [M, 0]]});
const mouth = comp('mushroom-mouth', 2 * M + 2, [
  layer('wide-smile', [smile], {ip: 0, op: M + 1}),
  layer('wide', openMouth([34, 6], [58, 44], [10, 4], [34, 18], [[0, 0], [3, 100], [M, 100]]), {ip: 0, op: M + 1}),
  layer('round-smile', [smile], {ip: M + 1, op: 2 * M + 2, ks: {}}),
  layer('round', openMouth([18, 10], [36, 46], [6, 4], [20, 14], [[0, 0], [3, 100], [M, 100]]), {ip: M + 1, op: 2 * M + 2}),
].map(l => (l.ip > 0 ? {...l, st: M + 1} : l)), {mouthFrames: M});

const dir = new URL('mushroom/', import.meta.url);
mkdirSync(dir, {recursive: true});
writeFileSync(new URL('body.json', dir), JSON.stringify(body));
writeFileSync(new URL('mouth.json', dir), JSON.stringify(mouth));
console.log('Wrote library/_shared/presenters/mushroom/{body,mouth}.json');

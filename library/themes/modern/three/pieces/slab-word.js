import {stage3, C, F, STEP, span, snap, punch, easeIn, clamp, hash} from './_scene.js';

// A big word built from slabs: each heavy Montserrat capital is cut into tall vertical white slabs
// (one per column run of the letter). Letters arrive in a scattered order, their slabs dropping in
// column by column with a small overshoot, translucent (the ghost) until the letter locks solid.
// The camera holds three-quarter on and turns a notch per bar; at the end the letters drop out
// again in a new order. "Built to last", "the launch", any one-word title.
export const meta = {duration: 7};
export const defaults = {clear: false, word: 'BUILD'};
const ROWS = 14, GAP = .14;

function slabs(ch) {
  const c = document.createElement('canvas'), x = c.getContext('2d'), px = 400;
  x.font = `800 ${px}px ${F.head}`; const cap = x.measureText('H').actualBoundingBoxAscent || px * .7, w = Math.ceil(x.measureText(ch).width);
  const cell = cap / ROWS, cols = Math.max(1, Math.round(w / cell));
  c.width = cols * cell + 2; c.height = Math.ceil(cap + 2); x.font = `800 ${px}px ${F.head}`; x.fillStyle = '#fff'; x.textBaseline = 'alphabetic'; x.fillText(ch, 0, cap);
  const d = x.getImageData(0, 0, c.width, c.height).data, on = (i, j) => d[(Math.floor((j + .5) * cell) * c.width + Math.floor((i + .5) * cell)) * 4 + 3] > 110;
  const out = [];
  for (let i = 0; i < cols; i++) { let j = 0; while (j < ROWS) { if (!on(i, j)) { j++; continue; } const j0 = j; while (j < ROWS && on(i, j)) j++; out.push({i, j0, len: j - j0}); } }
  return {cols, list: out};
}

export function mount(el, props = defaults) {
  const s = stage3(el, props, {fov: 30}), {T, scene, camera} = s, str = String(props.word ?? 'BUILD').toUpperCase().slice(0, 9);
  scene.add(new T.AmbientLight(0xffffff, .55));
  const key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 6, 8); scene.add(key);
  const rim = new T.DirectionalLight(0xffd9b8, .9); rim.position.set(6, 2, -4); scene.add(rim);
  const word = new T.Group(); scene.add(word);
  const geo = new T.BoxGeometry(1 - GAP, 1, 1.6);
  let x = 0; const letters = [...str].map((ch, li) => {
    if (ch === ' ') { x += ROWS * .35; return null; }
    const {cols, list} = slabs(ch), m = new T.MeshStandardMaterial({color: C.white, roughness: .55, metalness: .05, transparent: true});
    const g = new T.Group(); word.add(g);
    const parts = list.map(({i, j0, len}) => { const b = new T.Mesh(geo, m); b.scale.y = len - GAP; b.userData = {x: x + i + .5, y: ROWS - j0 - len / 2, col: i}; g.add(b); return b; });
    x += cols + 1.2; return {g, m, parts, cols};
  }).filter(Boolean);
  const total = x - 1.2, k = 1 / ROWS;
  word.scale.setScalar(k * Math.min(1.3, 5.6 / Math.max(1, total * k)));
  word.position.set(-total / 2 * word.scale.x, -ROWS / 2 * word.scale.y, 0);
  const n = letters.length, rank = sd => [...Array(n).keys()].sort((a, b) => hash(a + 1, sd) - hash(b + 1, sd)).reduce((r, idx, j) => (r[idx] = j, r), []);
  const rIn = rank(4), rOut = rank(21), OUT = meta.duration - 1.4;
  return {seek(t) {
    s.hold(1);
    const bar = Math.floor(t / (STEP * 8)), turn = bar + punch(span(t % (STEP * 8), 0, STEP * 2));
    const a = -.42 + Math.min(turn, 3) * .1, r = 13;
    camera.position.set(Math.sin(a) * r, 2.2, Math.cos(a) * r); camera.lookAt(0, 0, 0);
    letters.forEach((L, li) => {
      const tin = .3 + rIn[li] * STEP, tout = OUT + rOut[li] * STEP * .6, solid = t >= tin + STEP * 2 && t < tout;
      L.m.opacity = solid ? 1 : .26; L.m.depthWrite = solid;
      L.parts.forEach(b => {
        const u = b.userData, q = punch(span(t, tin + u.col * .025, STEP * 1.8)), o = easeIn(span(t, tout + u.col * .02, STEP * 1.5));
        b.position.set(u.x, u.y + (1 - q) * ROWS * 1.2 - o * ROWS * 1.4, 0);
        b.visible = q > 0 && o < 1;
      });
    });
    s.render(t);
  }};
}

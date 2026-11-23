// Shared plumbing for the modern 3D scenes (the underscore keeps it out of piece ids).
// The theme's look in WebGL: a near-black charcoal ground (the element's CSS background, with the
// kit's grain over it; `clear: true` leaves it transparent for footage), flat picture panels painted
// with the kit's studio-light TONES as canvas textures (no lights needed: the light is in the
// picture), white or charcoal everything else, and the kit's beat (snap = expo-out arrivals).
// Three.js r160 core only (no addons). Everything is set from seek(t): no clocks, no Math.random.
import {C, F, TONES, STEP, toneOf, hash, clamp, span, mix, snap, punch, io, easeIn, grainURL} from '../../kit.js';
export {C, F, TONES, STEP, toneOf, hash, clamp, span, mix, snap, punch, io, easeIn};

const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const texCache = new Map();

/** A studio-light picture (a kit TONE) as a canvas texture, w x h px, with fine grain. Cached. */
export function toneTexture(name, w = 256, h = 512, seed = 1) {
  const T = window.THREE, key = `${toneOf(name)}:${w}:${h}:${seed}`;
  if (texCache.has(key)) return texCache.get(key);
  const tone = TONES[toneOf(name)], c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), cx = tone.at[0] * w, cy = tone.at[1] * h, r = Math.hypot(w, h) * .95;
  const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  tone.stops.forEach((s, i) => gr.addColorStop([0, .28, .7, 1][i], s));
  x.fillStyle = gr; x.fillRect(0, 0, w, h);
  const d = x.getImageData(0, 0, w, h), rnd = mulberry(977 + seed);
  for (let i = 0; i < d.data.length; i += 4) { const n = (rnd() - .5) * 18; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
  x.putImageData(d, 0, 0);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  texCache.set(key, tex); return tex;
}

/** Text drawn to a canvas texture: {tex, aspect}. Heavy Montserrat capitals by default. */
export function textTexture(str, {size = 160, font = F.head, weight = 800, color = C.white, track = .04, pad = .2} = {}) {
  const T = window.THREE, c = document.createElement('canvas'), x = c.getContext('2d'), f = `${weight} ${size}px ${font}`;
  x.font = f; const chars = [...String(str)], ws = chars.map(ch => x.measureText(ch).width), w = ws.reduce((a, b) => a + b, 0) + track * size * Math.max(0, chars.length - 1);
  c.width = Math.ceil(w + size * pad * 2); c.height = Math.ceil(size * (1 + pad * 2));
  x.font = f; x.fillStyle = color; x.textBaseline = 'middle';
  let px = size * pad; chars.forEach((ch, i) => { x.fillText(ch, px, c.height / 2 + size * .04); px += ws[i] + track * size; });
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  return {tex, aspect: c.width / c.height, canvas: c};
}

/** A flat picture panel (w x h world units) showing a tone or an image URL, centred on its origin. */
export function picture(w, h, {tone = 'ember', image = null, seed = 1, side = 'double'} = {}) {
  const T = window.THREE, mat = new T.MeshBasicMaterial({map: image ? null : toneTexture(tone, 256, Math.round(256 * h / w), seed), side: side === 'double' ? T.DoubleSide : T.FrontSide, transparent: true});
  if (image) new T.TextureLoader().load(image, tex => { tex.colorSpace = T.SRGBColorSpace; const a = tex.image.width / tex.image.height, b = w / h;
    if (a > b) { tex.repeat.set(b / a, 1); tex.offset.set((1 - b / a) / 2, 0); } else { tex.repeat.set(1, a / b); tex.offset.set(0, (1 - a / b) / 2); } mat.map = tex; mat.needsUpdate = true; });
  return new T.Mesh(new T.PlaneGeometry(w, h), mat);
}

/** Thin white rectangle outline (w x h) as a mesh of four flat bars, `t` thick. */
export function frame(w, h, t = .02, color = C.white) {
  const T = window.THREE, g = new T.Group(), m = new T.MeshBasicMaterial({color, transparent: true});
  for (const [bw, bh, x, y] of [[w + t, t, 0, h / 2], [w + t, t, 0, -h / 2], [t, h, -w / 2, 0], [t, h, w / 2, 0]]) { const b = new T.Mesh(new T.PlaneGeometry(bw, bh), m); b.position.set(x, y, 0); g.add(b); }
  g.material = m; return g;
}

/**
 * A 3D stage in the theme's look. Returns {T, scene, camera, renderer, render(t), hold(minAspect), clear}.
 * Call render(t) at the end of seek.
 */
export function stage3(el, props = {}, {fov = 35, near = .1, far = 200} = {}) {
  const T = window.THREE, clear = Boolean(props.clear);
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.style.background = clear ? 'transparent' : `radial-gradient(120% 80% at 50% 42%, #252528 0%, ${C.bg} 55%, #131314 100%)`;
  const renderer = new T.WebGLRenderer({antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true});
  renderer.setClearColor(0x000000, 0);
  const cv = renderer.domElement; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; el.append(cv);
  const grain = clear ? null : (() => { const d = document.createElement('div'); d.style.cssText = `position:absolute;inset:0;pointer-events:none;background-image:url(${grainURL()});background-size:256px 256px;opacity:.55;mix-blend-mode:overlay`; el.append(d); return d; })();
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(fov, 1, near, far);
  const fit = () => { const cw = el.clientWidth || 600, ch = el.clientHeight || 600; renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(cw, ch, false); camera.aspect = cw / ch; camera.updateProjectionMatrix(); };
  fit();
  let last = 0;
  const draw = () => renderer.render(scene, camera);
  const render = t => { last = t; if (grain) { const s = Math.floor(t * 12); grain.style.backgroundPosition = `${Math.round(hash(s, 1) * 256)}px ${Math.round(hash(s, 2) * 256)}px`; } draw(); };
  const observer = new ResizeObserver(() => { fit(); hold(minA); draw(); }); observer.observe(el);
  el.__dispose = () => { observer.disconnect(); renderer.dispose(); renderer.forceContextLoss(); };
  /** On frames narrower than `minAspect`, widen the vertical field of view so the subject keeps its width. */
  let minA = .85; const fov0 = fov;
  const hold = (minAspect = minA) => { minA = minAspect; const a = camera.aspect, f = a >= minAspect ? fov0 : 2 * Math.atan(Math.tan(fov0 * Math.PI / 360) * minAspect / a) * 180 / Math.PI; if (Math.abs(camera.fov - f) > 1e-3) { camera.fov = f; camera.updateProjectionMatrix(); } };
  return {T, scene, camera, renderer, render, hold, clear};
}

/** Beat-snapped progress: the value steps on the beat grid with an expo-out landing inside each step. */
export const stepped = (t, step = STEP * 4, land = STEP * 1.5) => { const k = Math.floor(t / step); return k + snap((t - k * step) / land); };

/**
 * THE BIG WORD in 3D: one plane per letter (heavy white capitals), centred on the group's origin,
 * `height` world units for the cap height. seek(t, {at, step, hold, out, outStep}) builds letters in a
 * scattered order through a ghost (translucent) state to solid, and drops them out the same way.
 */
export function word3(str, height = 1, {seed = 3, color = C.white, track = .06, ghost = .26} = {}) {
  const T = window.THREE, chars = [...String(str)], g = new T.Group(), px = 200, ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `800 ${px}px ${F.head}`;
  const cap = ctx.measureText('H').actualBoundingBoxAscent || px * .7, k = height / cap;
  const ws = chars.map(ch => ctx.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0) + track * px * Math.max(0, chars.length - 1);
  let x = -total / 2;
  const letters = chars.map((ch, i) => {
    const tt = textTexture(ch, {size: px, color, track: 0, pad: .2}), m = new T.MeshBasicMaterial({map: tt.tex, transparent: true, depthWrite: false});
    const h = tt.canvas.height * k, w = tt.canvas.width * k, mesh = new T.Mesh(new T.PlaneGeometry(w, h), m);
    mesh.position.set((x + ws[i] / 2) * k, -px * .04 * k + (px * .5 - cap / 2) * k * 0, 0); x += ws[i] + track * px;
    g.add(mesh); return {mesh, m, y0: mesh.position.y};
  });
  const n = letters.length, rank = (s) => [...Array(n).keys()].sort((a, b) => hash(a + 1, s) - hash(b + 1, s)).reduce((r, idx, j) => (r[idx] = j, r), []);
  const rIn = rank(seed), rOut = rank(seed + 17);
  return {group: g, letters, width: total * k,
    seek(t, {at = 0, step = .055, hold = .09, out = null, outStep = null} = {}) {
      letters.forEach((l, i) => {
        const tin = at + rIn[i] * step, tout = out == null ? Infinity : out + rOut[i] * (outStep ?? step);
        let s = t < tin ? 0 : t < tin + hold ? 1 : 2, drop = 0;
        if (t >= tout) { s = t < tout + hold ? 1 : 0; drop = clamp((t - tout) / hold) * height * .2; }
        l.mesh.visible = s > 0; l.m.opacity = s >= 2 ? 1 : ghost; l.mesh.position.y = l.y0 - drop;
      });
    }};
}

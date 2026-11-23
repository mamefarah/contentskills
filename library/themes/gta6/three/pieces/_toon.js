// Shared plumbing for this theme's 3D scenes (not a piece itself: the underscore keeps it out of piece ids).
// The bundled Three.js is the core build with no post-processing, so the comic look is hand-written:
//   scene -> offscreen target. Every material writes a flat cel colour to RGB and an "ink id" to alpha.
//   post  -> wherever the ink id changes between neighbouring pixels, a dark outline is drawn.
// Flat shading comes from screen-space derivatives, so any geometry reads as faceted low-poly; light
// falls in three hard bands, shadows lean violet, and faces turned toward the sun get a warm rim.
// All original code.
import {C, F, GRADS} from '../../coast.js';

export const v3 = color => { const n = parseInt(color.slice(1), 16); return new window.THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
const glv = color => { const v = v3(color); return `vec3(${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)})`; };
/** Seeded 0..1 hash for building geometry (never Math.random: pieces must be repeatable). */
export const rand = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const GLSL = /* glsl */`
uniform float uTime;
const vec3 INK = ${glv(C.ink)}, PAPER = ${glv(C.paper)}, PINK = ${glv(C.pink)}, ORANGE = ${glv(C.orange)}, YELLOW = ${glv(C.yellow)}, TEAL = ${glv(C.teal)}, AQUA = ${glv(C.aqua)}, VIOLET = ${glv(C.violet)}, PLUM = ${glv(C.plum)}, NIGHT = ${glv(C.night)};
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;
const VERT = /* glsl */`varying vec3 vView, vObj; varying vec2 vUv;
void main() { vObj = position; vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vView = mv.xyz; gl_Position = projectionMatrix * mv; }`;
const TOON = /* glsl */`
uniform vec3 uColor; uniform float uId, uFacet, uWin, uLit; varying vec3 vView, vObj;
void main() {
  vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
  float l = dot(n, normalize(vec3(.45, .75, .5))), band = l > .45 ? 1. : l > .05 ? .78 : .56;
  vec3 base = uColor;
  if (uWin > 0.) {                                           // rows of windows on upright faces, some lit
    vec2 g = vec2(vObj.x + vObj.z, vObj.y) * uWin, f = fract(g);
    float on = step(.22, f.x) * step(f.x, .78) * step(.3, f.y) * step(f.y, .78) * step(abs(normalize(cross(dFdx(vObj), dFdy(vObj))).y), .5);
    base = mix(base, mix(vec3(.23, .1, .47), vec3(1., .97, .7), step(1. - uLit, hash2(floor(g)))), on);
  }
  vec3 col = mix(base * vec3(.42, .3, .72) + vec3(.06, .02, .12), base, band);
  float rim = step(.5, dot(n, normalize(vec3(-.75, .25, .2)))) * (1. - step(.45, l));
  col = mix(col, mix(col, vec3(1., .62, .25), .6), rim);
  gl_FragColor = vec4(col, fract(uId + uFacet * (n.x * .23 + n.y * .37 + n.z * .11)));
}`;
const SKY = /* glsl */`
uniform vec2 uSun, uRes; uniform float uSunR, uHorizon, uRays, uSpin, uDots, uClouds; uniform vec3 c0, c1, c2, c3; varying vec2 vUv;
float bar(vec2 p, vec2 c, vec2 h) { vec2 d = abs(p - c) - h + h.y; return length(max(d, 0.)) - h.y; }
void main() {
  float aspect = uRes.x / uRes.y, k = clamp((vUv.y - uHorizon) / (1. - uHorizon), 0., 1.);
  vec3 col = k < .22 ? mix(c0, c1, k / .22) : k < .55 ? mix(c1, c2, (k - .22) / .33) : mix(c2, c3, (k - .55) / .45);
  vec2 d = (vUv - uSun) * vec2(aspect, 1.); float r = length(d), ang = atan(d.y, d.x);
  col = mix(col, col + vec3(.16, .12, .02), uRays * step(.5, fract(ang * 8. / 6.2832 + uSpin)) * smoothstep(1.4, .1, r));
  vec2 g = mat2(.7071, -.7071, .7071, .7071) * (vUv * vec2(aspect, 1.)) * 46.;
  col = mix(col, c3 * .62, uDots * step(length(fract(g) - .5), (k - .4) * .62) * .55);
  float a = 0.;
  vec2 p = vUv * vec2(aspect, 1.);
  for (int i = 0; i < 4; i++) { float fi = float(i); vec2 c = vec2(fract(.17 + fi * .37 + uTime * .006 * (1. + fi * .3)) * (aspect + .8) - .4, uHorizon + (1. - uHorizon) * (.34 + fi * .17));
    float m = min(bar(p, c, vec2(.2, .012)), min(bar(p, c + vec2(-.05, -.034), vec2(.27, .012)), bar(p, c + vec2(.04, -.068), vec2(.15, .012))));
    col = mix(col, PAPER, uClouds * step(m, 0.) * .8); }
  if (r < uSunR) { float sy = d.y / uSunR, cut = step(sy, .05) * step(.6, fract(pow(max(.05 - sy, 0.), .85) * 5.2));
    if (cut < .5) { col = mix(vec3(1., .96, .62), vec3(1., .45, .5), clamp(.55 - sy * .6, 0., 1.)); a = .5; } }
  gl_FragColor = vec4(col, a);
}`;
const WATER = /* glsl */`
uniform vec3 uA, uB; uniform vec2 uFlow; uniform float uWake, uGlint; varying vec3 vObj;
void main() {
  vec2 p = vObj.xy + uFlow * uTime; float far = clamp(length(vObj.xy) / 60., 0., 1.);
  float row = floor(p.y * .8), off = hash2(vec2(row, 3.)) * 6., x = p.x * .55 + off + sin(uTime * .8 + row) * .3;
  float crest = step(.82, sin(x * 3.1416) * .5 + .5) * step(abs(fract(p.y * .8) - .5 - .18 * sin(x * 3.1416)), .09) * step(.35, hash2(vec2(row, floor(x * .5))));
  vec3 col = mix(uA, uB, clamp(far * 1.5, 0., 1.));
  col = mix(col, vec3(1., .85, .45), uGlint * smoothstep(3.5, 0., abs(vObj.x)) * step(.5, fract(p.y * .45 + sin(p.x * 2.) * .1)) * .7);
  col = mix(col, PAPER, crest * (1. - far) * .9);
  float wake = 0.;
  if (uWake > 0.) { float back = -vObj.y, s = abs(vObj.x); wake = step(0., back) * (step(abs(s - back * .34 - .6), .16 + back * .035) * step(.3, fract(back * .35 - uTime * 2.)) + step(s, 1.) * step(back, 9.) * step(.35, fract(back * .8 - uTime * 3. + s))) * smoothstep(34., 4., back); col = mix(col, PAPER, clamp(wake, 0., 1.)); }
  gl_FragColor = vec4(col, .2 + .12 * step(.5, wake));
}`;
const POST = /* glsl */`
uniform sampler2D tMap; uniform vec2 uPx; uniform float uInk, uClear; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tMap, vUv); float e = 0.;
  for (int i = 0; i < 8; i++) { float a = float(i) * .7854; vec2 o = vec2(cos(a), sin(a)) * uPx * uInk; e = max(e, abs(texture2D(tMap, vUv + o).a - c.a)); e = max(e, abs(texture2D(tMap, vUv + o * .5).a - c.a)); }
  float ink = smoothstep(.012, .03, e);
  if (uClear > .5) {                       // see-through: the cleared background (magenta, never a scene colour) shows the footage; outlines stay
    float bg = step(distance(c.rgb, vec3(1., 0., 1.)), .02), a = max(1. - bg, ink); vec3 col = mix(bg > .5 ? INK : c.rgb, INK, ink);
    gl_FragColor = vec4(col, a); return;
  }
  gl_FragColor = vec4(mix(c.rgb, INK, ink), 1.);
}`;

/**
 * A comic-shaded Three.js stage. Returns:
 *   T, scene, camera
 *   toon(color, {facet, win, lit})   cel material; facet 0 for smooth round things, win > 0 adds windows
 *   flat(color)                      unshaded colour (signs, lights); glow(color, strength) additive halo
 *   mesh(geometry, color, opts)      shorthand: adds a toon mesh to the scene (or opts.parent)
 *   box(w, h, d, color, opts), cyl(rTop, rBottom, h, sides, color, opts)
 *   sky({sun, sunR, horizon, rays, dots, clouds, colors})  full-frame backdrop; returns its uniforms
 *   water({a, b, flow, wake, glint, size, y})  shader water plane
 *   art(draw, w, h)                  a plane textured from a 2D canvas you draw (lettering, bank notes, coin faces)
 *   palm({h, lean, trunk, leaf})     low-poly palm tree group (not yet added to the scene)
 *   play(draw)                       -> {seek}: sets uTime, calls draw(t), renders; redraws on resize
 */
export function toonStage(el, {fov = 40, ink = 1, clear = false} = {}) {
  // clear: no backdrop, the picture is see-through where nothing is drawn (for pieces laid over footage). Straight alpha:
  // a premultiplied clear would turn the magenta background marker black.
  const T = window.THREE, renderer = new T.WebGLRenderer({antialias: false, preserveDrawingBuffer: true, alpha: clear, premultipliedAlpha: false});
  renderer.outputColorSpace = T.LinearSRGBColorSpace; renderer.toneMapping = T.NoToneMapping; renderer.setClearColor(clear ? 0xff00ff : 0x000000, 0);
  el.append(renderer.domElement);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(fov, 1, .1, 600), U = {uTime: {value: 0}};
  const target = new T.WebGLRenderTarget(4, 4, {minFilter: T.LinearFilter, magFilter: T.LinearFilter});
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2)); quad.frustumCulled = false;
  const QUAD_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }`;
  const post = new T.ShaderMaterial({uniforms: {tMap: {value: target.texture}, uPx: {value: new T.Vector2()}, uInk: {value: 1}, uClear: {value: clear ? 1 : 0}}, vertexShader: QUAD_VS, fragmentShader: GLSL + POST, depthTest: false});
  quad.material = post; const quadScene = new T.Scene().add(quad), quadCamera = new T.Camera(), size = new T.Vector2();
  let skyU = null, ids = 0, redraw = null;
  const fit = () => { const w = el.clientWidth || 600, h = el.clientHeight || 600; renderer.setPixelRatio(Math.max(1, Math.min(2, 1300 / Math.max(w, h)))); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  fit();
  const render = () => {
    renderer.getDrawingBufferSize(size); if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
    post.uniforms.uPx.value.set(1 / size.x, 1 / size.y); post.uniforms.uInk.value = ink * size.y / 400; if (skyU) skyU.uRes.value.copy(size);
    renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(quadScene, quadCamera);
  };
  const observer = new ResizeObserver(() => { fit(); redraw?.(); }); observer.observe(el);
  // Browsers allow only a handful of WebGL contexts; whoever removes the piece should call this.
  el.__dispose = () => { observer.disconnect(); target.dispose(); renderer.dispose(); renderer.forceContextLoss(); };
  const shader = (vs, fs, uniforms, options = {}) => new T.ShaderMaterial({uniforms: {...uniforms, ...U}, vertexShader: vs, fragmentShader: GLSL + fs, side: T.DoubleSide, ...options});
  const nextId = () => (.13 + (++ids * .171) % .8);
  const toon = (color, {facet = 1, win = 0, lit = .5, id = null} = {}) => shader(VERT, TOON, {uColor: {value: v3(C[color] ?? color)}, uId: {value: id ?? nextId()}, uFacet: {value: facet}, uWin: {value: win}, uLit: {value: lit}});
  const flat = (color, id = null) => shader(VERT, `uniform vec3 uColor; uniform float uId, uGain; void main() { gl_FragColor = vec4(uColor * uGain, uId); }`, {uColor: {value: v3(C[color] ?? color)}, uId: {value: id ?? nextId()}, uGain: {value: 1}});
  const additive = {transparent: true, depthWrite: false, blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor};
  const glow = (color, strength = .5) => shader(VERT, `uniform vec3 uColor; uniform float uGain; varying vec2 vUv; void main() { float d = length(vUv - .5) * 2.; gl_FragColor = vec4(uColor * uGain * smoothstep(1., 0., d) * smoothstep(1., 0., d), 0.); }`, {uColor: {value: v3(C[color] ?? color)}, uGain: {value: strength}}, additive);
  const mesh = (geometry, color, opts = {}) => { const m = new T.Mesh(geometry, typeof color === 'string' ? toon(color, opts) : color); (opts.parent ?? scene).add(m); if (opts.at) m.position.set(...opts.at); return m; };
  const box = (w, h, d, color, opts) => mesh(new T.BoxGeometry(w, h, d), color, opts);
  const cyl = (r0, r1, h, sides, color, opts) => mesh(new T.CylinderGeometry(r0, r1, h, sides), color, opts);
  const sky = ({sun = [.5, .5], sunR = .16, horizon = .4, rays = 0, dots = 1, clouds = 1, colors = [C.yellow, C.orange, C.pink, '#4a22b8']} = {}) => {
    skyU = {uSun: {value: new T.Vector2(...sun)}, uRes: {value: new T.Vector2(1, 1)}, uSunR: {value: sunR}, uHorizon: {value: horizon}, uRays: {value: rays}, uSpin: {value: 0}, uDots: {value: dots}, uClouds: {value: clouds}, c0: {value: v3(colors[0])}, c1: {value: v3(colors[1])}, c2: {value: v3(colors[2])}, c3: {value: v3(colors[3])}};
    const m = new T.Mesh(new T.PlaneGeometry(2, 2), shader(QUAD_VS, SKY, skyU, {depthTest: false, depthWrite: false})); m.frustumCulled = false; m.renderOrder = -10; scene.add(m); return skyU;
  };
  const water = ({a = C.teal, b = '#0a6f9e', flow = [0, 0], wake = 0, glint = 1, size = 400, y = 0} = {}) => {
    const u = {uA: {value: v3(a)}, uB: {value: v3(b)}, uFlow: {value: new T.Vector2(...flow)}, uWake: {value: wake}, uGlint: {value: glint}};
    const m = new T.Mesh(new T.PlaneGeometry(size, size), shader(VERT, WATER, u)); m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); m.u = u; return m;
  };
  /** A plane showing a 2D drawing: draw(ctx, w, h) paints a canvas; transparent pixels are cut away. `w` world units wide. */
  const art = (draw, w = 2, px = [512, 256]) => {
    const canvas = document.createElement('canvas'); canvas.width = px[0]; canvas.height = px[1]; const ctx = canvas.getContext('2d'); draw(ctx, px[0], px[1]);
    const texture = new T.CanvasTexture(canvas); texture.minFilter = T.LinearFilter; texture.generateMipmaps = false;
    const u = {tMap: {value: texture}, uId: {value: nextId()}, uGain: {value: 1}};
    const m = new T.Mesh(new T.PlaneGeometry(w, w * px[1] / px[0]), shader(VERT, `uniform sampler2D tMap; uniform float uId, uGain; varying vec2 vUv; void main() { vec4 c = texture2D(tMap, vUv); if (c.a < .5) discard; gl_FragColor = vec4(c.rgb * uGain, uId); }`, u)); m.u = u; return m;
  };
  const palm = ({h = 4, lean = .25, trunk = '#8a4a3a', leaf = C.teal, seed = 1} = {}) => {
    const g = new T.Group(), tm = toon(trunk), lm = toon(leaf), top = new T.Group();
    for (let i = 0; i < 4; i++) { const s = new T.Mesh(new T.CylinderGeometry(.2 - i * .022, .25 - i * .022, h / 4 + .03, 5), tm); s.position.set(Math.sin(i / 3 * 1.2) * lean * h * .3, h / 8 + i * h / 4, 0); s.rotation.z = -lean * (i / 3) * .9; g.add(s); }
    top.position.set(Math.sin(1.2) * lean * h * .3 + lean * .2, h, 0); g.add(top);
    for (let i = 0; i < 9; i++) { const pivot = new T.Group(), geo = new T.ConeGeometry(.36, 3, 4); geo.translate(0, 1.5, 0); geo.scale(1, 1, .4); const l = new T.Mesh(geo, lm); l.rotation.z = -.95 - rand(i * 3 + seed) * 1.05; pivot.rotation.y = i / 9 * 6.283 + rand(seed) * 3; pivot.add(l); top.add(pivot); }
    const nut = new T.Mesh(new T.IcosahedronGeometry(.3, 0), tm); top.add(nut); g.crown = top; return g;
  };
  const play = draw => { let last = 0; redraw = () => { draw(last); render(); }; return {seek(t) { last = t; U.uTime.value = t; draw(t); render(); }}; };
  /** Paint chunky outlined lettering onto a 2D canvas (for art()). */
  const letter = (ctx, text, x, y, size, {font = F.display, fill = 'hot', outline = .09, align = 'center'} = {}) => {
    ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.lineJoin = 'round'; ctx.textBaseline = 'alphabetic';
    const g = ctx.createLinearGradient(0, y - size * .8, 0, y + size * .1); for (const [at, c] of GRADS[fill] ?? [[0, C[fill] ?? fill], [1, C[fill] ?? fill]]) g.addColorStop(at, c);
    ctx.strokeStyle = C.ink; ctx.lineWidth = size * outline * 2; ctx.fillStyle = C.ink; ctx.strokeText(text, x + size * .06, y + size * .06); ctx.strokeText(text, x, y); ctx.fillStyle = g; ctx.fillText(text, x, y);
  };
  return {T, renderer, scene, camera, U, toon, flat, glow, mesh, box, cyl, sky, water, art, palm, play, letter, additive, shader, VERT};
}

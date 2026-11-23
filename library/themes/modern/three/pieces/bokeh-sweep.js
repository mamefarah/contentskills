import {stage3, TONES, toneOf, C, STEP, span, snap, io, hash, clamp} from './_scene.js';

// Out-of-focus studio light over charcoal: soft discs of warm and cool light (the kit's picture tones)
// hang at different depths, breathing slightly, while a broad white light sweep crosses the frame on
// a slow diagonal every few seconds and lifts the discs it passes. A quiet backdrop for titles and
// lower thirds. Loops.
export const meta = {duration: 8, loop: true};
export const defaults = {clear: false, count: 70, tones: ['ember', 'sand', 'teal', 'steel', 'rose'], sweeps: 2};

const VS = /* glsl */`
attribute float aSize, aSeed; attribute vec3 aColor; uniform float uTime, uPx, uSweep, uLoop; varying vec3 vC; varying float vA, vEdge;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
  float breathe = .85 + .15 * sin(6.2831853 * (uTime / uLoop + aSeed));
  vec2 ndc = gl_Position.xy / gl_Position.w; float d = (ndc.x + ndc.y * .55) - uSweep;
  float lift = exp(-d * d * 5.);
  gl_PointSize = aSize * uPx / -mv.z * (1. + lift * .25); vC = mix(aColor, vec3(1.), lift * .35); vA = (.35 + .65 * lift) * breathe; vEdge = aSeed; }`;
const FS = /* glsl */`
varying vec3 vC; varying float vA, vEdge;
void main() { float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard;
  float disc = smoothstep(1., .86, r) * (.75 + .25 * smoothstep(.3, .95, r));
  gl_FragColor = vec4(vC * disc * vA, disc * vA); }`;
const BAND_FS = /* glsl */`
uniform float uSweep, uAmt; varying vec2 vUv;
void main() { vec2 p = vUv * 2. - 1.; float d = (p.x + p.y * .55) - uSweep; float a = (exp(-d * d * 7.) * .7 + exp(-d * d * 60.) * .3) * uAmt; gl_FragColor = vec4(vec3(1., .97, .92) * a * .34, a * .34); }`;

export function mount(el, props = defaults) {
  const s = stage3(el, props, {fov: 40}), {T, scene, camera, renderer} = s, N = Math.max(10, Math.min(200, props.count ?? 70)), tones = props.tones ?? defaults.tones;
  const pos = [], size = [], seed = [], col = [];
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  for (let i = 0; i < N; i++) {
    const z = -2 - hash(i, 1) * 14, spread = 1 + -z * .42;
    pos.push((hash(i, 2) - .5) * 2 * spread * 1.2, (hash(i, 3) - .5) * 2 * spread, z);
    size.push(.35 + hash(i, 4) * 1.1); seed.push(hash(i, 5));
    const tn = TONES[toneOf(tones[i % tones.length])]; col.push(...rgb(tn.stops[hash(i, 6) < .5 ? 0 : 1]));
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('aSize', new T.Float32BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new T.Float32BufferAttribute(seed, 1)); geo.setAttribute('aColor', new T.Float32BufferAttribute(col, 3));
  const uniforms = {uTime: {value: 0}, uPx: {value: 500}, uSweep: {value: -3}, uLoop: {value: meta.duration}};
  const pts = new T.Points(geo, new T.ShaderMaterial({vertexShader: VS, fragmentShader: FS, uniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending}));
  pts.frustumCulled = false; scene.add(pts);
  const bandU = {uSweep: {value: -3}, uAmt: {value: 1}};
  const band = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: BAND_FS, uniforms: bandU, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending}));
  band.frustumCulled = false; band.renderOrder = 2; scene.add(band);
  const sweeps = Math.max(1, Math.round(props.sweeps ?? 2)), per = meta.duration / sweeps;
  return {seek(t) {
    s.hold(.8);
    camera.position.set(0, 0, 4); camera.lookAt(0, 0, -10);
    const q = io(((t % per) / per)), sw = -2.1 + q * 4.2;
    uniforms.uTime.value = t; uniforms.uSweep.value = sw; bandU.uSweep.value = sw;
    uniforms.uPx.value = renderer.getDrawingBufferSize(new T.Vector2()).y / (2 * Math.tan(camera.fov * Math.PI / 360));
    s.render(t);
  }};
}

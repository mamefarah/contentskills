import {toonStage} from './_toon.js';

// Neon terrain: a low flight down a valley of wireframe mountains toward a slotted sun. The valley floor is flat and the
// ridges rise on both sides; the grid is drawn in the shader so its lines stay crisp and glow at any size, and they move
// with the terrain as the camera flies forward. Loops: one full period of the ridges per meta.duration.
export const meta = {duration: 6, loop: true};

const CELL = 2.5;                 // grid spacing (world units)
const P = CELL * 10;              // period of the ridges along the flight path (a whole number of cells, so the loop is seamless)
const HZ = .54;                   // horizon, as a fraction of the frame height from the bottom
const X_HALF = 200, Z_NEAR = 30, Z_FAR = -260, NX = 160, NZ = 200;
const clamp01 = v => Math.min(1, Math.max(0, v));

/** Height of the ground at sideways position x and flight-path position zz. Periodic in zz with period P. */
function height(x, zz) {
  const ph = 2 * Math.PI * zz / P, s = clamp01((Math.abs(x) - 12) / 48), valley = s * s * (3 - 2 * s);
  return valley * (10.5 * Math.sin(ph * 2 + x * .09) + 6.75 * Math.sin(ph * 3 - x * .14 + 1.7) + 3.75 * Math.sin(ph * 5 + x * .23));
}

// The ground: near-black violet, cyan grid lines that turn magenta into the distance. Its alpha is the ink id (.3, the
// sky is 0), so the horizon line gets a comic ink edge and the grid itself stays clean.
const TERRAIN_FS = /* glsl */`
uniform float uOff, uCell, uId; varying vec3 vView, vObj;
void main() {
  vec2 q = vec2(vObj.x, vObj.z + uOff) / uCell;
  vec2 fw = max(fwidth(q), vec2(1e-4));
  vec2 dd = abs(fract(q - .5) - .5) / fw;                  // distance to the nearest grid line, in pixels
  float d = min(dd.x, dd.y);
  float core = 1. - smoothstep(1.6, 2.6, d);
  float halo = 1. - smoothstep(2.6, 10., d);
  float fog = smoothstep(40., 230., length(vView));
  vec3 line = mix(vec3(.45, .96, .9), vec3(1., .24, .62), fog);
  vec3 ground = mix(vec3(.05, .01, .13), vec3(.2, .03, .24), fog);
  vec3 col = ground + line * (core * 1.25 + halo * .3);
  gl_FragColor = vec4(col, uId);
}`;

export function mount(el) {
  const {T, scene, camera, sky, play, shader, VERT} = toonStage(el, {fov: 62});
  sky({sun: [.5, HZ + .15], sunR: .2, horizon: 0, dots: 0, clouds: 0, colors: ['#ff3f97', '#7a1f8f', '#2b0c63', '#0d0530']});
  camera.position.set(0, 6, 10); camera.lookAt(0, 3.5, -40);

  const geometry = new T.BufferGeometry(), pos = new Float32Array((NX + 1) * (NZ + 1) * 3), index = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const k = (j * (NX + 1) + i) * 3;
    pos[k] = (i / NX - .5) * 2 * X_HALF; pos[k + 1] = 0; pos[k + 2] = Z_NEAR + (Z_FAR - Z_NEAR) * j / NZ;
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; index.push(a, c, b, b, c, d);
  }
  const attr = new T.BufferAttribute(pos, 3); attr.setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position', attr); geometry.setIndex(index);
  const material = shader(VERT, TERRAIN_FS, {uOff: {value: 0}, uCell: {value: CELL}, uId: {value: .3}});
  const ground = new T.Mesh(geometry, material); ground.frustumCulled = false; scene.add(ground);

  return play(t => {
    const off = ((t / meta.duration) * P) % P;
    material.uniforms.uOff.value = off;
    for (let j = 0; j <= NZ; j++) {
      const zz = Z_NEAR + (Z_FAR - Z_NEAR) * j / NZ + off;
      for (let i = 0; i <= NX; i++) pos[(j * (NX + 1) + i) * 3 + 1] = height((i / NX - .5) * 2 * X_HALF, zz);
    }
    attr.needsUpdate = true;
  });
}

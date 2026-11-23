import {toonStage, rand} from './_toon.js';
import {C, F, span} from '../../coast.js';

// A neon sign on a brick wall: a palm, a rising sun and a line of script switch on tube by tube,
// stutter, then hum, each with an inked edge and a soft halo. props.text is the sign's words.
export const meta = {duration: 5, live: true};
export const defaults = {text: 'Open late'};

export function mount(el, props = defaults) {
  const {T, scene, camera, flat, glow, mesh, art, play, letter, shader, VERT} = toonStage(el, {fov: 34, ink: .9});
  const wall = mesh(new T.PlaneGeometry(40, 40), shader(VERT, `varying vec3 vObj; void main() { vec2 p = vObj.xy * vec2(1.1, 2.2); p.x += step(.5, fract(p.y * .5)) * .5; vec2 f = fract(p); float mortar = step(f.x, .05) + step(f.y, .1);
    vec3 col = mix(vec3(.2, .08, .36), vec3(.27, .11, .45), hash2(floor(p))); col = mix(col, vec3(.11, .04, .22), min(mortar, 1.)); gl_FragColor = vec4(col * (1. - .25 * length(vObj.xy) / 9.), .1); }`, {})); wall.position.z = -.4;
  const tubes = [];
  const tube = (points, color, order, r = .11) => { const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(p[0], p[1], 0))), m = mesh(new T.TubeGeometry(curve, points.length * 8, r, 6), flat(color)), halo = mesh(new T.TubeGeometry(curve, points.length * 6, r * 6, 6), shader(VERT, `uniform vec3 uColor; uniform float uGain; void main() { gl_FragColor = vec4(uColor * uGain, 0.); }`, {uColor: m.material.uniforms.uColor, uGain: {value: .2}}, {transparent: true, depthWrite: false, blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor})); halo.position.z = -.2; tubes.push({m, halo, order}); };
  const arc = (cx, cy, r, a0, a1, n = 10) => Array.from({length: n + 1}, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  tube(arc(0, .2, 2.5, 0, Math.PI, 16), 'orange', 0); [.9, 1.5, 2].forEach((y, i) => { const hw = Math.sqrt(6.25 - (y) ** 2); tube([[-hw + .25, .2 + y - .2 * 0], [hw - .25, .2 + y]], 'yellow', 1 + i * .3, .08); });
  tube([[-3.9, -.6], [-3.6, 1.2], [-3.3, 2.6], [-3.5, 4]], 'pink', 2);
  [[-1.9, .5], [-1.5, 1], [-.4, .9], [.6, .2], [.9, -.6]].forEach(([dx, dy], i) => tube([[-3.5, 4], [-3.5 + dx * .55, 4 + dy * .9 + .25], [-3.5 + dx * 1.2, 4 + dy * .8 - .5]], 'aqua', 2.4 + i * .25, .09));
  tube([[-4.6, -.75], [4.6, -.75]], 'pink', 3.6, .07);
  const words = art((ctx, w, h) => letter(ctx, props.text, w / 2, h * .68, Math.min(250, w * 1.7 / Math.max(4, props.text.length) * 1.05), {font: F.script, fill: 'paper', outline: .05}), 8.4, [1024, 384]); words.position.set(0, -2.3, .1); scene.add(words);
  const wordGlow = mesh(new T.PlaneGeometry(11, 5), glow('aqua', .5)); wordGlow.position.set(0, -2.3, -.1);
  const sunGlow = mesh(new T.PlaneGeometry(11, 9), glow('orange', .35)); sunGlow.position.set(0, 1.6, -.15);
  camera.position.set(0, .6, 19); camera.lookAt(0, .6, 0);
  // Each tube switches on in turn with a stutter, then holds with a faint hum; one keeps misbehaving.
  const level = (t, order, i) => { const k = t - .3 - order * .42; if (k < 0) return .12; if (k < .32) return Math.floor(k * 22 + i) % 2 ? 1 : .15; const dip = i === 4 && rand(Math.floor(t * 14)) > .82 ? .25 : 1; return dip * (.93 + .07 * Math.sin(t * 40 + i)); };
  return play(t => {
    tubes.forEach(({m, halo, order}, i) => { const v = level(t, order, i); m.material.uniforms.uGain.value = .25 + .75 * v; halo.material.uniforms.uGain.value = .2 * Math.max(0, v - .15); });
    const w = level(t, 4.4, 9); words.u.uGain.value = .3 + .7 * w; wordGlow.material.uniforms.uGain.value = .5 * Math.max(0, w - .15); sunGlow.material.uniforms.uGain.value = .35 * Math.max(0, level(t, 0, 0) - .15);
    camera.position.x = Math.sin(t * .5) * .8;camera.lookAt(0, .6, 0);
  });
}

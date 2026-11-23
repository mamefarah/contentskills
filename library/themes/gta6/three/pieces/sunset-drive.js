import {toonStage, rand} from './_toon.js';
import {C} from '../../coast.js';

// Driving into the sunset: a low-poly car on a coast road with palms sweeping past on both sides and
// a striped sun on the horizon. Comic-shaded with ink outlines. Loops seamlessly.
export const meta = {duration: 4, loop: true};
export const defaults = {car: 'pink'};

export function mount(el, props = defaults) {
  const {T, scene, camera, toon, flat, mesh, box, cyl, sky, palm, play, shader, VERT} = toonStage(el, {fov: 52});
  sky({sun: [.5, .52], sunR: .2, horizon: .4});
  const ground = mesh(new T.PlaneGeometry(400, 400), toon('#3a1a6e', {facet: 0})); ground.rotation.x = -Math.PI / 2;
  const road = mesh(new T.PlaneGeometry(9, 400), shader(VERT, `varying vec3 vObj; void main() { float x = abs(vObj.x), dash = step(x, .12) * step(.5, fract(vObj.y * .125 + uTime * 2.)), edge = step(4.05, x) * step(x, 4.3);
    gl_FragColor = vec4(mix(mix(NIGHT, YELLOW, dash), PAPER, edge), .31 + .2 * dash + .4 * edge); }`, {})); road.rotation.x = -Math.PI / 2; road.position.y = .02;
  for (let i = 0; i < 14; i++) { const w = 6 + rand(i) * 10, h = 3 + rand(i + 9) * 9; box(w, h, 6, '#5a2590', {at: [(i - 6.5) * 13 + rand(i + 3) * 4, h / 2, -150], facet: 0}); }
  const SPACING = 16, COUNT = 8, palms = [];
  for (let i = 0; i < COUNT * 2; i++) { const p = palm({h: 6 + rand(i) * 2.5, lean: (i % 2 ? -1 : 1) * (.15 + rand(i + 5) * .2), trunk: '#b0507a', leaf: i % 3 ? '#19c8a8' : '#12a5c0', seed: i}); p.side = i % 2 ? 1 : -1; p.slot = Math.floor(i / 2); p.position.x = p.side * (7 + rand(i + 2) * 2); p.rotation.y = rand(i) * 6; scene.add(p); palms.push(p); }
  const car = new T.Group(); scene.add(car); const body = props.car in C ? props.car : 'pink';
  box(2.3, .55, 4.6, body, {parent: car, at: [0, .62, 0]}); box(1.9, .5, 2.1, '#2a1157', {parent: car, at: [0, 1.12, .25]}); box(1.7, .1, 1.9, body, {parent: car, at: [0, 1.42, .25]});
  box(2.4, .12, .5, body, {parent: car, at: [0, 1.02, 2.1]}); box(.7, .16, .06, flat('coral'), {parent: car, at: [-.7, .7, 2.32]}); box(.7, .16, .06, flat('coral'), {parent: car, at: [.7, .7, 2.32]}); box(.8, .2, .05, flat('paper'), {parent: car, at: [0, .52, 2.33]});
  for (const [x, z] of [[-1.15, 1.4], [1.15, 1.4], [-1.15, -1.5], [1.15, -1.5]]) { const w = cyl(.45, .45, .35, 10, C.ink, {parent: car, at: [x, .45, z], facet: 0}); w.rotation.z = Math.PI / 2; }
  return play(t => {
    const travel = t / meta.duration * SPACING * 2;                      // two palm spacings per loop: the row lines up again
    palms.forEach(p => { p.position.z = -110 + ((p.slot * SPACING + travel) % (COUNT * SPACING)) + (p.side > 0 ? SPACING / 2 : 0); p.crown.rotation.z = Math.sin(t / meta.duration * 6.283 + p.slot) * .05; });
    const sway = Math.sin(t / meta.duration * 6.283); car.position.set(sway * .5, Math.abs(Math.sin(t / meta.duration * 6.283 * 4)) * .03, 0); car.rotation.set(0, -sway * .03, sway * .015);
    camera.position.set(sway * .25, 2.7, 9.5); camera.lookAt(0, 1.9, -30);
  });
}

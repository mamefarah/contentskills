import {toonStage, rand} from './_toon.js';
import {C} from '../../coast.js';

// Night over the city: a low-poly helicopter circles above blocks of lit towers, sweeping a
// spotlight across the rooftops. Comic-shaded with ink outlines. Loops.
export const meta = {duration: 6, loop: true};

export function mount(el) {
  const {T, scene, camera, toon, flat, mesh, box, cyl, sky, play, shader, VERT, additive} = toonStage(el, {fov: 44});
  sky({sun: [.2, .34], sunR: .09, horizon: .24, clouds: 0, colors: [C.orange, C.pink, '#5a2bd0', '#160a36']});
  const ground = mesh(new T.PlaneGeometry(300, 300), toon('#1d0f45', {facet: 0})); ground.rotation.x = -Math.PI / 2;
  const tints = ['#5a2bd0', '#7a3cf0', '#b23bd0', '#3b6fe0', '#ff3f97', '#12a5c0'];
  for (let x = -6; x <= 6; x++) for (let z = -7; z <= 2; z++) { const i = x * 31 + z * 7, h = 2 + rand(i) * rand(i + 3) * 16; if (rand(i + 5) < .18) continue; box(3.2, h, 3.2, tints[Math.floor(rand(i + 8) * tints.length)], {at: [x * 5, h / 2, z * 5 - 4], win: .9, lit: .35}); if (rand(i + 2) > .7) box(1.2, .8, 1.2, 'aqua', {at: [x * 5, h + .4, z * 5 - 4], facet: 0}); }
  const heli = new T.Group(); heli.scale.setScalar(1.5); scene.add(heli);
  const bodyG = new T.IcosahedronGeometry(1, 1); bodyG.scale(1.25, .95, .9); mesh(bodyG, 'sky', {parent: heli, facet: 0}); box(.9, .5, .7, 'aqua', {parent: heli, at: [.75, .15, 0], facet: 0});
  const tail = box(2.6, .26, .26, 'sky', {parent: heli, at: [-2.1, .25, 0]}); box(.16, .9, .5, 'pink', {parent: heli, at: [-3.3, .6, 0]}); box(.3, .5, .3, C.ink, {parent: heli, at: [0, 1, 0], facet: 0});
  cyl(3.3, 3.3, .04, 24, '#cfc6ff', {parent: heli, at: [0, 1.26, 0], facet: 0}); const rotor = box(6.4, .1, .4, C.ink, {parent: heli, at: [0, 1.32, 0], facet: 0}), tailRotor = box(.06, 1.3, .16, C.ink, {parent: heli, at: [-3.3, .6, .3], facet: 0});
  for (const z of [-.6, .6]) { box(2.2, .08, .1, 'paper', {parent: heli, at: [.1, -1.15, z], facet: 0}); box(.07, .5, .07, 'paper', {parent: heli, at: [.6, -.9, z], facet: 0}); box(.07, .5, .07, 'paper', {parent: heli, at: [-.5, -.9, z], facet: 0}); }
  box(.3, .2, .3, flat('yellow'), {parent: heli, at: [.5, -.95, 0]});
  const beamG = new T.ConeGeometry(1, 1, 20, 1, true); beamG.translate(0, -.5, 0); beamG.rotateX(Math.PI / 2);   // apex at the origin, opening along -z (the way lookAt points)
  const beam = mesh(beamG, shader(VERT, `varying vec3 vObj; void main() { gl_FragColor = vec4(vec3(1., .95, .6) * .2 * (1. + vObj.z * .6), 0.); }`, {}, additive));
  const pool = mesh(new T.CircleGeometry(1, 24), shader(VERT, `varying vec2 vUv; void main() { gl_FragColor = vec4(vec3(1., .93, .55) * .5, 0.); }`, {}, {...additive, depthTest: false})); pool.rotation.x = -Math.PI / 2;
  camera.position.set(0, 14, 32); camera.lookAt(0, 8, -8);
  const hp = new T.Vector3(), tp = new T.Vector3();
  return play(t => {
    const a = t / meta.duration * 6.283;
    hp.set(Math.cos(a) * 8, 15 + Math.sin(a * 2) * .5, 8 + Math.sin(a) * 4); heli.position.copy(hp); heli.rotation.set(0, -a - Math.PI / 2, 0); heli.rotateZ(-.1);
    rotor.rotation.y = a * 23; tailRotor.rotation.z = a * 31;
    tp.set(Math.cos(a * 2 + 1) * 9, 0, -8 + Math.sin(a * 3) * 7);
    const len = hp.distanceTo(tp); beam.position.copy(hp).y -= 1; beam.lookAt(tp); beam.scale.set(len * .2, len * .2, -len); pool.position.set(tp.x, 9 * 0 + .3, tp.z); pool.scale.setScalar(len * .2);
  });
}

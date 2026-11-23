import {toonStage, rand} from './_toon.js';
import {C} from '../../coast.js';

// Sirens: two low-poly police cruisers racing across an elevated highway at night, side-on, light bars strobing red and
// blue and washing the deck, the lit city below and behind. The deck sits about a quarter down the frame, so in a
// 9:16 talking-head shot (this scene behind the speaker) the chase runs just above the head. Comic-shaded with ink outlines.
// props.strobe: flashes per second. Loops.
export const meta = {duration: 3, loop: true};
export const defaults = {strobe: 6};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props};
  const {T, scene, camera, toon, flat, glow, mesh, box, cyl, sky, play} = toonStage(el, {fov: 50});
  sky({sun: [.5, .5], sunR: 0, horizon: .3, clouds: 0, dots: .6, colors: ['#3b1a78', '#24104f', '#160a36', '#0b0520']});
  const ground = mesh(new T.PlaneGeometry(400, 400), toon('#1d0f45', {facet: 0})); ground.rotation.x = -Math.PI / 2;
  const tints = ['#5a2bd0', '#3b6fe0', '#7a3cf0', '#2a1a6e'];
  for (let i = 0; i < 22; i++) { const w = 4 + rand(i) * 5, h = 8 + rand(i + 9) * 22; box(w, h, 5, tints[i % 4], {at: [(i - 11) * 5.2 + rand(i + 3) * 2, h / 2, -26 - rand(i + 5) * 14], win: .9, lit: .4}); }
  const Y = 11.5, Z = -8;                                                   // the highway deck
  box(200, .9, 5, '#3a2a7a', {at: [0, Y - .45, Z], facet: 0}); box(200, .5, .3, 'pink', {at: [0, Y + .25, Z + 2.5], facet: 0}); box(200, .5, .3, 'pink', {at: [0, Y + .25, Z - 2.5], facet: 0});
  for (let i = -6; i <= 6; i++) box(1, Y - .9, 1.2, '#2a1a5e', {at: [i * 9, (Y - .9) / 2, Z], facet: 0});
  const lamps = []; for (let i = -6; i <= 6; i++) { box(.2, 3, .2, '#2a1157', {at: [i * 9 + 4.5, Y + 1.5, Z - 2.6], facet: 0}); lamps.push(box(.8, .25, .5, flat('yellow'), {at: [i * 9 + 4.5, Y + 3, Z - 2.2]})); }
  const cruiser = () => {
    const car = new T.Group(); scene.add(car);
    box(4.6, .55, 2.3, '#f4f1ff', {parent: car, at: [0, .62, 0]}); box(1.6, .3, 2.32, C.ink, {parent: car, at: [1.6, .62, 0]}); box(1.4, .3, 2.32, C.ink, {parent: car, at: [-1.7, .62, 0]});
    box(2.1, .5, 1.9, '#2a1157', {parent: car, at: [-.2, 1.12, 0]}); box(1.9, .1, 1.7, '#f4f1ff', {parent: car, at: [-.2, 1.42, 0]});
    const red = box(.5, .34, .8, flat('#ff2a3a'), {parent: car, at: [-.2, 1.58, -.42]}), blue = box(.5, .34, .8, flat('#2f6bff'), {parent: car, at: [-.2, 1.58, .42]});
    box(.06, .16, .5, flat('paper'), {parent: car, at: [2.32, .72, 0]});
    for (const [x, zz] of [[1.4, -1.15], [1.4, 1.15], [-1.5, -1.15], [-1.5, 1.15]]) { const w = cyl(.45, .45, .35, 10, C.ink, {parent: car, at: [x, .45, zz], facet: 0}); w.rotation.x = Math.PI / 2; }
    const gr = mesh(new T.PlaneGeometry(10, 10), glow('#ff2a3a', .9), {parent: car, at: [-.2, 1.8, .8]}), gb = mesh(new T.PlaneGeometry(10, 10), glow('#2f6bff', .9), {parent: car, at: [.6, 1.8, .8]});
    return {car, red, blue, gr, gb};
  };
  const cars = [cruiser(), cruiser()], SPAN = 56; cars.forEach(c => c.car.scale.setScalar(2.7));   // big enough to read from the street
  return play(t => {
    const u = t / meta.duration, on = Math.floor(t * p.strobe) % 2;
    cars.forEach((c, i) => {
      const x = ((u * SPAN + i * 22) % SPAN) - SPAN / 2;                // across the deck, wrapping: two cars chasing
      c.car.position.set(x, Y, Z + (i ? -1 : 1)); c.car.rotation.z = Math.sin(t * 20 + i) * .01;
      const a = (on + i) % 2; c.red.material.uniforms.uGain.value = a ? 1.6 : .35; c.blue.material.uniforms.uGain.value = a ? .35 : 1.6;
      c.gr.material.uniforms.uGain.value = a ? 2.6 : .1; c.gb.material.uniforms.uGain.value = a ? .1 : 2.6;
      c.gr.lookAt(camera.position); c.gb.lookAt(camera.position);
    });
    camera.position.set(Math.sin(u * 6.283) * .3, 13, 24); camera.lookAt(0, 5.5, -10);   // level with the deck, tilted down: the light bars show
  });
}

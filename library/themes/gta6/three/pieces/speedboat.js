import {toonStage, rand} from './_toon.js';
import {C} from '../../coast.js';

// A speedboat cutting across teal water, throwing a white V-shaped wake drawn in the water shader,
// with a striped sun and a far shoreline. Comic-shaded with ink outlines. Loops.
export const meta = {duration: 4, loop: true};

export function mount(el) {
  const {T, scene, camera, toon, flat, mesh, box, sky, water, play} = toonStage(el, {fov: 42});
  sky({sun: [.3, .64], sunR: .13, horizon: .5});
  const sea = water({flow: [0, 9], wake: 1, glint: 0});
  for (let i = 0; i < 16; i++) box(8 + rand(i) * 10, 3 + rand(i + 5) * 9, 4, i % 4 ? '#5a2590' : '#7a3cf0', {at: [(i - 7.5) * 13, 2, -160], facet: 0});
  const boat = new T.Group(); scene.add(boat);
  const hull = new T.BoxGeometry(2.4, .9, 7, 1, 1, 3), pos = hull.attributes.position;
  for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i), y = pos.getY(i); if (z < -3) { pos.setX(i, pos.getX(i) * .08); pos.setY(i, y + .45); } else if (z < -1) pos.setX(i, pos.getX(i) * .8); if (y < 0) pos.setX(i, pos.getX(i) * .7); }
  mesh(hull, 'paper', {parent: boat, at: [0, .5, 0]}); box(2.5, .22, 4.6, 'pink', {parent: boat, at: [0, .78, 1.2]}); box(1.9, .7, .12, 'aqua', {parent: boat, at: [0, 1.3, -.4]}).rotation.x = -.5;
  box(1.6, .5, 1.2, '#2a1157', {parent: boat, at: [0, 1.1, 1.2]}); box(2, .5, .8, C.ink, {parent: boat, at: [0, .9, 3.3], facet: 0}); box(.08, 1.3, .08, 'paper', {parent: boat, at: [.9, 1.6, 3.2], facet: 0}); box(.7, .4, .04, flat('coral'), {parent: boat, at: [.52, 2, 3.2]});
  return play(t => {
    const a = t / meta.duration * 6.283, hop = Math.abs(Math.sin(a * 2));
    boat.position.set(0, .05 + hop * .22, 0); boat.rotation.set(.1 + hop * .07, 0, Math.sin(a) * .12);
    camera.position.set(7 + Math.sin(a) * 1.2, 6.5 + Math.cos(a) * .4, 15); camera.lookAt(0, 2.6, -6);
  });
}

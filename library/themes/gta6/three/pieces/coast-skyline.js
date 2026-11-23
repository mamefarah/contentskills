import {toonStage, rand} from './_toon.js';
import {C} from '../../coast.js';

// A low-poly beachfront at dusk: stepped pastel towers with lit windows, a strip of sand, palms and
// shader water, comic-shaded with ink outlines while the camera drifts along the shore. Loops.
export const meta = {duration: 8, loop: true};
const PASTEL = ['#ff9ec7', '#8ef0e4', '#ffe1a8', '#b9a2ff', '#ffb38a', '#9fd0ff'];

export function mount(el) {
  const {T, scene, camera, toon, flat, mesh, box, cyl, sky, water, palm, play} = toonStage(el, {fov: 38});
  sky({sun: [.74, .5], sunR: .15, horizon: .36});
  water({flow: [.6, .3], glint: 0, y: -.1});
  const sand = box(120, .5, 9, '#ffd9a0', {at: [0, .05, -3], facet: 0}), walk = box(120, .3, 2.2, '#ff9ec7', {at: [0, .35, -6.5], facet: 0});
  for (let i = 0; i < 13; i++) {
    const x = (i - 6) * 6.4 + rand(i) * 1.5, w = 3.6 + rand(i + 1) * 1.8, h = 5 + rand(i + 2) * 11, d = 4, color = PASTEL[i % PASTEL.length], g = new T.Group(); g.position.set(x, .5, -11 - rand(i + 3) * 3); scene.add(g);
    box(w, h, d, color, {parent: g, at: [0, h / 2, 0], win: 1.1, lit: .45}); box(w + .5, .28, d + .5, 'paper', {parent: g, at: [0, h + .14, 0], facet: 0});
    if (i % 3 === 0) { box(w * .6, 1.6, d * .6, color, {parent: g, at: [0, h + 1.1, 0], win: 1.1}); box(.25, 2.6, .25, 'pink', {parent: g, at: [0, h + 3.2, 0], facet: 0}); }
    else if (i % 3 === 1) { const c = cyl(w * .32, w * .32, 1.4, 8, color, {parent: g, at: [w * .18, h + .9, 0]}); box(.5, h * .7, .3, flat(i % 2 ? 'pink' : 'aqua'), {parent: g, at: [-w / 2 - .25, h * .6, d / 2]}); }
    else box(w * .8, .5, d * .8, 'aqua', {parent: g, at: [0, h + .5, 0], facet: 0});
    box(w + .8, .2, 1.2, 'coral', {parent: g, at: [0, 1.7, d / 2 + .5], facet: 0});
  }
  for (let i = 0; i < 10; i++) box(10 + rand(i) * 8, 8 + rand(i + 4) * 16, 3, '#5a2590', {at: [(i - 4.5) * 14, 6, -26], facet: 0});
  const palms = []; for (let i = 0; i < 9; i++) { const p = palm({h: 3.6 + rand(i) * 1.6, lean: (rand(i + 7) - .5) * .7, trunk: '#b0623a', leaf: i % 2 ? '#19c8a8' : '#0fa58c', seed: i}); p.position.set((i - 4) * 8.6 + rand(i + 2) * 3, .3, -2.2 - rand(i + 4) * 3.2); scene.add(p); palms.push(p); }
  for (let i = 0; i < 6; i++) { const u = cyl(1.3, .1, .7, 8, i % 2 ? 'pink' : 'yellow', {at: [(i - 2.5) * 9 + 3, 1.75, -.6]}); cyl(.05, .05, 1.6, 4, 'paper', {at: [(i - 2.5) * 9 + 3, .9, -.6], facet: 0}); }
  return play(t => {
    const a = t / meta.duration * 6.283; palms.forEach((p, i) => p.crown.rotation.z = Math.sin(a * 2 + i) * .06);
    camera.position.set(Math.sin(a) * 9, 3.4 + Math.cos(a) * .5, 22 + Math.cos(a) * 2); camera.lookAt(Math.sin(a) * 4, 5.2, -10);
  });
}

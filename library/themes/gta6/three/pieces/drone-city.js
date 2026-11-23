import {toonStage, rand} from './_toon.js';
import {C} from '../../coast.js';

// "Add some 3D": an FPV drone flight over a low-poly sunset city. The camera starts at street level looking up at a
// pink tower, lifts straight up past its roof while it swings round and tilts down to take in the whole city, then dives
// back in between the towers, banking like a racing drone, and races down a street. props.seconds: how long the whole
// flight takes (the move is eased so each part reads even when it is short). Comic-shaded, ink outlines. Full frame.
export const meta = {duration: 1.2};
export const defaults = {seconds: 1.2};
const PASTEL = ['#ff9ec7', '#8ef0e4', '#ffe1a8', '#b9a2ff', '#ffb38a', '#9fd0ff', '#7a3cf0', '#ff6a5c'];
const ease = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;

export function mount(el, props = defaults) {
  const p = {...defaults, ...props};
  const {T, scene, camera, box, cyl, sky, water, palm, play} = toonStage(el, {fov: 62});
  sky({sun: [.5, .62], sunR: .14, horizon: .45, rays: .6});
  water({flow: [.4, .2], glint: 1, y: -.2});
  box(150, .4, 170, '#3a1f73', {at: [0, 0, -50], facet: 0});                                                  // the city block
  for (let gx = -5; gx <= 5; gx++) for (let gz = 0; gz <= 10; gz++) {
    const x = gx * 12 - 6 + 6, z = 8 - gz * 12, cx = x + (rand(gx * 13 + gz) - .5) * 2, cz = z + (rand(gz * 17 + gx) - .5) * 2;
    if (Math.abs(cx) < 9 && Math.abs(cz + 12) < 9) continue;                                                  // room for the hero tower
    if (Math.abs(x + 12) < 3) continue;                                                                       // the avenue the drone dives down
    const centre = 1 - Math.min(1, Math.hypot(x, z + 40) / 70), h = 5 + rand(gx * 7 + gz * 3) * 16 + centre * 34 * rand(gx + gz * 11);
    const w = 6.5 + rand(gx + gz) * 2.5, color = PASTEL[(gx * 3 + gz * 5 + 40) % PASTEL.length];
    box(w, h, w, color, {at: [cx, h / 2, cz], win: 1.1, lit: .45});
    if (h > 26) { box(w * .6, 3, w * .6, color, {at: [cx, h + 1.5, cz], win: 1.1}); box(.3, 5, .3, 'pink', {at: [cx, h + 5.5, cz], facet: 0}); }
    else box(w + .4, .3, w + .4, 'paper', {at: [cx, h + .15, cz], facet: 0});
  }
  // the hero tower they are "looking at"
  box(12, 46, 12, '#ff3f97', {at: [0, 23, -12], win: 1, lit: .55}); box(8, 6, 8, '#ff9ec7', {at: [0, 49, -12], win: 1}); cyl(.4, .4, 10, 6, 'yellow', {at: [0, 57, -12], facet: 0});
  box(13, .6, 13, 'paper', {at: [0, 46.3, -12], facet: 0});
  for (let i = 0; i < 16; i++) { const pl = palm({h: 4 + rand(i) * 2, lean: (rand(i + 3) - .5) * .5, trunk: '#b0623a', leaf: i % 2 ? '#19c8a8' : '#0fa58c', seed: i}); pl.position.set(-12 + (i % 2 ? 4.6 : -4.6), .2, 10 - i * 8); scene.add(pl); }
  // flight path: street level at the tower, up past the roof swinging round, then a dive down the avenue
  const P = [[0, 4, 36], [0, 12, 24], [7, 34, 12], [26, 64, -6], [16, 60, -42], [-4, 30, -52], [-12, 9, -66], [-12, 4, -90]].map(v => new T.Vector3(...v));
  const L = [[0, 24, -12], [0, 40, -12], [0, 50, -16], [-8, 0, -42], [-18, 0, -64], [-13, 5, -90], [-12, 4, -110], [-12, 4, -130]].map(v => new T.Vector3(...v));
  const path = new T.CatmullRomCurve3(P), look = new T.CatmullRomCurve3(L);
  return play(t => {
    const u = Math.min(1, Math.max(0, t / p.seconds)), e = ease(u);
    camera.position.copy(path.getPoint(e)); camera.up.set(0, 1, 0); camera.lookAt(look.getPoint(e));
    const bank = Math.sin(Math.PI * Math.min(1, Math.max(0, (e - .55) / .45))) * .38 - Math.sin(Math.PI * Math.min(1, e / .5)) * .12;
    camera.rotateZ(bank);
  });
}

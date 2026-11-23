import {toonStage, rand} from './_toon.js';
import {C} from '../../coast.js';

// A backdrop: rows of palms at different depths slide past a huge striped sun over glinting water,
// so near trees move faster than far ones. Silhouettes with a warm rim; birds drift across. Loops.
export const meta = {duration: 6, loop: true};

export function mount(el) {
  const {T, scene, camera, flat, mesh, box, sky, water, palm, play} = toonStage(el, {fov: 40});
  sky({sun: [.5, .5], sunR: .26, horizon: .3});
  water({glint: 1, flow: [.5, .2], a: C.teal, b: '#7a3cf0'});
  const rows = [{z: -4, gap: 9, n: 6, h: 7, c: C.ink, lc: '#2a1157'}, {z: -16, gap: 8, n: 9, h: 6, c: '#3b1a78', lc: '#3b1a78'}, {z: -34, gap: 9, n: 12, h: 6, c: '#6a2ba0', lc: '#6a2ba0'}].map((r, k) => {
    const strip = box(400, .6, 3, r.c, {at: [0, .2, r.z], facet: 0});
    const trees = Array.from({length: r.n}, (_, i) => { const p = palm({h: r.h * (.8 + rand(i + k * 9) * .5), lean: (rand(i + k * 5 + 1) - .5) * .9, trunk: r.c, leaf: r.lc, seed: i + k * 20}); p.position.z = r.z; p.rotation.y = rand(i + k) * 6; scene.add(p); return p; });
    return {...r, trees};
  });
  const birds = Array.from({length: 5}, (_, i) => { const s = new T.Shape(); s.moveTo(-.9, .25); s.quadraticCurveTo(-.4, .5, 0, 0); s.quadraticCurveTo(.4, .5, .9, .25); s.quadraticCurveTo(.4, .3, 0, -.14); s.quadraticCurveTo(-.4, .3, -.9, .25); const m = mesh(new T.ShapeGeometry(s), flat(C.ink)); m.position.z = -20; return m; });
  camera.position.set(0, 3.2, 14); camera.lookAt(0, 5.2, -20);
  return play(t => {
    const u = t / meta.duration;
    rows.forEach((r, k) => { const span = r.n * r.gap; r.trees.forEach((p, i) => { p.position.x = ((i * r.gap + u * span / (k + 1) * (k === 0 ? 1 : 1) + span * 10) % span) - span / 2; p.crown.rotation.z = Math.sin(u * 6.283 * 2 + i) * .05; }); });
    birds.forEach((b, i) => { b.position.x = ((u + i * .23) % 1) * 44 - 22; b.position.y = 12 + i * .9 + Math.sin(u * 6.283 + i) * .5; b.scale.set(.8, .6 + .5 * Math.sin(u * 6.283 * 6 + i * 2), 1); });
  });
}

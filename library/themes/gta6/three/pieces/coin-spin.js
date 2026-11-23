import {toonStage, rand} from './_toon.js';
import {C, F} from '../../coast.js';

// A fat gold coin spinning in front of a turning sunburst, with smaller coins circling and star
// glints. Comic-shaded with ink outlines. Loops. props.mark is the symbol on its face.
export const meta = {duration: 3, loop: true};
export const defaults = {mark: '$'};

export function mount(el, props = defaults) {
  const {T, scene, camera, toon, flat, mesh, cyl, sky, art, play, letter} = toonStage(el, {fov: 36});
  const skyU = sky({sun: [.5, .5], sunR: 0, horizon: -.4, rays: 1, clouds: 0, dots: .8, colors: [C.yellow, C.orange, C.pink, '#7a3cf0']});
  const face = () => art((ctx, w, h) => { ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .47, 0, 7); ctx.fill(); ctx.strokeStyle = C.orange; ctx.lineWidth = w * .035; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .37, 0, 7); ctx.stroke();
    ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.ellipse(w * .36, h * .3, w * .07, w * .16, .7, 0, 7); ctx.fill(); letter(ctx, props.mark, w / 2, h * .7, w * .5, {fill: 'gold', outline: .07}); }, 3.6, [512, 512]);
  const coin = new T.Group(); scene.add(coin);
  const rimMesh = cyl(2, 2, .44, 40, 'orange', {parent: coin, facet: 0}); rimMesh.rotation.x = Math.PI / 2;
  const a = face(), b = face(); a.position.z = .225; b.position.z = -.225; b.rotation.y = Math.PI; coin.add(a, b);
  const minis = Array.from({length: 6}, (_, i) => { const g = new T.Group(), m = cyl(.5, .5, .14, 16, 'yellow', {parent: g, facet: 0}); m.rotation.x = Math.PI / 2; scene.add(g); return g; });
  const glints = Array.from({length: 7}, (_, i) => { const s = new T.Shape(); for (let k = 0; k < 8; k++) { const r = k % 2 ? .09 : .42, ang = k * Math.PI / 4; s[k ? 'lineTo' : 'moveTo'](Math.cos(ang) * r, Math.sin(ang) * r); } const m = mesh(new T.ShapeGeometry(s), flat('paper')); m.position.set((rand(i) - .5) * 8, (rand(i + 9) - .5) * 8, 1 + rand(i + 4)); return m; });
  camera.position.set(0, 0, 13); camera.lookAt(0, 0, 0);
  return play(t => {
    const u = t / meta.duration, w = u * 6.283;
    coin.rotation.y = w; coin.rotation.z = .12; coin.position.y = Math.sin(w) * .25; skyU.uSpin.value = u / 8 * 2;      // the burst has 8-fold symmetry: a quarter step per loop lines up
    minis.forEach((g, i) => { const ang = w + i * 1.047; g.position.set(Math.cos(ang) * 3.6, Math.sin(ang * 1) * 1.3 + Math.sin(i * 2.1) * 1.6, Math.sin(ang) * 3.6); g.rotation.set(w + i, w * 2 + i, 0); });
    glints.forEach((m, i) => { const k = (u + rand(i + 20)) % 1; m.scale.setScalar(Math.sin(k * Math.PI) ** 2 * 1.3 + .001); m.rotation.z = k * 1.5; });
  });
}

import {toonStage, rand} from './_toon.js';
import {C, F} from '../../coast.js';

// "Posted to nine platforms": a dusk skyline where a giant rooftop screen switches on for each platform, one after
// another, each with that platform's colour and a short mark, while the camera pushes slowly in. props.platforms: the
// screens ([{mark, name, color}]); props.times: seconds from the start when each switches on (default spread over 1.6 s).
// The marks are simple lettering in each platform's colour, not the platforms' own logo artwork. Comic-shaded, ink outlines.
export const meta = {duration: 3};
export const defaults = {
  platforms: [{mark: 'IG', name: 'INSTAGRAM', color: '#ff3f97'}, {mark: 'TT', name: 'TIKTOK', color: '#12c4c0'}, {mark: 'YT', name: 'YOUTUBE', color: '#ff2a3a'},
    {mark: 'X', name: 'X', color: '#f4f1ff'}, {mark: 'in', name: 'LINKEDIN', color: '#2f8bff'}, {mark: 'f', name: 'FACEBOOK', color: '#4a6bff'},
    {mark: '@', name: 'THREADS', color: '#ffd447'}, {mark: 'P', name: 'PINTEREST', color: '#ff4a4a'}, {mark: 'B', name: 'BLUESKY', color: '#6ff2e3'}],
  times: null,
};

export async function mount(el, props = defaults) {
  await Promise.all([`150px ${F.display}`, `30px ${F.caps}`].map(f => document.fonts?.load(f).catch(() => {})));   // drawn into canvases below
  const p = {...defaults, ...props}, n = p.platforms.length, times = p.times ?? p.platforms.map((_, i) => .15 + i * 1.6 / n);
  const {T, scene, camera, toon, flat, glow, mesh, box, sky, art, play} = toonStage(el, {fov: 46});
  sky({sun: [.5, .3], sunR: .16, horizon: .2, colors: [C.yellow, C.orange, C.pink, '#4a22b8']});
  const ground = mesh(new T.PlaneGeometry(300, 300), toon('#2a1157', {facet: 0})); ground.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 26; i++) { const w = 4 + rand(i) * 5, h = 6 + rand(i + 9) * 22; box(w, h, 5, ['#5a2bd0', '#7a3cf0', '#b23bd0', '#3b6fe0'][i % 4], {at: [(i - 12.5) * 4.6, h / 2, -40 - rand(i + 2) * 20], win: 1, lit: .45}); }
  // nine towers in a 3 x 3 stagger, each topped by a screen facing the camera
  const screens = p.platforms.map((pl, i) => {
    const col = i % 3, row = Math.floor(i / 3), x = (col - 1) * 9.5 + (row % 2 ? 2 : -1), z = -6 - row * 9, h = 4 + row * 6 + rand(i) * 3;
    box(6.4, h, 5, ['#7a3cf0', '#5a2bd0', '#b23bd0'][row], {at: [x, h / 2, z], win: 1.1, lit: .5});
    const g = new T.Group(); g.position.set(x, h + 3.2, z + 1); scene.add(g);
    box(7.4, 5, .6, C.ink, {parent: g, at: [0, 0, -.35], facet: 0}); box(.4, 1.4, .4, '#2a1157', {parent: g, at: [-2, -2.9, -.3], facet: 0}); box(.4, 1.4, .4, '#2a1157', {parent: g, at: [2, -2.9, -.3], facet: 0});
    const off = art((ctx, w, h) => { ctx.fillStyle = '#1a0d3a'; ctx.fillRect(0, 0, w, h); }, 6.8, [340, 230]);
    const lit = art((ctx, w, h) => {
      ctx.fillStyle = pl.color; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(25,11,51,.18)'; for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 3);
      ctx.font = `150px ${F.display}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = 16; ctx.strokeStyle = C.ink; ctx.strokeText(pl.mark, w / 2, h * .44); ctx.fillStyle = '#fff'; ctx.fillText(pl.mark, w / 2, h * .44);
      ctx.font = `30px ${F.caps}`; ctx.fillStyle = C.ink; ctx.fillText(pl.name, w / 2, h * .86);
    }, 6.8, [340, 230]);
    const halo = mesh(new T.PlaneGeometry(16, 12), glow(pl.color, .7), {parent: g, at: [0, 0, -.5]});
    g.add(off, lit); off.position.z = lit.position.z = .01;
    return {g, lit, off, halo, at: times[i]};
  });
  return play(t => {
    screens.forEach(s => {
      const q = t - s.at, on = q >= 0, pop = on ? 1 + .25 * Math.exp(-q * 9) * Math.cos(q * 30) : 1;
      s.lit.visible = on; s.off.visible = !on; s.halo.visible = on; s.halo.material.uniforms.uGain.value = on ? .7 + .5 * Math.exp(-q * 5) : 0;
      s.g.scale.setScalar(pop);
    });
    const k = t / meta.duration; camera.position.set(Math.sin(k * 1.2) * 2, 12 - k * 1.5, 52 - k * 6); camera.lookAt(0, 4, -12);   // the whole 3 x 3 grid in the top of a 9:16 frame
  });
}

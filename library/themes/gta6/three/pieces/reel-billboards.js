import {toonStage, rand} from './_toon.js';
import {C} from '../../coast.js';

// "Every reel I've ever posted": driving down a sunset coast road lined with billboards, each showing one of the
// creator's real reel covers in an ink frame, rushing past on both sides. Give it the covers (props.images, URLs);
// they repeat to fill the road. Comic-shaded with ink outlines. Not a loop: the drive runs `duration` seconds.
export const meta = {duration: 3.5};
export const defaults = {images: [], speed: 34};

const load = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

export async function mount(el, props = defaults) {
  const p = {...defaults, ...props}, imgs = (await Promise.all(p.images.map(load))).filter(Boolean);
  const {T, scene, camera, toon, flat, mesh, box, sky, art, palm, play, shader, VERT} = toonStage(el, {fov: 58});
  sky({sun: [.5, .56], sunR: .2, horizon: .46});
  const ground = mesh(new T.PlaneGeometry(400, 900), toon('#3a1a6e', {facet: 0})); ground.rotation.x = -Math.PI / 2; ground.position.z = -300;
  const road = mesh(new T.PlaneGeometry(9, 900), shader(VERT, `varying vec3 vObj; void main() { float x = abs(vObj.x), dash = step(x, .12) * step(.5, fract(vObj.y * .125)), edge = step(4.05, x) * step(x, 4.3);
    gl_FragColor = vec4(mix(mix(NIGHT, YELLOW, dash), PAPER, edge), .31 + .2 * dash + .4 * edge); }`, {})); road.rotation.x = -Math.PI / 2; road.position.set(0, .02, -300);
  for (let i = 0; i < 16; i++) { const w = 8 + rand(i) * 12, h = 4 + rand(i + 9) * 12; box(w, h, 6, '#5a2590', {at: [(i - 7.5) * 15 + rand(i + 3) * 4, h / 2, -420], facet: 0}); }
  // the billboards: a 9:16 cover in a thick ink frame with a hot-pink trim, on two posts, turned toward the road
  const N = 14, GAP = 15, cover = (img, i) => art((ctx, w, h) => {
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, w, h); ctx.fillStyle = i % 2 ? C.pink : C.yellow; ctx.fillRect(10, 10, w - 20, h - 20);
    if (img) { const s = Math.max((w - 52) / img.width, (h - 52) / img.height), dw = img.width * s, dh = img.height * s;
      ctx.save(); ctx.beginPath(); ctx.rect(26, 26, w - 52, h - 52); ctx.clip(); ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh); ctx.restore(); }
  }, 4.2, [288, 512]);
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1, g = new T.Group(); g.position.set(side * 3.4, 3.2, -14 - i * GAP); g.rotation.y = -side * .18; scene.add(g);   // tall, close to the road: in a 9:16 frame they pass above the speaker's head
    for (const x of [-1.3, 1.3]) box(.3, 4.6 + 6.4, .3, '#2a1157', {parent: g, at: [x, 2.3 - 3.2, -.1], facet: 0});
    const c = cover(imgs.length ? imgs[i % imgs.length] : null, i); c.position.set(0, 8.3, 0); g.add(c);
    box(4.6, .3, .5, 'pink', {parent: g, at: [0, 4.4, 0], facet: 0});
  }
  const palms = [];
  for (let i = 0; i < 18; i++) { const q = palm({h: 6 + rand(i) * 2, lean: (i % 2 ? -1 : 1) * (.15 + rand(i + 5) * .2), trunk: '#b0507a', leaf: i % 3 ? '#19c8a8' : '#12a5c0', seed: i});
    q.position.set((i % 2 ? -1 : 1) * (13 + rand(i + 2) * 3), 0, -6 - i * GAP * .8); q.rotation.y = rand(i) * 6; scene.add(q); palms.push(q); }
  return play(t => {
    const z = 8 - t * p.speed, sway = Math.sin(t * 1.6);
    camera.position.set(sway * .4, 3.2, z); camera.lookAt(sway * .2, 3.6, z - 40);
    palms.forEach((q, i) => q.crown.rotation.z = Math.sin(t * 2 + i) * .06);
  });
}

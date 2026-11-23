import {toonStage, rand} from './_toon.js';
import {C, F} from '../../coast.js';

// Banknotes and coins tumbling down in front of a turning sunburst. Comic-shaded with ink
// outlines. Loops, so it works as a backdrop behind a figure. sky: false leaves out the sunburst, so the money
// falls over the footage (a shower in front of the person).
export const meta = {duration: 4, loop: true};
export const defaults = {mark: '$', sky: true, notes: null};   // notes: two banknote colours, e.g. ['#3BAA5C', '#24804A'] for green money

export function mount(el, props = defaults) {
  const {T, scene, camera, cyl, sky, art, play, letter} = toonStage(el, {fov: 40, clear: props.sky === false});
  const skyU = props.sky === false ? {uSpin: {value: 0}} : sky({sun: [.5, .42], sunR: 0, horizon: -.3, rays: 1, clouds: 0, dots: .9, colors: [C.yellow, C.orange, C.pink, '#5a2bd0']});
  const note = tint => art((ctx, w, h) => { const r = 22, m = 10; ctx.fillStyle = tint; ctx.strokeStyle = C.ink; ctx.lineWidth = 12; ctx.beginPath(); ctx.roundRect(m, m, w - 2 * m, h - 2 * m, r); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 5; ctx.globalAlpha = .6; ctx.beginPath(); ctx.roundRect(m + 26, m + 26, w - 2 * m - 52, h - 2 * m - 52, 10); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = C.paper; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(w / 2, h / 2, h * .28, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.ink; ctx.font = `${h * .4}px ${F.display}`; ctx.textAlign = 'center'; ctx.fillText(props.mark, w / 2, h * .64);
    for (const x of [w * .14, w * .86]) { ctx.font = `${h * .2}px ${F.display}`; ctx.fillText(props.mark, x, h * .58); } }, 3.2, [512, 256]);
  const things = Array.from({length: 26}, (_, i) => {
    let m; if (i % 4 === 3) { m = cyl(.55, .55, .16, 18, 'yellow', {facet: 0}); } else { m = note(props.notes?.length ? props.notes[i % props.notes.length] : i % 3 ? C.aqua : C.teal); scene.add(m); }
    return {m, x: (rand(i) - .5) * 15, z: (rand(i + 7) - .5) * 10 - 2, phase: rand(i + 3), speed: 1 + Math.floor(rand(i + 5) * 2), spin: 1 + Math.floor(rand(i + 11) * 3), tilt: rand(i + 13) * 6};
  });
  camera.position.set(0, 0, 16); camera.lookAt(0, 0, 0);
  return play(t => {
    const u = t / meta.duration; skyU.uSpin.value = u / 4;
    things.forEach(({m, x, z, phase, speed, spin, tilt}, i) => { const k = (u * speed + phase) % 1;
      m.position.set(x + Math.sin((u * spin + phase) * 6.283) * 1.1, 11 - k * 22, z); m.rotation.set(tilt + u * spin * 6.283, phase * 6 + u * 6.283 * (spin > 1 ? 1 : 2), Math.sin((u + phase) * 6.283) * .6); });
  });
}

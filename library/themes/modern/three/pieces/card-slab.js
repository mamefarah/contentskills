import {stage3, toneTexture, C, STEP, span, snap, punch, io, hash} from './_scene.js';

// A slab of floating picture cards seen three-quarter on: a dozen thin portrait cards stacked tight
// like a deck. On the beat the deck fans open in depth, card by card, and turns a notch; at the end it
// closes back into one slab. Charcoal card edges, studio-light pictures on the faces. "Options",
// "the collection", "everything we made this year".
export const meta = {duration: 8};
export const defaults = {clear: false, count: 12, tones: ['ember', 'steel', 'bone', 'teal', 'rose', 'sand', 'cobalt', 'olive']};

export function mount(el, props = defaults) {
  const s = stage3(el, props, {fov: 30}), {T, scene, camera} = s, N = Math.max(3, Math.min(24, props.count ?? 12)), tones = props.tones ?? defaults.tones;
  const deck = new T.Group(); scene.add(deck);
  const edge = new T.MeshBasicMaterial({color: C.graphite});
  const cards = Array.from({length: N}, (_, i) => {
    const face = new T.MeshBasicMaterial({map: toneTexture(tones[i % tones.length], 256, 352, i + 1)}), back = new T.MeshBasicMaterial({color: C.ink});
    const m = new T.Mesh(new T.BoxGeometry(1.6, 2.2, .035), [edge, edge, edge, edge, face, back]);
    deck.add(m); return {m, jx: (hash(i, 3) - .5) * .18, jy: (hash(i, 4) - .5) * .14, jr: (hash(i, 5) - .5) * .12};
  });
  return {seek(t) {
    s.hold(.8);
    camera.position.set(4.6, 1.5, 6.4); camera.lookAt(0, 0, 0);
    const turn = [1.6, 2.8, 4, 5.2].reduce((a, at) => a + punch(span(t, at, STEP * 2)), 0);
    deck.rotation.y = -.3 + turn * .1; deck.rotation.x = -.08;
    cards.forEach((c, i) => {
      const k = i - (N - 1) / 2, q = snap(span(t, .8 + i * .04, STEP * 4)) - io(span(t, 6.5 + (N - 1 - i) * .03, STEP * 4)), intro = snap(span(t, i * .03, STEP * 2));
      c.m.position.set(c.jx * q, c.jy * q + (1 - intro) * -4, k * (.045 + .36 * q));
      c.m.rotation.z = c.jr * q; c.m.visible = intro > 0;
    });
    s.render(t);
  }};
}

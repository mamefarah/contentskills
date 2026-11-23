import {stage3, picture, word3, STEP, span, snap, punch, hash} from './_scene.js';

// A fashion lookbook wall: five tall picture strips in a row with staggered heights. On the beat they
// flip about their vertical axes one at a time in a scattered order, each turning to a new studio-
// light picture on its back, while the camera pushes in a notch per bar. A huge white word builds
// across the strips letter by letter through a ghost and drops out before the end. Loops visually.
export const meta = {duration: 8};
export const defaults = {clear: false, word: 'LOOKBOOK', tones: ['ember', 'steel', 'bone', 'teal', 'rose'], backs: ['sand', 'cobalt', 'rose', 'olive', 'steel'], images: []};

export function mount(el, props = defaults) {
  const s = stage3(el, props, {fov: 32}), {T, scene, camera} = s, N = 5, W = 1.05, G = .07, tones = props.tones ?? defaults.tones, backs = props.backs ?? defaults.backs;
  const strips = Array.from({length: N}, (_, i) => {
    const h = 3.3 - (i % 2 ? .25 : 0), g = new T.Group();
    const a = picture(W, h, {tone: tones[i % tones.length], image: props.images?.[i] ?? null, seed: i + 1, side: 'front'});
    const b = picture(W, h, {tone: backs[i % backs.length], seed: i + 11, side: 'front'}); b.rotation.y = Math.PI;
    g.add(a, b); g.position.set((i - (N - 1) / 2) * (W + G), (i % 2 ? .12 : -.05), 0); scene.add(g); return g;
  });
  const order = [...Array(N).keys()].sort((a, b) => hash(a + 1, 7) - hash(b + 1, 7));
  const w = word3(props.word ?? '', .62); w.group.position.z = .9; scene.add(w.group);
  const fit = Math.min(1, (N * (W + G)) * .8 / Math.max(.01, w.width)); w.group.scale.setScalar(fit);
  return {seek(t) {
    s.hold(.8);
    const push = Math.floor(t / (STEP * 8)) + snap(span(t % (STEP * 8), 0, STEP * 1.5));
    camera.position.set(0, 0, 12.2 - push * .18); camera.lookAt(0, 0, 0);
    strips.forEach((g, i) => {
      const slot = order.indexOf(i), first = .6 + slot * STEP * 2, second = 4.6 + slot * STEP * 2;
      const turns = punch(span(t, first, STEP * 2.2)) + punch(span(t, second, STEP * 2.2));
      g.rotation.y = turns * Math.PI;
      const intro = snap(span(t, i * STEP * .5, STEP * 2)); g.scale.y = intro; g.visible = intro > 0;
    });
    w.seek(t, {at: 1.1, step: .06, out: 6.6, outStep: .05});
    s.render(t);
  }};
}

import {stage3, picture, frame, word3, C, STEP, span, snap, punch} from './_scene.js';

// A carousel: ten tall picture panels standing on a ring, seen from slightly above. The ring turns
// one panel per bar on the beat, landing hard with a small overshoot, so a new picture swings to the
// front each time; the front panel carries a thin white frame. Optional big word across the front.
// "The collection", "every look", "swipe through". Loops (one full turn over the duration).
export const meta = {duration: 8, loop: true};
export const defaults = {clear: false, word: '', count: 10, tones: ['ember', 'steel', 'bone', 'teal', 'rose', 'sand', 'cobalt', 'olive', 'rose', 'steel'], images: []};

export function mount(el, props = defaults) {
  const s = stage3(el, props, {fov: 34}), {T, scene, camera} = s, N = Math.max(4, Math.min(16, props.count ?? 10)), tones = props.tones ?? defaults.tones;
  const R = N * .27, ring = new T.Group(); scene.add(ring);
  const panels = Array.from({length: N}, (_, i) => {
    const a = i / N * Math.PI * 2, p = picture(1.15, 2.7, {tone: tones[i % tones.length], image: props.images?.[i] ?? null, seed: i + 3});
    p.position.set(Math.sin(a) * R, 0, Math.cos(a) * R); p.rotation.y = a; ring.add(p); return p;
  });
  const front = frame(1.35, 2.9, .018); front.position.set(0, 0, R + .02); scene.add(front);
  const w = props.word ? word3(props.word, .5) : null; if (w) { w.group.position.set(0, -.1, R + .5); scene.add(w.group); }
  const BAR = meta.duration / N;
  return {seek(t) {
    s.hold(.8);
    camera.position.set(0, 1.7, R + 8.2); camera.lookAt(0, -.1, 0);
    const k = Math.floor(t / BAR), turn = k + punch(span(t - k * BAR, 0, STEP * 2));
    ring.rotation.y = -turn / N * Math.PI * 2;
    panels.forEach((p, i) => { const intro = snap(span(t, i * .04, STEP * 2)); p.scale.y = Math.max(1e-3, intro); });
    const f = snap(span(t - k * BAR, STEP * 1.2, STEP)); front.material.opacity = t < STEP * 2 ? 0 : f; front.scale.setScalar(.96 + .04 * f);
    w?.seek(t, {at: .5, step: .06, out: meta.duration - 1.2, outStep: .05});
    s.render(t);
  }};
}

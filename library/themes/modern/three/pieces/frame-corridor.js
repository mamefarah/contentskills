import {stage3, picture, frame, C, span, snap, hash} from './_scene.js';

// A slow dolly down a gallery corridor of vertical frames: thin white portrait frames stand across
// the path one after another, and tall studio-light pictures hang on both walls, facing in, fading
// out of the charcoal ahead. The camera glides forward at an even pace; the corridor never ends.
// A title backdrop: "step inside", "behind the scenes", "the archive".
export const meta = {duration: 8};
export const defaults = {clear: false, speed: 1, tones: ['ember', 'steel', 'bone', 'teal', 'rose', 'sand', 'cobalt', 'olive']};
const GAP = 2.4, N = 10;

export function mount(el, props = defaults) {
  const s = stage3(el, props, {fov: 50}), {T, scene, camera} = s, tones = props.tones ?? defaults.tones, speed = (props.speed ?? 1) * GAP * 2 / meta.duration;
  if (!s.clear) scene.fog = new T.Fog(new T.Color(C.bg), 6, 24);
  const rows = Array.from({length: N}, (_, i) => {
    const g = new T.Group(), f = frame(1.9, 3, .022); g.add(f);
    const side = i % 2 ? 1 : -1, p = picture(1.3, 2.4, {tone: tones[i % tones.length], seed: i + 5}); p.position.set(side * 2.3, .1 + (hash(i, 2) - .5) * .3, -GAP / 2); p.rotation.y = -side * Math.PI / 2;
    const q = picture(.9, 1.7, {tone: tones[(i + 3) % tones.length], seed: i + 21}); q.position.set(-side * 2.3, -.2, -GAP * .2); q.rotation.y = side * Math.PI / 2;
    g.add(p, q); scene.add(g); return {g, f};
  });
  // Floor and ceiling hairlines run along the corridor.
  const lm = new T.LineBasicMaterial({color: C.rule, transparent: true, opacity: .8});
  for (const [x, y] of [[-2.3, -1.6], [2.3, -1.6], [-2.3, 1.6], [2.3, 1.6]]) scene.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(x, y, 2), new T.Vector3(x, y, -GAP * N)]), lm));
  return {seek(t) {
    s.hold(.7);
    camera.position.set(0, 0, 3); camera.lookAt(0, 0, -20);
    const travel = t * speed, L = GAP * N;
    // Rows ride toward the camera and wrap to the far end out of sight (in the fog), so the corridor never ends.
    rows.forEach((r, i) => { let z = -i * GAP + travel; z = ((z - 3.5) % L + L) % L - L + 3.5; r.g.position.z = z; r.f.material.opacity = Math.max(0, Math.min(1, (2.4 - z) / 1.4)); });
    s.render(t);
  }};
}

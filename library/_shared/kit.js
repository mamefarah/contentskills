// Shared helpers for library pieces. Keep this tiny: palette, easing, and timing math.
export const palette = {
  ink: '#171426', navy: '#151B36', cream: '#FFF1D8', peach: '#FFC49A', coral: '#FF786A',
  pink: '#EC68A8', violet: '#8155C8', cyan: '#54D8D0', yellow: '#FFD16E', mist: '#8FA3C4',
};
export const series = [palette.cyan, palette.coral, palette.yellow, palette.pink, palette.violet, palette.peach];
export const hex = color => parseInt(color.slice(1), 16);

export const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const mix = (a, b, t) => a + (b - a) * t;
/** Progress 0..1 of time t through the window [start, start + length]. */
export const span = (t, start, length) => clamp((t - start) / length);
export const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeBack = x => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

/** A Three.js renderer that tracks its container size. Call render() after updating the scene. */
export function threeStage(el, {fov = 35, background = palette.navy, z = 10} = {}) {
  const T = window.THREE;
  const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.setClearColor(hex(background), 1);
  el.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(fov, 1, .1, 500);
  camera.position.set(0, 0, z);
  const fit = () => {
    const w = el.clientWidth || 600, h = el.clientHeight || 600;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  fit();
  let lastRender = () => {};
  const observer = new ResizeObserver(() => { fit(); lastRender(); });
  observer.observe(el);
  // Browsers allow only a handful of WebGL contexts; whoever removes the piece should call this.
  el.__dispose = () => { observer.disconnect(); renderer.dispose(); renderer.forceContextLoss(); };
  const render = () => { lastRender = () => renderer.render(scene, camera); lastRender(); };
  return {T, renderer, scene, camera, render};
}

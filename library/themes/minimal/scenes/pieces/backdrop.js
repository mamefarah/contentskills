import {scene, h, set, breathe, span, ease} from '../../kit.js';

// The plain canvas, for transitions and breathing room: near-black with a faint vignette, or warm light grey.
// An optional soft light breathes at the hero spot; `fadeIn` brings the field up from black/white.
export const meta = {duration: 10};
export const defaults = {mode: 'dark', light: true, lightColor: null, fadeIn: 0};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, mode} = scene(el, p);
  const color = p.lightColor ?? (mode === 'dark' ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.8)');
  const light = p.light ? h(root, 'c', {left: 540, top: 860, width: 1300, height: 1300, borderRadius: '50%', background: `radial-gradient(circle, ${color} 0%, transparent 65%)`}) : null;
  const veil = h(el, '', {position: 'absolute', inset: 0, background: mode === 'dark' ? '#000' : '#fff', opacity: 0, pointerEvents: 'none'});
  return {
    seek(t) {
      if (light) set(light, {opacity: .7 + .3 * breathe(t, 3)});
      set(veil, {opacity: p.fadeIn > 0 ? 1 - ease(span(t, 0, p.fadeIn)) : 0});
    },
  };
}

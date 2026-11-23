import {scene, h, set, esc, pop, popStyle, span, io, breathe, content, glow, HERO} from '../../kit.js';

// Two app tiles side by side with "or" between them: the first is already centred and slides left as the second
// springs in from the right at `inAt`. For "use this one, or that one". Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {
  mode: 'dark', a: {icon: '✳', tile: ['#ff9a3d', '#f05a14'], label: 'Claude Code'}, b: {icon: 'icon:bolt', tile: ['#34d399', '#10a37f'], label: 'ChatGPT Work'},
  word: 'or', inAt: .15, popAt: 0, size: 300,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p), S = p.size, cy = HERO.y - 40;
  const make = d => {
    const [top, bottom] = Array.isArray(d.tile) ? d.tile : [d.tile, d.tile];
    const g = glow(root, 0, cy, S * 1.9, `color-mix(in srgb, ${bottom} 60%, transparent)`);
    const tile = h(root, 'c', {top: cy, width: S, height: S, borderRadius: S * .235, background: `linear-gradient(160deg, ${top}, ${bottom})`,
      boxShadow: 'inset 0 3px 0 rgba(255,255,255,.35), 0 30px 70px rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center'}, content(d.icon, S * .54, '#fff'));
    const label = h(root, 'c', {top: cy + S / 2 + 70, font: '800 52px/1 Inter', letterSpacing: '-.02em', color: M.fieldInk, whiteSpace: 'nowrap'}, esc(d.label));
    return {g, tile, label};
  };
  const A = make(p.a), B = make(p.b);
  const or = h(root, 'c', {left: HERO.x, top: cy, font: '400 96px/1 "Instrument Serif Italic"', color: M.fieldDim}, esc(p.word));
  return {
    seek(t) {
      const q = io(span(t, p.inAt, .45)), ax = HERO.x - 250 * q, bx = HERO.x + 250 + 260 * (1 - io(span(t, p.inAt, .5)));
      const PA = pop(t, p.popAt, {d: .4, from: .85}), PB = pop(t, p.inAt, {d: .5, from: .6, blur: 16}), b = breathe(t, 2.2);
      set(A.tile, {...popStyle(PA, 'translate(-50%,-50%)'), left: ax}); set(A.label, {left: ax, opacity: PA.o});
      set(A.g, {left: ax, opacity: PA.o * (.5 + .3 * b) * (1 - .4 * q)});
      set(B.tile, {...popStyle(PB, 'translate(-50%,-50%)'), left: bx}); set(B.label, {left: bx, opacity: PB.o});
      set(B.g, {left: bx, opacity: PB.o * (.6 + .3 * b)});
      set(or, {opacity: span(t, p.inAt + .2, .25), transform: `translate(-50%,-50%) scale(${.6 + .4 * io(span(t, p.inAt + .2, .3))})`});
    },
  };
}

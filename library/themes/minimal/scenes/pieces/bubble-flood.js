import {scene, h, set, esc, popIn, tick, expo, span, hash, W, H, HERO} from '../../kit.js';

// An overwhelming flood of company bubbles: `count` round "logo" bubbles (a letter mark each, seeded colours) pour in
// from the bottom edge, faster and faster, until they spill past every edge of the frame. A counter on a white plate
// ticks to `value` in the middle; the `named` companies land as big white pills on their spoken words. The letter
// marks are not real logos. Times are seconds from the shot start.
export const meta = {duration: 6};
export const defaults = {
  mode: 'dark', count: 180, value: 180, suffix: '+', label: 'companies scanned', floodAt: .1, floodFor: 2.4,
  named: [{text: 'Anthropic', at: 1.2}, {text: 'OpenAI', at: 1.6}, {text: 'ElevenLabs', at: 2}],
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const tones = [M.hue.orange, M.hue.blue, M.hue.green, M.hue.violet, M.hue.red, '#ffffff', '#ffffff', '#10132a'];
  const letters = 'ABCDEFGHJKLMNPRSTVWZ';
  const field = h(root, 'a', {inset: 0});
  const bubbles = Array.from({length: p.count}, (_, i) => {
    const d = 70 + hash(i, 1) * 80, tone = tones[Math.floor(hash(i, 2) * tones.length)], light = tone === '#ffffff';
    // targets fill the frame centre-out, then spill past the edges
    const r = Math.sqrt((i + 1) / p.count), a = i * 2.39996 + hash(i, 3) * .5;
    const x = HERO.x + Math.cos(a) * r * 760, y = HERO.y + 60 + Math.sin(a) * r * 1100;
    const b = h(field, 'c', {left: x, top: y, width: d, height: d, borderRadius: '50%', background: tone, display: 'grid', placeItems: 'center',
      font: `800 ${Math.round(d * .42)}px/1 Inter`, color: light ? M.ink : '#fff', boxShadow: '0 10px 24px rgba(20,30,90,.25)', border: light ? `2px solid ${M.line}` : 'none'},
      letters[Math.floor(hash(i, 4) * letters.length)]);
    // accelerate: early bubbles arrive slowly, the last ones in a rush
    const at = p.floodAt + p.floodFor * Math.pow(i / p.count, .6);
    return {b, at, x, y, spin: (hash(i, 5) - .5) * 40};
  });
  const plate = h(root, 'c', {left: HERO.x, top: HERO.y + 40, width: 620, height: 330, borderRadius: 48, background: '#fff', boxShadow: '0 40px 90px rgba(20,30,90,.35)', zIndex: 2});
  const num = h(plate, 'c', {left: 310, top: 140, font: '800 200px/1 Inter', letterSpacing: '-.05em', color: M.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'});
  h(plate, 'c', {left: 310, top: 268, font: '600 26px/1 "Inter Tight"', letterSpacing: '.26em', textTransform: 'uppercase', color: M.dim, whiteSpace: 'nowrap'}, esc(p.label));
  const named = p.named.map((n, i) => {
    const pill = h(root, 'c', {left: HERO.x + [-250, 230, -20][i % 3], top: HERO.y + [-280, -200, 340][i % 3], zIndex: 3, height: 96, padding: '0 40px', display: 'flex', alignItems: 'center',
      borderRadius: 999, background: '#fff', font: '800 44px/1 Inter', color: M.ink, boxShadow: `0 0 0 6px ${M.hue.orange}, 0 24px 60px rgba(20,30,90,.35)`, whiteSpace: 'nowrap'}, esc(n.text));
    return {pill, at: n.at, rot: [-6, 5, -3][i % 3]};
  });
  return {
    seek(t) {
      for (const {b, at, x, y, spin} of bubbles) {
        const q = expo(span(t, at, .45));
        set(b, {opacity: t < at ? 0 : 1, transform: `translate(-50%,-50%) translateY(${(1 - q) * (H + 200 - y)}px) rotate(${spin * (1 - q)}deg) scale(${.6 + .4 * q})`});
      }
      popIn(plate, t, p.floodAt + .2, 'translate(-50%,-50%)', {d: .4, from: .7});
      num.innerHTML = `${Math.round(tick(t, p.floodAt, p.floodFor, p.value))}<span style="color:${M.hue.orange}">${esc(p.suffix)}</span>`;
      set(num, {transform: 'translate(-50%,-50%)'});
      for (const n of named) popIn(n.pill, t, n.at, `translate(-50%,-50%) rotate(${n.rot}deg)`, {d: .4, from: .4});
    },
  };
}

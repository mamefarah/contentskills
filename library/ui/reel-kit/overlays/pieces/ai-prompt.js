import {C, SAFE, brand, mix, clamp, easeOut, fadeOut, stage, group, rr, circle, line, text, measure} from '../../ui.js';

// A chat composer above your head types your ask as you say it, shows a slash-command suggestion chip, then sends
// (the button turns into a check and "Sent" appears). Time the overlay so typing runs
// while the words are spoken: it types from 0.2 s to typeEnd (default 0.35 s + 0.05 s a letter) and sends 0.3 s later.
export const meta = {duration: 2.4};
export const defaults = {text: 'turn this into a reel', label: 'To Claude', suggest: '/reel-edit  ·  edits your clip', typeEnd: null, sendAt: null,
  x: SAFE.left, y: SAFE.top + 19, width: SAFE.right - SAFE.left, ...brand({})};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, b = brand(p), svg = stage(el), root = group(svg), live = group(root);
  const W = p.width, sugg = p.suggest || '', H = sugg ? 270 : 205, pad = W * .05;
  const typeEnd = p.typeEnd ?? Math.min((p.life ?? 4) * .6, .35 + p.text.length * .05), send = p.sendAt ?? typeEnd + .3;
  const fs = 49, maxText = W - pad * 2 - H * .35, chipW = sugg ? measure(svg, sugg, 30, 600) + 54 : 0;
  // Pre-measure every typed prefix once so seek() does no layout work.
  const shown = [...Array(p.text.length + 1)].map((_, n) => {
    let s = p.text.slice(0, n); while (s.length > 3 && measure(svg, s, fs, 500) > maxText) s = s.slice(1);
    return {s, w: measure(svg, s, fs, 500)};
  });
  return {
    seek(t) {
      live.replaceChildren();
      const n = Math.floor(p.text.length * clamp((t - .2) / Math.max(.1, typeEnd - .2))), sent = t >= send;
      const caret = Math.floor(t * 2.4) % 2 === 0 || n < p.text.length, done = n >= p.text.length;
      const kin = easeOut(t / .3), lift = sent ? easeOut((t - send) / .3) : 0, s = 1 - .03 * lift;
      const y = p.y - (1 - kin) * 58 - lift * 23, cx = p.x + W / 2;
      root.setAttribute('opacity', clamp(t / .15) * fadeOut(t, p.life));
      root.setAttribute('transform', `translate(${cx} ${y}) scale(${s}) translate(${-W / 2} 0)`);
      const g = group(live, {filter: svg.shadow});
      rr(g, 0, 0, W, H, H * .2, C.card);
      text(live, pad, H * .17, p.label.toUpperCase(), 26, 600, C.muted, 'start', {'letter-spacing': 1});
      const ty = H * .43, {s: typed, w: tw} = shown[n];
      text(live, pad, ty, typed, fs, 500, b.ink);
      if (caret && !sent) rr(live, pad + tw + 3, ty - 28, 4.5, 56, 0, b.accent);
      if (sugg && n >= Math.min(p.text.length, 3) && !sent) {
        rr(live, pad, H * .66, chipW, H * .22, H * .08, mix(b.accent, '#ffffff', .89));
        text(live, pad + 27, H * .77, sugg, 30, 600, b.accent);
      }
      const br = H * .15, bx = W - pad - br, by = sugg ? H * .72 : H * .62;
      circle(live, bx, by, br, done || sent ? b.accent : '#C8CDD6');
      const lw = Math.max(4, br * .2);
      if (sent) {
        line(live, [[bx - br * .4, by], [bx - br * .08, by + br * .32], [bx + br * .45, by - br * .35]], '#fff', br * .22);
        text(live, bx - br * 1.5, by, 'Sent', 28, 600, C.muted, 'end');
      } else {
        line(live, [[bx, by + br * .45], [bx, by - br * .45]], '#fff', lw);
        line(live, [[bx - br * .38, by - br * .08], [bx, by - br * .48], [bx + br * .38, by - br * .08]], '#fff', lw);
      }
    },
  };
}

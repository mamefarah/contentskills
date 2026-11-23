import {say, C, stage, group, rr, circle, text, spark, iconPlus, iconSliders, iconMic, iconArrowUp, EDGE} from '../../ui.js';

// The Claude composer on its own, as a card that floats over footage (transparent around it): the prompt types letter
// by letter with the orange caret, the send button presses, and the box then shows Claude's spinning spark with a
// short `status` line. Place it with x, y (top-left) and w; it is 236 px tall. It glides up into place and leaves
// before `life` ends. Timing: `typeAt` .. `typeAt + typeFor` typing, the send at `sendAt`.
export const meta = {duration: 2.4, live: true};
export const defaults = {text: 'Turn this into a reel', placeholder: 'Reply to Claude...', status: 'Working on it...', typeAt: 0.2, typeFor: 0.9, sendAt: 1.3, x: 40, y: 1150, w: 1000, size: 54};

const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 4);
export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el, null), root = group(svg), base = group(root), live = group(root), msg = String(p.text);
  const {x, y, w} = p, h = 236, ty = y + 74, by = y + 172;
  rr(base, x, y + 10, x + w, y + h + 10, 48, 'rgba(0,0,0,.28)', {filter: 'blur(14px)'});
  rr(base, x, y, x + w, y + h, 48, C.surf, EDGE);
  iconPlus(base, x + 54, by); iconSliders(base, x + 128, by); iconMic(base, x + w - 160, by);
  const life = p.life ?? meta.duration;
  return {seek(t) {
    live.replaceChildren();
    const a = ease(t / .3), b = life ? Math.pow(Math.max(0, Math.min(1, (t - (life - .26)) / .26)), 3) : 0;
    root.setAttribute('opacity', (Math.min(1, t / .16) * (1 - b)).toFixed(3)); root.setAttribute('transform', `translate(0 ${((1 - a) * 60 + b * 40).toFixed(1)})`);
    const n = Math.max(0, Math.min(msg.length, Math.floor((t - p.typeAt) / p.typeFor * msg.length + 1e-6) + (t >= p.typeAt ? 1 : 0)));
    const typed = msg.slice(0, n), sent = t >= p.sendAt, gone = t >= p.sendAt + .14;
    if (gone) { spark(live, x + 66, ty, 26, (t - p.sendAt) * 5); say(live, x + 112, ty, p.status, p.size * .82); }
    else if (typed) {
      const tx = text(live, x + 40, ty, typed, p.size, 450, C.text, 'start', {opacity: sent ? 1 - (t - p.sendAt) / .14 : 1});
      const tw = tx.getComputedTextLength ? tx.getComputedTextLength() : typed.length * p.size * .5;
      if (!sent) rr(live, x + 44 + tw, ty - 32, x + 48 + tw, ty + 32, 0, C.orange);
    } else { if (Math.floor(t * 2.5) % 2 === 0) rr(live, x + 40, ty - 32, x + 44, ty + 32, 0, C.orange); text(live, x + 56, ty, p.placeholder, p.size * .86, 450, C.placeholder); }
    const press = sent ? 1 - .12 * Math.sin(Math.PI * Math.min(1, (t - p.sendAt) / .2)) : 1, cx = x + w - 70, r = 42 * press;
    rr(live, cx - r, by - r, cx + r, by + r, 26 * press, gone ? C.surf2 : sent ? C.orangeHot : typed ? C.orange : C.surf2); iconArrowUp(live, cx, by, gone ? C.muted : '#fff', 19 * press);
  }};
}

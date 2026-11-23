import {IG, IGF, SAFE, clamp, easeOut, easeBack, fadeOut, stage, group, rr, text, measure, fit, person} from '../../ui.js';

// Sending DMs, as the Instagram message thread: a white card under the speaker where your messages pop in one after
// another as outgoing bubbles (right-aligned, the app's blue), then "Delivered" under the last one. For "just send DMs":
// outreach you start yourself, not the comment-keyword auto-DM (that is comment-dm).
// Times (seconds into the overlay): the card arrives by 0.3, bubble i lands at firstAt + i * step.
// `messages` are the lines you send (illustrative copy: write what the speaker would really send). `to` names the thread.
export const meta = {duration: 2.4};
export const defaults = {messages: ['Hey 👋', 'Love what your team is building', 'Can I show you something?'], to: 'New message',
  firstAt: .3, step: .32, x: SAFE.left, y: 1164, width: 910};

const T = (p, x, y, s, size, weight, fill, anchor = 'start') => text(p, x, y, s, size, weight, fill, anchor, {'font-family': IGF});

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), card = group(svg);
  const msgs = (p.messages || []).slice(0, 3), W = p.width, bh = 70, gap = 12, top = 22, size = 32;
  const H = top + msgs.length * bh + (msgs.length - 1) * gap + 34 + 14, maxW = W - 250;
  const lines = msgs.map(m => fit(svg, m, maxW - 56, size, 400, IGF)), widths = lines.map(m => measure(svg, m, size, 400, IGF) + 56);
  rr(card, 0, 0, W, H, 36, IG.white, {filter: svg.shadow});
  person(svg, card, 110, 84, 104, p.to);
  T(card, 110, 176, fit(svg, p.to, 200, 28, 600, IGF), 28, 600, IG.name, 'middle');
  const live = group(card);                                          // the bubbles, redrawn each frame, above the card

  return {
    seek(t) {
      live.replaceChildren();
      const k = easeBack(t / .3);
      card.setAttribute('opacity', clamp(k * 2) * fadeOut(t, p.life));
      card.setAttribute('transform', `translate(${p.x} ${p.y + (1 - k) * 90})`);
      let last = -1;
      lines.forEach((m, i) => {
        const at = p.firstAt + i * p.step;
        if (t < at) return;
        last = i;
        const b = easeBack((t - at) / .22), w = widths[i], x = W - 26 - w, y = top + i * (bh + gap);
        const g = group(live, {opacity: clamp(b * 2), transform: `translate(${x + w} ${y + bh}) scale(${.6 + .4 * b}) translate(${-w} ${-bh})`});
        rr(g, 0, 0, w, bh, bh / 2, IG.send);
        T(g, 28, bh / 2 + 1, m, size, 400, IG.white);
      });
      const sentAt = p.firstAt + last * p.step + .25;
      if (last >= 0 && t >= sentAt) {
        const s = group(live, {opacity: easeOut((t - sentAt) / .2)});
        T(s, W - 30, top + (last + 1) * (bh + gap) + 8, 'Delivered', 24, 500, IG.meta, 'end');
      }
    },
  };
}

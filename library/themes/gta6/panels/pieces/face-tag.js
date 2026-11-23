import {C, FRAME, coastStage, inked, tab, place, span, mix, pop, presence, leave} from '../../coast.js';

// A label that hovers over the speaker with an arrow pointing down at them, and chunky comic corner
// marks around the face. Give it `track` to follow the face, or a fixed `box` (0..1 of the frame).
// In a footage project the player supplies the face position itself (`locate`), adjusted for any zoom.
export const meta = {duration: 4, live: true, wantsFaces: true};
export const defaults = {label: 'THIS GUY', box: {x: .3, y: .3, w: .4, h: .24}, track: null, fill: 'pink', corners: true};

function boxAt(props, t) {
  const track = props.track;
  if (!track?.length) return props.box;
  let i = track.findIndex(s => s[0] > t); if (i < 0) i = track.length - 1;
  const a = track[Math.max(0, i - 1)], b = track[i], q = b[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))) : 0;
  return {x: mix(a[1], b[1], q), y: mix(a[2], b[2], q), w: mix(a[3], b[3], q), h: mix(a[4], b[4], q)};
}

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), g = root.append('g'), marks = [0, 1, 2, 3].map(() => { const m = g.append('g'); inked(m, 'M0 0H86V26H26V86H0Z', {fill: 'yellow', ink: 6, shadow: 7, join: 'miter'}); return m; });
  const arrow = g.append('g'); inked(arrow, 'M-30 -90H30V-20H66L0 60L-66 -20H-30Z', {fill: 'paper', ink: 8, shadow: 9});
  const tag = tab(g, 0, 0, props.label, {size: 64, fill: props.fill});
  return {
    seek(t) {
      // `at` is the video time this overlay started, so the tag follows the face in footage time.
      const b = props.locate ? props.locate(t + (props.at ?? 0)) : boxAt(props, t + (props.at ?? 0)), W = FRAME.width, H = FRAME.height;
      const x0 = Math.max(30, b.x * W - 20), x1 = Math.min(W - 30, (b.x + b.w) * W + 20), y0 = Math.max(260, b.y * H - 40), y1 = Math.min(H - 300, (b.y + b.h) * H + 30), cx = (x0 + x1) / 2;
      root.attr('opacity', presence(t, props.life) * (1 - leave(t, props.life)));
      marks.forEach((m, i) => { const k = pop(t, .1 + i * .05) * (props.corners ? 1 : 0), grow = (1 - span(t, .1, .3)) * 60; place(m, i % 2 ? x1 + grow : x0 - grow, i < 2 ? y0 - grow : y1 + grow, k, [0, 90, 270, 180][i]); });
      const bob = Math.sin(t * 6) * 12;
      place(arrow, cx, y0 - 96 + bob, pop(t, .3)); place(tag.g, cx - tag.w / 2, y0 - 240 + bob * .4, pop(t, .2), -3);
    },
  };
}

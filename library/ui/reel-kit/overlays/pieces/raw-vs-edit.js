import {C, brand, clamp, easeInOut, fadeOut, stage, group, rr, text, captionBar, sticker} from '../../ui.js';

// RAW and EDITED labels for a before/after split, plus what the edit added on the EDITED window: the reel's caption
// (*starred* words on the highlight) and a tilted title sticker. The split itself is a layout; the defaults match
// {"to": "split", "x": 552, "second": {"x": 48, "y": 480, "width": 480, "height": 800, "raw": true}} (RAW left).
// growAt (seconds into the overlay) grows the EDITED rect to the full frame over growRamp, in step with a
// {"to": "full", "ramp": growRamp, "ease": "smooth"} layout at the same moment; the labels fade as it grows.
// (the punch-in is a storyboard zoom; the grade is the clip's look, which the raw window skips).
export const meta = {duration: 3};
export const defaults = {raw: {x: 48, y: 480, width: 480, height: 800}, edited: {x: 552, y: 480, width: 480, height: 800},
  rawLabel: 'RAW', editedLabel: 'EDITED', caption: 'a single *cut*', title: 'ZERO CUTS', growAt: null, growRamp: .45, ...brand({})};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, b = brand(p), svg = stage(el), root = group(svg);
  const rawTag = group(root), edTag = group(root), extras = group(root);
  const tag = (g, rect, label, fill, w) => { rr(g, rect.x + 22, rect.y + 22, w, 54, 16, fill); text(g, rect.x + 22 + w / 2, rect.y + 49, label, 30, 700, C.white, 'middle'); };
  tag(rawTag, p.raw, p.rawLabel, b.ink, 119);
  tag(edTag, p.edited, p.editedLabel, b.accent, 184);
  const words = String(p.caption || '').split(/\s+/).filter(Boolean), full = {x: 0, y: 0, width: 1080, height: 1920};
  // The caption and sticker are drawn once at the EDITED window's size and scaled with it as it grows.
  const e = p.edited, inner = group(extras);
  if (words.length) captionBar(svg, inner, words, e.x + e.width / 2, e.y + e.height * .7, e.width * .075, b);
  if (p.title) sticker(svg, inner, p.title, e.x + e.width / 2, e.y + e.height * .14, e.width * .085, b);
  return {
    seek(t) {
      const g = p.growAt == null ? 0 : easeInOut((t - p.growAt) / p.growRamp), out = fadeOut(t, p.life, .12);
      root.setAttribute('opacity', clamp(t / .2) * out);
      rawTag.setAttribute('opacity', 1 - g); edTag.setAttribute('opacity', clamp((.6 - g) / .2));
      const x = e.x + (full.x - e.x) * g, y = e.y + (full.y - e.y) * g, w = e.width + (full.width - e.width) * g, h = e.height + (full.height - e.height) * g;
      // A uniform scale keeps the type undistorted; the window's aspect barely changes (480x800 -> 1080x1920).
      const k = w / e.width, cx = x + w / 2, cy = y + h / 2;
      inner.setAttribute('transform', `translate(${cx} ${cy}) scale(${k}) translate(${-(e.x + e.width / 2)} ${-(e.y + e.height / 2)})`);
    },
  };
}

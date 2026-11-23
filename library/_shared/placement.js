// Where captions may go on a 1080x1920 frame: off the speaker's face, inside the app safe zone,
// and clear of the graphics drawn that moment. Shared by the footage player (which places captions);
// the numbers live in safe-zone.json, which pipeline/qa.py and library/_shared/signature.py read too.
// Rectangles are [x0, y0, x1, y1] in frame pixels.

/** Reels, TikTok and Shorts cover the top 220 px, the bottom 450 px, 35 px each side, and the button column (right edge x 945) below y 1160 (1080x1920). */
import ZONE from './safe-zone.json' with {type: 'json'};
// Graphics stay inside left..right, top..bottom (rightLow below y = split, the button column); captions may go down to captionBottom.
export const SAFE = {left: ZONE.left, top: ZONE.top, right: ZONE.right, rightLow: ZONE.rightLow, split: ZONE.split, bottom: ZONE.bottom, captionBottom: ZONE.captionBottom};
const safeFor = (W, H) => { const sx = W / 1080, sy = H / 1920; return {left: SAFE.left * sx, top: SAFE.top * sy, right: SAFE.right * sx, rightLow: SAFE.rightLow * sx, split: SAFE.split * sy, captionBottom: SAFE.captionBottom * sy, bottom: SAFE.bottom * sy}; };

/** The face box from the tracker (0..1 of the frame) as the area to keep clear: forehead and hair above the detector box, a little below the chin. */
export function faceKeep(face, W, H, pad = 0) {
  const x = face.x * W, y = face.y * H, w = face.w * W, h = face.h * H;
  return [x - w * (.1 + pad), y - h * (.3 + pad), x + w * (1.1 + pad), y + h * (1.1 + pad)];
}
export const area = r => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]);
export const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

/**
 * Where graphics are drawn, sampled a few times a second (out/occupancy.json from the combiner's first pass):
 * {fps, cols, rows, cell, frames: [hex of the packed cell bits, row by row]}. Returns {covered(t, rect) -> 0..1 of rect drawn on}.
 */
export function readOccupancy(json) {
  if (!json?.frames?.length) return {covered: () => 0};
  const {fps, cols, rows, cell} = json, sums = new Map();
  const table = i => {             // a summed-area table for sample i, built when first needed
    if (sums.has(i)) return sums.get(i);
    const hex = json.frames[i], s = new Uint32Array((cols + 1) * (rows + 1));
    for (let r = 0; r < rows; r++) for (let c = 0, run = 0; c < cols; c++) {
      const bit = r * cols + c, on = (parseInt(hex[bit >> 2], 16) >> (3 - (bit & 3))) & 1;
      run += on; s[(r + 1) * (cols + 1) + c + 1] = s[r * (cols + 1) + c + 1] + run;
    }
    sums.set(i, s); return s;
  };
  return {covered(t, rect) {
    const s = table(Math.max(0, Math.min(json.frames.length - 1, Math.round(t * fps)))), W = cols + 1;
    const c0 = Math.max(0, Math.floor(rect[0] / cell)), r0 = Math.max(0, Math.floor(rect[1] / cell)), c1 = Math.min(cols, Math.ceil(rect[2] / cell)), r1 = Math.min(rows, Math.ceil(rect[3] / cell));
    if (c1 <= c0 || r1 <= r0) return 0;
    const n = s[r1 * W + c1] - s[r0 * W + c1] - s[r1 * W + c0] + s[r0 * W + c0];
    return n / ((c1 - c0) * (r1 - r0));
  }};
}

/** How bad a caption at `rect` is: on the face counts most, then on other graphics, then outside the safe zone. */
export function captionCost(rect, {face, covered, W = 1080, H = 1920}) {
  const z = safeFor(W, H), a = Math.max(1, area(rect)), right = rect[3] > z.split ? z.rightLow : z.right;
  const inside = overlap(rect, [z.left, z.top, right, z.captionBottom]) / a;
  const onFace = face ? overlap(rect, face) / Math.max(1, area(face)) : 0;
  // Any real touch of the face costs more than leaving the safe zone: a caption under the app's own text beats one across the mouth.
  const onGraphic = covered ? covered(rect) : 0;     // text on text is unreadable: also worse than leaving the safe zone
  return 50 * onFace + (onFace > .02 ? 20 : 0) + 10 * onGraphic + (onGraphic > .08 ? 10 : 0) + 5 * (1 - inside);
}

/**
 * Pick a spot for a caption whose natural box is `rect`. Tries, at full size then smaller: the bottom of the safe zone,
 * just under the chin, above the head, then every height up the frame; the first clear spot wins, else the least bad one
 * (which may sit below the safe zone: never on the face if anywhere else is free).
 * Returns {dy, scale, cost}: move the caption down by dy pixels and scale it about its centre.
 */
export function placeCaption(rect, {face, covered, W = 1080, H = 1920}) {
  const z = safeFor(W, H), cx = (rect[0] + rect[2]) / 2, cy = (rect[1] + rect[3]) / 2, w = rect[2] - rect[0], h = rect[3] - rect[1], gap = 24 * H / 1920;
  let best = null;
  for (const scale of [1, .85, .72]) {
    const hw = w * scale / 2, hh = h * scale / 2, at = y => [cx - hw, y - hh, cx + hw, y + hh];
    const bottom = z.captionBottom;
    const ys = [Math.min(cy, bottom - hh)];
    if (face) ys.push(face[3] + gap + hh, face[1] - gap - hh);
    for (let y = bottom - hh; y >= z.top + hh; y -= 20 * H / 1920) ys.push(y);
    for (let y = bottom - hh + 20 * H / 1920; y + hh <= .93 * H; y += 20 * H / 1920) ys.push(y);     // last resort: below the safe zone (qa fails it, but the face stays clear)
    for (const y of ys) {
      if (y - hh < z.top || y + hh > .93 * H) continue;
      const cost = captionCost(at(y), {face, covered, W, H});
      if (cost <= .01) return {dy: y - cy, scale, cost};
      if (!best || cost < best.cost) best = {dy: y - cy, scale, cost};
    }
  }
  return best ?? {dy: 0, scale: 1, cost: captionCost(rect, {face, covered, W, H})};
}

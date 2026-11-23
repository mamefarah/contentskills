"""Turn review frames into storyboard sketches: pencil line art of the real picture, with the speaker's face,
the app safe zone and every graphic's box drawn on top.
  python pipeline/sketch.py <manifest.json>
manifest: {"panels": [{"src": frame.jpg, "dst": sketch.jpg, "face": {x, y, w, h} | null,
                       "boxes": [{x, y, w, h, n}], "safe": true}]}       (all positions 0..1 of the frame)
"""
import json, math, sys
import cv2
import numpy as np

PAPER = np.array([238, 244, 248], np.float32)          # BGR, warm off-white
FACE = (60, 60, 214); BOX = (40, 140, 240); SAFE = (200, 160, 90)
# Reels / TikTok / Shorts cover the top 220 px, bottom 450 px and 35 px each side of a 1080x1920 frame.
SAFE_ZONE = (35 / 1080, 220 / 1920, 1 - 35 / 1080, 1 - 450 / 1920)


def pencil(img):
    h, w = img.shape[:2]
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    blur = cv2.GaussianBlur(255 - g, (0, 0), max(1.5, w * .012))
    dodge = np.clip(g * 256 / np.maximum(1, 256 - blur), 0, 255)            # colour-dodge pencil: flat areas go white, edges stay
    soft = cv2.GaussianBlur(g.astype(np.uint8), (0, 0), max(.8, w * .002))
    edges = cv2.Canny(soft, 40, 110).astype(np.float32) / 255
    out = np.minimum(dodge, 255 - edges * 150)
    tone = 255 - (255 - g) * .16                                              # a light wash so dark areas still read as shapes
    out = np.minimum(out, tone)
    out = 255 - (255 - out) * .9
    grain = np.random.default_rng(7).normal(0, 4, (h, w)).astype(np.float32)
    out = np.clip(out + grain, 0, 255) / 255
    return (out[..., None] * PAPER).astype(np.uint8)


def dashed_line(img, p, q, color, th, dash):
    d = math.dist(p, q); n = max(1, int(d / dash))
    for i in range(0, n, 2):
        a, b = i / n, min(1, (i + 1) / n)
        cv2.line(img, (int(p[0] + (q[0] - p[0]) * a), int(p[1] + (q[1] - p[1]) * a)),
                 (int(p[0] + (q[0] - p[0]) * b), int(p[1] + (q[1] - p[1]) * b)), color, th, cv2.LINE_AA)


def dashed_rect(img, x0, y0, x1, y1, color, th, dash):
    for p, q in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        dashed_line(img, p, q, color, th, dash)


def badge(img, x, y, n, color, r):
    cv2.circle(img, (int(x), int(y)), r, color, -1, cv2.LINE_AA)
    s = str(n); scale = r / 15; (tw, th), _ = cv2.getTextSize(s, cv2.FONT_HERSHEY_SIMPLEX, scale, 2)
    cv2.putText(img, s, (int(x - tw / 2), int(y + th / 2)), cv2.FONT_HERSHEY_SIMPLEX, scale, (255, 255, 255), 2, cv2.LINE_AA)


def annotate(img, panel):
    h, w = img.shape[:2]; th = max(1, round(w / 260)); dash = max(6, w // 45)
    if panel.get('safe', True):
        x0, y0, x1, y1 = SAFE_ZONE
        dashed_rect(img, x0 * w, y0 * h, x1 * w, y1 * h, SAFE, th, dash)
    f = panel.get('face')
    if f:
        cx, cy, rx, ry = (f['x'] + f['w'] / 2) * w, (f['y'] + f['h'] / 2) * h, f['w'] * w / 2 * 1.05, f['h'] * h / 2 * 1.05
        for a in range(0, 360, 16):
            cv2.ellipse(img, (int(cx), int(cy)), (int(rx), int(ry)), 0, a, a + 9, FACE, th + 1, cv2.LINE_AA)
        cv2.putText(img, 'FACE', (int(cx - rx), int(cy - ry - 6)), cv2.FONT_HERSHEY_SIMPLEX, w / 900, FACE, max(1, th), cv2.LINE_AA)
    for b in panel.get('boxes', []):
        x0, y0, x1, y1 = b['x'] * w, b['y'] * h, (b['x'] + b['w']) * w, (b['y'] + b['h']) * h
        inset = th * 2 if b['w'] > .98 and b['h'] > .98 else 0
        dashed_rect(img, x0 + inset, y0 + inset, x1 - inset, y1 - inset, BOX, th + 1, dash)
        badge(img, x0 + inset + w * .045, y0 + inset + w * .045, b['n'], BOX, max(9, int(w * .035)))
    return img


def main():
    manifest = json.load(open(sys.argv[1]))
    for panel in manifest['panels']:
        img = cv2.imread(panel['src'])
        if img is None: raise SystemExit('Could not read ' + panel['src'])
        cv2.imwrite(panel['dst'], annotate(pencil(img), panel), [cv2.IMWRITE_JPEG_QUALITY, 90])


if __name__ == '__main__':
    main()

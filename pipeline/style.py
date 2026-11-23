"""Measure the look of a reference video (a reel someone likes), for pipeline/style.mjs.

    python pipeline/style.py <video> <out dir>

Writes into <out dir>:
  analysis.json  what can be measured: cut pace, the grade (brightness, contrast, saturation, warmth, black and white
                 points), the palette (main colours by share, and the saturated accent colours), how often text is on screen
  sheet.jpg      a contact sheet of moments across the video (just after cuts, and evenly spread), for judging by eye
                 what cannot be measured well: the caption look, fonts, graphics, motion
  frames/        the sampled frames at full size

Nothing here copies the reference: only general traits are taken (colours, pace, grade), never layouts or assets.
"""
import json, sys
from pathlib import Path

import cv2
import numpy as np


def read_frames(path, step):
    cap = cv2.VideoCapture(str(path)); fps = cap.get(cv2.CAP_PROP_FPS) or 30
    i = 0
    while True:
        ok, img = cap.read()
        if not ok: break
        if i % step == 0: yield i / fps, img
        i += 1
    cap.release()


def hist(img):
    small = cv2.resize(img, (96, 170)); hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv], [0, 1, 2], None, [16, 8, 8], [0, 180, 0, 256, 0, 256]); return cv2.normalize(h, h).flatten()


def text_share(img):
    """A rough share of the frame covered by text-like strokes (dense, high-contrast small edges), 0..1."""
    g = cv2.cvtColor(cv2.resize(img, (360, 640)), cv2.COLOR_BGR2GRAY)
    grad = cv2.morphologyEx(g, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    _, bw = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    blobs = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 1)))
    n, _, stats, _ = cv2.connectedComponentsWithStats(blobs)
    area = 0
    for x, y, w, h, a in stats[1:]:
        if 8 <= h <= 60 and w >= h * 1.8 and a / (w * h) > .45: area += w * h
    return min(1., area / (360 * 640))


def hexc(bgr): return '#%02X%02X%02X' % (int(bgr[2]), int(bgr[1]), int(bgr[0]))


def main(video, out):
    out = Path(out); (out / 'frames').mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(video)); fps = cap.get(cv2.CAP_PROP_FPS) or 30; count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); cap.release()
    duration = count / fps

    # cuts: a big jump in colour histogram between frames two apart
    times, prev, cuts, grade, texts = [], None, [], [], []
    pixels = []
    for t, img in read_frames(video, 2):
        h = hist(img)
        if prev is not None and cv2.compareHist(prev, h, cv2.HISTCMP_BHATTACHARYYA) > .38 and (not cuts or t - cuts[-1] > .25): cuts.append(round(t, 2))
        prev = h; times.append(t)
        if len(times) % 6 == 0:
            f = img.astype(np.float32) / 255; lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            grade.append([lum.mean(), lum.std(), hsv[..., 1].mean() / 255, (f[..., 2].mean() - f[..., 0].mean()), np.percentile(lum, 5), np.percentile(lum, 95)])
            texts.append(text_share(img))
            pixels.append(cv2.resize(img, (36, 64)).reshape(-1, 3))
    g = np.array(grade).mean(0)

    # palette: k-means over sampled pixels; accents are the saturated, not-too-dark clusters
    px = np.concatenate(pixels).astype(np.float32)
    _, labels, centers = cv2.kmeans(px, 8, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, .5), 3, cv2.KMEANS_PP_CENTERS)
    share = np.bincount(labels.flatten(), minlength=8) / len(labels)
    palette = []
    for c, s in sorted(zip(centers, share), key=lambda x: -x[1]):
        hsv = cv2.cvtColor(np.uint8([[c]]), cv2.COLOR_BGR2HSV)[0, 0]
        palette.append({'hex': hexc(c), 'share': round(float(s), 3), 'saturation': round(hsv[1] / 255, 2), 'value': round(hsv[2] / 255, 2)})
    # accents: strongly saturated pixels anywhere (small areas: text highlights, stickers, UI), clustered
    allpx = np.concatenate(pixels); hsvall = cv2.cvtColor(allpx.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV).reshape(-1, 3)
    hot = allpx[(hsvall[:, 1] > 150) & (hsvall[:, 2] > 110)].astype(np.float32)
    accents = []
    if len(hot) > 40:
        k = min(4, len(hot) // 10)
        _, lab, cen = cv2.kmeans(hot, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, .5), 3, cv2.KMEANS_PP_CENTERS)
        sh = np.bincount(lab.flatten(), minlength=k) / len(allpx)
        accents = [{'hex': hexc(c), 'share': round(float(s), 4)} for c, s in sorted(zip(cen, sh), key=lambda x: -x[1]) if s > .002]

    # contact sheet: just after each of up to 10 cuts, plus even spread, 15 frames
    picks = sorted(set([round(min(duration - .1, c + .35), 2) for c in cuts[:10]] + [round(duration * (i + .5) / 8, 2) for i in range(8)]))
    while len(picks) > 15: picks.pop(len(picks) // 2)
    cap = cv2.VideoCapture(str(video)); tiles = []
    for t in picks:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000); ok, img = cap.read()
        if not ok: continue
        cv2.imwrite(str(out / 'frames' / f'{t:06.2f}.jpg'), img, [cv2.IMWRITE_JPEG_QUALITY, 90])
        tile = cv2.resize(img, (300, int(300 * img.shape[0] / img.shape[1])))
        cv2.putText(tile, f'{t:.1f}s', (8, 26), cv2.FONT_HERSHEY_SIMPLEX, .7, (0, 0, 0), 4); cv2.putText(tile, f'{t:.1f}s', (8, 26), cv2.FONT_HERSHEY_SIMPLEX, .7, (0, 255, 255), 2)
        tiles.append(tile)
    cap.release()
    cols = 5; h, w = tiles[0].shape[:2]; rows = (len(tiles) + cols - 1) // cols
    sheet = np.zeros((rows * h, cols * w, 3), np.uint8)
    for i, tile in enumerate(tiles): sheet[(i // cols) * h:(i // cols + 1) * h, (i % cols) * w:(i % cols + 1) * w] = tile
    cv2.imwrite(str(out / 'sheet.jpg'), sheet, [cv2.IMWRITE_JPEG_QUALITY, 88])

    shots = np.diff([0] + cuts + [duration]) if cuts else np.array([duration])
    result = {
        'video': str(video), 'duration': round(duration, 2), 'fps': round(fps, 2),
        'pace': {'cuts': len(cuts), 'cutsPerSecond': round(len(cuts) / duration, 2), 'medianShot': round(float(np.median(shots)), 2), 'cutTimes': cuts},
        'grade': {'brightness': round(float(g[0]), 3), 'contrast': round(float(g[1]), 3), 'saturation': round(float(g[2]), 3), 'warmth': round(float(g[3]), 3), 'blacks': round(float(g[4]), 3), 'whites': round(float(g[5]), 3)},
        'palette': palette, 'accents': accents,
        'text': {'meanShare': round(float(np.mean(texts)), 4), 'framesWithText': round(float(np.mean(np.array(texts) > .004)), 2)},
        'sheet': 'sheet.jpg', 'sheetTimes': picks,
    }
    (out / 'analysis.json').write_text(json.dumps(result, indent=2))
    print(json.dumps({k: result[k] for k in ('duration', 'pace', 'grade', 'accents', 'text')}))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

"""Renders this theme's transition previews: the sample clip (under the editorial grade) handing over to a title card.
  .tools/venv-effects/bin/python library/themes/modern/transitions/make_previews.py [name ...]
Each loop is 1.6 seconds at 270x480: a short hold on the clip, the transition, a short hold on the card.
"""
import json, subprocess, sys
from pathlib import Path
import cv2
import numpy as np
here = Path(__file__).resolve().parent
sys.path.insert(0, str(here.parents[2] / '_shared'))
import shader_transitions
from shader_transitions import render
shader_transitions.load_theme(here.parent)                 # this theme's own transitions (theme_transitions.py) and its colours
from effects_engine import effect, load_theme
load_theme(here.parent)

W, H, HOLD, MOVE = 270, 480, 8, 24          # frames: hold, transition, hold = 40 at 30 fps (transitions here are short)
CHAR, WHITE, DIM = (30, 28, 28), (242, 245, 245), (159, 154, 154)
TONES = [((40, 70, 150), (20, 30, 60)), ((120, 110, 60), (40, 40, 30)), ((170, 180, 196), (90, 96, 110))]   # ember, teal, bone (BGR, lit / shade)

def graphic():
    """A stand-in for a title card in the theme's look (BGR): the charcoal canvas, three vertical studio-tone strips
    with staggered edges, one heavy white word across them and small tracked labels. Drawn at 4x and reduced."""
    s = 4; w, h = W * s, H * s
    image = np.zeros((h, w, 3), np.float32) + np.float32(CHAR)
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    gap, sw = 6 * s, (w - 2 * 18 * s - 2 * 6 * s) / 3
    for i, (top, bottom) in enumerate(((.16, .78), (.1, .86), (.2, .74))):
        x0 = 18 * s + i * (sw + gap); lit, shade = (np.float32(c) for c in TONES[i])
        light = np.exp(-(((x - x0 - sw * .35) / (sw * .7)) ** 2 + ((y - h * .38) / (h * .35)) ** 2))[..., None]
        box = ((x >= x0) & (x < x0 + sw) & (y >= h * top) & (y < h * bottom))[..., None]
        image = np.where(box, shade + (lit - shade) * light, image)
    image += np.random.default_rng(3).normal(0, 2.5, (h, w, 1)).astype(np.float32)
    image = np.clip(image, 0, 255).astype(np.uint8)
    def text(label, yy, scale, color, thick, gap, font=cv2.FONT_HERSHEY_DUPLEX):
        sizes = [cv2.getTextSize(c, font, scale * s, thick * s)[0][0] for c in label]; total = sum(sizes) + gap * s * (len(label) - 1); xx = (w - total) // 2
        for i, c in enumerate(label):
            cv2.putText(image, c, (xx, int(yy * s)), font, scale * s, color, thick * s, cv2.LINE_AA); xx += sizes[i] + gap * s
    text('NEXT', 262, 1.9, WHITE, 5, 3)
    text('CHAPTER 02', 64, .3, WHITE, 1, 4, cv2.FONT_HERSHEY_SIMPLEX)
    text('ILLUSTRATIVE', 440, .26, DIM, 1, 4, cv2.FONT_HERSHEY_SIMPLEX)
    return cv2.resize(image, (W, H), interpolation=cv2.INTER_AREA)

if __name__ == '__main__':
    video = cv2.VideoCapture(str(here.parents[2] / '_shared/sample/clip.mp4'))
    video.set(cv2.CAP_PROP_POS_FRAMES, 30)
    frames = [effect('editorial_grade', cv2.resize(video.read()[1], (W, H), interpolation=cv2.INTER_AREA), 0, .85, i, 1) for i in range(HOLD + MOVE)]
    target = graphic()
    wanted = set(sys.argv[1:])
    (here / 'clips').mkdir(exist_ok=True)
    for item in json.loads((here / 'catalog.json').read_text())['items']:
        name = item['id']
        if wanted and name not in wanted: continue
        out = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', '30', '-i', 'pipe:0', '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(here / 'clips' / f'{name}.mp4')], stdin=subprocess.PIPE)
        for i in range(HOLD + MOVE + HOLD):
            progress = (i - HOLD + 1) / (MOVE + 1)             # never quite 0 or 1 while moving
            out.stdin.write(render(name, frames[min(i, len(frames) - 1)], target, progress, item.get('params')).tobytes())
        out.stdin.close(); out.wait(); print(name)

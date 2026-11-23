"""Renders this theme's transition previews: the sample clip handing over to a graphics frame.
  .tools/venv-effects/bin/python library/themes/gta6/transitions/make_previews.py [name ...]
Each loop is 1.6 seconds at 270x480: a short hold on the clip, the transition, a short hold on the graphic.
"""
import json, math, subprocess, sys
from pathlib import Path
import cv2
import numpy as np
here = Path(__file__).resolve().parent
sys.path.insert(0, str(here.parents[2] / '_shared'))
import shader_transitions
from shader_transitions import render
shader_transitions.load_theme(here.parent)                 # a theme's own transitions and colours, if it has transitions/theme_transitions.py

W, H, HOLD, MOVE = 270, 480, 8, 32          # frames: hold, transition, hold = 48 at 30 fps
bgr = lambda h: (int(h[5:7], 16), int(h[3:5], 16), int(h[1:3], 16))
INK, CREAM, NIGHT, PLUM, VIOLET, PINK, ORANGE, YELLOW, TEAL = map(bgr, ('#190b33', '#fff4e0', '#24104f', '#3b1a78', '#5a2bd0', '#ff3f97', '#ff8a30', '#ffd447', '#12c4c0'))

def graphic():
    """A stand-in for a graphics shot in the theme's look (BGR): sunset sky, sun, a tilted panel card with chunky bars.
    Drawn at 4x and reduced, for clean ink lines."""
    s = 4; w, h = W * s, H * s
    stops = np.array([VIOLET, PINK, ORANGE, YELLOW], np.float32)
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None] ** .9 * 3; i = np.clip(t.astype(int), 0, 2)
    image = np.ascontiguousarray(np.broadcast_to((stops[i[:, 0]] * (1 - (t - i)) + stops[i[:, 0] + 1] * (t - i))[:, None, :], (h, w, 3)).astype(np.uint8))
    sun = (int(w * .5), int(h * .3)); cv2.circle(image, sun, int(w * .27), INK, -1, cv2.LINE_AA); cv2.circle(image, sun, int(w * .27) - s * 3, YELLOW, -1, cv2.LINE_AA)
    for k in range(5):                                                                  # slits across the lower half of the sun
        y = sun[1] + int(w * (.04 + k * .05)); cv2.rectangle(image, (sun[0] - int(w * .3), y), (sun[0] + int(w * .3), y + s * (2 + k)), PINK, -1)
    def quad(points, fill, shadow=0):
        pts = np.int32([[x * w, y * h] for x, y in points])
        if shadow: cv2.fillPoly(image, [pts + s * shadow], INK, cv2.LINE_AA)
        cv2.fillPoly(image, [pts], fill, cv2.LINE_AA)
        return pts
    card = [(.09, .45), (.93, .42), (.9, .9), (.07, .88)]
    pts = quad(card, CREAM, 5); cv2.polylines(image, [pts], True, INK, s * 3, cv2.LINE_AA)
    inner = quad([(.125, .472), (.895, .446), (.87, .876), (.105, .858)], NIGHT); cv2.polylines(image, [inner], True, INK, s * 2, cv2.LINE_AA)
    for k, (value, color) in enumerate([(.45, TEAL), (.7, PINK), (.55, ORANGE), (.95, YELLOW)]):
        x0 = .18 + k * .17; top = .83 - value * .27 - k * .004
        bar = quad([(x0, top), (x0 + .115, top - .004), (x0 + .115, .83 - k * .004), (x0, .834 - k * .004)], color, 3); cv2.polylines(image, [bar], True, INK, s * 2, cv2.LINE_AA)
    def text(label, y, scale, color, thick):
        size = cv2.getTextSize(label, cv2.FONT_HERSHEY_DUPLEX, scale * s, thick * s)[0]; x = (w - size[0]) // 2
        cv2.putText(image, label, (x + s * 2, y * s + s * 2), cv2.FONT_HERSHEY_DUPLEX, scale * s, INK, (thick + 4) * s, cv2.LINE_AA)
        cv2.putText(image, label, (x, y * s), cv2.FONT_HERSHEY_DUPLEX, scale * s, INK, (thick + 4) * s, cv2.LINE_AA)
        cv2.putText(image, label, (x, y * s), cv2.FONT_HERSHEY_DUPLEX, scale * s, color, thick * s, cv2.LINE_AA)
    text('NEXT SHOT', 58, .95, CREAM, 3)
    tag = quad([(.12, .405), (.52, .39), (.53, .455), (.13, .47)], PINK, 3); cv2.polylines(image, [tag], True, INK, s * 2, cv2.LINE_AA)
    cv2.putText(image, 'ILLUSTRATIVE', (int(w * .15), int(h * .448)), cv2.FONT_HERSHEY_DUPLEX, .42 * s, CREAM, s, cv2.LINE_AA)
    return cv2.resize(image, (W, H), interpolation=cv2.INTER_AREA)

if __name__ == '__main__':
    video = cv2.VideoCapture(str(here.parents[2] / '_shared/sample/clip.mp4'))
    video.set(cv2.CAP_PROP_POS_FRAMES, 30)
    frames = [cv2.resize(video.read()[1], (W, H), interpolation=cv2.INTER_AREA) for _ in range(HOLD + MOVE)]
    target = graphic()
    wanted = set(sys.argv[1:])
    (here / 'clips').mkdir(exist_ok=True)
    for item in json.loads((here / 'catalog.json').read_text())['items']:
        name = item['id']
        if wanted and name not in wanted: continue
        out = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', '30', '-i', 'pipe:0', '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(here / 'clips' / f'{name}.mp4')], stdin=subprocess.PIPE)
        for i in range(HOLD + MOVE + HOLD):
            progress = (i - HOLD + 1) / (MOVE + 1)             # never quite 0 or 1 while moving
            out.stdin.write(render(name, frames[min(i, len(frames) - 1)], target, progress).tobytes())
        out.stdin.close(); out.wait(); print(name)

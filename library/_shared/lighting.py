"""Lighting setups: relight footage of a person in 9 lighting schemes. Original OpenCV work.

Every function has the effects-engine contract: fn(img, progress, amount, frame, seed) -> img
(BGR uint8 in and out, amount 0..1, stateless and deterministic, the source is never modified).
The face is found with YuNet (library/models/yunet) and the person is cut out with PP-HumanSeg
(library/models/pphumanseg), so the light sits on the person wherever they are in the frame. Light maps are built at reduced size and scaled up.

Names: light_<scheme>. Shown in every theme's effects catalog under the "Lighting" group.
"""
import math
from functools import lru_cache
from pathlib import Path
import cv2
import numpy as np

MODELS = Path(__file__).resolve().parents[1] / 'models'
MODEL = MODELS / 'yunet' / 'face_detection_yunet_2026may.onnx'
SEG_MODEL = MODELS / 'pphumanseg' / 'human_segmentation_pphumanseg_2023mar.onnx'
WORK = 360            # light maps are computed at this width


# ---------- finding the person ----------
@lru_cache(maxsize=1)
def _detector():
    if not MODEL.exists(): return None
    try: return cv2.FaceDetectorYN.create(str(MODEL), '', (320, 320), 0.6, 0.3, 5)
    except Exception: return None

_last = {}
def _face(img, frame):
    """(cx, cy, fw, fh) of the largest face in 0..1 of the frame; the last one found, or a centred guess."""
    key = (img.shape[:2], int(frame))
    if key in _last: return _last[key]
    h, w = img.shape[:2]; s = 320 / max(h, w); small = cv2.resize(img, (max(8, int(w * s)), max(8, int(h * s))), interpolation=cv2.INTER_AREA)
    det, found = _detector(), None
    if det is not None:
        det.setInputSize((small.shape[1], small.shape[0])); _, faces = det.detect(small)
        if faces is not None and len(faces):
            x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])[:4]
            found = ((x + fw / 2) / small.shape[1], (y + fh / 2) / small.shape[0], fw / small.shape[1], fh / small.shape[0])
    if found is None: found = _last.get('any', (.5, .3, .16, .1))
    _last.clear(); _last[key] = found; _last['any'] = found
    return found


def _person(face, h, w):
    """Soft mask (0..1, h x w) of head, shoulders and body hanging from the face."""
    cx, cy, fw, fh = face; m = np.zeros((h, w), np.float32)
    X, Y, FW, FH = cx * w, cy * h, fw * w, fh * h
    cv2.ellipse(m, (int(X), int(Y - FH * .1)), (int(FW * .62), int(FH * .8)), 0, 0, 360, 1, -1)
    top = Y + FH * .55
    body = np.array([[X - FW * .45, top], [X + FW * .45, top], [X + FW * 1.55, top + FH * 1.1], [X + FW * 1.5, h],
                     [X - FW * 1.5, h], [X - FW * 1.55, top + FH * 1.1]], np.int32)
    cv2.fillPoly(m, [body], 1)
    return cv2.GaussianBlur(m, (0, 0), max(1.5, FW * .12))


@lru_cache(maxsize=1)
def _segmenter():
    if not SEG_MODEL.exists(): return None
    try: return cv2.dnn.readNet(str(SEG_MODEL))
    except Exception: return None

_cut = {}
def _seg(net, img):
    """PP-HumanSeg person probability of a picture, at the model's 192x192."""
    x = cv2.resize(img, (192, 192), interpolation=cv2.INTER_AREA)[:, :, ::-1].astype(np.float32) / 255
    net.setInput(cv2.dnn.blobFromImage((x - .5) / .5)); return net.forward()[0, 1]


def _refine(img, rough, w, h, frame, face=None):
    """Soft person matte at working size: PP-HumanSeg, edges snapped to the picture; the face-based estimate if the model is missing.
    With `face`, a second pass on a crop around the head (hair included) replaces the head region: the model then sees the
    hair at several times the resolution, so its outline follows the hair instead of a blob."""
    key = (img.shape[:2], int(frame), w)
    if key in _cut: return _cut[key]
    net, m = _segmenter(), rough
    if net is not None:
        prob = cv2.resize(_seg(net, img), (w, h), interpolation=cv2.INTER_CUBIC)
        if face is not None:
            H, W = img.shape[:2]; cx, cy, fw, fh = face
            x0, x1 = max(0, int((cx - fw * 2.1) * W)), min(W, int((cx + fw * 2.1) * W)); y0, y1 = max(0, int((cy - fh * 2.4) * H)), min(H, int((cy + fh * 1.8) * H))
            if x1 - x0 > 32 and y1 - y0 > 32:
                head = _seg(net, img[y0:y1, x0:x1])
                a0, a1, b0, b1 = int(x0 * w / W), int(x1 * w / W), int(y0 * h / H), int(y1 * h / H)
                if a1 > a0 + 4 and b1 > b0 + 4:
                    sub = cv2.resize(head, (a1 - a0, b1 - b0), interpolation=cv2.INTER_CUBIC)
                    gy, gx = np.mgrid[0:b1 - b0, 0:a1 - a0].astype(np.float32)          # feather the crop's own edges into the whole-frame pass
                    sides = [gx, gy, (a1 - a0 - 1) - gx] + ([] if y1 >= H else [(b1 - b0 - 1) - gy])      # no feather where the crop meets the frame's bottom
                    k = np.clip(np.minimum.reduce(sides) / max(4., (a1 - a0) * .08), 0, 1)
                    prob[b0:b1, a0:a1] = sub * k + prob[b0:b1, a0:a1] * (1 - k)
        guide = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
        try: prob = cv2.ximgproc.guidedFilter(guide, prob.astype(np.float32), max(2, w // 90), 1e-3)
        except AttributeError: pass
        m = np.clip((prob - .5) * 3 + .5, 0, 1).astype(np.float32)
        if m.mean() < .01: m = rough                      # nobody found: fall back to the estimate
    m = cv2.GaussianBlur(m, (0, 0), max(.6, w * .003))
    _cut.clear(); _cut[key] = m
    return m


def person_mask(img, frame=0):
    """The person in this exact picture as a full-size soft matte (H x W float32, 0..1), edges snapped to the picture.
    Used by pipeline/composite.py for overlays with "behind": "person". The per-frame caches are dropped first: an effect
    may already have cut out a differently framed picture (before zoom or layout placement) at the same frame number."""
    H, W = img.shape[:2]; w = min(WORK, W); h = max(2, round(H * w / W))
    _last.pop((img.shape[:2], int(frame)), None); _cut.pop((img.shape[:2], int(frame), w), None)
    face = _face(img, frame); m = _refine(img, _person(face, h, w), w, h, frame, face)
    hw, hh = max(2, W // 2), max(2, H // 2); r = max(2, hw // 120)            # guided filter at half size (as signature.person does)
    I = cv2.cvtColor(cv2.resize(img, (hw, hh), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    p = cv2.resize(m, (hw, hh), interpolation=cv2.INTER_LINEAR); box = lambda x: cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1))
    mI, mp = box(I), box(p); a = (box(I * p) - mI * mp) / (box(I * I) - mI * mI + 2e-3); p = np.clip(box(a) * I + box(mp - a * mI), 0, 1)
    return np.clip((cv2.resize(p, (W, H), interpolation=cv2.INTER_LINEAR) - .5) * 1.6 + .5, 0, 1).astype(np.float32)


@lru_cache(maxsize=4)
def _grid(h, w):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x / max(1, w - 1), y / max(1, h - 1)


def _ss(e0, e1, x): t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def _col(hexrgb): v = hexrgb.lstrip('#'); return np.array([int(v[4:6], 16), int(v[2:4], 16), int(v[0:2], 16)], np.float32) / 255
def _lum(f): return (f[..., 0] * .114 + f[..., 1] * .587 + f[..., 2] * .299)[..., None]


class Scene:
    """Everything a lighting scheme needs, at working size, plus helpers to finish at full size."""
    def __init__(self, img, frame, seed):
        self.img, self.H, self.W = img, img.shape[0], img.shape[1]
        self.w = min(WORK, self.W); self.h = max(2, round(self.H * self.w / self.W))
        self.face = _face(img, frame); self.frame, self.seed = frame, seed
        self.x, self.y = _grid(self.h, self.w)
        self._rough = _person(self.face, self.h, self.w); self._mask = None
        cx, cy, fw, fh = self.face; self.cx, self.cy, self.fw, self.fh = cx, cy, fw, fh
        self.aspect = self.H / self.W

    @property
    def mask(self):
        """The person as a soft matte (cached per frame)."""
        if self._mask is None: self._mask = _refine(self.img, self._rough, self.w, self.h, self.frame)
        return self._mask

    def dist(self, px, py):
        """Distance from (px, py) in frame widths."""
        return np.sqrt((self.x - px) ** 2 + ((self.y - py) * self.aspect) ** 2)

    def up(self, a):
        """A working-size map (h x w or h x w x 3) at full size, as float32 with a colour axis."""
        a = cv2.resize(a.astype(np.float32), (self.W, self.H), interpolation=cv2.INTER_LINEAR)
        return a if a.ndim == 3 else a[..., None]


def _finish(img, out, amount):
    out = np.clip(out, 0, 1)
    if amount < 1: out = img.astype(np.float32) / 255 * (1 - amount) + out * amount
    return np.clip(np.rint(out * 255), 0, 255).astype(np.uint8)


def _relight(s, light, ambient, tint=None, lift=0.0, sat=1.0, contrast=1.0):
    """Multiply the footage by an RGB light map (working size, h x w x 3) on top of a tinted ambient."""
    f = s.img.astype(np.float32) / 255
    if sat != 1: g = _lum(f); f = g + (f - g) * sat
    if contrast != 1: f = np.clip((f - .5) * contrast + .5, 0, 1)
    amb = np.ones(3, np.float32) * ambient if tint is None else _col(tint) * ambient
    return f * (amb + s.up(light)) + lift


def _add(out, s, glow):
    """Screen-blend an RGB glow (working size) on top: light in the air, flares, haze."""
    g = np.clip(s.up(glow), 0, 1)
    return 1 - (1 - np.clip(out, 0, 1)) * (1 - g)


def _gobo_rects(s, rects, angle, soft):
    """Hard light through openings (windows, blinds): rects in 0..1 frame space, sheared by angle."""
    m = np.zeros((s.h, s.w), np.float32)
    for x0, y0, x1, y1 in rects:
        k = math.tan(math.radians(angle)); pts = np.array([[x0, y0], [x1, y0], [x1 + k * (y1 - y0), y1], [x0 + k * (y1 - y0), y1]]) * [s.w, s.h]
        cv2.fillPoly(m, [pts.astype(np.int32)], 1)
    return cv2.GaussianBlur(m, (0, 0), max(.5, s.w * soft))


def _leaves(s, scale, seed):
    """Dappled light through leaves: thresholded smooth noise."""
    rng = np.random.default_rng(seed); n = rng.random((max(2, int(s.h / scale)), max(2, int(s.w / scale)))).astype(np.float32)
    n = cv2.resize(n, (s.w, s.h), interpolation=cv2.INTER_CUBIC); n = cv2.GaussianBlur(n, (0, 0), s.w * .01)
    return _ss(.5, .56, n)


def _rim(s, width=.012):
    """A thin band just inside the person's outline."""
    m = s.mask; inner = cv2.GaussianBlur(m, (0, 0), s.w * width)
    return np.clip((m - inner) * 2.5, 0, 1) * (m > .2) * _ss(s.cy + s.fh * 5, s.cy - s.fh, s.y)   # strongest on head and shoulders


# ---------- the 9 schemes ----------
def spotlight(s, p):
    pool = np.exp(-(s.dist(s.cx, s.cy + s.fh * .3) / max(.3, s.fw * 1.4)) ** 2)
    return _relight(s, pool[..., None] * _col('#fff1dc') * 1.35, .1)

def rim(s, p):
    edge = _rim(s, .01)
    out = _relight(s, (s.mask * .35)[..., None] * _col('#d9e6ff'), .22, '#9aa6c0', sat=.85)
    return _add(out, s, edge[..., None] * _col('#f2f6ff') * 1.1)

def flashlight(s, p):
    ox, oy = math.sin(p * math.pi * 2) * .03, math.cos(p * math.pi * 1.3) * .02
    r = max(.17, s.fw * .8); pool = _ss(r, r * .82, s.dist(s.cx + ox, s.cy + oy))
    return _relight(s, pool[..., None] * _col('#fffaf0') * 1.35, .1, '#8890a8')

def golden_hour(s, p):
    leaves = cv2.GaussianBlur(_leaves(s, 6, s.seed), (0, 0), s.w * .004) * _ss(.1, .75, s.x)
    light = (.4 + leaves * .4)[..., None] * _col('#ffb060')
    return _relight(s, light, .55, '#ffcf9a', sat=1.15)

def neon(s, p):
    flick = 1 - .08 * (math.sin(s.frame * 2.7) > .9)
    pink = _ss(.55, 0, s.x) * flick
    cyan = _ss(.6, 1, s.x) * .45
    light = pink[..., None] * _col('#ff2fa8') * 1.3 + cyan[..., None] * _col('#25d8ff')
    out = _relight(s, light, .12, '#5a4a70', sat=.6)
    return _add(out, s, (_ss(.12, 0, s.x) * (1 - s.mask))[..., None] * _col('#ff2fa8') * .6)

def projector(s, p):
    flare = np.exp(-(s.dist(s.cx + s.fw * .3, s.cy - s.fh * .55) / .06) ** 2)
    haze = np.exp(-(s.dist(s.cx + s.fw * .3, s.cy - s.fh * .55) / .3) ** 2) * .5
    ang = np.arctan2((s.y - (s.cy - s.fh * .55)) * s.aspect, s.x - (s.cx + s.fw * .3))
    rays = (np.cos(ang * 9 + p) ** 16) * np.exp(-(s.dist(s.cx + s.fw * .3, s.cy - s.fh * .55) / .2) ** 2) * .5
    out = _relight(s, (s.mask * .2)[..., None] * _col('#aef0ff'), .3, '#3e7e8c', sat=.7)
    return _add(out, s, (flare + haze + rays)[..., None] * _col('#d6fbff'))

def under_light(s, p):
    key = _ss(s.cy - s.fh * .8, s.cy + s.fh * .6, s.y) * np.exp(-((s.x - s.cx) / max(.3, s.fw * 1.8)) ** 2) * (.3 + .7 * s.mask)
    return _relight(s, key[..., None] * _col('#ffd6a8') * 1.4, .18, '#7a7a98')

def low_key(s, p):
    key = np.exp(-(s.dist(s.cx - .04, s.cy + s.fh * .3) / .28) ** 2) * (.3 + .7 * s.mask)
    return _relight(s, key[..., None] * _col('#f6ecdf') * 1.05, .05, contrast=1.2)

def silhouette(s, p):
    glow = np.exp(-(s.dist(s.cx, s.cy + s.fh) / .55) ** 2)
    bg = (.65 + .45 * glow)[..., None] * _col('#fff0dc')
    f = s.img.astype(np.float32) / 255
    m = s.up(np.clip(s.mask * 1.15, 0, 1))
    dark = f * .07 + _lum(f) * .03
    out = s.up(bg) * (1 - m) + dark * m
    return _add(out, s, (_rim(s, .006) * .35)[..., None] * _col('#ffe8c8'))


SCHEMES = {
    'spotlight': (spotlight, 'Spotlight', 'A warm pool of light from above on the person; the room falls away to near-black.'),
    'rim': (rim, 'Rim light', 'Dark, cool scene; a thin bright outline traces the person.'),
    'flashlight': (flashlight, 'Flashlight', 'A hard round beam on the face that drifts a little; everything else dark.'),
    'golden_hour': (golden_hour, 'Golden hour', 'Low warm sun with leaf shadows dappled across the scene.'),
    'neon': (neon, 'Neon', 'Hot magenta from one side, a cyan touch from the other, dark in between.'),
    'projector': (projector, 'Projector', 'A bright lamp flaring behind the head through haze, teal room.'),
    'under_light': (under_light, 'Under light', 'Light from below: the campfire or horror look.'),
    'low_key': (low_key, 'Low key', 'Mostly shadow: one small key on the face, deep blacks.'),
    'silhouette': (silhouette, 'Silhouette', 'Bright hazy background, the person a dark shape with a faint edge.'),
}


def _make(fn):
    def run(img, progress, amount, frame, seed):
        s = Scene(img, frame, seed)
        return _finish(img, fn(s, progress), amount)
    return run

LIGHTS = {'light_' + k: _make(v[0]) for k, v in SCHEMES.items()}

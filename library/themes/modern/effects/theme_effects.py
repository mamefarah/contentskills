"""Modern theme effects. Loaded by library/_shared/effects_engine.load_theme().

    EFFECTS = {name: fn(img, progress, amount, frame, seed, props=None) -> img}     BGR uint8 in and out

The style: a near-black charcoal canvas (#1c1c1e) round full-bleed vertical pictures; the frame splits into
staggered vertical strips, a 2x2 mosaic, a slot that widens or a card that punches up to full frame, on a
fast beat (0.2 s grid) with expo-out arrivals and hard cuts. Colour comes from the footage only.

Every effect is stateless and deterministic (it sees one frame at a time; randomness only from seed and frame),
never modifies its input, and fades to the untouched picture as amount goes to 0. Each takes options through
`props` (the storyboard effect entry's "props"; the pipeline adds `seconds` and `fps`). Because effects see only
the current frame, strips and mosaic cells vary by crop, zoom, mirror and grade rather than by time offset.

Layout effects (strip_split, mosaic, punch_zoom, slot_reveal) time themselves over the effect's seconds:
use "where": "all" and "amount": 1. `face: [u, v]` (shares of the frame, default [.5, .4]) is where crops centre.
"""
import math
from functools import lru_cache
import cv2
import numpy as np

CHAR = np.array([30, 28, 28], np.float32) / 255           # #1c1c1e as BGR
STEP = .2                                                   # the beat grid (s)


def _u8(a): return np.clip(np.rint(a * 255), 0, 255).astype(np.uint8)
def _f(img): return img.astype(np.float32) * (1 / 255)
def _c(x, lo=0., hi=1.): return min(max(x, lo), hi)
def _snap(x): x = _c(x); return 1. if x >= 1 else 1 - 2 ** (-10 * x)                # expo-out: the theme's arrival
def _punch(x, c=1.25): x = _c(x); return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2   # back-out, small overshoot
def _ein(x): return _c(x) ** 3
def _hash(n, seed=0):
    x = math.sin(n * 127.1 + seed * 311.7 + 74.7) * 43758.5453
    return x - math.floor(x)
def _p(props, key, default):
    v = (props or {}).get(key, default)
    return default if v is None else v
def _secs(props): return float(_p(props, 'seconds', 2.0))
def _fps(props): return float(_p(props, 'fps', 30))


def _crop(img, zoom, cx, cy, w, h, mirror=False):
    """A w x h picture from img, zoomed by `zoom` (>= cover) round (cx, cy) in 0..1, filling the box (no stretch)."""
    H, W = img.shape[:2]
    s = max(w / W, h / H) * zoom                        # scale so the source covers the box, then zoom in
    sw, sh = w / s, h / s                               # source window size
    x0 = _c(cx * W - sw / 2, 0, max(0, W - sw)); y0 = _c(cy * H - sh / 2, 0, max(0, H - sh))
    M = np.float32([[s, 0, -x0 * s], [0, s, -y0 * s]])
    out = cv2.warpAffine(img, M, (int(w), int(h)), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return out[:, ::-1] if mirror else out


def _paste(dst, src, x, y):
    """Paste src into dst with its top-left at (x, y), clipped to dst."""
    H, W = dst.shape[:2]; h, w = src.shape[:2]; x, y = int(round(x)), int(round(y))
    ax, ay, bx, by = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if bx > ax and by > ay: dst[ay:by, ax:bx] = src[ay - y:by - y, ax - x:bx - x]


def _grade(img, kind):
    """Per-panel variants so strips/cells read as different pictures: none, mono, warm, cool, punch."""
    if kind == 'mono':
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); g = cv2.convertScaleAbs(g, alpha=1.18, beta=-14)
        return cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
    f = _f(img)
    if kind == 'warm': f = f * np.array([.86, .98, 1.1], np.float32)
    elif kind == 'cool': f = f * np.array([1.1, 1.0, .88], np.float32)
    elif kind == 'punch': f = np.clip((f - .5) * 1.3 + .5, 0, 1)
    else: return img
    return _u8(f)


def _mix(base, fx, a):
    if a >= 1: return fx
    return cv2.addWeighted(fx, float(a), base, 1 - float(a), 0)


# ---------------------------------------------------------------- the look
def editorial_grade(img, p, a, frame, seed, props=None):
    """The theme look (footage.look, about 0.8): clean contrasty fashion grade. A soft S-curve, blacks set down
    to the charcoal of the canvas (not crushed to pure black), saturation eased back with skin kept warm,
    cool shadows / neutral highlights, a light vignette. Options: contrast (1.0), warmth (0 = neutral,
    + warmer), fade (how far blacks lift toward charcoal, 0.6), mono (0..1 toward black and white)."""
    f = _f(img); con = float(_p(props, 'contrast', 1.0)); warm = float(_p(props, 'warmth', 0)); fade = float(_p(props, 'fade', .6)); mono = float(_p(props, 'mono', 0))
    l = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)[..., None]
    s = .82 + .1 * (1 - mono)                                      # ease saturation back
    f = l + (f - l) * (s * (1 - mono))
    x = np.clip(f, 0, 1); k = 1.35 * con
    curve = 1 / (1 + np.exp(-k * 4 * (x - .5)))                    # S-curve, normalised to 0..1
    lo, hi = 1 / (1 + math.exp(k * 2)), 1 / (1 + math.exp(-k * 2))
    f = (curve - lo) / (hi - lo)
    sh = np.clip(1 - cv2.cvtColor(f.astype(np.float32), cv2.COLOR_BGR2GRAY) * 2.2, 0, 1)[..., None]
    f = f + sh * np.array([.035, .012, -.02], np.float32)          # cool the shadows a touch
    f = f * np.array([1 - .04 * warm, 1, 1 + .05 * warm], np.float32)
    f = CHAR * fade + f * (1 - CHAR * fade)                        # blacks sit at charcoal
    h, w = f.shape[:2]; vig = _vig(h, w)
    f = f * vig
    return _mix(img, _u8(f), a)


@lru_cache(maxsize=8)
def _vig(h, w):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = ((x / w - .5) ** 2 * 1.4 + (y / h - .45) ** 2) * 1.6
    return np.clip(1 - d * .55, .7, 1)[..., None]


# ---------------------------------------------------------------- layouts
def strip_split(img, p, a, frame, seed, props=None):
    """The frame splits into 2-3 vertical strips of the clip at different crops and zooms (one mirrored, one in
    black and white), with staggered top/bottom edges on charcoal. Strips slide in from alternate ends on the
    beat at the start and slide out at the end. Options: n (3), gap (frame px at 1080 wide, 8), stagger (share
    of height the edges step, .05), zooms ([1.0, 1.7, 1.25]), grades (['none', 'mono', 'warm']), out (true:
    leave at the end), face ([.5, .4])."""
    H, W = img.shape[:2]; sc = W / 1080; n = int(_c(_p(props, 'n', 3), 2, 4)); gap = float(_p(props, 'gap', 8)) * sc
    stag = float(_p(props, 'stagger', .05)) * H; zooms = _p(props, 'zooms', [1.0, 1.7, 1.25, 1.45]); grades = _p(props, 'grades', ['none', 'mono', 'warm', 'cool'])
    fu, fv = _p(props, 'face', [.5, .4]); T = _secs(props); t = p * T; out = bool(_p(props, 'out', True))
    sw = (W - gap * (n - 1)) / n; canvas = np.full_like(img, _u8(CHAR))
    for i in range(n):
        off = (stag if i % 2 else (0 if i == 0 else -stag * .5)) + (0 if i % 2 else stag * .3)
        h = int(H - stag * 1.2); x = i * (sw + gap); y = off
        zoom = float(zooms[i % len(zooms)]); u = fu + (i - (n - 1) / 2) * .12 / zoom
        pic = _grade(_crop(img, zoom, u, fv, int(math.ceil(sw)), h, mirror=(i == n - 1 and n > 2)), grades[i % len(grades)])
        d = -1 if i % 2 else 1
        ain = _snap((t - i * STEP * .5) / (STEP * 1.6))
        aout = _ein((t - (T - STEP * 2.2) - i * STEP * .3) / (STEP * 1.2)) if out else 0
        dy = (1 - ain) * d * H * 1.05 - aout * d * H * 1.05
        if ain > 0 and aout < 1: _paste(canvas, pic, x, y + dy)
    return _mix(img, canvas, a)


def mosaic(img, p, a, frame, seed, props=None):
    """A 2x2 grid of different crops of the clip (wide, close on the face, mirrored, black and white) on
    charcoal; the cells wipe in one by one from their outer edges on the beat and wipe out at the end.
    Options: gap (10), zooms ([1.0, 2.0, 1.3, 1.6]), grades (['none', 'warm', 'mono', 'cool']), out (true), face."""
    H, W = img.shape[:2]; sc = W / 1080; gap = float(_p(props, 'gap', 10)) * sc
    zooms = _p(props, 'zooms', [1.0, 2.0, 1.3, 1.6]); grades = _p(props, 'grades', ['none', 'warm', 'mono', 'cool'])
    fu, fv = _p(props, 'face', [.5, .4]); T = _secs(props); t = p * T; out = bool(_p(props, 'out', True))
    cw, ch = int((W - gap) / 2), int((H - gap) / 2); canvas = np.full_like(img, _u8(CHAR)); rank = [0, 3, 1, 2]
    for i in range(4):
        x, y = (i % 2) * (cw + gap), (i // 2) * (ch + gap)
        ain = _snap((t - rank[i] * STEP * .5) / (STEP * 1.5)); aout = _snap((t - (T - STEP * 2) - rank[i] * STEP * .3) / STEP) if out else 0
        w = int(cw * ain * (1 - aout))
        if w < 1: continue
        z = float(zooms[i % len(zooms)]) * (1.12 - .12 * ain)
        pic = _grade(_crop(img, z, fu, fv + (.04 if i == 1 else 0), cw, ch, mirror=(i == 2)), grades[i % len(grades)])
        left = i % 2 == 0
        part = pic[:, cw - w:] if left else pic[:, :w]
        _paste(canvas, part, x + (cw - w if left else 0), y)
    return _mix(img, canvas, a)


def punch_zoom(img, p, a, frame, seed, props=None):
    """The zoom punch: the clip sits as a centred card on charcoal (`from` of the frame, .62) and on the beat
    scales up to full frame with a small overshoot, then holds. Options: from (.62), at (seconds in when it
    punches; default 2 beats), ramp (s, .3), back (true: shrinks back to the card over the last beat)."""
    H, W = img.shape[:2]; T = _secs(props); t = p * T
    s0 = float(_p(props, 'from', .62)); at = float(_p(props, 'at', STEP * 2)); ramp = float(_p(props, 'ramp', .3)); back = bool(_p(props, 'back', False))
    q = _punch((t - at) / ramp)
    if back: q *= 1 - _snap((t - (T - STEP * 1.5)) / STEP)
    s = s0 + (1 - s0) * q
    if s >= .999: return _mix(img, img.copy(), a)
    w, h = max(2, int(W * s)), max(2, int(H * s))
    canvas = np.full_like(img, _u8(CHAR))
    if s > 1:                                                     # overshoot: crop a slightly bigger picture
        big = cv2.resize(img, (w, h), interpolation=cv2.INTER_LINEAR); x0, y0 = (w - W) // 2, (h - H) // 2
        return _mix(img, big[y0:y0 + H, x0:x0 + W], a)
    _paste(canvas, cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA), (W - w) / 2, (H - h) / 2)
    return _mix(img, canvas, a)


def slot_reveal(img, p, a, frame, seed, props=None):
    """Image in a slot: the clip shows only through a narrow vertical slot on charcoal that drops open, holds a
    beat, then widens to full frame (the picture inside eases from a slight zoom to rest). Options: w0 (slot
    width, share of W, .12), h0 (slot height, share of H, .62), at (s when it widens, 2 beats), len (s, .45)."""
    H, W = img.shape[:2]; T = _secs(props); t = p * T
    w0 = float(_p(props, 'w0', .12)); h0 = float(_p(props, 'h0', .62)); at = float(_p(props, 'at', STEP * 2)); ln = float(_p(props, 'len', .45))
    drop = _snap(t / (STEP * 1.2)); wide = _snap((t - at) / ln)
    ww = W * (w0 + (1 - w0) * wide); hh = H * (h0 * drop + (1 - h0) * wide) if wide > 0 else H * h0 * drop
    if ww >= W - .5 and hh >= H - .5: return _mix(img, img.copy(), a)
    z = 1.2 - .2 * wide; pic = _crop(img, z, .5, .42, W, H)
    canvas = np.full_like(img, _u8(CHAR)); x0, y0 = int((W - ww) / 2), int((H - hh) / 2)
    if ww > 1 and hh > 1: canvas[y0:y0 + int(hh), x0:x0 + int(ww)] = pic[y0:y0 + int(hh), x0:x0 + int(ww)]
    return _mix(img, canvas, a)


# ---------------------------------------------------------------- beat hits
def strobe_cut(img, p, a, frame, seed, props=None):
    """Beat flash: on every beat a one-frame hard hit, alternating a white flash and a charcoal frame, and the
    picture steps in by a punch zoom that resets each bar of four beats. Options: beat (s, .4), flash (.55; a white hit reads as a dropped frame above that),
    zoom (step per beat, .06), mode ('both' | 'white' | 'dark')."""
    H, W = img.shape[:2]; fps = _fps(props); beat = float(_p(props, 'beat', .4)); t = frame / fps if props and 'fps' in props else p * _secs(props)
    k = int(math.floor(t / beat + 1e-6)); u = t - k * beat; zs = float(_p(props, 'zoom', .06)); mode = _p(props, 'mode', 'both')
    z = 1 + zs * (k % 4) * a
    out = _crop(img, z, .5, .42, W, H) if z > 1.001 else img.copy()
    hit = u < 1.2 / fps
    if hit:
        white = mode == 'white' or (mode == 'both' and k % 2 == 0)
        col = np.ones(3, np.float32) * .96 if white else CHAR
        fl = float(_p(props, 'flash', .55)) * a
        out = _u8(_f(out) * (1 - fl) + col * fl)
    return out


def beat_zoom(img, p, a, frame, seed, props=None):
    """Hard step zooms on the beat: 1.0, then pushes of `step` (0.1) per beat toward the face, snapping back
    to wide every `bar` beats (4). No easing: each step is a jump cut. Options: beat (s, .4), step, bar, face."""
    H, W = img.shape[:2]; fps = _fps(props); beat = float(_p(props, 'beat', .4)); t = frame / fps if props and 'fps' in props else p * _secs(props)
    k = int(math.floor(t / beat + 1e-6)); bar = int(_p(props, 'bar', 4)); fu, fv = _p(props, 'face', [.5, .4])
    z = 1 + float(_p(props, 'step', .1)) * (k % bar) * a
    return _crop(img, z, fu, fv, W, H) if z > 1.001 else img.copy()


def mono_flash(img, p, a, frame, seed, props=None):
    """A beat of black and white: the picture drops to a contrasty monochrome on the hit and colour returns
    over the following beat (use "where": "in" on a cut, or as a pulse on a stressed word)."""
    m = _grade(img, 'mono')
    return _mix(img, m, a)


def exposure(img, p, a, frame, seed, props=None):
    """Brightens a stretch that reads too dark after the look: lifts the mid-tones (gamma) and adds a little gain,
    whites rolled off so nothing clips. Options: lift (0.18; 0 = none, 0.3 = a lot)."""
    f = _f(img); k = float(_p(props, 'lift', .18)) * a
    g = np.power(np.clip(f, 0, 1), 1 / (1 + k * 1.6)) * (1 + k * .25)
    g = np.where(g > .9, .9 + (g - .9) * .5, g)                    # soft shoulder above 90 %
    return _u8(np.clip(g, 0, 1))


def slow_push(img, p, a, frame, seed, props=None):
    """A slow, smooth push-in over the effect's whole length (ease in and out), from 1.0 to `to` (1.15) round
    `focus` ([.5, .5]). With "layer": "all" it pushes into the graphics too (a full-screen grid, a card)."""
    H, W = img.shape[:2]; fu, fv = _p(props, 'focus', [.5, .5])
    e = p * p * (3 - 2 * p)
    z = 1 + (float(_p(props, 'to', 1.15)) - 1) * e * a
    return _crop(img, z, fu, fv, W, H) if z > 1.0005 else img.copy()


EFFECTS = {
    'slow_push': slow_push,
    'exposure': exposure,
    'editorial_grade': editorial_grade,
    'strip_split': strip_split,
    'mosaic': mosaic,
    'punch_zoom': punch_zoom,
    'slot_reveal': slot_reveal,
    'strobe_cut': strobe_cut,
    'beat_zoom': beat_zoom,
    'mono_flash': mono_flash,
}
for _fn in EFFECTS.values(): _fn.takes_props = True

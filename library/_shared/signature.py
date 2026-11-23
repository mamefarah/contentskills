"""Signature effects: footage effects available in every theme. Original OpenCV work.

  cop_lights         the room drops dark; red and blue police lights strobe across the person from both sides
  gta6_poster        a game-cover poster of the person: cel shading on a sunset, hook in bold type, loading spinner, snaps live
  text_behind_slice  a colour card with a big title behind the person; on a cue it is sliced and the halves slide apart
  reel_flythrough    full-screen cutaway: the shot shrinks to a card, the camera flies through playing reels, lands back on the shot
  color_grade        the look changes on a word: moody, warm, cool, bw or pop fades in (or ripples out from a point)
In signature_kit.py (the reel kit and lines of light, same contract, brand props accent/highlight/ink/paper/background):
  ai_prompt          a chat composer above the head types the ask, shows a slash-command suggestion, then sends
  edit_preview       full-screen: the shot shrinks into an "Editing with..." card on the brand grid, plays sped up, grows back
  raw_vs_edit        RAW and EDITED cards side by side on the brand grid; the edited one grows to full screen
  feed_scroll        a phone-style card above the head swipes up through reels, each with its view count
  storyboard_pages   storyboard pages above the head (thumbnail, line, note per shot) that flip
  insights_zoom      a reel-insights card slides in, numbers count up, the camera pushes into the views row
  catalog_grid       end card: Comment "KEYWORD" over a numbered grid of reels filling in tile by tile
  lines_of_light     the room drops to near-black teal; neon lines draw an editing timeline behind the person, struck out

Contract: fn(img, progress, amount, frame, seed, props=None) -> img (BGR uint8, the source never modified, deterministic:
the same frame and options always give the same picture; no state is carried between frames, so chunks can render in any
order). `props` is the storyboard effect entry's "props" object; the pipeline adds `seconds` (the effect's length) and
`fps`, which the timed effects use to turn progress into seconds. Every option has a default, so each works with none.
The person is found with lighting.py's face detector and person segmenter (no model of its own).
Text is drawn with FFmpeg's drawtext (fonts in signature/fonts: Anton, Barlow Condensed, Inter, Montserrat, Instrument
Serif and Michroma, all OFL).
Names are snake_case and registered for every theme in effects_engine.py, group "Signature" in each theme's catalog.
"""
import json, math, os, random, re, subprocess, tempfile
from collections import namedtuple
from functools import lru_cache
from pathlib import Path
import cv2
import numpy as np
import lighting as _L

HERE = Path(__file__).resolve().parent / 'signature'
FONTS = HERE / 'fonts'
REELS = HERE / 'reels'


# ---------- maths, colour and the safe box ----------
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x
def ease_out(x):
    return 1 - pow(1 - clamp(x), 3)
def ease_inout(x):
    t = clamp(x); return 3 * t * t - 2 * t * t * t
def ease_back(x):
    t, k = clamp(x) - 1, 1.7; return t * t * ((k + 1) * t + k) + 1
def rgb(value, fallback):
    """'#ff2634', [255, 38, 52] or None -> (r, g, b)."""
    if value is None:
        return fallback
    if isinstance(value, (tuple, list)):
        return tuple(int(c) for c in value[:3])
    hexa = str(value).lstrip('#')
    return tuple(int(hexa[k:k + 2], 16) for k in range(0, 6, 2))
def _rgbf(img): return img[..., ::-1].astype(np.float32) / 255           # BGR uint8 -> RGB float, the working space
def _out(f): return np.clip(np.rint(f[..., ::-1] * 255), 0, 255).astype(np.uint8)
def _secs(o, default): return max(.05, float(o.get('seconds', default)))
def _yes(v): return str(v).lower() in ('1', 'true', 'yes')


def safe_box(width, height):
    """The part of a vertical frame TikTok, Reels and Shorts never cover with their UI (1080x1920: top 220, bottom 450,
    sides 35, and the button column right of x 945 below y=1160). (left, top, right_upper, right_lower, bottom, split_y) in pixels."""
    zone, kx, ky = _safe_zone(), width / 1080, height / 1920
    return zone['left'] * kx, zone['top'] * ky, zone['right'] * kx, zone['rightLow'] * kx, zone['bottom'] * ky, zone['split'] * ky


@lru_cache(maxsize=1)
def _safe_zone():
    """library/_shared/safe-zone.json: one source for the safe zone (placement.js, qa.py, here)."""
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'safe-zone.json')) as f: return json.load(f)


@lru_cache(maxsize=4)
def _grid(W, H):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); return xx, yy


@lru_cache(maxsize=16)
def _blob(W, H, cx, cy, rx, ry):
    xx, yy = _grid(W, H); return np.exp(-2.2 * (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)).astype(np.float32)


# ---------- the person (lighting.py's detector and segmenter) ----------
def _guided(guide, src, radius, eps=2e-3):
    """Guided filter: `src` smoothed, its edges snapped to the edges of `guide`."""
    window = (2 * radius + 1, 2 * radius + 1)
    mean = lambda a: cv2.boxFilter(a, -1, window)
    mg, ms = mean(guide), mean(src)
    slope = (mean(guide * src) - mg * ms) / (mean(guide * guide) - mg * mg + eps)
    return np.clip(mean(slope) * guide + mean(ms - slope * mg), 0, 1)

_matte_cache = {}
def person(img, frame):
    """(mask H x W float 0..1, (fx, fy, fw) face centre and width in pixels) for this frame."""
    H, W = img.shape[:2]; key = (img.shape, int(frame), img[::97, ::89].tobytes())
    if key in _matte_cache: return _matte_cache[key]
    face = _L._face(img, frame); w = min(_L.WORK, W); h = max(2, round(H * w / W))
    m = _L._refine(img, _L._person(face, h, w), w, h, frame)
    hw, hh = max(2, W // 2), max(2, H // 2)                                  # snap the matte's edges to the picture at half size
    grey = cv2.cvtColor(cv2.resize(img, (hw, hh), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    m = _guided(grey, cv2.resize(m, (hw, hh), interpolation=cv2.INTER_LINEAR), max(2, hw // 120))
    m = np.clip((cv2.resize(m, (W, H), interpolation=cv2.INTER_LINEAR) - .5) * 1.6 + .5, 0, 1).astype(np.float32)
    cx, cy, fw, _ = face; out = (m, (cx * W, cy * H, max(fw * W, W * .05)))
    _matte_cache.clear(); _matte_cache[key] = out
    return out


def camera(f, m, face, zoom, cx, cy):
    """Zoom picture and mask toward (cx, cy), capped at 2x. Returns (f, m, face)."""
    H, W = f.shape[:2]; z = min(zoom, 2.0)
    if z <= 1.002: return f, m, face
    view_w, view_h = W / z, H / z
    left, top = clamp(cx - view_w / 2, 0, W - view_w), clamp(cy - view_h / 2, 0, H - view_h)
    warp = np.float32([[z, 0, -left * z], [0, z, -top * z]])
    f = cv2.warpAffine(f, warp, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    if m is not None: m = cv2.warpAffine(m, warp, (W, H), flags=cv2.INTER_LINEAR)
    return f, m, ((face[0] - left) * z, (face[1] - top) * z, face[2] * z)


# ---------- text and layers (RGBA float, straight alpha) ----------
@lru_cache(maxsize=256)
def _glyphs(s, font, size, border):
    """Coverage (float 0..1) of s drawn white on black by FFmpeg, uncropped, at a fixed origin."""
    size = max(6, int(size)); border = max(0, int(border)); pad = border + size // 3 + 4
    Wc, Hc = int(size * (len(s) * .95 + 1)) + 2 * pad, int(size * 1.7) + 2 * pad
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8') as t: t.write(s); name = t.name
    try:
        vf = (f"drawtext=fontfile='{FONTS / font}':textfile='{name}':fontsize={size}:fontcolor=white"
              f":borderw={border}:bordercolor=white:x={pad}:y={pad}")
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'color=c=black:s={Wc}x{Hc}', '-vf', vf, '-frames:v', '1',
                              '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True, check=True).stdout
    finally: os.unlink(name)
    return np.frombuffer(raw, np.uint8).reshape(Hc, Wc).astype(np.float32) / 255


def text(s, size, font='Inter-ExtraBold.ttf', fill=(255, 255, 255), stroke=0, stroke_fill=(22, 22, 24), shadow=0, pad=None):
    """A cropped RGBA layer of one line of text: fill colour, an optional outline and a soft drop shadow."""
    body = _glyphs(s, font, int(size), 0)
    cover = _glyphs(s, font, int(size), int(stroke)) if stroke else body
    ys, xs = np.nonzero(cover > .02)
    if not len(ys): return np.zeros((2, 2, 4), np.float32)
    p = int(size * .2 + shadow * 2.5) + 4 if pad is None else int(pad)
    y0, y1, x0, x1 = max(0, ys.min() - p), ys.max() + p + 1, max(0, xs.min() - p), xs.max() + p + 1
    body, cover = body[y0:y1, x0:x1], cover[y0:y1, x0:x1]
    col = np.float32(stroke_fill) / 255 * (1 - body[..., None]) + np.float32(fill) / 255 * body[..., None]
    out = np.dstack([col, cover]).astype(np.float32)
    return shadowed(out, shadow, shadow * .5, .63) if shadow else out


def text_width(s, size, font):
    g = _glyphs(s, font, 100, 0); xs = np.nonzero(g.max(axis=0) > .02)[0]
    return (xs.max() - xs.min() + 1) * size / 100 if len(xs) else 0


def shadowed(L, blur=18, dy=10, alpha=.47):
    """A layer with a soft black shadow under it (grows the canvas)."""
    blur = max(1, int(blur)); pad = blur * 2 + int(abs(dy)); h, w = L.shape[:2]
    out = np.zeros((h + 2 * pad, w + 2 * pad, 4), np.float32)
    sh = np.zeros(out.shape[:2], np.float32); sh[pad + int(dy):pad + int(dy) + h, pad:pad + w] = L[..., 3] * alpha
    sh = cv2.GaussianBlur(sh, (0, 0), blur)
    a = L[..., 3:4]; out[..., 3] = sh
    reg = out[pad:pad + h, pad:pad + w]
    na = a + reg[..., 3:4] * (1 - a)
    reg[..., :3] = np.where(na > 1e-4, L[..., :3] * a / np.maximum(na, 1e-4), 0); reg[..., 3:4] = na
    return out


def rounded(L, r):
    """Round the corners of a layer (radius r pixels)."""
    h, w = L.shape[:2]; m = np.zeros((h * 4, w * 4), np.uint8); r = int(max(0, min(r, w / 2, h / 2)) * 4)
    cv2.rectangle(m, (r, 0), (w * 4 - 1 - r, h * 4 - 1), 255, -1); cv2.rectangle(m, (0, r), (w * 4 - 1, h * 4 - 1 - r), 255, -1)
    for cx, cy in ((r, r), (w * 4 - 1 - r, r), (r, h * 4 - 1 - r), (w * 4 - 1 - r, h * 4 - 1 - r)): cv2.circle(m, (cx, cy), r, 255, -1)
    m = cv2.resize(m, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    out = L.copy(); out[..., 3] *= m; return out


def place(f, L, cx, cy, scale=1.0, rot=0.0, alpha=1.0, behind=None):
    """Composite layer L (RGBA) onto picture f in place, centred on (cx, cy), scaled, rotated (degrees, counter-clockwise).
    behind: a person mask; the layer is hidden wherever the person is."""
    if scale <= .01 or alpha <= .003: return
    H, W = f.shape[:2]; h, w = L.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), rot, scale); M[:, 2] += (cx - w / 2, cy - h / 2)
    corners = np.array([[0, 0, 1], [w, 0, 1], [0, h, 1], [w, h, 1]], np.float32) @ M.T
    x0, y0 = int(max(0, math.floor(corners[:, 0].min()))), int(max(0, math.floor(corners[:, 1].min())))
    x1, y1 = int(min(W, math.ceil(corners[:, 0].max()))), int(min(H, math.ceil(corners[:, 1].max())))
    if x0 >= x1 or y0 >= y1: return
    M[:, 2] -= (x0, y0)
    pre = np.dstack([L[..., :3] * L[..., 3:4], L[..., 3:4]])
    interp = cv2.INTER_AREA if scale < .7 and abs(rot) < .05 else cv2.INTER_LINEAR
    if interp == cv2.INTER_AREA:                                            # shrink cleanly, then position
        pre = cv2.resize(pre, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
        M = np.float32([[1, 0, cx - pre.shape[1] / 2 - x0], [0, 1, cy - pre.shape[0] / 2 - y0]]); interp = cv2.INTER_LINEAR
    warped = cv2.warpAffine(pre, M, (x1 - x0, y1 - y0), flags=interp, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    a = np.clip(warped[..., 3:4], 0, 1) * alpha
    if behind is not None: a = a * (1 - behind[y0:y1, x0:x1, None])
    dst = f[y0:y1, x0:x1, :3]                                               # an RGBA target keeps its own alpha
    dst[:] = dst * (1 - a) + warped[..., :3] * alpha * (1 - (0 if behind is None else behind[y0:y1, x0:x1, None]))


# ---------- grades ----------
_LUMA = np.float32([0.299, 0.587, 0.114])

def grade(img, look='moody'):
    """One of the five looks, on an RGB float picture."""
    y = (img @ _LUMA)[..., None]
    saturate = lambda k: y + (img - y) * k
    if look == 'bw': return np.repeat(np.clip((y - 0.5) * 1.25 + 0.5, 0, 1), 3, axis=2)
    if look == 'warm': return np.clip(saturate(1.12) * np.float32([1.1, 1.0, 0.84]) + np.float32([0.03, 0.012, -0.01]), 0, 1)
    if look == 'cool': return np.clip(np.float32([0.9, 1.0, 1.1]) * img, 0, 1)
    if look == 'pop': return np.clip((saturate(1.35) - 0.5) * 1.12 + 0.5, 0, 1)
    soft = np.power(np.clip(saturate(0.55), 0, 1), 1.7) * 0.6             # moody: dark, soft colour
    return np.clip(soft + (1 - y) * np.float32([-0.02, 0.02, 0.05]) + y * np.float32([0.04, 0.012, -0.03]), 0, 1)


@lru_cache(maxsize=2)
def _vig(W, H):
    xx, yy = _grid(W, H); return np.clip(((xx - W / 2) / (W * .75)) ** 2 + ((yy - H / 2) / (H * .7)) ** 2, 0, 1).astype(np.float32)


GRADES = ('moody', 'warm', 'cool', 'bw', 'pop')
def color_grade(img, progress, amount, frame, seed, props=None):
    """grade: moody | warm | cool | bw | pop. style: fade (default) or ripple (spreads from x, y). dur: seconds to arrive."""
    o = props or {}; kind = str(o.get('grade', 'moody')).lower(); kind = kind if kind in GRADES else 'moody'
    f = _rgbf(img); H, W = f.shape[:2]
    timed = 'seconds' in o; d = _secs(o, 2.0); lt = progress * d
    out_k = clamp((d - lt) / .2) if timed and _yes(o.get('out', 0)) else 1.0     # the pipeline's "where" already fades it out
    if str(o.get('style', 'fade')) != 'ripple':
        dur = float(o.get('dur', .45))                                            # dur 0: on at once, from its first frame
        k = (ease_out(lt / dur) if timed and dur > 0 else 1.0) * out_k * amount
        g = f * (1 - k) + grade(f, kind) * k
        if kind == 'moody': g = g * (1 - .45 * k * _vig(W, H))[..., None]
        return _out(g)
    ox, oy, dur = float(o.get('x', .5)) * W, float(o.get('y', .2)) * H, float(o.get('dur', .9))
    R = math.hypot(max(ox, W - ox), max(oy, H - oy)) * 1.05; r = R * (ease_out(lt / dur) if timed else 1.0)
    g = grade(f, kind); k = out_k * amount
    if r >= R * .999: return _out(f * (1 - k) + g * k)
    xx, yy = _grid(W, H); dist = np.sqrt((xx - ox) ** 2 + (yy - oy) ** 2)
    m = np.clip((r - dist) / (W * .05) + .5, 0, 1)[..., None] * k
    ring = np.exp(-((dist - r) / (W * .012)) ** 2)[..., None] * .35 * k * (1 - lt / dur * .6)
    tint = np.float32([1.0, .85, .6]) if kind == 'warm' else np.float32([.75, .85, 1.0])
    return _out(np.clip(f * (1 - m) + g * m + ring * tint, 0, 1))


# ---------- cop lights ----------
COP_RED, COP_BLUE = (255, 38, 52), (40, 96, 255)
def cop_lights(img, progress, amount, frame, seed, props=None):
    """color, color2: the two lights (default red, blue). speed: flashes per second (2.2). push: slow push-in (1.08)."""
    o = props or {}; d = _secs(o, 3.0); lt = progress * d
    f = _rgbf(img); H, W = f.shape[:2]; m, face = person(img, frame)
    f, m, (fx, fy, fw) = camera(f, m, face, 1 + (float(o.get('push', 1.08)) - 1) * ease_inout(lt / d), face[0], face[1] + (H / 1.08) * .1)
    k = clamp(lt / .18) * (clamp((d - lt) / .25) if 'seconds' in o else 1) * amount
    red, blue = np.float32(rgb(o.get('color'), COP_RED)) / 255, np.float32(rgb(o.get('color2'), COP_BLUE)) / 255
    hz = float(o.get('speed', 2.2)); s = math.sin(2 * math.pi * hz * lt)
    flick = .55 + .45 * abs(math.sin(2 * math.pi * hz * 3 * lt))           # the double flash of a light bar
    pr, pb = .18 + .82 * (max(0, s) ** .6) * flick, .18 + .82 * (max(0, -s) ** .6) * flick
    f = f * (1 - k * (.8 * (1 - m) + .38 * m))[..., None]                   # the room dies, the person stays brighter
    Lb, Rb = _blob(W, H, -W * .1, H * .3, W * .62, H * .4), _blob(W, H, W * 1.1, H * .3, W * .62, H * .4)
    inner = cv2.GaussianBlur(m, (0, 0), max(2, W * .0175)); rim = np.clip((m - inner) * 3.2, 0, 1) * m
    xx, _ = _grid(W, H); side = np.clip((xx - fx) / (fw * 1.2), -1, 1)
    wl, wr = np.clip(-side, 0, 1) * .8 + .2, np.clip(side, 0, 1) * .8 + .2
    bg = 1 - m
    f += ((Lb * (bg * .85 + m * .4) + rim * wl * 1.6) * pr * k)[..., None] * red + ((Rb * (bg * .85 + m * .4) + rim * wr * 1.6) * pb * k)[..., None] * blue
    cL, cR = _blob(W, H, -W * .02, H * .2, W * .16, H * .1) * pr, _blob(W, H, W * 1.02, H * .2, W * .16, H * .1) * pb
    f += (cL * k * .9)[..., None] * (red * .6 + .4) + (cR * k * .9)[..., None] * (blue * .6 + .4)
    return _out(np.clip(f, 0, 1))


# ---------- gta6 poster ----------
def _cel_ink(small, w, h):
    """Ink lines for the cel look, 0..1 at (w, h): outlines of shapes found on a much smoother, half-size copy, specks dropped."""
    half = cv2.resize(small, (w // 2, h // 2), interpolation=cv2.INTER_AREA)
    calm = cv2.edgePreservingFilter(half, flags=1, sigma_s=60, sigma_r=.5)
    grey = cv2.medianBlur(cv2.cvtColor(calm, cv2.COLOR_RGB2GRAY), 5)
    marks = cv2.adaptiveThreshold(grey, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 9, 5)
    _count, labels, stats, _centres = cv2.connectedComponentsWithStats(marks, 8)
    shade = np.concatenate([[0], np.where(stats[1:, cv2.CC_STAT_AREA] >= 12, 255, 0)]).astype(np.uint8)   # label 0 is the paper
    lines = cv2.resize(shade[labels], (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
    return cv2.GaussianBlur(lines, (0, 0), .6)

def gta_cel(img, matte, W):
    """Heavy cel shading like a game-cover painting (RGB float in and out): flat light bands with thresholds from the
    frame's own brightness, saturated warm light, magenta-purple shadows, ink lines on shapes (not texture), warm rim light."""
    full_h, full_w = img.shape[:2]
    w, h = int(full_w * .7) // 2 * 2, int(full_h * .7) // 2 * 2
    small = cv2.resize((np.clip(img, 0, 1) * 255).astype(np.uint8), (w, h), interpolation=cv2.INTER_AREA)
    flat = cv2.bilateralFilter(cv2.edgePreservingFilter(small, flags=1, sigma_s=30, sigma_r=.28), 7, 40, 5)
    lab = cv2.cvtColor(flat, cv2.COLOR_RGB2LAB).astype(np.float32)
    ramp = np.linspace(0, 1, w, dtype=np.float32)[None, :]                # 0 at the left edge, 1 at the right
    light = np.clip(lab[..., 0] / 255 * (.7 + .6 * ramp), 0, 1)           # a low sun from the right
    body = cv2.resize((matte > .5).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
    measured = light[body > 0] if body.sum() > 500 else light.ravel()     # thresholds from the person, when there is one
    lo, hi = (np.percentile(measured, pct) for pct in (38, 78))
    soft_step = lambda edge: 1 / (1 + np.exp(-(light - edge) / .012))
    band = .2 + .4 * soft_step(lo) + .32 * soft_step(hi)                  # three flat bands: shadow, mid, lit
    tone = np.clip(band * .9 + (light - (lo + hi) / 2) * .25 + .03, 0, 1)
    shadow, lit = np.clip((.6 - band) / .4, 0, 1), np.clip((band - .6) / .32, 0, 1)
    green_red = (lab[..., 1] - 128) * 1.55 + shadow * 16 + lit * 4
    blue_yellow = (lab[..., 2] - 128) * 1.55 - shadow * 26 + lit * 12
    painted = np.dstack([tone * 255, np.clip(green_red + 128, 0, 255), np.clip(blue_yellow + 128, 0, 255)]).astype(np.uint8)
    col = cv2.cvtColor(painted, cv2.COLOR_LAB2RGB).astype(np.float32) / 255
    ink = _cel_ink(small, w, h)[..., None]
    rim = (np.exp(-cv2.distanceTransform(body, cv2.DIST_L2, 5) / (w * .01)) * body)[..., None]
    across = ramp[..., None]
    col = col + rim * np.float32([1.0, .55, .22]) * (.1 + .6 * across) + rim * np.float32([.3, .15, .7]) * .35 * (1 - across)
    col = col * (1 - ink * .9) + np.float32([.1, .03, .12]) * ink * .9
    big = cv2.resize(np.clip(col, 0, 1), (full_w, full_h), interpolation=cv2.INTER_CUBIC)
    return np.clip(big * 1.35 - cv2.GaussianBlur(big, (0, 0), 2.0) * .35, 0, 1)


_SKY = [(0.0, (46, 18, 84)), (.35, (164, 40, 128)), (.6, (250, 104, 84)), (.78, (255, 178, 74)), (1.0, (255, 214, 120))]   # top to horizon

_FRONDS = (-170, -140, -110, -70, -40, -10, 200, 160)                    # degrees

def _palm(mask, W, H, side):
    """One palm silhouette drawn into `mask`: a curved trunk from the bottom corner and eight drooping fronds."""
    foot, lean, crown_y = W * (.08 if side < 0 else .92), side * -W * .06, H * .42
    trunk = [(foot + lean * (k / 10) ** 1.6, H - (H - crown_y) * k / 10) for k in range(11)]
    cv2.polylines(mask, [np.int32(trunk)], False, 255, int(W * .03), cv2.LINE_AA)
    crown_x, reach = foot + lean, W * .17
    for degrees in _FRONDS:
        ang = math.radians(degrees)
        frond = [(crown_x + math.cos(ang) * reach * u, crown_y + math.sin(ang) * reach * .45 * u - reach * .18 * math.sin(math.pi * u * .8) + reach * .55 * u * u)
                 for u in np.linspace(0, 1, 12)]
        for j, (p, q) in enumerate(zip(frond, frond[1:])):
            cv2.line(mask, tuple(np.int32(p)), tuple(np.int32(q)), 255, max(2, int(W * .026 * (1 - j / len(frond)))), cv2.LINE_AA)

@lru_cache(maxsize=2)
def sunset_bg(width, height):
    """Retro sunset: purple to gold sky, a striped sun, two palm silhouettes, a faint halftone (RGB float)."""
    W, H = width, height
    rows = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    sky = np.zeros((H, 3), np.float32)
    for (at0, colour0), (at1, colour1) in zip(_SKY, _SKY[1:]):
        t = np.clip((rows - at0) / (at1 - at0), 0, 1)
        sky = np.where((rows >= at0) & (rows <= at1), np.float32(colour0) * (1 - t) + np.float32(colour1) * t, sky)
    picture = np.ascontiguousarray(np.repeat(sky[:, None, :], W, axis=1))
    disc, radius, sun_x, sun_y = np.zeros((H, W), np.uint8), W * .34, W * .5, H * .62
    cv2.circle(disc, (int(sun_x), int(sun_y)), int(radius), 255, -1, cv2.LINE_AA)
    for stripe in range(7):                                               # gaps that widen toward the horizon
        y = sun_y + radius * (.1 + stripe * .13)
        cv2.rectangle(disc, (0, int(y)), (W, int(y + radius * .03 * (stripe + 1))), 0, -1)
    palms = np.zeros((H, W), np.uint8)
    for side in (-1, 1): _palm(palms, W, H, side)
    for mask, colour in ((disc, (255, 236, 150)), (palms, (28, 12, 40))):
        cover = mask.astype(np.float32)[..., None] / 255
        picture = picture * (1 - cover) + np.float32(colour) * cover
    halftone = ((np.indices((H, W)).sum(0) % 8) < 1).astype(np.float32)[..., None]
    return (picture / 255 * (1 - .08 * halftone)).astype(np.float32)


def _scaled(f, m, face, s, W, H):
    """Scale the person (picture and mask) by s, anchored at the bottom centre."""
    if abs(s - 1) < .005: return f, m, face
    M = np.float32([[s, 0, W * (1 - s) / 2], [0, s, H * (1 - s)]])
    fx, fy, fw = face
    return (cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE), cv2.warpAffine(m, M, (W, H), flags=cv2.INTER_LINEAR),
            (fx * s + W * (1 - s) / 2, fy * s + H * (1 - s), fw * s))


def _spinner(size, a0):
    sp = int(size); S = 4; c = np.zeros((sp * 2 * S, sp * 2 * S), np.uint8)
    cv2.ellipse(c, (sp * S, sp * S), (sp * S - 16, sp * S - 16), 0, a0, a0 + 270, 255, max(3, int(sp * .18)) * S, cv2.LINE_AA)
    a = cv2.resize(c, (sp * 2, sp * 2), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    return shadowed(np.dstack([np.ones((sp * 2, sp * 2, 3), np.float32), a]), 4, 2, .55)


def _slides(c, live, LT, o):
    """slides: [[a, b, hold, d], ...] seconds into the effect. The plain footage slides in from the left over a..b (its
    right edge sweeping across), covers the frame until hold, then slides out to the right until d, uncovering the poster
    again; a == b means it is already covering at a (the clip opens on the footage). Each move is motion-blurred
    sideways with a bright edge, like a whip cut. slideStyle: 'wipe' = a smooth wipe instead (no motion blur, a crisp
    seam with a thin glow), so mid-move one part of the frame is the plain footage and the rest the cel-shaded poster."""
    H, W = c.shape[:2]
    if o.get('slideStyle') == 'wipe':                                        # user, 2026-11-22 (m7): smooth, half raw / half cel-shaded
        xs = np.arange(W, dtype=np.float32)[None, :, None]
        for s in o.get('slides') or []:
            a, b, hold, d = (float(v) for v in s)
            if LT < a or LT > d: continue
            if LT < b: q = ease_inout(clamp((LT - a) / max(1e-3, b - a))); lo, hi = 0.0, W * q          # raw grows from the left
            elif LT <= hold: lo, hi = 0.0, float(W)
            else: q = ease_inout(clamp((LT - hold) / max(1e-3, d - hold))); lo, hi = W * q, float(W)   # raw leaves to the right
            soft = max(1.5, W * .002)
            m = np.clip((xs - lo) / soft + .5, 0, 1) * np.clip((hi - xs) / soft + .5, 0, 1)
            c = c * (1 - m) + live * m
            for ex in (lo, hi):                                              # a thin warm glow on the moving seam
                if 1 < ex < W - 1:
                    c = np.clip(c + np.exp(-((xs - ex) / (W * .004)) ** 2) * np.float32([1.0, .86, .55]) * .8, 0, 1)
        return c
    for s in o.get('slides') or []:
        a, b, hold, d = (float(v) for v in s)
        if LT < a or LT > d: continue
        if LT < b: q = ease_inout(clamp((LT - a) / max(1e-3, b - a))); off, v = -W * (1 - q), 1 - abs(2 * q - 1)
        elif LT <= hold: off, v = 0.0, 0.0
        else: q = ease_inout(clamp((LT - hold) / max(1e-3, d - hold))); off, v = W * q, 1 - abs(2 * q - 1)
        x0 = int(round(off)); sh = np.zeros_like(live); m = np.zeros((H, W, 1), np.float32)
        lo, hi = max(0, x0), min(W, W + x0)
        if hi <= lo: continue
        sh[:, lo:hi] = live[:, lo - x0:hi - x0]; m[:, lo:hi] = 1
        if v > .05:                                                          # sideways motion blur while it moves
            k = max(3, int(W * .09 * v)) | 1
            sh = cv2.blur(sh, (k, 1)); m = cv2.blur(m, (k, 1))[..., None]
        c = c * (1 - m) + sh * m
        for ex in (lo, hi):                                                  # a hot edge on the moving side
            if 0 < ex < W and v > 0:
                xs = np.arange(W, dtype=np.float32)[None, :, None]
                c = np.clip(c + np.exp(-((xs - ex) / (W * .006)) ** 2) * np.float32([1.0, .85, .5]) * min(1, v * 2), 0, 1)
    return c


def gta6_poster(img, progress, amount, frame, seed, props=None):
    """text: the hook, lines split with | (default FIVE WAYS|TO GET PAID). text2 + switchAt: a second hook that replaces it
    switchAt seconds into the effect (pops in the same way). label: next to the spinner (LOADING; '' = none). labelY: the
    label's centre in frame pixels (default just above the safe zone's bottom). exitFlash: false = end on a hard cut, no white flash.
    scale: the person's size in the poster (default fits the hook above the head). reveal: seconds for an unveiling instead
    of the white-flash pop-in: a glowing line sweeps down from the top, the poster unveiled above it, live footage still
    below it, and each hook line pops in as the line passes it (0 = the flash, default). Runs over its whole length and snaps
    live in the last 0.2 s (hold: true = no snap, the poster runs to the cut); amount does not fade it.
    before: a hook shown first on the live footage in a plain modern look (lines split with |; white Montserrat
    ExtraBold, beforeFont to change it; beforeFill / beforeStroke: its colour and an outline, hex; beforeBox: a solid block behind each line, hex), so the opening frames already say what the video is about; with reveal the
    curtain line replaces it by the poster's hook as it passes. revealAt: seconds of live footage (with `before`) before
    the curtain starts (default 0); switchAt still counts from the effect's start.
    textScale / beforeScale: the poster hook's / the modern hook's size against the default (1.25 = 25% larger), capped
    so the widest line stays inside the safe zone.
    slides: [[a, b, hold, d], …] the plain footage whips in from the left and out to the right over the poster (_slides)."""
    # LT: seconds since the effect started; lt (below): seconds since the poster's curtain started (revealAt)
    o = props or {}; d = _secs(o, 3.0); LT = progress * d
    ra = float(o.get('revealAt', 0) or 0); lt = LT - ra; d = max(.1, d - ra)   # poster time starts at revealAt
    live = _rgbf(img); H, W = live.shape[:2]; l, t, ru, rl, b, _ = safe_box(W, H)
    pure = live
    if o.get('before'):                                                       # the modern hook on the live footage
        bl = str(o['before']).upper().split('|'); bf = o.get('beforeFont', 'Montserrat-ExtraBold.ttf')
        bw = max(text_width(x, 100, bf) for x in bl) / 100
        hx = lambda h: tuple(int(str(h).lstrip('#')[j:j + 2], 16) for j in (0, 2, 4))
        bbox = o.get('beforeBox')                                         # e.g. '#f5ff1f': each line on a solid highlighter block
        bk = float(o.get('beforeScale', 1) or 1)                          # beforeScale: the modern hook's size (1.25 = 25% larger), still inside the safe zone
        bs = min(W * .13 * bk, (ru - l) * (.9 if bk <= 1 else .97) / max(bw + (.44 if bbox else 0), 1e-3))
        live = np.ascontiguousarray(live.copy())
        for i, ln in enumerate(bl):
            bfill = hx(o.get('beforeFill', '#ffffff'))
            bstroke = o.get('beforeStroke')                               # e.g. '#1c1c1e': an outline so it reads on a white room
            if bbox:                                                      # orange type did not pop on a white kitchen
                tx = text(ln, bs, bf, fill=bfill, pad=0); px, py = int(bs * .22), int(bs * .14)
                ti = np.zeros((tx.shape[0] + 2 * py, tx.shape[1] + 2 * px, 4), np.float32); ti[..., :3] = np.float32(hx(bbox)) / 255; ti[..., 3] = 1
                ti = rounded(ti, bs * .18); a = tx[..., 3:4]; reg = ti[py:py + tx.shape[0], px:px + tx.shape[1]]
                reg[..., :3] = tx[..., :3] * a + reg[..., :3] * (1 - a)
                ti = shadowed(ti, 8 * W / 1080, 4 * W / 1080, .5)
            else:
                ti = text(ln, bs, bf, fill=bfill, shadow=8 * W / 1080,
                          **({'stroke': max(2, int(bs * .06)), 'stroke_fill': hx(bstroke)} if bstroke else {}))
            # beforePop: false = every line fully on screen from the very first frame (no pop-in)
            q = 1.0 if o.get('beforePop', True) is False else clamp((LT - i * .08) / .22)
            if not q > 0: continue
            # beforeGap: space between the safe zone's top and the first line, in hook heights (default .1; 0 = flush with the top)
            bg_ = float(o.get('beforeGap', .1)) * bs
            place(live, ti, W / 2, t + i * bs * 1.1 + ti.shape[0] / 2 + bg_, 1 + .25 * (1 - ease_back(q)), 0, clamp(q * 3))
    if lt < 0:
        return _out(live)
    snap = min(.2, d * .15) if o.get('hold') is not True else 0.0           # hold: true = the poster stays to the very end (no snap live)
    if snap > 0 and lt >= d - snap:                                                      # snap to live with a white flash (exitFlash: false = a hard cut)
        return _out(pure if o.get('exitFlash', True) is False else np.clip(pure + (1 - (lt - (d - snap)) / snap) * .9, 0, 1))
    def fit(raw):
        ls = str(raw).upper().split('|')
        widest = max(text_width(x, 100, 'Anton-Regular.ttf') for x in ls) / 100
        tk = float(o.get('textScale', 1) or 1)                              # textScale: the poster hook's size (1.25 = 25% larger), still inside the safe zone
        ts = min(W * .15 * tk, (ru - l) * (.92 if tk <= 1 else .96) / max(widest, 1e-3))
        return ls, ts
    lines, tsize = fit(o.get('text', 'FIVE WAYS|TO GET PAID'))
    text_h = len(lines) * tsize * 1.12 + tsize * .3                          # the person's scale stays set by the first hook
    s = float(o.get('scale', clamp((H - (t + text_h)) / (H * .8), .6, 1.0)))
    t0 = 0.0                                                                # text2 + switchAt (s into the effect): the hook is replaced, popping in again
    if o.get('text2') and LT >= float(o.get('switchAt', 99)):
        lines, tsize = fit(o['text2']); t0 = float(o['switchAt']) - ra
    m, face = person(img, frame)
    # the person comes from the clean frame (`pure`), not `live`: a strip of the yellow `before` hook
    # block rode along on top of the head inside the poster cut-out
    f2, m2, _ = _scaled(pure, m, face, s, W, H)
    pers = gta_cel(f2, m2, W)
    mm = (m2 > .5).astype(np.uint8); ow = max(4, int(W * .014))
    outline = cv2.GaussianBlur(cv2.dilate(mm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ow * 2 + 1, ow * 2 + 1))).astype(np.float32), (0, 0), 1.2)[..., None]
    mf = cv2.GaussianBlur(m2, (0, 0), 1.0)[..., None]
    p = clamp(lt / max(.1, d - snap))
    bg = cv2.warpAffine(sunset_bg(W, H), np.float32([[1.03, 0, -W * .015], [0, 1.03, -H * .015 - H * .03 * ease_inout(p)]]), (W, H), borderMode=cv2.BORDER_REFLECT)
    poster = bg * (1 - outline) + np.float32([.06, .03, .08]) * outline
    c = np.clip(poster * (1 - mf) + pers * mf, 0, 1).astype(np.float32)
    c, _, _ = camera(c, None, (0, 0, 1), 1 + .07 * ease_inout(p), W / 2, H * .55)
    c = np.ascontiguousarray(c)
    R = float(o.get('reveal', 0) or 0)
    line_y = lambda u: H * ease_inout(clamp(u))                            # the reveal line's height, u = lt / R
    def passed(y):                                                          # seconds until the line passes height y
        if R <= 0: return 0.0
        return next((R * k / 60 for k in range(61) if line_y(k / 60) >= y), R)
    for i, wording in enumerate(lines):
        ti = text(wording, tsize, 'Anton-Regular.ttf', fill=(255, 244, 214) if i % 2 == 0 else (255, 214, 10), stroke=int(tsize * .07), stroke_fill=(30, 10, 40), shadow=10 * W / 1080)
        cy = t + i * tsize * 1.12 - tsize * .15 + ti.shape[0] / 2
        q = clamp((lt - max(t0 + .06 + i * .14, passed(cy + ti.shape[0] / 2) if not t0 else 0)) / .28)
        if not q > 0: continue
        sc = (1 + .6 * (1 - ease_back(q))) * (1 + .012 * math.sin(lt * 3.1 + i * 1.3))
        place(c, ti, W / 2 + W * .006 * math.sin(lt * 2.3 + i), cy, sc, 3 + 1.4 * math.sin(lt * 2.2 + i * 1.7), clamp(q * 3))
    if R <= 0:
        kin = clamp(lt / .12)
        if kin < 1: c = np.clip(c + (1 - kin) * .8, 0, 1)                   # pops in from a white flash
    sp = W * .05; cx, cy = rl - sp * .8, b - sp * .8                         # spinner and LOADING, bottom right of the safe zone
    if o.get('labelY') is not None: cy = float(o['labelY']) * H / 1920       # labelY: its centre in 1080x1920 frame pixels
    if str(o.get('label', 'LOADING')):                                      # label '' drops the spinner and its tag
        place(c, _spinner(sp, (lt * 360 * 1.4) % 360), cx, cy)
        lb = text(str(o.get('label', 'LOADING')), W * .045, 'BarlowCondensed-ExtraBold.ttf', stroke=max(2, int(W * .045 * .045)), stroke_fill=(12, 14, 16), shadow=max(2, int(W * .045 * .06)))
        place(c, lb, cx - sp * 1.2 - lb.shape[1] / 2, cy, alpha=.9)
    if R > 0 and lt < R + .25:                                              # the unveiling: poster above the line, live below
        ly = line_y(lt / R); yy = np.arange(H, dtype=np.float32)[:, None, None]
        edge = max(1.5, H * .0015)
        above = np.clip((ly - yy) / edge + .5, 0, 1)
        c = c * above + live * (1 - above)
        glow = np.exp(-((yy - ly) / (H * .012)) ** 2) * .9 + np.exp(-((yy - ly) / (H * .0025)) ** 2)
        fade = 1 - clamp((lt - R) / .25)
        c = np.clip(c + glow * fade * np.float32([1.0, .86, .55]), 0, 1)
    # footage whips in and out over the poster. It carries the `before` hook when set (m17 on
    # craziest-claude-gta6: the plain stretches show the modern title, the poster the same title in GTA6 type)
    if o.get('slides'): c = _slides(c, live, LT, o)
    return _out(c)


# ---------- text behind, slice open ----------
K_ACC = (47, 91, 234)
@lru_cache(maxsize=4)
def _grid_base(W, H, col):
    xx, yy = _grid(W, H); r = np.sqrt(((xx - W * .5) / W) ** 2 + ((yy - H * .3) / H) ** 2)
    return np.clip(np.float32(col) / 255 * (1.18 - .55 * np.clip(r, 0, 1))[..., None], 0, 1).astype(np.float32)

def grid_bg(W, H, col, t, speed=110.0):
    """Brand colour with a soft top light and a graph-paper grid drifting diagonally."""
    base = _grid_base(W, H, tuple(col)); xx, yy = _grid(W, H); step = W * .085; off = t * speed * W / 1080; lw = max(2.0, W * .0022)
    gx = np.abs(((xx + off) % step) - step / 2); gy = np.abs(((yy + off * .6) % step) - step / 2)
    line = np.clip(lw - (step / 2 - np.maximum(gx, gy)), 0, 1)[..., None]
    return base + (1 - base) * line * .22


def _slice_layout(W, H, lines, ybot, scale=1.0, font='Inter-ExtraBold.ttf', sizes=None):
    l, t, ru, _, _, _ = safe_box(W, H)
    k = lambda i: float(sizes[i]) if sizes and i < len(sizes) else 1.0     # per-line size multipliers (1 = the shared size)
    size = W * .3; widest = max(text_width(x, 100, font) * k(i) for i, x in enumerate(lines)) / 100
    size = min(size, (ru - l) * .96 / max(widest, 1e-3)) * scale
    ims = [text(x, size * k(i), font, pad=2) for i, x in enumerate(lines)]
    hgt = sum(i.shape[0] for i in ims) + size * .06 * (len(ims) - 1)
    y = top = max(t, min(ybot - hgt, H * .4)); pos = []
    for i in ims: pos.append((W / 2, y + i.shape[0] / 2)); y += i.shape[0] + size * .06
    return ims, pos, (pos[0][1] + pos[-1][1]) / 2, top + hgt * .8 - H * .02     # the cut runs just above the head


def _slice_bg(W, H, col, lt, bg, ims, cy):
    """The card behind the title: 'grid' (graph paper drifting), 'wall' (the title repeated small in rows that scroll
    in alternate directions), 'burst' (sun rays turning round the title) or 'solid' (the plain colour, soft top light only)."""
    if bg == 'solid':
        return _grid_base(W, H, tuple(col)).copy()
    if bg == 'burst':
        base = _grid_base(W, H, tuple(col)); xx, yy = _grid(W, H)
        ang = np.arctan2(yy - cy, xx - W / 2) + lt * .9; ray = ((ang / (2 * math.pi / 18)) % 2 < 1).astype(np.float32)[..., None]
        return base + (1 - base) * ray * .16
    if bg == 'wall':
        card = _grid_base(W, H, tuple(col)).copy(); row = W * .13; k = 0
        for y in np.arange(-row * .5, H + row, row):
            im = ims[k % len(ims)]; sc = row * .78 / max(1, im.shape[0]); w = im.shape[1] * sc + W * .05
            off = (lt * W * .45 * (1 if k % 2 else -1)) % w
            for x in np.arange(-w + off, W + w, w): place(card, im, x + w / 2, y, sc, 0, .16)
            k += 1
        return card
    return grid_bg(W, H, col, lt).copy()


def _slice_card(W, H, col, lines, ybot, lt, cut, stag, times=None, tilt=0.0, bg='grid', scale=1.0, font='Inter-ExtraBold.ttf', sizes=None):
    """The opening card at time lt: drifting grid, each word slams in (overshoot and a shockwave ring), slow push, shake.
    times: when each word lands (seconds into the card; e.g. as it is spoken), instead of every `stag` seconds.
    tilt: degrees each word kicks in at, alternating sides, settling straight as it lands."""
    words, spots, mid_y, _ = _slice_layout(W, H, lines, ybot, scale, font, sizes)
    since = [lt - (float(times[n]) if times and n < len(times) else n * stag) for n in range(len(spots))]   # seconds since each word landed
    push = 1 + .06 * clamp(lt / max(cut, .3))
    card = _slice_bg(W, H, col, lt, bg, words, mid_y).astype(np.float32)
    rings = np.zeros((H, W), np.float32)
    for age, (x, y) in zip(since, spots):                                   # a shockwave ring opens from each word as it lands
        spread = clamp((age - .12) / .55)
        if 0 < spread < 1:
            cv2.circle(rings, (int(x), int(mid_y + (y - mid_y) * push)), int(W * (.12 + .55 * ease_out(spread))),
                       170 / 255 * (1 - spread), int(W * .014 * (1 - spread)) + 2, cv2.LINE_AA)
    card = card * (1 - rings[..., None]) + rings[..., None]
    shake = 0.0
    for n, (age, word, (x, y)) in enumerate(zip(since, words, spots)):
        arrive = clamp(age / .3)
        if arrive <= 0: continue
        unsettled = 1 - ease_back(arrive)                                   # 1 as it appears, 0 once it sits
        if arrive >= .4: shake = max(shake, 1 - clamp((age - .12) / .25))
        place(card, word, x, mid_y + (y - mid_y) * push, (1 + 1.4 * unsettled) * push, (1 if n % 2 else -1) * tilt * unsettled, clamp(arrive * 3))
    if shake > 0:
        rows, columns = int(W * .008 * shake * math.cos(lt * 70)), int(W * .012 * shake * math.sin(lt * 90))
        card = np.roll(card, (rows, columns), axis=(0, 1))
    return card.astype(np.float32)


def text_behind_slice(img, progress, amount, frame, seed, props=None):
    """text: the title, lines split with | (default ZERO|CUTS). at: seconds into the effect when the slice happens
    (default 60% in). angle: the cut line's tilt (-9). color: the card (#2F5BEA). y: where the title's bottom sits,
    0..1 of the height (default .37, just over a chest-up speaker's head). stagger: seconds between words (.22).
    times: when each word lands, seconds into the effect (put them on the spoken words for captions behind the person).
    tilt: degrees each word kicks in at, alternating (0). bg: the card, 'grid' | 'wall' | 'burst' | 'solid'.
    enter: seconds of the real background before the card rolls in from the top over `roll` seconds (0, .2).
    scale: the title's size against the widest that fits the safe zone (1), e.g. .8 to keep it clear of a zoom.
    font: the title's font file in signature/fonts (Inter-ExtraBold.ttf; InterTight-ExtraBold.ttf matches the Inter Tight captions).
    sizes: per-line size multipliers, e.g. [1.3, 1] to make the first line 30% bigger than the rest."""
    o = props or {}; d = _secs(o, 3.0); lt = progress * d
    sizes = tuple(float(x) for x in o['sizes']) if o.get('sizes') else None
    f = _rgbf(img); H, W = f.shape[:2]; m, _ = person(img, frame)
    col = rgb(o.get('color'), K_ACC); lines = tuple(str(o.get('text', 'ZERO|CUTS')).upper().split('|'))
    cut = float(o.get('at', d * .6)); ang = math.radians(float(o.get('angle', -9))); stag = float(o.get('stagger', .22))
    ybot = float(o.get('y', .37)) * H
    times = o.get('times'); times = tuple(float(x) for x in times) if times else None
    enter, roll = float(o.get('enter', 0)), float(o.get('roll', .2))
    if lt < enter: return img.copy()                                        # the real background first, then the card rolls in
    card = _slice_card(W, H, col, lines, ybot, min(lt, cut), cut, stag, times, float(o.get('tilt', 0)), str(o.get('bg', 'grid')), float(o.get('scale', 1)), str(o.get('font', 'Inter-ExtraBold.ttf')), sizes)
    p = ease_inout((lt - cut - .14) / .42)
    if p >= 1: return img.copy()
    x0, y0 = W / 2, _slice_layout(W, H, lines, ybot, float(o.get('scale', 1)), str(o.get('font', 'Inter-ExtraBold.ttf')), sizes)[3]
    xx, yy = _grid(W, H); side = (yy - y0) - math.tan(ang) * (xx - x0)
    nx, ny = -math.sin(ang), math.cos(ang); dist = p * H * .75
    layer = np.zeros_like(f); a = np.zeros((H, W), np.float32)
    for way in (-1, 1):                                                     # the two pieces, pushed apart along the cut's normal
        piece = (side * way > 0).astype(np.float32)
        slide = np.float32([[1, 0, way * nx * dist], [0, 1, way * ny * dist]])
        layer += cv2.warpAffine(card * piece[..., None], slide, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0))
        a += cv2.warpAffine(piece, slide, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    if lt < enter + roll:                                                   # rolling in: the card slides down from the top
        dy = (ease_out((lt - enter) / max(roll, .01)) - 1) * H; M = np.float32([[1, 0, 0], [0, 1, dy]])
        layer = cv2.warpAffine(layer, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0)); a = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    a = np.clip(a, 0, 1) * (1 - m)
    f = f * (1 - a[..., None]) + layer * a[..., None]
    if cut <= lt < cut + .5:                                                # the cut line: draws across fast, glows, fades
        q = clamp((lt - cut) / .14); fade = 1 - clamp((lt - cut - .14) / .3)
        ln = np.zeros((H, W), np.float32); xa, xb = -20, -20 + (W + 40) * q
        cv2.line(ln, (int(xa), int(y0 + math.tan(ang) * (xa - x0))), (int(xb), int(y0 + math.tan(ang) * (xb - x0))), 1.0, max(4, int(W * .007)), cv2.LINE_AA)
        ln = np.clip(ln + cv2.GaussianBlur(ln, (0, 0), 6 * W / 1080), 0, 1)[..., None] * fade
        f = f * (1 - ln) + ln
    return _out(np.clip(f, 0, 1))


# ---------- reel fly-through ----------
RF_VIDEO, RF_IMAGE = ('mp4', 'mov', 'm4v', 'webm'), ('jpg', 'jpeg', 'png', 'webp')
RF_BW, RF_BH = 360, 640                                                     # every card is decoded at this size, then scaled

@lru_cache(maxsize=32)
def _frames(path):
    """A clip decoded once at card size, 15 fps, cover-cropped (RGB uint8, n x RF_BH x RF_BW x 3)."""
    frame_bytes = RF_BW * RF_BH * 3
    fit = f'fps=15,scale={RF_BW}:{RF_BH}:force_original_aspect_ratio=increase,crop={RF_BW}:{RF_BH}'
    decode = ['ffmpeg', '-v', 'error', '-i', path, '-vf', fit, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1']
    data = subprocess.run(decode, capture_output=True, check=True).stdout
    count = len(data) // frame_bytes
    return np.frombuffer(data[:count * frame_bytes], np.uint8).reshape(count, RF_BH, RF_BW, 3)


@lru_cache(maxsize=32)
def _image(path):
    im = cv2.imread(path, cv2.IMREAD_COLOR)
    return _cover(im[..., ::-1].astype(np.float32) / 255, RF_BW, RF_BH)


def _cover(f, w, h):
    """f (float) cover-scaled and centre-cropped to w x h."""
    H, W = f.shape[:2]; s = max(w / W, h / H)
    big = cv2.resize(f, (max(int(w), int(round(W * s))), max(int(h), int(round(H * s)))), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR)
    l, t = (big.shape[1] - int(w)) // 2, (big.shape[0] - int(h)) // 2
    return big[t:t + int(h), l:l + int(w)]


def _title(path):
    """A card title from a file name: the leading date dropped, dashes to spaces, first letter capital."""
    undated = re.sub(r'^\d{4}[-_]\d{2}[-_]\d{2}[-_]?', '', Path(path).stem)
    words = re.sub(r'[-_]+', ' ', undated).strip()
    return words[:1].upper() + words[1:]


_Card = namedtuple('_Card', 'x y depth turn clip start titled')            # one card in the fly-through's 3D field

_HEROES, _HERO_GAP = 4, 1.15                                                # titled cards down the middle lane, and the depth between them

RF_ENTER, RF_FLY, RF_COLUMN, RF_FOCAL = .08, .55, .87, .5                   # progress marks (entrance, fly-through, column), focal length

@lru_cache(maxsize=2)
def _rf_setup(W, H, folder, titles_text, sub, seed, count, bg, bg2, gta):
    """Everything the fly-through needs that does not change per frame: clips, titles, the card field, both backgrounds."""
    is_media = lambda name: name.lower().rsplit('.', 1)[-1] in RF_VIDEO + RF_IMAGE
    paths = sorted(os.path.join(folder, name) for name in os.listdir(folder) if is_media(name)) if os.path.isdir(folder) else []
    given = [(row.split('::') + [''])[:2] for row in titles_text.split('|')] if titles_text else []
    titles = [(head, under or sub) for head, under in given + [[_title(p), ''] for p in paths[len(given):]]]
    dice, field = random.Random(seed), []
    while len(field) < count:                                               # background cards, scattered in depth
        x, y, depth = dice.uniform(-2.3, 2.3), dice.uniform(-3.8, 3.8), dice.uniform(.7, _HEROES * _HERO_GAP + 2.5)
        if abs(x) >= 1.0 or abs(y) >= 1.5:                                  # the middle lane stays clear for the hero cards
            field.append(_Card(x, y, depth, dice.uniform(-5, 5), len(field), dice.uniform(0, 3), False))
    for hero in range(_HEROES):
        field.append(_Card(dice.uniform(-.08, .08), dice.uniform(-.06, .06), 1 + (hero + 1) * _HERO_GAP, dice.uniform(-2, 2), hero, 0, True))
    xx, yy = _grid(W, H)
    glow = np.clip(1 - np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * .45) / H) ** 2)[..., None] * 1.6, 0, 1) * .10
    if gta:
        fly_bg = sunset_bg(W, H); column_bg = np.clip(fly_bg * .38 + np.float32([.06, .02, .10]) * .62, 0, 1)
    else:
        fly_bg, column_bg = np.clip(np.float32(bg) / 255 + glow, 0, 1), np.clip(np.float32(bg2) / 255 + glow * .6, 0, 1)
    down = np.arange(RF_BH, dtype=np.float32) / RF_BH                        # darkens the foot of a card under its title
    return dict(paths=paths, titles=titles, field=field, bg1=fly_bg.astype(np.float32), bg2=column_bg.astype(np.float32),
                corner=rounded(np.ones((RF_BH, RF_BW, 4), np.float32), 26)[..., 3], shade=(np.clip((down - .62) / .38, 0, 1) ** 1.4 * .745)[:, None, None])


_cel_cache = {}
def _cel(f):
    """The gta6_poster cel shading on one card-sized picture."""
    return gta_cel(f, np.ones(f.shape[:2], np.float32), RF_BW * 3)


@lru_cache(maxsize=64)
def _card_title(t0, t1, gta, font=None):
    if font:                                                                # a chosen face (props.font), e.g. the modern theme's Montserrat
        fs = 32
        while text_width(t0, fs, font) > RF_BW * .86 and fs > 16: fs -= 2
        return text(t0, fs, font), (text(t1, 19, font, fill=(225, 225, 225)) if t1 else None)
    if gta:
        fs = 44; ti = text(t0.upper(), fs, 'Anton-Regular.ttf', fill=(255, 244, 214), stroke=4, stroke_fill=(30, 10, 40), shadow=4)
        while ti.shape[1] > RF_BW * .94 and fs > 18: fs -= 3; ti = text(t0.upper(), fs, 'Anton-Regular.ttf', fill=(255, 244, 214), stroke=4, stroke_fill=(30, 10, 40), shadow=4)
        si = text(t1.upper(), 24, 'Anton-Regular.ttf', fill=(255, 214, 10), stroke=3, stroke_fill=(30, 10, 40)) if t1 else None
        return ti, si
    fs = 30
    while text_width(t0, fs, 'Inter-Bold.ttf') > RF_BW * .86 and fs > 16: fs -= 2
    return text(t0, fs, 'Inter-Bold.ttf'), (text(t1, 19, 'Inter-Bold.ttf', fill=(225, 225, 225)) if t1 else None)


def _rf_picture(path, t, gta):
    """The picture on a reel's card at time t (RGB float, card size); cel-shaded frames are kept, since that is slow."""
    if path.lower().rsplit('.', 1)[-1] not in RF_VIDEO:
        still = _image(path); return _cel(still) if gta else still
    clip = _frames(path); n = int(t * 15) % len(clip)
    if not gta: return clip[n].astype(np.float32) / 255
    if (path, n) not in _cel_cache:
        if len(_cel_cache) > 400: _cel_cache.clear()
        _cel_cache[(path, n)] = _cel(clip[n].astype(np.float32) / 255)
    return _cel_cache[(path, n)]

def _rf_base(S, i, t, label, live, gta, font=None):
    """One card (RGBA, RF_BW x RF_BH): the clip's frame at time t, a title strip, rounded corners. i None: the live shot."""
    title = None
    if not S['paths'] or i is None:
        picture = _cover(live, RF_BW, RF_BH)
        if gta: picture = _cel(picture)
    else:
        picture = _rf_picture(S['paths'][i % len(S['paths'])], t, gta)
        if label: title = S['titles'][i % len(S['titles'])]
    card = np.dstack([picture, S['corner']]).astype(np.float32)
    if title and title[0]:
        head, under = _card_title(title[0], title[1], gta, font)
        if not gta: card[..., :3] *= 1 - S['shade']
        head_y = RF_BH - head.shape[0] / 2 - (40 if title[1] else 14) if gta else RF_BH - (62 if title[1] else 44)
        place(card, head, RF_BW / 2, head_y)
        if under is not None: place(card, under, RF_BW / 2, RF_BH - (under.shape[0] / 2 + 10 if gta else 30))
    return _outlined(card, 9) if gta else card


def _outlined(L, width, k=1.0):
    """A heavy dark poster outline just inside a layer's (rounded) edge."""
    a = L[..., 3]; e = max(1, int(width)); ring = np.clip(a - cv2.erode(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * e + 1, 2 * e + 1))), 0, 1)[..., None] * k
    out = L.copy(); out[..., :3] = L[..., :3] * (1 - ring) + np.float32([16, 6, 22]) / 255 * ring; return out


def _rf_draw(canvas, card, cx, cy, width, rot=0.0, alpha=1.0, blur=0.0, shadow=False):
    """Draw a card `width` pixels wide onto the canvas; `blur` is the depth-of-field amount."""
    w = int(width); h = int(w * RF_BH / RF_BW)
    if w < 4 or alpha <= .01: return
    if blur > 1.5:                                                          # cheap depth of field: blur a small copy
        k = max(.12, min(1.0, 6 / blur))
        tiny = cv2.resize(card, (max(4, int(w * k)), max(4, int(h * k))), interpolation=cv2.INTER_AREA)
        sized = cv2.resize(cv2.GaussianBlur(tiny, (0, 0), blur * k), (w, h), interpolation=cv2.INTER_LINEAR)
    else:
        sized = cv2.resize(card, (w, h), interpolation=cv2.INTER_AREA if w < RF_BW else cv2.INTER_CUBIC)
    if shadow and w > canvas.shape[1] * .2: sized = shadowed(np.clip(sized, 0, 1), int(w * .05), int(w * .03), .43)
    place(canvas, sized, cx, cy, 1.0, rot, alpha)


def _rf_fly(S, u, lt, live, gta, font, W, H):
    """Entrance and fly-through: the shot shrinks into the first card, then the camera moves through the field, hero to hero."""
    canvas = S['bg1'].copy()
    travelled = clamp((u - RF_ENTER) / (RF_FLY - RF_ENTER)) * _HEROES
    hero = min(_HEROES - 1, int(travelled)); part = travelled - hero
    cam = _HERO_GAP * (hero + .45 * part + .55 * ease_inout(part))          # keeps moving but settles on each hero card
    own = _Card(0, 0, 1.0, 0, None, 0, False)                               # the live shot, as the nearest card
    for card in sorted([own] + S['field'], key=lambda c: cam - c.depth):    # far to near
        away = card.depth - cam
        if not .28 <= away <= 6: continue
        size = RF_FOCAL / away; width = size * W
        x, y = W / 2 + card.x * size * W, H / 2 + card.y * size * W
        if x + width < -W * .2 or x - width > W * 1.2: continue
        alpha = clamp((6 - away) / 1.5) * clamp((away - .28) / .22)
        blur = max(0.0, size / RF_FOCAL - 1.25) * 10 + max(0.0, .16 - size) * 18
        if card.clip is None:                                               # the shot shrinks from full screen into the first card
            shrink = ease_inout(clamp(u / RF_ENTER)); width = W + (W * .5 - W) * shrink
            if shrink < 1: blur = 0
        face = _rf_base(S, card.clip, lt + card.start, card.titled and size > .3, live, gta, font)
        _rf_draw(canvas, face, x, y, width, card.turn * clamp(1 - abs(x - W / 2) / W), alpha, blur, shadow=size > .3)
    return canvas

def _rf_grow(canvas, live, y, card_w, grow, gta, W, H):
    """The live shot growing from its card back to the full frame (cel-shaded until the last fifth, in the gta6 look)."""
    width = card_w + (W - card_w) * grow
    shot = _cover(live, int(width), int(width * H / W))
    if gta and grow < 1:
        painted = cv2.resize(_cel(_cover(live, 540, 960)), (shot.shape[1], shot.shape[0]), interpolation=cv2.INTER_CUBIC)
        real = clamp((grow - .8) / .2); shot = painted * (1 - real) + shot * real
    layer = rounded(np.dstack([shot, np.ones(shot.shape[:2], np.float32)]), 26 * width / RF_BW * (1 - grow))
    if gta and grow < 1: layer = _outlined(layer, 9 * width / RF_BW * (1 - grow), 1 - grow)
    place(canvas, layer, W / 2, y)
    if gta:
        flash = clamp(1 - abs(grow - .9) / .1)
        if flash > 0: canvas = np.clip(canvas + flash * .85, 0, 1)
    return canvas

def _rf_column(S, u, lt, live, gta, font, W, H, extra):
    """The column: the last hero card, `extra` more reels and the live shot scroll past; the shot then grows to full screen."""
    fade = ease_inout(clamp((u - RF_FLY) / .06))
    canvas = S['bg1'] * (1 - fade) + S['bg2'] * fade
    stack = [_HEROES - 1] + [_HEROES + j for j in range(extra)] + [None]
    last = len(stack) - 1
    scrolled = clamp((u - RF_FLY) / (RF_COLUMN - RF_FLY)) * last
    row = min(last - 1, int(scrolled)); part = scrolled - row
    at = row + ease_inout(clamp((part - .35) / .65)) if u < RF_COLUMN else last
    card_w = W * .5; card_h = card_w * RF_BH / RF_BW; pitch = card_h + W * .045
    grow = ease_inout(clamp((u - RF_COLUMN) / (1 - RF_COLUMN)))
    for slot, clip in enumerate(stack):
        y = H / 2 + (slot - at) * pitch
        if y + card_h < -H * .1 or y - card_h > H * 1.1: continue
        if clip is None and grow > 0:
            canvas = _rf_grow(canvas, live, y, card_w, grow, gta, W, H); continue
        focus = clamp(1 - abs(slot - at))
        face = _rf_base(S, clip, lt, clip is not None, live, gta, font)
        _rf_draw(canvas, face, W / 2, y, card_w * (.94 + .06 * focus), 0, (.45 + .55 * focus) * (1 - grow), 0, shadow=focus > .5)
    return canvas

def reel_flythrough(img, progress, amount, frame, seed, props=None):
    """clips: a folder of reel videos or images (default the sample reels in signature/reels; titles from file names).
    text: card titles 'Title::sub|...'. sub: a line under every title (your handle). column: cards in the column (3).
    count: background cards (16). bg, bg2: fly-through and column backgrounds. look: gta6 = cel-shaded poster cards on the
    sunset. font: the card titles' font file in signature/fonts (Montserrat-ExtraBold.ttf for the modern look). seed: the field layout (3).
    grid: a colour (e.g. #1A2FA0) to fly through text_behind_slice's drifting graph-paper card instead of the flat bg.
    grid2: the same for the column (instead of the flat bg2).
    Full-screen cutaway; give it 4-6 s. amount does not fade it."""
    o = props or {}; u = clamp(progress); lt = u * _secs(o, 5.0)
    live = _rgbf(img); H, W = live.shape[:2]
    gta = str(o.get('look', '')).lower() in ('gta6', 'gta', 'gta6-poster', 'gta6_poster', 'poster')
    font = str(o['font']) if o.get('font') else None                        # card titles in another face (a file in signature/fonts)
    S = _rf_setup(W, H, str(o.get('clips') or REELS), str(o.get('text') or ''), str(o.get('sub', '')), int(o.get('seed', 3)), int(o.get('count', 16)),
                  rgb(o.get('bg'), (176, 171, 165)), rgb(o.get('bg2'), (8, 8, 10)), gta)
    for key, prop in (('bg1', 'grid'), ('bg2', 'grid2')):                   # drifting graph paper instead of a flat background
        if o.get(prop): S = dict(S, **{key: grid_bg(W, H, rgb(o[prop], K_ACC), lt).astype(np.float32)})
    if u < RF_FLY: return _out(_rf_fly(S, u, lt, live, gta, font, W, H))
    return _out(_rf_column(S, u, lt, live, gta, font, W, H, int(o.get('column', 3))))


# name -> (fn, title, description) ; every fn takes props
EFFECTS = {
    'cop_lights': (cop_lights, 'Cop lights', 'The room drops dark and red and blue police lights strobe across the person from both sides.'),
    'gta6_poster': (gta6_poster, 'GTA6 poster', 'A game-cover poster of the person: cel shading on a sunset with a heavy outline, the hook in bold type and a loading spinner, then it snaps live.'),
    'text_behind_slice': (text_behind_slice, 'Text behind, slice', 'A colour card with a big title behind the person; on the cue a cut line slices it and the halves slide apart to reveal the shot (a fixed look, the same in every theme). Prefer a title in the storyboard theme: a text overlay with "behind": "person" and "exit": "slice" (README: Behind the person, and the slice exit).'),
    'reel_flythrough': (reel_flythrough, 'Reel fly-through', 'Full-screen cutaway: the shot shrinks into a card, the camera flies through playing reels, they stack into a column and the last card grows back to full screen.'),
    'color_grade': (color_grade, 'Colour grade', 'The look changes on a word: moody, warm, cool, black and white or pop fades in (or ripples out from a point).'),
}
import signature_kit as _kit                                                # the reel kit and lines of light (signature_kit.py)
EFFECTS.update(_kit.EFFECTS)
for _fn, _, _ in EFFECTS.values(): _fn.takes_props = True
SIGNATURE = {k: v[0] for k, v in EFFECTS.items()}

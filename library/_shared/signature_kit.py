"""Signature effects, part two: the reel kit (Instagram talking-head editing) and lines of light. Same contract as signature.py (read its docstring): fn(img, progress, amount, frame, seed,
props=None) -> BGR uint8, stateless and deterministic per frame, every option defaulted. Imported by signature.py, which
adds these to its EFFECTS (import signature, not this module, first).

  ai_prompt         a chat composer above the head types the ask, shows a slash-command suggestion, then sends: Sent
  edit_preview      the shot shrinks into an "Editing with..." card on the brand grid, plays sped up with a shimmer, grows back
  raw_vs_edit       RAW and EDITED cards side by side on the brand grid; the edited one (punch-in, grade, caption, sticker) grows to full screen
  feed_scroll       a phone-style card above the head swipes up through reels like the feed, each with its view count
  storyboard_pages  storyboard pages above the head: thumbnails, each shot's line and a note; the pages flip
  insights_zoom     a reel-insights card slides in, the numbers count up, the camera pushes into the views row, a highlighter sweeps
  catalog_grid      end card: Comment "KEYWORD" over a numbered grid of reels that fills in tile by tile
  lines_of_light    the room drops to near-black teal; thin neon lines draw an editing timeline behind the person, it is struck out

Brand look (every kit effect): accent (#2F5BEA), highlight (#FFE03C), ink (#16181D), paper (light cards, #FFFFFF),
background: grid (accent with a drifting graph-paper grid) | solid. The cards above the head keep the face (brows to chin)
uncovered: the real face is put back over them. Fonts (signature/fonts, all OFL): Inter, Instrument Serif
Italic, Michroma.
"""
import math, os, re
from functools import lru_cache
import cv2
import numpy as np
import signature as S
from signature import (clamp, ease_out, ease_inout, ease_back, rgb, _rgbf, _out, _secs, safe_box, person, camera, place,
                       shadowed, rounded, grid_bg, _grid_base, _grid, _frames, _image, _cover, K_ACC, REELS, FONTS, RF_VIDEO, RF_IMAGE)

K_HI, K_INK, K_PAPER, K_MUTED = (255, 224, 60), (22, 24, 29), (255, 255, 255), (112, 118, 130)
KB, KXB, KS, KM = 'Inter-Bold.ttf', 'Inter-ExtraBold.ttf', 'Inter-SemiBold.ttf', 'Inter-Medium.ttf'
SERIF, MICH = 'InstrumentSerif-Italic.ttf', 'Michroma-Regular.ttf'


def _theme(o):
    return dict(acc=rgb(o.get('accent') or o.get('color'), K_ACC), hi=rgb(o.get('highlight'), K_HI), ink=rgb(o.get('ink'), K_INK),
                paper=rgb(o.get('paper'), K_PAPER), bg=str(o.get('background', 'grid')).lower())


def _theme_bg(W, H, T, t):
    """The brand's full-frame background: accent with a soft top light and a drifting grid, or the plain accent light."""
    if T['bg'] == 'solid': return _grid_base(W, H, tuple(T['acc'])).copy()
    return grid_bg(W, H, T['acc'], t, 60.0)


def _kout(o, lt, d, dd=.15): return clamp((d - lt) / dd) if 'seconds' in o else 1.0
def _mix(a, b, k): return tuple(int(round(x * (1 - k) + y * k)) for x, y in zip(a, b))


# ---------- drawing on RGBA float layers (straight alpha), anti-aliased by 4x supersampling ----------
SS = 4
def layer(w, h): return np.zeros((max(1, int(h)), max(1, int(w)), 4), np.float32)


def _over(R, col, a):
    """Composite colour col (3,) or (h, w, 3), coverage a (h, w), over the RGBA region R in place."""
    a3 = a[..., None]; na = a + R[..., 3] * (1 - a)
    R[..., :3] = (col * a3 + R[..., :3] * R[..., 3:4] * (1 - a3)) / np.maximum(na[..., None], 1e-5)
    R[..., 3] = na


def _draw(L, box, fn, col, alpha=1.0):
    h, w = L.shape[:2]
    x0, y0 = max(0, int(math.floor(box[0])) - 2), max(0, int(math.floor(box[1])) - 2)
    x1, y1 = min(w, int(math.ceil(box[2])) + 2), min(h, int(math.ceil(box[3])) + 2)
    if alpha <= 0 or x0 >= x1 or y0 >= y1: return
    m = np.zeros(((y1 - y0) * SS, (x1 - x0) * SS), np.uint8)
    fn(m, lambda x, y: (int(round((x - x0) * SS)), int(round((y - y0) * SS))))
    a = cv2.resize(m, (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA).astype(np.float32) / 255 * alpha
    _over(L[y0:y1, x0:x1], np.float32(col[:3]) / 255, a)


def rrect(L, x0, y0, x1, y1, r, col, alpha=1.0):
    def fn(m, P):
        (ax, ay), (bx, by) = P(x0, y0), P(x1, y1); rr = int(max(0, min(r * SS, (bx - ax) / 2, (by - ay) / 2)))
        cv2.rectangle(m, (ax + rr, ay), (bx - rr, by), 255, -1); cv2.rectangle(m, (ax, ay + rr), (bx, by - rr), 255, -1)
        for cx, cy in ((ax + rr, ay + rr), (bx - rr, ay + rr), (ax + rr, by - rr), (bx - rr, by - rr)): cv2.circle(m, (cx, cy), rr, 255, -1, cv2.LINE_AA)
    _draw(L, (x0, y0, x1, y1), fn, col, alpha)


def ellipse(L, cx, cy, rx, ry, col, alpha=1.0, width=0):
    def fn(m, P):
        c = P(cx, cy); cv2.ellipse(m, c, (max(1, int(rx * SS)), max(1, int(ry * SS))), 0, 0, 360, 255, -1 if not width else max(1, int(width * SS)), cv2.LINE_AA)
    _draw(L, (cx - rx - width, cy - ry - width, cx + rx + width, cy + ry + width), fn, col, alpha)


def poly(L, pts, col, alpha=1.0):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    _draw(L, (min(xs), min(ys), max(xs), max(ys)), lambda m, P: cv2.fillPoly(m, [np.int32([P(*p) for p in pts])], 255, cv2.LINE_AA), col, alpha)


def line(L, pts, width, col, alpha=1.0, closed=False):
    if len(pts) < 2: return
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    _draw(L, (min(xs) - width, min(ys) - width, max(xs) + width, max(ys) + width),
          lambda m, P: cv2.polylines(m, [np.int32([P(*p) for p in pts])], closed, 255, max(1, int(width * SS)), cv2.LINE_AA), col, alpha)


def arc(L, cx, cy, r, a0, a1, width, col, alpha=1.0):
    _draw(L, (cx - r - width, cy - r - width, cx + r + width, cy + r + width),
          lambda m, P: cv2.ellipse(m, P(cx, cy), (int(r * SS), int(r * SS)), 0, a0, a1, 255, max(1, int(width * SS)), cv2.LINE_AA), col, alpha)


# ---------- text: one line, a steady baseline (FFmpeg drawtext with y_align=font) ----------
@lru_cache(maxsize=512)
def _kglyphs(s, font, size):
    """Coverage of s at a fixed baseline: rows [0, 1.3 * size) span ascender to descender whatever the letters,
    columns cropped to the ink (2 px margin). (array, ink left offset)."""
    import subprocess, tempfile
    size = max(6, int(size)); pad = size // 3 + 4
    Wc, Hc = int(size * (len(s) * .95 + 1)) + 2 * pad, int(size * 1.7) + 2 * pad
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8') as t: t.write(s); name = t.name
    try:
        vf = f"drawtext=fontfile='{FONTS / font}':textfile='{name}':fontsize={size}:fontcolor=white:expansion=none:x={pad}:y={pad}:y_align=font"
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'color=c=black:s={Wc}x{Hc}', '-vf', vf, '-frames:v', '1',
                              '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True, check=True).stdout
    finally: os.unlink(name)
    g = np.frombuffer(raw, np.uint8).reshape(Hc, Wc).astype(np.float32) / 255
    g = g[pad:pad + int(size * 1.3)]
    xs = np.nonzero(g.max(axis=0) > .02)[0]
    if not len(xs): return np.zeros((g.shape[0], 2), np.float32)
    return np.ascontiguousarray(g[:, max(0, xs[0] - 2):xs[-1] + 3])


def ktext(s, size, font=KB, fill=(255, 255, 255)):
    """RGBA layer of one line of text; its vertical middle is the line's middle (like PIL's anchor 'lm')."""
    if not s or not s.strip(): return layer(2, size * 1.3)
    g = _kglyphs(s, font, int(size))
    return np.dstack([np.broadcast_to(np.float32(fill[:3]) / 255, g.shape + (3,)), g]).astype(np.float32)


def tracked(s, size, font, fill, track=.32):
    """Wide-tracked caps, one glyph at a time (drawtext has no letter spacing)."""
    parts = [ktext(ch, size, font, fill) for ch in s]; sp = size * track; gaps = []
    w = 0
    for ch, p in zip(s, parts): gaps.append(w); w += (size * .38 if ch == ' ' else p.shape[1]) + sp
    L = layer(w - sp + 4, size * 1.3)
    for x, ch, p in zip(gaps, s, parts):
        if ch != ' ': put(L, p, x + 2, L.shape[0] / 2, 'lm')
    return L


def put(L, T, x, y, anchor='lm', alpha=1.0):
    """Composite layer T onto layer L. anchor: l/m/r horizontally, m (middle) or t (top) vertically."""
    h, w = T.shape[:2]
    x0 = x if anchor[0] == 'l' else x - w / 2 if anchor[0] == 'm' else x - w
    y0 = y - h / 2 if anchor[1] == 'm' else y
    x0, y0 = int(round(x0)), int(round(y0))
    H_, W_ = L.shape[:2]; ax, ay, bx, by = max(0, x0), max(0, y0), min(W_, x0 + w), min(H_, y0 + h)
    if bx <= ax or by <= ay: return
    sub = T[ay - y0:by - y0, ax - x0:bx - x0]
    _over(L[ay:by, ax:bx], sub[..., :3], sub[..., 3] * alpha)


def tw(s, size, font): return ktext(s, size, font).shape[1] - 4 if s and s.strip() else 0


def _kguard(f, before, m, face):
    """Put the real face (brows to chin) back over any card: cards may use the space above the head, never the face."""
    H, W = f.shape[:2]; fx, fy, fw = face
    rx, ry = fw * .62, fw * .88; cy = fy + fw * .08
    x0, x1 = int(max(0, fx - rx * 1.2)), int(min(W, fx + rx * 1.2)); y0, y1 = int(max(0, cy - ry * 1.2)), int(min(H, cy + ry * 1.2))
    if x0 >= x1 or y0 >= y1: return
    rows, columns = np.ogrid[y0:y1, x0:x1]
    e_ = ((columns - fx) / rx) ** 2 + ((rows - cy) / ry) ** 2
    g = (np.clip((1.15 - e_) / .3, 0, 1) * m[y0:y1, x0:x1])[..., None]
    f[y0:y1, x0:x1] = f[y0:y1, x0:x1] * (1 - g) + before[y0:y1, x0:x1] * g


def _idle(lt, W, H, seed=0, amp=1.0):
    t = lt + seed * 1.7
    return math.sin(t * 1.9) * W * .004 * amp, math.sin(t * 2.6 + 1.1) * H * .004 * amp, math.sin(t * 1.3 + .4) * 1.2 * amp


# ---------- media: reels / covers / the clip itself ----------
def _media(o, key='clips'):
    """Paths from props[key] (a folder, one file, a list, or paths split with |); the sample reels by default."""
    v = o.get(key) or o.get('images')
    if isinstance(v, (list, tuple)): paths = [str(x) for x in v]
    elif v and '|' in str(v): paths = [x.strip() for x in str(v).split('|') if x.strip()]
    elif v and os.path.isfile(str(v)): paths = [str(v)]
    else:
        folder = str(v) if v else str(REELS)
        paths = sorted(os.path.join(folder, n) for n in os.listdir(folder) if n.lower().rsplit('.', 1)[-1] in RF_VIDEO + RF_IMAGE) if os.path.isdir(folder) else []
    return [p for p in paths if os.path.isfile(p)]


def _still(path, t=1.0):
    """One picture (RGB float, 360 x 640 cover crop) of a video at t seconds, or an image."""
    if path.lower().rsplit('.', 1)[-1] in RF_VIDEO:
        arr = _frames(path); return arr[int(t * 15) % len(arr)].astype(np.float32) / 255
    return _image(path)


def _crop(src, w, h, top=.5):
    """src (float RGB) cover-scaled to w x h, cropped at `top` (0 = top edge, .5 = centre)."""
    H, W = src.shape[:2]; s = max(w / W, h / H)
    big = cv2.resize(src, (max(int(w), int(round(W * s)) + 1), max(int(h), int(round(H * s)) + 1)), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR)
    l, t = (big.shape[1] - int(w)) // 2, int((big.shape[0] - int(h)) * top)
    return big[t:t + int(h), l:l + int(w)]


def _rgba(im): return np.dstack([im, np.ones(im.shape[:2], np.float32)]).astype(np.float32)


# ---------- ai_prompt ----------
def _compose_card(W, T, w, typed, caret, sent, sugg_on, label, sugg, done):
    h = int(W * (.25 if sugg else .19)); pad = w * .05; u = W / 1080
    L = layer(w, h); rrect(L, 0, 0, w, h, h * .2, T['paper'])
    put(L, ktext(label.upper(), W * .024, KS, K_MUTED), pad, h * .17)
    size = W * .045; ty = h * .43; shown = typed
    while len(shown) > 3 and tw(shown, size, KM) > w - pad * 2 - h * .35: shown = shown[1:]
    put(L, ktext(shown, size, KM, T['ink']), pad - 2, ty)
    if not sent and caret:
        x = pad + tw(shown, size, KM) + (size * .26 if shown.endswith(' ') else 0) + 3 * u
        rrect(L, x, ty - W * .026, x + max(2, W * .004), ty + W * .026, 0, T['acc'])
    if sugg_on and sugg:
        sw = tw(sugg, W * .028, KS) + W * .05
        rrect(L, pad, h * .66, pad + sw, h * .88, h * .08, _mix((255, 255, 255), T['acc'], .1))
        put(L, ktext(sugg, W * .028, KS, T['acc']), pad + W * .025, h * .77)
    br = h * .15; bx, by = w - pad - br, (h * .72 if sugg else h * .62)
    ellipse(L, bx, by, br, br, T['acc'] if done or sent else (200, 205, 214))
    lw = max(2, br * .2)
    if sent:
        line(L, [(bx - br * .4, by), (bx - br * .08, by + br * .32), (bx + br * .45, by - br * .35)], max(2, br * .22), (255, 255, 255))
        put(L, ktext('Sent', W * .026, KS, K_MUTED), bx - br * 1.5, by, 'rm')
    else:
        line(L, [(bx, by + br * .45), (bx, by - br * .45)], lw, (255, 255, 255))
        line(L, [(bx - br * .38, by - br * .08), (bx, by - br * .48), (bx + br * .38, by - br * .08)], lw, (255, 255, 255))
    return shadowed(L, 18 * u, 10 * u, .31), h


def ai_prompt(img, progress, amount, frame, seed, props=None):
    """text: the ask, typed as you say it (turn this into a reel). label: over it (To Claude). suggest: the slash-command
    suggestion ('' hides it). type_end: seconds when the typing finishes (by its length). send_at: seconds when it sends
    (type_end + .3). accent, ink, paper: brand colours. The card sits above the head; the face stays uncovered."""
    o = props or {}; d = _secs(o, 3.0); lt = progress * d
    f = _rgbf(img); H, W = f.shape[:2]; l, t, ru, rl, b, _ = safe_box(W, H); T = _theme(o)
    text = str(o.get('text', 'turn this into a reel')); label = str(o.get('label', 'To Claude'))
    sugg = str(o.get('suggest', '/reel-edit  ·  edits your clip'))
    t_type = float(o.get('type_end', min(d * .6, .35 + len(text) * .05))); send = float(o.get('send_at', t_type + .3))
    n = int(len(text) * clamp((lt - .2) / max(.1, t_type - .2))); sent = lt >= send
    caret = int(lt * 2.4) % 2 == 0 or n < len(text)
    w = ru - l
    card, h = _compose_card(W, T, w, text[:n], caret, sent, n >= min(len(text), 3) and not sent, label, sugg, n >= len(text))
    kin = ease_out(lt / .3); lift = ease_out((lt - send) / .3) if sent else 0
    y = t + H * .01 - (1 - kin) * H * .03 - lift * H * .012
    m, face = person(img, frame); before = f.copy()
    place(f, card, (l + ru) / 2, y + h / 2, 1 - .03 * lift, 0, clamp(lt / .15) * _kout(o, lt, d) * amount)
    _kguard(f, before, m, face)
    return _out(np.clip(f, 0, 1))


# ---------- edit_preview ----------
def _spin(r, a0, col, width):
    L = layer(r * 2 + 6, r * 2 + 6); arc(L, r + 3, r + 3, r, a0, a0 + 260, width, col); return L


def edit_preview(img, progress, amount, frame, seed, props=None):
    """video: a clip to play sped up in the card (default: the shot itself). speed: 3 (shown as SPED UP 3x).
    text: the title over the card (Editing with reel-edit…). accent, highlight, background (grid | solid).
    Full-screen cutaway: the shot shrinks into the card on the brand background and grows back at the end. amount does not fade it."""
    o = props or {}; d = _secs(o, 3.0); lt = progress * d
    live = _rgbf(img); H, W = live.shape[:2]; l, t, ru, rl, b, _ = safe_box(W, H); T = _theme(o); u = W / 1080
    src = o.get('video'); speed = float(o.get('speed', 3))
    cw = W * .56; ch = cw * 16 / 9; cx, cy = W / 2, t + H * .06 + ch / 2
    tin, tout = ease_inout(lt / .4), ease_inout((lt - (d - .4)) / .4)
    k = tin * (1 - tout)
    w = W + (cw - W) * k; h = H + (ch - H) * k; x = W / 2 + (cx - W / 2) * k; y = H / 2 + (cy - H / 2) * k
    if src and os.path.isfile(str(src)) and .3 < lt < d - .3:
        arr = _frames(str(src)); content = _cover(arr[int(lt * speed * 15) % len(arr)].astype(np.float32) / 255, w, h)
    else: content = _cover(live, w, h)
    card = _rgba(np.ascontiguousarray(content)); cwid, chei = card.shape[1], card.shape[0]
    if k > .6:                                                              # shimmer sweep, badge, progress line
        ph = (lt * .9) % 1.0; bx = -cwid * .6 + ph * cwid * 2.2
        poly(card, [(bx, 0), (bx + cwid * .25, 0), (bx + cwid * .05, chei), (bx - cwid * .2, chei)], (255, 255, 255), 70 / 255)
        sp = ktext(f'SPED UP {speed:g}×', W * .026, KB, (255, 255, 255)); bh = W * .036
        rrect(card, cwid - sp.shape[1] - W * .035, W * .025, cwid - W * .02, W * .025 + bh, W * .012, (0, 0, 0), 160 / 255)
        put(card, sp, cwid - W * .0275 - sp.shape[1] / 2, W * .025 + bh / 2, 'mm')
        pw = cwid * clamp((lt - .4) / max(.5, d - .9))
        if pw > 1: rrect(card, 0, chei - max(3, 12 * u), pw, chei, 0, T['hi'])
    card = rounded(card, .06 * W * k)
    c = _theme_bg(W, H, T, lt)
    place(c, shadowed(card, 20 * u, 10 * u, .47) if k > .2 else card, x, y)
    if k > .6:
        a = clamp((k - .6) / .4)
        ttl = ktext(str(o.get('text', 'Editing with reel-edit…')), W * .042, KS, (236, 238, 242))
        r = W * .016; yy = cy - ch / 2 - W * .06
        sp = _spin(r, (lt * 400) % 360, T['hi'], max(2, r * .35))
        place(c, sp, cx - cw / 2 + sp.shape[1] / 2, yy, alpha=a)
        place(c, ttl, cx - cw / 2 + sp.shape[1] + W * .015 + ttl.shape[1] / 2, yy, alpha=a)
    return _out(np.clip(c, 0, 1))


# ---------- raw_vs_edit ----------
def _kcap(words, size, T):
    """Caption pill: ink, white words, *key* words on a highlighter block."""
    parts = [(w_.replace('*', ''), w_.startswith('*') and w_.rstrip('.,!?').endswith('*')) for w_ in words]
    gap = size * .28; ims = [ktext(p, size, KXB, T['ink'] if key else (255, 255, 255)) for p, key in parts]
    widths = [i.shape[1] - 4 for i in ims]; pad = size * .32; tot = sum(widths) + gap * (len(parts) - 1); hgt = size * 1.45
    L = layer(tot + pad * 2 + 8, hgt + 8); rrect(L, 4, 4, tot + pad * 2 + 4, hgt + 4, hgt * .28, T['ink'], 232 / 255)
    xx = pad + 4; cy = hgt / 2 + 4
    for (p, key), im, wd in zip(parts, ims, widths):
        if key: rrect(L, xx - size * .14, cy - size * .6, xx + wd + size * .14, cy + size * .6, size * .18, T['hi'])
        put(L, im, xx - 2, cy); xx += wd + gap
    return shadowed(L, 10 * L.shape[1] / 1000 + 2, 5 * L.shape[1] / 1000 + 1, .31)


def _badge(L, W, label, col, x1):
    rrect(L, W * .02, W * .02, x1, W * .07, W * .015, col)
    put(L, ktext(label, W * .028, KB, (255, 255, 255)), (W * .02 + x1) / 2, W * .045, 'mm')


def raw_vs_edit(img, progress, amount, frame, seed, props=None):
    """grow_at: seconds when the edited card grows to full screen (58% in). punch: the edited card's zoom on the face (1.3,
    capped so the face stays a comfortable size). caption: words on the edited card, *word* highlighted ('' = none;
    default 'a single *cut*'). title: the sticker (ZERO CUTS; '' = none). color/accent, highlight, ink, background.
    Full-screen: settles back to the untouched shot in its last .12 s. amount does not fade it."""
    o = props or {}; d = _secs(o, 3.0); lt = progress * d
    live = _rgbf(img); H, W = live.shape[:2]; l, t, ru, rl, b, _ = safe_box(W, H); T = _theme(o); u = W / 1080
    m, (fx, fy, fw) = person(img, frame)
    grow = float(o.get('grow_at', d * .58))
    lum = (live @ np.float32([.299, .587, .114]))[..., None]
    raw = np.clip((lum + (live - lum) * .55 - .5) * .78 + .53, 0, 1)
    edit = np.clip((lum + (live - lum) * 1.25 - .5) * 1.12 + .5, 0, 1) * np.float32([1.03, 1.0, .97])
    z = clamp(float(o.get('punch', 1.3)), 1.0, 2.0)                        # the edit: punch in on the face
    cwz, chz = W / z, H / z; x0_ = int(np.clip(fx - cwz / 2, 0, W - cwz)); y0_ = int(np.clip(fy - chz * .42, 0, H - chz))
    edit = cv2.resize(np.ascontiguousarray(edit[y0_:y0_ + int(chz), x0_:x0_ + int(cwz)]), (W, H), interpolation=cv2.INTER_LINEAR)
    efy, efw = (fy - y0_) * z / H, fw * z / H                                # the face in the edited picture, 0..1 of its height
    cw = (ru - l - W * .04) / 2; ch = cw * 16 / 9; cy = (t + b) / 2
    g = ease_inout((lt - grow) / .45)
    c = _theme_bg(W, H, T, lt)
    kin = ease_back(lt / .32); out = _kout(o, lt, d, .12)
    lx, rx = l + cw / 2, ru - cw / 2
    if g < 1:
        rc = rounded(_rgba(_cover(raw, cw, ch)), W * .04); _badge(rc, W, 'RAW', T['ink'], W * .13)
        place(c, shadowed(rc, 16 * u, 8 * u, .31), lx - g * W * .6, cy, .85 + .15 * kin, 0, clamp(kin * 2) * (1 - g))
    w = cw + (W - cw) * g; h = ch + (H - ch) * g; x = rx + (W / 2 - rx) * g; y = cy + (H / 2 - cy) * g
    ec = _rgba(np.ascontiguousarray(_cover(edit, w, h))); ew, eh = ec.shape[1], ec.shape[0]
    sc = eh / H                                                             # card px per frame px (cover keeps the full height)
    capt = str(o.get('caption', 'a single *cut*')).split()
    if capt:                                                                # under the chin, inside the safe zone
        cap = _kcap(capt, w * .075, T); chin = (efy + efw * .8) * eh
        ccy = min(max(eh * .7, chin + cap.shape[0] * .42), b * sc - cap.shape[0] * .3)
        put(ec, cap, ew / 2, ccy, 'mm')
    title = str(o.get('title', 'ZERO CUTS'))
    if title:                                                               # over the hair, above the forehead
        stk = ktext(title, w * .085, KXB, (255, 255, 255)); pw_, ph_ = stk.shape[1] + w * .06, stk.shape[0] + w * .02
        st = layer(pw_, ph_); rrect(st, 0, 0, pw_, ph_, w * .02, T['acc']); put(st, stk, pw_ / 2, ph_ / 2, 'mm')
        M = cv2.getRotationMatrix2D((pw_ / 2, ph_ / 2), 4, 1.0); cs, sn = abs(M[0, 0]), abs(M[0, 1])
        nw, nh = int(pw_ * cs + ph_ * sn) + 2, int(pw_ * sn + ph_ * cs) + 2; M[:, 2] += (nw / 2 - pw_ / 2, nh / 2 - ph_ / 2)
        st = cv2.warpAffine(st, M, (nw, nh), flags=cv2.INTER_LINEAR, borderValue=0)
        st = shadowed(st, 8 * w / 1000 + 1, 4 * w / 1000 + 1, .35)
        brow = (efy - efw * .62) * eh
        sy = max(t * sc + nh * .5, min(eh * .14 + nh / 2, brow - nh * .55))
        put(ec, st, ew / 2, sy, 'mm')
    if g < .6: _badge(ec, W, 'EDITED', T['acc'], W * .19)
    ec = rounded(ec, W * .04 * (1 - g))
    place(c, shadowed(ec, 16 * u, 8 * u, .31) if g < .95 else ec, x, y, (.85 + .15 * kin) if g == 0 else 1.0, 0, clamp(kin * 2))
    if out < 1: c = c * out + live * (1 - out)                              # settle back to the untouched shot
    return _out(np.clip(c, 0, 1))


# ---------- feed_scroll ----------
@lru_cache(maxsize=32)
def _feed_tile(path, w, h, view, W, cover_t):
    im = _rgba(np.ascontiguousarray(_crop(_still(path, cover_t), w, h, .3)))
    if view:
        size = W * .03; tx = ktext(view, size, KB, (255, 255, 255)); ph = size * 1.25; tri = size * .62
        pw = tx.shape[1] + tri + size * .75; x0, y1 = W * .02, h - W * .02
        rrect(im, x0, y1 - ph, x0 + pw, y1, ph / 2, (0, 0, 0), 150 / 255)
        ym = y1 - ph / 2; tx0 = x0 + size * .32
        poly(im, [(tx0, ym - tri / 2), (tx0 + tri * .85, ym), (tx0, ym + tri / 2)], (255, 255, 255))
        put(im, tx, tx0 + tri + size * .18, ym)
    return im


def feed_scroll(img, progress, amount, frame, seed, props=None):
    """clips: reel covers, a folder of videos or images, one path or several split with | (default the sample reels in
    signature/reels). text: view counts split with | (212K|1.1M|486K). count: how many reels (3). size: card width, 0..1
    of the frame (.36). at: seconds into each video used as its cover (1). The card sits above the head; the face stays uncovered."""
    o = props or {}; d = _secs(o, 3.0); lt = progress * d
    f = _rgbf(img); H, W = f.shape[:2]; l, t, ru, rl, b, _ = safe_box(W, H); u = W / 1080
    cards = _media(o)
    if not cards: return img.copy()
    n = max(1, int(o.get('count', 3))); views = (str(o.get('text', '212K|1.1M|486K')).split('|') + [''] * n)[:n]
    w = int(W * float(o.get('size', .36))); h = int(w * 1.3)
    per = d / n; idx = min(n - 1, int(lt / per)); fr = (lt - idx * per) / per
    pos = idx + (ease_inout((fr - .72) / .28) if idx < n - 1 else 0)
    win = layer(w, h); win[..., 3] = 1
    for slot in range(n):
        yo = (slot - pos) * h
        if -h < yo < h:
            put(win, _feed_tile(cards[slot % len(cards)], w, h, views[slot], W, float(o.get('at', 1.0)) + (slot // len(cards)) * .9), 0, yo, 'lt')
    win = rounded(win, w * .09); bd = max(2, int(6 * u * 1.5))
    fr_ = layer(w + 2 * bd, h + 2 * bd); rrect(fr_, 0, 0, w + 2 * bd, h + 2 * bd, w * .09 + bd, (255, 255, 255)); put(fr_, win, bd, bd, 'lt')
    for dot in range(n):                                                    # page dots down the right edge
        dy = bd + h * .5 + (dot - (n - 1) / 2) * W * .024
        ellipse(fr_, bd + w - W * .016, dy, W * .006, W * .006, (255, 255, 255), 1.0 if dot == round(pos) else 110 / 255)
    k = ease_back(lt / .3); ix, iy, rot = _idle(lt, W, H, 5, .5)
    m, face = person(img, frame); before = f.copy()
    place(f, shadowed(fr_, 18 * u, 10 * u, .43), W / 2 + ix, t + h / 2 + bd + H * .008 + iy, .8 + .2 * k, rot * .5, clamp(k * 2) * _kout(o, lt, d) * amount)
    _kguard(f, before, m, face)
    return _out(np.clip(f, 0, 1))


# ---------- storyboard_pages ----------
@lru_cache(maxsize=8)
def _sb_page(W, w, h, rows, p, pages, title, acc, ink, paper):
    """One page without its thumbnails (they are pasted per frame: they may play)."""
    rh, hh, pad = W * .125, W * .075, W * .035
    L = layer(w, h); rrect(L, 0, 0, w, h, W * .035, paper)
    put(L, ktext(title or f'storyboard  ·  {len(rows)} shots', W * .026, KS, K_MUTED), pad, hh * .55)
    put(L, ktext(f'page {p + 1} / {pages}', W * .026, KS, K_MUTED), w - pad, hh * .55, 'rm')
    for j in range(3):
        i = p * 3 + j
        if i > len(rows) - 1: break
        y0 = hh + j * rh; tw_ = rh * .62; x = pad + tw_ + W * .03
        put(L, ktext(f'{i + 1:02d}', W * .026, KB, acc), x, y0 + rh * .34)
        s = '“' + rows[i][0] + '”'; size = W * .05; room = w - x - pad - W * .06
        while tw(s, size, SERIF) > room and len(s) > 6: s = s[:-2].rstrip('…” ') + '…”'
        put(L, ktext(s, size, SERIF, ink), x + W * .055, y0 + rh * .34)
        if len(rows[i]) > 1 and rows[i][1]: put(L, ktext(rows[i][1], W * .029, KM, acc), x + W * .055, y0 + rh * .7)
        if j < 2 and i + 1 < len(rows): line(L, [(pad, y0 + rh), (w - pad, y0 + rh)], max(1, W * .0018), (228, 230, 236))
    return L


def storyboard_pages(img, progress, amount, frame, seed, props=None):
    """text: shots as 'line::note|…' (three per page; pages flip evenly over the effect). title: the header
    ('storyboard · N shots'). video: a clip for the thumbnails, with shots: seconds into it per row split with |
    (default: the live shot in every thumbnail). accent, ink, paper. The card sits above the head; the face stays uncovered."""
    o = props or {}; d = _secs(o, 3.0); lt = progress * d
    f = _rgbf(img); H, W = f.shape[:2]; l, t, ru, rl, b, _ = safe_box(W, H); T = _theme(o); u = W / 1080
    rows = tuple(tuple(x.split('::')) for x in str(o.get('text', "I didn't make a single cut::hook card, wipe on \"cut\"|No editing apps::tiles struck through|One message::prompt types, sends")).split('|'))
    src = o.get('video'); src = str(src) if src and os.path.isfile(str(src)) else None
    shots = [float(x) for x in str(o.get('shots', '')).split('|') if x.strip()] or [1.0 + i * 1.3 for i in range(len(rows))]
    pages = max(1, math.ceil(len(rows) / 3))
    w = int(ru - l); rh, hh = W * .125, W * .075; h = int(hh + rh * 3 + W * .02)
    period = d / pages; pg = min(pages - 1, int(lt / period)); ph = lt - pg * period
    page = _sb_page(W, w, h, rows, pg, pages, str(o.get('title', '')), T['acc'], T['ink'], T['paper']).copy()
    pad = W * .035; tw_, th_ = rh * .62, rh * .84
    for j in range(3):
        i = pg * 3 + j
        if i > len(rows) - 1: break
        im = _crop(_frames(src)[int(shots[i % len(shots)] * 15) % len(_frames(src))].astype(np.float32) / 255, tw_, th_, .35) if src else _crop(f, tw_, th_, .4)
        put(page, rounded(_rgba(np.ascontiguousarray(im)), W * .01), pad, hh + j * rh + (rh - th_) / 2, 'lt')
    page = shadowed(page, 18 * u, 10 * u, .31)
    sx = 1.0
    if pg > 0 and ph < .16: sx = ease_out(ph / .16)                         # second half of the flip: the new page opens
    elif pg < pages - 1 and ph > period - .16: sx = 1 - ease_inout((ph - (period - .16)) / .16)
    sx = max(.02, sx)
    if sx < .999: page = cv2.resize(page, (max(2, int(page.shape[1] * sx)), page.shape[0]), interpolation=cv2.INTER_AREA)
    k = ease_out(lt / .3); m, face = person(img, frame); before = f.copy()
    place(f, page, (l + ru) / 2, t + H * .004 + h / 2 - (1 - k) * H * .02, 1.0, 0, k * _kout(o, lt, d) * amount)
    _kguard(f, before, m, face)
    return _out(np.clip(f, 0, 1))


# ---------- insights_zoom ----------
_NUMBER = re.compile(r'\d[\d,.]*')

def _parse_num(s):
    """'212,480' -> ('', 212480.0, '', True, 0); '$2.5M' -> ('$', 2.5, 'M', False, 1)."""
    shown = str(s).strip(); found = _NUMBER.search(shown)
    if not found: return shown, 0.0, '', False, 0
    digits = found.group()
    decimals = len(digits.split('.')[1]) if '.' in digits else 0
    return shown[:found.start()], float(digits.replace(',', '') or 0), shown[found.end():], ',' in digits, decimals


def _fmt_num(pre, v, suf, commas, dp): return pre + (f'{v:,.{dp}f}' if commas else f'{v:.{dp}f}') + suf


@lru_cache(maxsize=4)
def _ins_head(w, hh, acc):
    across = np.linspace(0, 1, int(w), dtype=np.float32).reshape(1, -1, 1)
    band = (np.float32(acc) * (1 - across) + np.float32((124, 58, 237)) * across) / 255
    return np.repeat(band, int(hh), 0)


def _icon(L, kind, cx, cy, s, col):
    ellipse(L, cx, cy, s, s, col); wl = (255, 255, 255); q = s * .5
    if kind < 1:                                                            # an eye
        ellipse(L, cx, cy, q * 1.25, q * .7, wl, width=max(1, s * .14)); ellipse(L, cx, cy, q * .35, q * .35, wl)
    elif kind == 1: poly(L, [(cx - q * .7, cy - q), (cx + q * .7, cy - q), (cx + q * .7, cy + q), (cx, cy + q * .45), (cx - q * .7, cy + q)], wl)
    else: poly(L, [(cx - q, cy - q * .1), (cx + q, cy - q * .8), (cx + q * .25, cy + q * .9), (cx - q * .05, cy + q * .2)], wl)


def insights_zoom(img, progress, amount, frame, seed, props=None):
    """text: rows 'Label::value|…' (Views::212,480|Saves::9,312|Shares::4,077; the first is the big one, highlighted).
    title (Reel insights), sub (Last 30 days), growth: the pill by the first row (38%; '' = none). zoom: the push into
    the views row (1.35). accent, highlight, ink, paper. The card slides in above the head; the face stays uncovered."""
    o = props or {}; d = _secs(o, 3.0); lt = progress * d
    f = _rgbf(img); H, W = f.shape[:2]; l, t, ru, rl, b, _ = safe_box(W, H); T = _theme(o); u = W / 1080
    rows = [x.split('::') + [''] for x in str(o.get('text', 'Views::212,480|Saves::9,312|Shares::4,077')).split('|')]
    w = int(W * .56); rh = W * .08; hh = int(W * .16); h = int(hh + rh * len(rows) + W * .025); pad = W * .04
    hq = ease_inout(clamp((lt - .95) / .35)); cnt = ease_out(clamp((lt - .3) / .7)); spark = ease_out(clamp((lt - .2) / .9))
    cols = [T['acc'], (245, 158, 11), (16, 185, 129), (236, 72, 153)]
    L = layer(w, h); rrect(L, 0, 0, w, h, 0, T['paper'])
    L[:hh, :, :3] = _ins_head(w, hh, tuple(T['acc']))
    put(L, ktext(str(o.get('title', 'Reel insights')), W * .036, KXB, (255, 255, 255)), pad, hh * .36)
    put(L, ktext(str(o.get('sub', 'Last 30 days')), W * .023, KM, (255, 255, 255)), pad, hh * .62, alpha=200 / 255)
    vals = [.08, .14, .11, .22, .2, .38, .55, .92]                          # sparkline that draws itself across the header
    x0s, x1s, yb, yt = w * .5, w - pad, hh * .82, hh * .2
    pts = [(x0s + (x1s - x0s) * n / (len(vals) - 1), yb - (yb - yt) * level) for n, level in enumerate(vals)]
    nn = spark * (len(pts) - 1); k_ = int(nn); fk = nn - k_
    vis = pts[:k_ + 1] + ([(pts[k_][0] + (pts[k_ + 1][0] - pts[k_][0]) * fk, pts[k_][1] + (pts[k_ + 1][1] - pts[k_][1]) * fk)] if k_ < len(pts) - 1 else [])
    if len(vis) > 1:
        poly(L, vis + [(vis[-1][0], yb), (vis[0][0], yb)], (255, 255, 255), 60 / 255)
        line(L, vis, max(2, W * .0055), (255, 255, 255))
        ex, ey = vis[-1]; rr = W * .011
        ellipse(L, ex, ey, rr + max(1, 3 * u), rr + max(1, 3 * u), (255, 255, 255)); ellipse(L, ex, ey, rr, rr, T['hi'])
    for i, stat in enumerate(rows):
        y = hh + i * rh + rh / 2 + W * .008; big = i == 0
        pre, val, suf, commas, dp = _parse_num(stat[1]); v = _fmt_num(pre, val * cnt, suf, commas, dp)
        vsize, vfont = W * (.048 if big else .034), (KXB if big else KB)
        if big and hq > 0:
            vw = tw(stat[1], vsize, vfont)
            rrect(L, w - pad - vw - 8 * u, y, w - pad - vw - 8 * u + (vw + 16 * u) * hq, y + rh * .3, 6 * u, T['hi'])
        s = rh * .27; _icon(L, i % 3, pad + s, y, s, cols[i % len(cols)])
        lx = pad + s * 2 + W * .022
        put(L, ktext(stat[0], W * .031, KS, T['ink']), lx - 2, y)
        growth = str(o.get('growth', '38%'))
        if big and growth:                                                  # green growth pill next to the label
            gx = lx + tw(stat[0], W * .031, KS) + W * .018; ph = rh * .42; pw = W * .1; pa = clamp((lt - .7) / .2)
            if pa > 0:
                rrect(L, gx, y - ph / 2, gx + pw, y + ph / 2, ph / 2, (220, 252, 231), pa)
                tx, ts = gx + ph * .5, ph * .22
                poly(L, [(tx, y - ts), (tx + ts, y + ts * .8), (tx - ts, y + ts * .8)], (22, 163, 74), pa)
                put(L, ktext(growth, W * .022, KB, (22, 163, 74)), gx + pw * .6, y, 'mm', pa)
        put(L, ktext(v, vsize, vfont, T['ink']), w - pad + 2, y, 'rm')
        if i < len(rows) - 1: line(L, [(lx, y + rh / 2), (w - pad, y + rh / 2)], max(1, W * .0018), (232, 234, 240))
    L = shadowed(rounded(L, W * .035), 18 * u, 10 * u, .35)
    kin = ease_out(lt / .35)
    x = l + w / 2 - (1 - kin) * W * .7; y = t + H * .01 + h / 2
    m, face = person(img, frame); before = f.copy()
    place(f, L, x, y, 1.0, 0, _kout(o, lt, d) * amount); _kguard(f, before, m, face)
    z_in = ease_inout((lt - .45) / .5); z_out = ease_inout((lt - (d - .45)) / .4) if 'seconds' in o else 0
    z = 1 + (float(o.get('zoom', 1.35)) - 1) * z_in * (1 - z_out)
    f, _, _ = camera(f, None, face, z, l + w * .62, t + H * .01 + hh + rh * .5)
    return _out(np.clip(f, 0, 1))


# ---------- catalog_grid ----------
@lru_cache(maxsize=64)
def _cat_tile(path, tw_, th_, num, W, ink, cover_t):
    src = _still(path, cover_t) if path else np.full((10, 10, 3), np.float32(220 / 255))
    im = rounded(_rgba(np.ascontiguousarray(_crop(src, tw_, th_, .35))), W * .025)
    bs = W * .05; rrect(im, W * .012, W * .012, W * .012 + bs, W * .012 + bs, bs * .25, ink)
    put(im, ktext(str(num), W * .028, KXB, (255, 255, 255)), W * .012 + bs / 2, W * .012 + bs / 2, 'mm')
    return shadowed(im, 10 * W / 1080, 5 * W / 1080, .27)


def catalog_grid(img, progress, amount, frame, seed, props=None):
    """text: the keyword (REEL). total: how many there are (15; when more than fit, the last tile says +N more).
    sub: the pill (and I'll send all N effects). clips: the tile pictures, a folder or paths split with | (default the
    sample reels). labels: names under the tiles split with |. cols (4), rows (3), step: seconds between tiles (.1).
    accent, highlight, ink, background. Full-screen end card: the brand background fades in over the shot."""
    o = props or {}; d = _secs(o, 3.0); lt = progress * d
    live = _rgbf(img); H, W = live.shape[:2]; l, t, ru, rl, b, _ = safe_box(W, H); T = _theme(o)
    kw = str(o.get('text', 'REEL')); total = int(o.get('total', 15))
    labels = str(o.get('labels', '')).split('|') if o.get('labels') else []
    cards = _media(o); cols, rows_ = int(o.get('cols', 4)), int(o.get('rows', 3))
    n = min(cols * rows_, max(1, total))
    k_bg = ease_out(lt / .25); c = live * (1 - k_bg) + _theme_bg(W, H, T, lt) * k_bg
    ttl = ktext(f'Comment “{kw}”', W * .085, KXB, (255, 255, 255))
    sub_t = ktext(str(o.get('sub', f"and I'll send all {total} effects")), W * .036, KB, T['ink'])
    y = t + H * .01; k1 = ease_back(lt / .3)
    place(c, shadowed(ttl, 6 * W / 1080, 3 * W / 1080, .2), W / 2, y + ttl.shape[0] / 2, .9 + .1 * k1, 0, clamp(k1 * 2))
    pw, ph = sub_t.shape[1] + W * .06, sub_t.shape[0] + W * .012
    pill = layer(pw, ph); rrect(pill, 0, 0, pw, ph, ph / 2, T['hi']); put(pill, sub_t, pw / 2, ph / 2, 'mm')
    k2 = ease_back((lt - .15) / .3) if lt >= .15 else 0.0
    py = y + ttl.shape[0] + W * .02 + ph / 2
    place(c, pill, W / 2, py, .85 + .15 * k2, 0, clamp(k2 * 2))
    gy0 = py + ph / 2 + W * .05; gap = W * .025; lab_h = W * .04
    tw_ = ((ru - l) - gap * (cols - 1)) / cols
    th_ = min(tw_ * 1.33, ((b - gy0) - (gap + lab_h) * (rows_ - 1) - lab_h) / rows_)
    step = float(o.get('step', .1))
    for i, ti in enumerate(.35 + k * step for k in range(n)):               # each tile pops in a step after the one before
        kk = ease_back((lt - ti) / .25) if lt >= ti else 0.0
        if not kk > 0: continue
        cx = l + tw_ / 2 + (i % cols) * (tw_ + gap); cy = gy0 + th_ / 2 + (i // cols) * (th_ + gap + lab_h)
        last = total > n and i == n - 1
        if last:
            im = layer(tw_, th_); rrect(im, 0, 0, tw_, th_, W * .025, T['ink'])
            put(im, ktext(f'+{total - n + 1}', W * .07, KXB, (255, 255, 255)), tw_ / 2, th_ / 2 - W * .01, 'mm')
            put(im, ktext('more', W * .03, KB, (200, 204, 212)), tw_ / 2, th_ / 2 + W * .05, 'mm')
            im = shadowed(im, 10 * W / 1080, 5 * W / 1080, .27)
        else:
            p = cards[i % len(cards)] if cards else ''
            im = _cat_tile(p, int(tw_), int(th_), i + 1, W, tuple(T['ink']), 1.0 + (i // max(1, len(cards))) * 1.7)
        place(c, im, cx, cy, .7 + .3 * kk, 0, clamp(kk * 2))
        if not last and i < len(labels) and labels[i]:
            lb = ktext(labels[i], W * .026, KS, (255, 255, 255))
            place(c, lb, cx, cy + th_ / 2 + lab_h * .55, min(1.0, tw_ / max(1, lb.shape[1])), 0, clamp(kk * 2))
    return _out(np.clip(c, 0, 1))


# ---------- lines of light ----------
LL_TEAL, LL_ORANGE, LL_RED = (8, 20, 22), (255, 138, 40), (255, 52, 64)


def _ll_partial(pts, f):
    """The start of a polyline: the first fraction f of its length."""
    if len(pts) < 2 or f <= 0: return []
    lengths = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    budget, drawn = sum(lengths) * min(f, 1), [pts[0]]
    for (a, b), length in zip(zip(pts, pts[1:]), lengths):
        if budget < length:                                                 # this segment is only part drawn: stop inside it
            part = budget / length if length else 0
            drawn.append((a[0] + (b[0] - a[0]) * part, a[1] + (b[1] - a[1]) * part)); break
        drawn.append(b); budget -= length
    return drawn


def _ll_poly(m, pts, val, lw):
    if len(pts) > 1 and val > 0: cv2.polylines(m, [np.int32(np.round(np.float32(pts) * 4))], False, int(val), int(lw), cv2.LINE_AA, 2)


def _ll_render(W, H, Lw, Rd, Bl):
    """Line masks to light: red fringe left, blue fringe right, white core, soft glow (RGB float, additive)."""
    L, R = Lw.astype(np.float32) / 255, Rd.astype(np.float32) / 255; sp = max(1, int(round(3 * W / 720)))
    out = np.zeros((H, W, 3), np.float32)
    out[..., 0] += np.roll(L, -sp, 1) * .95; out[..., 2] += np.roll(L, sp, 1) * 1.0; out += L[..., None] * .75
    out += cv2.GaussianBlur(L, (0, 0), W * .008)[..., None] * np.float32([.55, .35, .95]) * .9
    out += R[..., None] * np.float32([1.0, .3, .32]) + cv2.GaussianBlur(R, (0, 0), W * .01)[..., None] * np.float32([1.0, .12, .18]) * 1.4
    out += cv2.GaussianBlur(Bl.astype(np.float32) / 255, (0, 0), W * .03)[..., None] * np.float32([.45, .65, 1.0]) * 1.6
    return out


def _ll_dim(f, m, k):
    """The room drops to the near-black teal frame (the person stays lit), with a vignette. k = 0..1."""
    if k <= 0: return f
    H, W = f.shape[:2]; xx, yy = _grid(W, H)
    vig = np.clip(1 - .75 * (((xx - W / 2) / W) ** 2 + ((yy - H * .42) / H) ** 2) * 2.2, .35, 1)[..., None]
    bg = (f * .1 + np.float32(LL_TEAL) / 255) * vig; you = f * .82 + np.float32(LL_TEAL) / 255 * .3
    mm = m[..., None]; return f * (1 - k) + (bg * (1 - mm) + you * mm) * k


def _ll_timeline(f, m, o, lt, d, k):
    H, W = f.shape[:2]; l, t, ru, rl, b, _ = safe_box(W, H)
    cut = float(o.get('at', d * .62)); lw = max(2, int(round(W * .0035)))
    x0, x1 = l + W * .04, ru - W * .04
    y0 = t + H * .05; y1 = y0 + H * float(o.get('height', .2)); ym = (y0 + y1) / 2
    col_ = ease_inout((lt - cut - .25) / .3); shrink = ease_inout((lt - cut - .5) / .25)   # collapse to the centre line, then to a flash
    cx = (x0 + x1) / 2
    P = lambda p: (cx + (p[0] - cx) * (1 - shrink), ym + (p[1] - ym) * (1 - col_))
    Wm, Rm, Bm = (np.zeros((H, W), np.uint8) for _ in range(3))
    fade = 1 - clamp((lt - cut - .72) / .15)
    wl = lambda pts, a=1.0: _ll_poly(Wm, [P(p) for p in pts], 255 * a * fade, lw)
    dot = (l + W * .015, t + W * .015)                                      # 1. a red dot fires the first line down to the timeline
    if fade > 0:
        cv2.circle(Rm, (int(dot[0] * 4), int(dot[1] * 4)), int(W * .009 * 4), int(255 * fade), -1, cv2.LINE_AA, 2)
        _ll_poly(Rm, [P(p) for p in _ll_partial([dot, (dot[0], ym), (x0, ym)], ease_inout(lt / .45))], 200 * fade * (1 - clamp((lt - .9) / .4)), lw)
    fo = ease_inout((lt - .35) / .6)                                        # 2. the frame opens both ways round to the right side
    wl(_ll_partial([(x0, ym), (x0, y0), (x1, y0), (x1, ym)], fo)); wl(_ll_partial([(x0, ym), (x0, y1), (x1, y1), (x1, ym)], fo))
    rul = y0 + (y1 - y0) * .16; lanes = [rul + (y1 - rul) * q for q in (.36, .68)]   # 3. ruler ticks and track lanes
    tq = ease_out((lt - .7) / .5); n = 22
    for tick in range(n + 1):
        if tq < tick / n: break
        x = x0 + (x1 - x0) * tick / n; wl([(x, y0), (x, y0 + (y1 - y0) * (.1 if tick % 5 == 0 else .05))], .6)
    wl(_ll_partial([(x0, rul), (x1, rul)], tq), .5)
    for yy in lanes: wl(_ll_partial([(x0, yy), (x1, yy)], tq), .35)
    ph = (x0 + (x1 - x0) * ease_inout((lt - 1.15) / max(.3, cut - 1.2))) if lt > 1.15 else None   # 4. clips open, staggered
    clips = [(0, .04, .3), (0, .33, .62), (0, .66, .95), (1, .1, .45), (1, .52, .85), (2, .04, .22), (2, .28, .58), (2, .64, .9)]
    rws = [rul] + lanes + [y1]; pad = (y1 - y0) * .035
    for j, (lane, a, bq) in enumerate(clips):
        q = ease_out((lt - .85 - j * .05) / .35)
        if not q > 0: continue
        cx0, cx1 = x0 + (x1 - x0) * a, x0 + (x1 - x0) * (a + (bq - a) * q); cy0, cy1 = rws[lane] + pad, rws[lane + 1] - pad
        wl([(cx0, cy0), (cx1, cy0), (cx1, cy1), (cx0, cy1), (cx0, cy0)], .9)
        if ph is not None and cx0 <= ph <= cx1 + W * .03 and lt < cut:   # the playhead lights each clip blue as it passes
            (ax, ay), (bx, by) = P((cx0, cy0)), P((cx1, cy1)); cv2.rectangle(Bm, (int(ax), int(ay)), (int(bx), int(by)), 110, -1)
    if ph is not None and lt < cut + .35:                                   # 5. the red playhead runs the timeline (the cause) ...
        a = 1 - clamp((lt - cut) / .35)
        _ll_poly(Rm, [P((ph, y0 - (y1 - y0) * .08)), P((ph, y1 + (y1 - y0) * .04))], 255 * a, lw)
        hx, hy = P((ph, y0 - (y1 - y0) * .08)); cv2.circle(Rm, (int(hx * 4), int(hy * 4)), int(W * .009 * 4), int(255 * a), -1, cv2.LINE_AA, 2)
    for s_, (pa, pb) in enumerate([((x0, y1), (x1, y0)), ((x0, y0), (x1, y1))]):   # 6. ... and on the cue two red strikes cross it out
        q = ease_out((lt - cut - s_ * .1) / .16)
        if q > 0 and fade > 0: _ll_poly(Rm, [P(p) for p in _ll_partial([pa, pb], q)], 255 * fade, lw + 1)
    fl = clamp((lt - cut - .68) / .08) * (1 - clamp((lt - cut - .76) / .3))   # 7. a blue flash where the line vanishes
    if fl > 0: cv2.circle(Bm, (int(cx), int(ym)), int(W * .05), int(255 * fl), -1, cv2.LINE_AA)
    f = np.clip(f + _ll_render(W, H, Wm, Rm, Bm) * (1 - m[..., None]) * k, 0, 1)
    if lt < cut:                                                            # a small TIMELINE label over the frame ...
        ta = clamp((lt - .6) / .25) * k * (1 - col_)
        if ta > 0: place(f, tracked(str(o.get('label', 'TIMELINE')).upper(), W * .03, MICH, (200, 214, 220)), cx, y0 - W * .045, 1.0, 0, ta)
    q = clamp((lt - cut - .3) / .5)                                         # ... after the flash NO TIMELINE lands (orange, red, white)
    if q > 0:
        col = LL_ORANGE if q < .35 else LL_RED if q < .7 else (238, 242, 245)
        place(f, tracked(str(o.get('text', 'NO TIMELINE')).upper(), W * .056, MICH, col), cx, ym, 1.0 + .04 * (1 - ease_out(q)), 0, clamp(q * 4) * k)
    return f


LL_SHAPES = {'timeline': _ll_timeline}                                     # add new lines-of-light shapes here


def lines_of_light(img, progress, amount, frame, seed, props=None):
    """shape: what the lines draw (timeline: an editing timeline that gets struck out). at: seconds into the effect of the
    cue word, when it is struck out (62% in). label: the small title over it (TIMELINE). text: what lands after (NO TIMELINE).
    height: the shape's height, 0..1 of the frame (.2). The lines sit behind the person, above the head."""
    o = props or {}; d = _secs(o, 3.0); lt = progress * d
    f = _rgbf(img); m, _ = person(img, frame)
    k = ease_inout(lt / .3) * (clamp((d - lt) / .35) if 'seconds' in o else 1) * amount
    f = _ll_dim(f, m, k)
    if k <= 0: return _out(f)
    return _out(np.clip(LL_SHAPES.get(str(o.get('shape', 'timeline')), _ll_timeline)(f, m, o, lt, d, k), 0, 1))


# name -> (fn, title, description)
EFFECTS = {
    'ai_prompt': (ai_prompt, 'AI prompt', 'A chat composer above the head types the ask as it is said, shows a slash-command suggestion, then sends and marks it Sent.'),
    'edit_preview': (edit_preview, 'Edit preview', 'Full-screen cutaway: the shot shrinks into an "Editing with…" card on the brand grid and plays sped up with a shimmer and a progress line, then grows back.'),
    'raw_vs_edit': (raw_vs_edit, 'Raw vs edit', 'RAW and EDITED cards play the same moment side by side on the brand grid; the edited one (punch-in, grade, caption, title sticker) grows to full screen.'),
    'feed_scroll': (feed_scroll, 'Feed scroll', 'A phone-style card above the head swipes up through reels like the real feed, each with its view count.'),
    'storyboard_pages': (storyboard_pages, 'Storyboard pages', 'Storyboard pages above the head: a thumbnail, each shot\'s line and a note per row; the pages flip.'),
    'insights_zoom': (insights_zoom, 'Insights zoom', 'A reel-insights card slides in above the head, the numbers count up, the camera pushes into the views row and a highlighter sweeps under the number.'),
    'catalog_grid': (catalog_grid, 'Catalog grid', 'End card: Comment "KEYWORD" and a pill over a numbered grid of reels that fills in tile by tile.'),
    'lines_of_light': (lines_of_light, 'Lines of light', 'The room drops to near-black teal and thin neon lines (red and blue fringes, white core) draw an editing timeline behind the person; on the cue it is struck out and NO TIMELINE lands.'),
}

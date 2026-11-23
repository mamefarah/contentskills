"""Stage 3 for footage projects: lay the rendered graphics over the recorded clip.
  python pipeline/composite.py <plan.json>                   makes the plan's "chunks": [{first, end, file}] — short stretches of the picture
                                                             (frames first..end-1), each written to its own video file without sound
  python pipeline/composite.py <plan.json> <out folder>      with "only": [frame numbers] in the plan: one JPEG per listed frame
The plan names each frame's graphics picture ("layers": one path per frame, from the frame cache; "under": the picture that goes
beneath the clip's windows, where there is one). A frame's picture depends only on its number and the plan, never on the frames
around it, so the video is made in chunks: pipeline/combine.mjs keeps every chunk, makes only those whose frames changed (several
of these processes at once), and joins them with the clip's own audio.
Per frame: zoom the footage toward the face, apply the theme's look and the timed effects, then
composite the transparent graphics frame on top. Effects marked "layer": "all" run last, on everything.
With "layouts" in the storyboard the plan carries, per frame, the clip's windows (pipeline/timeline.js panesAt):
the look and effects are applied to the clip first, then it is placed in each window over a backdrop (a blurred,
enlarged, dimmed copy of itself, or a flat colour), graphics marked "behind" go under the windows, the rest on top.
Graphics marked "behind": "person" come as a third picture per frame ("person" in the plan): laid over the finished clip
(after zoom, look, effects and windows) everywhere except where the person is (lighting.py's person cut-out), under the rest.
"""
import json, math, os, subprocess, sys
from pathlib import Path
import cv2
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'library' / '_shared'))
from effects_engine import effect, smooth, load_theme
from lighting import person_mask

plan, output = json.loads(Path(sys.argv[1]).read_text()), sys.argv[2] if len(sys.argv) > 2 else None
for extra in plan.get('accentThemeDirs', []): load_theme(extra)      # themes named by single effects ("theme": "..."), loaded first so the storyboard's theme wins a shared name
load_theme(plan.get('themeDir'))      # the theme's own effects, if it has any
w, h, fps = plan['width'], plan['height'], plan['fps']
video = cv2.VideoCapture(plan['footage'])
strength = {'in': lambda p: 1 - smooth(p), 'out': smooth, 'all': lambda p: 1, 'pulse': lambda p: math.sin(math.pi * p) ** 2}
only = set(plan['only']) if plan.get('only') else None      # stills mode: just these frames, written as JPEGs into `output` (a folder)
chunks = [] if only else sorted(plan['chunks'], key=lambda c: c['first'])
chunk_of = {index: chunk for chunk in chunks for index in range(chunk['first'], chunk['end'])}
needed = only if only else set(chunk_of)
def encoder_for(chunk):
    """One chunk's encoder. It writes beside the final name and is moved into place when complete, so a killed run leaves no half chunk."""
    chunk['tmp'] = f"{chunk['file']}.{os.getpid()}.tmp.mp4"; Path(chunk['file']).parent.mkdir(parents=True, exist_ok=True)
    return subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{w}x{h}', '-r', str(fps), '-i', 'pipe:0', '-sws_flags', 'accurate_rnd+full_chroma_int',
                             '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', chunk['tmp']], stdin=subprocess.PIPE)
def finish(chunk, encoder):
    encoder.stdin.close()
    if encoder.wait() != 0: sys.exit('FFmpeg failed while writing the video')
    os.replace(chunk['tmp'], chunk['file'])
def final_frame():
    """The clip's last frame, for a clip that is a frame short of its stated length."""
    again, kept = cv2.VideoCapture(plan['footage']), None
    while True:
        ok, picture = again.read()
        if not ok: return kept
        kept = picture
def timed_effects(image, index, layer):
    """Apply the storyboard effects active on this frame that belong to `layer` ('footage' or 'all')."""
    for event in plan['events']:
        if event.get('layer', 'footage') != layer or not event['start'] <= index < event['end']: continue
        progress = (index - event['start']) / max(1, event['end'] - event['start'] - 1)
        props = {**event.get('props', {}), 'seconds': (event['end'] - event['start']) / fps, 'fps': fps}      # options, for effects that take them
        image = effect(event['effect'], image, progress, max(0.0, min(1.0, event['amount'] * strength[event['where']](progress))), index, 1, props=props)
    return image

def over(image, layer):
    """Lay a graphics frame (BGR, or BGRA with see-through parts) on the picture."""
    if layer is None: return image
    if layer.shape[2] == 3: return layer          # a full-screen cutaway: the graphics frame has no see-through parts
    alpha = layer[:, :, 3:4].astype(np.float32) / 255
    return (image * (1 - alpha) + layer[:, :, :3] * alpha).astype(np.uint8)

def behind_person(image, layer, index):
    """Lay the graphics marked "behind": "person" on the picture everywhere except where the person is (the person stays in front).
    The person is cut out of the picture as it is shown at this frame (after zoom, look, effects and layout placement)."""
    if layer is None: return image
    alpha = layer[:, :, 3].astype(np.float32) / 255 if layer.shape[2] == 4 else np.ones(layer.shape[:2], np.float32)
    if not alpha.any(): return image
    m = person_mask(image, index)
    r = max(2, round(image.shape[1] / 120)); m = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))      # choke: the model's edge sits a few px out on the wall
    m = cv2.GaussianBlur(m, (0, 0), r * .5)
    # Colour decontamination: at the matte's soft edge the picture still holds the room (a white wall glows round the hair).
    # Edge pixels take the person's own colour, spread outward from inside the matte, so no halo of the old background shows.
    core = (m > .97).astype(np.float32); s = max(3., image.shape[1] / 180)
    fg = cv2.GaussianBlur(image.astype(np.float32) * core[..., None], (0, 0), s) / np.maximum(cv2.GaussianBlur(core, (0, 0), s), 1e-3)[..., None]
    keep, under = np.clip((m - .7) / .28, 0, 1)[..., None], alpha[..., None]                # only where a graphic sits behind the speaker
    picture = image * (1 - under) + (image * keep + fg * (1 - keep)) * under
    alpha = (alpha * (1 - m))[..., None]
    return np.clip(picture * (1 - alpha) + layer[:, :, :3] * alpha, 0, 255).astype(np.uint8)

# ---------- layouts: the clip in one or two windows over a backdrop ----------
unit = w / plan.get('formatWidth', w)          # plan numbers are storyboard pixels (1080 wide)
def window_mask(pane, grow=0.0):
    """Anti-aliased mask (float 0..1) of a pane's rounded, rotated window."""
    x, y, pw, ph, r = (pane[k] * unit for k in ('x', 'y', 'width', 'height', 'radius')); x -= grow; y -= grow; pw += 2 * grow; ph += 2 * grow; r = min(r + grow if r else 0, pw / 2, ph / 2)
    if r > .5:
        pts = []
        for cx, cy, a0 in ((x + pw - r, y + r, -90), (x + pw - r, y + ph - r, 0), (x + r, y + ph - r, 90), (x + r, y + r, 180)):
            pts += [(cx + r * math.cos(math.radians(a0 + i * 10)), cy + r * math.sin(math.radians(a0 + i * 10))) for i in range(10)]
    else: pts = [(x, y), (x + pw, y), (x + pw, y + ph), (x, y + ph)]
    a = math.radians(pane['rotate']); cx, cy = x + pw / 2, y + ph / 2
    pts = np.array([[cx + (px - cx) * math.cos(a) - (py - cy) * math.sin(a), cy + (px - cx) * math.sin(a) + (py - cy) * math.cos(a)] for px, py in pts])
    mask = np.zeros((h, w), np.uint8); cv2.fillPoly(mask, [np.round(pts * 16).astype(np.int32)], 255, lineType=cv2.LINE_AA, shift=4)
    return mask.astype(np.float32) / 255
def backdrop_of(graded, spec):
    if spec != 'blur': return np.full((h, w, 3), [int(spec[i:i + 2], 16) for i in (5, 3, 1)], np.uint8)
    small = cv2.GaussianBlur(cv2.resize(graded, (max(2, w // 12), max(2, h // 12)), interpolation=cv2.INTER_AREA), (0, 0), max(.8, w * .035 / 12))
    big = cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float32)
    big = cv2.warpAffine(big, np.float32([[1.3, 0, -.15 * w], [0, 1.3, -.15 * h]]), (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
    grey = big.mean(axis=2, keepdims=True)
    return np.clip((grey + (big - grey) * .85) * .62, 0, 255).astype(np.uint8)
def place(canvas, source, pane):
    """Draw one window of the clip onto the canvas: soft shadow, optional hairline border, then the picture through the window's mask."""
    a, b, c, d, e, f = pane['m']; s = math.hypot(a, b); m = np.float32([[a, c, e * unit], [b, d, f * unit]]); k = pane.get('k', 1)
    if s < .8:                                   # shrink with area averaging first, so a small window stays clean
        source = cv2.resize(source, None, fx=s, fy=s, interpolation=cv2.INTER_AREA); m[:, :2] /= s
    picture = cv2.warpAffine(source, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
    mask = window_mask(pane)
    out = canvas.astype(np.float32)
    if pane.get('shadow', 0) > .01:
        q = 8; soft = cv2.resize(mask, (w // q, h // q), interpolation=cv2.INTER_AREA)
        soft = cv2.warpAffine(cv2.GaussianBlur(soft, (0, 0), max(.6, 34 * unit / q)), np.float32([[1, 0, 0], [0, 1, 24 * unit / q]]), (w // q, h // q))
        out *= 1 - cv2.resize(soft, (w, h), interpolation=cv2.INTER_LINEAR)[..., None] * .5 * pane['shadow'] * k
    if pane.get('border', 0) > .1: ring = window_mask(pane, pane['border'] * unit)[..., None] * k; out = out * (1 - ring) + 255 * ring
    mask = mask[..., None] * k
    return (out * (1 - mask) + picture * mask).astype(np.uint8)

layout = plan.get('layout')        # per frame: None (the clip fills the frame, unzoomed) or {panes, backdrop}
last = None
layers, unders, persons = plan['layers'], plan.get('under') or [], plan.get('person') or []
encoder, current = None, None
for index in range(max(needed) + 1 if needed else 0):
    if index not in needed: video.grab(); continue          # step over frames nobody asked for
    ok, image = video.read()
    if not ok: image = last = last if last is not None else final_frame()            # hold the final frame if the clip is a frame short
    last = image
    if not only and chunk_of[index] is not current:
        if current: finish(current, encoder)
        current = chunk_of[index]; encoder = encoder_for(current)
    image = cv2.resize(image, (w, h), interpolation=cv2.INTER_AREA)
    top = cv2.imread(layers[index], cv2.IMREAD_UNCHANGED)
    if top is None: sys.exit(f'The graphics picture of frame {index} is missing or unreadable: {layers[index]}')
    if layout is None:
        scale, cx, cy = plan['zoom'][index]
        if scale > 1.001: image = cv2.warpAffine(image, np.float32([[scale, 0, cx * w * (1 - scale)], [0, scale, cy * h * (1 - scale)]]), (w, h), flags=cv2.INTER_LINEAR)
        if plan.get('look'): image = effect(plan['look']['name'], image, 0, plan['look'].get('amount', .6), index, 1, props=plan['look'].get('props'))
        image = timed_effects(image, index, 'footage')     # before the graphics, so captions are never reframed or distorted
    elif top.shape[2] == 3: pass                     # a full-screen cutaway covers everything: nothing underneath to draw
    else:
        raw = image
        if plan.get('look'): image = effect(plan['look']['name'], image, 0, plan['look'].get('amount', .6), index, 1, props=plan['look'].get('props'))
        graded = timed_effects(image, index, 'footage')
        state = layout[index]
        if state is None: image = graded
        elif state.get('full'): a, b, c, d, e, f = state['panes'][0]['m']; image = cv2.warpAffine(graded, np.float32([[a, c, e * unit], [b, d, f * unit]]), (w, h), flags=cv2.INTER_LINEAR)      # only zoomed
        else:
            image = backdrop_of(graded, state['backdrop'])
            below = unders[index] if index < len(unders) else None
            if below: image = over(image, cv2.imread(below, cv2.IMREAD_UNCHANGED))
            for pane in state['panes']: image = place(image, raw if pane.get('raw') else graded, pane)
    cut = persons[index] if index < len(persons) else None          # graphics behind the person ("behind": "person"): a third picture
    if cut and top.shape[2] == 4: image = behind_person(image, cv2.imread(cut, cv2.IMREAD_UNCHANGED), index)
    image = over(image, top)
    image = timed_effects(image, index, 'all')
    if only: cv2.imwrite(str(Path(output) / f'{index:05d}.jpg'), image, [cv2.IMWRITE_JPEG_QUALITY, 90])
    else: encoder.stdin.write(image.tobytes())
if only: sys.exit(0)
if current: finish(current, encoder)

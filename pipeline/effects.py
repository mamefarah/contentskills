"""Stage 3 helper: apply storyboard effects to a combined video.
  python pipeline/effects.py <in.mp4> <out.mp4> <plan.json>
plan = {fps, roi: {x, y, width, height}, events: [{effect, amount, where, start, end}], first?}  (frames, end exclusive)
"first" is the frame number of the video's first frame when it is a section of a longer one (events keep their numbers in the whole).
Only the visual region (roi) is changed, so captions and headlines stay sharp.
"""
import json, math, subprocess, sys
from pathlib import Path
import cv2
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'library' / '_shared'))
from effects_engine import effect, smooth, load_theme

source, output, plan = sys.argv[1], sys.argv[2], json.loads(Path(sys.argv[3]).read_text())
video = cv2.VideoCapture(source)
width, height = int(video.get(cv2.CAP_PROP_FRAME_WIDTH)), int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))
load_theme(plan.get('themeDir'))      # the theme's own effects, if it has any
x, y, w, h = (plan['roi'][k] for k in ('x', 'y', 'width', 'height'))
# How strongly an effect shows across its window: fade away after a cut, build toward one, hold, or swell in the middle.
strength = {'in': lambda p: 1 - smooth(p), 'out': smooth, 'all': lambda p: 1, 'pulse': lambda p: math.sin(math.pi * p) ** 2}
encoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{width}x{height}', '-r', str(plan['fps']), '-i', 'pipe:0',
                            '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], stdin=subprocess.PIPE)
frame = start = plan.get('first', 0)
while True:
    ok, image = video.read()
    if not ok: break
    for event in plan['events']:
        if not event['start'] <= frame < event['end']: continue
        progress = (frame - event['start']) / max(1, event['end'] - event['start'] - 1)
        amount = max(0.0, min(1.0, event['amount'] * strength[event['where']](progress)))
        props = {**event.get('props', {}), 'seconds': (event['end'] - event['start']) / plan['fps'], 'fps': plan['fps']}      # options, for effects that take them
        if event.get('full'): image = effect(event['effect'], image, progress, amount, frame, 1, props=props)
        else: image[y:y + h, x:x + w] = effect(event['effect'], image[y:y + h, x:x + w].copy(), progress, amount, frame, 1, props=props)
    encoder.stdin.write(image.tobytes()); frame += 1
encoder.stdin.close()
if encoder.wait() != 0: sys.exit('FFmpeg failed while writing the effects pass')
print(f"Applied {len(plan['events'])} effect(s) across {frame - start} frames")

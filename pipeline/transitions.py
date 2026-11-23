"""Stage 3 helper: shader transitions across the cuts of a finished picture.
  python pipeline/transitions.py <in.mp4> <out.mp4> <plan.json>
plan = {fps, cuts: [{name, frame, frames, params?, themeDir?}], themeDir?}   frame = first frame after the cut, frames = length of the transition
themeDir is the storyboard's theme folder: its transitions/theme_transitions.py, if any, adds the theme's own transitions and colours.
A transition spans [frame - frames/2, frame + frames/2). Before the cut the moving picture is A and
the first frame after the cut, held still, is B; after the cut the last frame before it, held still,
is A and the moving picture is B. Same number of frames out as in; any audio is copied untouched.
"""
import json, subprocess, sys
from pathlib import Path
import cv2
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'library' / '_shared'))
from shader_transitions import render, load_theme

source, output, plan = sys.argv[1], sys.argv[2], json.loads(Path(sys.argv[3]).read_text())
load_theme(plan.get('themeDir'))

def frames_of(path):
    video = cv2.VideoCapture(path)
    while True:
        ok, image = video.read()
        if not ok: return
        yield image

# First read: keep the two frames either side of every cut.
held, total = {}, 0
wanted = {cut['frame'] - 1 for cut in plan['cuts']} | {cut['frame'] for cut in plan['cuts']}
for image in frames_of(source):
    if total in wanted: held[total] = image
    total += 1
windows = []
for cut in plan['cuts']:
    at = cut['frame']
    if not 0 < at < total: print(f"Skipped {cut['name']}: no cut at frame {at}"); continue
    length = max(2, min(cut['frames'], 2 * at, 2 * (total - at)))       # stay inside the video
    windows.append({**cut, 'start': at - length // 2, 'end': at - length // 2 + length})
probe = cv2.VideoCapture(source)
width, height = int(probe.get(cv2.CAP_PROP_FRAME_WIDTH)), int(probe.get(cv2.CAP_PROP_FRAME_HEIGHT))

# Second read: render.
encoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{width}x{height}', '-r', str(plan['fps']), '-i', 'pipe:0', '-i', source,
                            '-map', '0:v', '-map', '1:a?', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', output], stdin=subprocess.PIPE)
for index, image in enumerate(frames_of(source)):
    for cut in windows:
        if not cut['start'] <= index < cut['end']: continue
        progress = (index - cut['start'] + 1) / (cut['end'] - cut['start'] + 1)      # never quite 0 or 1
        a, b = (image, held[cut['frame']]) if index < cut['frame'] else (held[cut['frame'] - 1], image)
        if cut.get('themeDir'): load_theme(cut['themeDir'])                                # a transition borrowed from another theme, in that theme's colours
        image = render(cut['name'], a, b, progress, cut.get('params'))
        if cut.get('themeDir'): load_theme(plan.get('themeDir'))
        break                                                                        # where two overlap, the earlier one wins
    encoder.stdin.write(image.tobytes())
encoder.stdin.close()
if encoder.wait() != 0: sys.exit('FFmpeg failed while writing the transitions pass')
print(f"Applied {len(windows)} transition(s) across {total} frames")

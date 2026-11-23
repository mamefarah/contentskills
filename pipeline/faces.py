"""Find the speaker's face through a video, so graphics can follow it and stay out of its way.
  python pipeline/faces.py <video> <out.json> <yunet.onnx>
Writes {"track": [[seconds, x, y, w, h, age], ...], "bounds": {x, y, w, h}} with boxes as 0..1 of the frame.
The largest face is followed and smoothed; moments with no detection reuse the last box, and `age` says how many
seconds ago the face was last really seen (0 = this frame), so a held box over black footage is not taken for a face.
"""
import json, sys
import cv2

source, output, model = sys.argv[1:4]
video = cv2.VideoCapture(source)
fps = video.get(cv2.CAP_PROP_FPS) or 30
width, height = int(video.get(cv2.CAP_PROP_FRAME_WIDTH)), int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))
scale = 640 / max(width, height)
size = (round(width * scale), round(height * scale))
detector = cv2.FaceDetectorYN.create(model, '', size, 0.6, 0.3, 50)
track, smooth, index, found_any, seen_at = [], None, 0, 0, 0.0
while True:
    ok, frame = video.read()
    if not ok: break
    if index % 2 == 0:                      # every other frame is plenty for a talking head
        _, faces = detector.detect(cv2.resize(frame, size))
        if faces is not None and len(faces):
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])[:4]
            box = [float(x) / size[0], float(y) / size[1], float(w) / size[0], float(h) / size[1]]
            smooth = box if smooth is None else [s * .7 + b * .3 for s, b in zip(smooth, box)]
            found_any += 1; seen_at = index / fps
        if smooth: track.append([round(index / fps, 3), *[round(v, 4) for v in smooth], round(index / fps - seen_at, 2)])
    index += 1
if not track: sys.exit('No face found in this video.')
x0, y0 = min(s[1] for s in track), min(s[2] for s in track)
x1, y1 = max(s[1] + s[3] for s in track), max(s[2] + s[4] for s in track)
json.dump({'duration': round(index / fps, 3), 'fps': fps, 'width': width, 'height': height, 'track': track,
           'bounds': {'x': round(x0, 4), 'y': round(y0, 4), 'w': round(x1 - x0, 4), 'h': round(y1 - y0, 4)}}, open(output, 'w'))
print(f'Face found in {found_any} of {len(track)} sampled frames; it stays within x {x0:.2f}-{x1:.2f}, y {y0:.2f}-{y1:.2f} of the frame.')

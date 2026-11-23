"""Turn the combiner's graphics-only screenshots into a coarse map of where graphics are drawn.
  python pipeline/occupancy.py <folder of NNNNN.png> <out.json> <fps> <frame width> <frame height>

Writes {fps, cols, rows, cell, frames: [hex]}: one bit per 20 px cell (1 = drawn on), row by row.
Captions read it to keep clear of graphics (library/_shared/placement.js); pipeline/qa.py checks against it.
"""
import json, os, sys
import cv2
import numpy as np

src, out, fps, W, H = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
CELL = 20
cols, rows = W // CELL, H // CELL
frames = []
for name in sorted(f for f in os.listdir(src) if f.endswith('.png')):
    im = cv2.imread(os.path.join(src, name), cv2.IMREAD_UNCHANGED)
    alpha = im[..., 3] if im is not None and im.ndim == 3 and im.shape[2] == 4 else np.zeros((rows, cols), np.uint8)
    cells = cv2.resize((alpha > 77).astype(np.float32), (cols, rows), interpolation=cv2.INTER_AREA) > .12
    frames.append(np.packbits(cells.ravel()).tobytes().hex())
json.dump({'fps': fps, 'cols': cols, 'rows': rows, 'cell': CELL, 'frames': frames}, open(out, 'w'))
print(f'Mapped where graphics sit in {len(frames)} moments.')

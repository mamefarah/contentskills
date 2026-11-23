"""Renders the lighting previews shown in every theme's effects catalog (group "Lighting"), and adds the
entries to each catalog that lacks them.
  .tools/venv-effects/bin/python library/_shared/lighting_previews.py [light_name ...]
Each clip starts on the untouched footage and fades the light in, so the change is easy to see.
"""
import json, subprocess, sys
from pathlib import Path
import cv2
here = Path(__file__).resolve().parent
sys.path.insert(0, str(here))
from effects_engine import effect
from lighting import SCHEMES

out_dir = here / 'lighting' / 'clips'; out_dir.mkdir(parents=True, exist_ok=True)
video = cv2.VideoCapture(str(here / 'sample/clip.mp4')); video.set(cv2.CAP_PROP_POS_FRAMES, 30)
frames = [cv2.resize(video.read()[1], (270, 480), interpolation=cv2.INTER_AREA) for _ in range(75)]
wanted = set(sys.argv[1:])
for key in SCHEMES:
    name = 'light_' + key
    if wanted and name not in wanted: continue
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '270x480', '-r', '30', '-i', 'pipe:0',
                           '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(out_dir / f'{name}.mp4')], stdin=subprocess.PIPE)
    for i, image in enumerate(frames):
        t = min(1, max(0, (i - 12) / 15)); amount = t * t * (3 - 2 * t)
        ff.stdin.write(effect(name, image, i / 74, amount, i, 1).tobytes())
    ff.stdin.close(); ff.wait(); print(name)

# catalog entries, one set per theme
for catalog in sorted((here.parent / 'themes').glob('*/effects/catalog.json')):
    data = json.loads(catalog.read_text()); ids = {i['id'] for i in data['items']}
    if 'Lighting' not in data['groups']: data['groups'].append('Lighting')
    for key, (_, title, desc) in SCHEMES.items():
        if 'light_' + key in ids: continue
        data['items'].append({'id': 'light_' + key, 'name': title.lower(), 'group': 'Lighting', 'src': f'../../../_shared/lighting/clips/light_{key}.mp4',
                              'portrait': True, 'description': desc + ' Finds the person in each frame; use 0.6–1 over a whole clip or a section.'})
    catalog.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

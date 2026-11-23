"""Renders the signature-effect previews shown in every theme's effects catalog (group "Signature"), and adds the
entries to each catalog that lacks them (the same pattern as lighting_previews.py).
  .tools/venv-effects/bin/python library/_shared/signature_previews.py [effect_name ...]
Each clip shows a moment of untouched footage, then the effect over its natural length, then the footage again.
"""
import json, subprocess, sys
from pathlib import Path
import cv2
here = Path(__file__).resolve().parent
sys.path.insert(0, str(here))
from effects_engine import effect
from signature import EFFECTS

# name: (seconds, props, options hint for the catalog)
PREVIEW = {
    'cop_lights': (3.0, {}, 'Options ("props"): color, color2 (hex), speed (flashes per second, 2.2), push (1.08).'),
    'gta6_poster': (3.0, {'text': 'CLAUDE|DID THIS'}, 'Options ("props"): text (hook lines split with |), label (LOADING), scale (the person\'s size, 0.6–1).'),
    'text_behind_slice': (3.0, {'text': 'ZERO|CUTS'}, 'Options ("props"): text (lines split with |), at (seconds in when it slices; 60% in), angle (-9), color (#2F5BEA), y (title bottom, 0–1; .37), stagger (.22).'),
    'reel_flythrough': (5.0, {}, 'Options ("props"): clips (folder of reels; sample reels by default), text (titles "Title::sub|…"), sub, column (3), count (16), bg, bg2, look ("gta6"), seed. Give it 4–6 s.'),
    'color_grade': (2.5, {'grade': 'moody'}, 'Options ("props"): grade (moody, warm, cool, bw, pop), style (fade or ripple), dur (seconds to arrive), x, y (ripple origin, 0–1). Also works as a footage "look".'),
    # the reel kit and lines of light (signature_kit.py); brand props on all of them: accent (#2F5BEA), highlight (#FFE03C), ink, paper, background (grid | solid)
    'ai_prompt': (3.0, {'text': 'turn this into a reel'}, 'Options ("props"): text (the ask, typed), label (To Claude), suggest (slash-command chip; "" hides it), type_end, send_at (seconds), accent, ink, paper. Card above the head.'),
    'edit_preview': (3.0, {'video': 'library/_shared/sample/clip.mp4', 'speed': 3}, 'Options ("props"): video (clip played sped up in the card; the shot itself by default), speed (3), text (Editing with reel-edit…), accent, highlight, background. Full-screen cutaway.'),
    'raw_vs_edit': (3.0, {'caption': 'a single *cut*', 'title': 'ZERO CUTS'}, 'Options ("props"): grow_at (seconds; 58% in), punch (edited zoom, 1.3), caption (*word* highlighted; "" = none), title (sticker; "" = none), color/accent, highlight, ink, background. Full-screen.'),
    'feed_scroll': (3.0, {'text': '212K|1.1M|486K'}, 'Options ("props"): clips (folder or |-list of reels/covers; sample reels by default), text (view counts with |), count (3), size (card width 0–1, .36), at (cover second, 1). Card above the head.'),
    'storyboard_pages': (3.0, {'text': "I didn't make a single cut::title slices open|No timeline::timeline in lines of light|One message::prompt types and sends|Here's what came back::raw vs edited",
                               'video': 'library/_shared/sample/clip.mp4', 'shots': '1|4|7|9'}, 'Options ("props"): text (shots "line::note|…", 3 per page), title, video + shots (thumbnail clip and seconds with |; the live shot by default), accent, ink, paper. Card above the head.'),
    'insights_zoom': (3.0, {}, 'Options ("props"): text (rows "Label::value|…", the first is highlighted), title (Reel insights), sub (Last 30 days), growth (38%), zoom (1.35), accent, highlight, ink, paper.'),
    'catalog_grid': (3.0, {'text': 'REEL', 'total': 10, 'labels': 'text-behind-slice|lines-of-light|ai-prompt|edit-preview|raw-vs-edit|glitch|feed-scroll|storyboard|insights-zoom|comment-dm'},
                     'Options ("props"): text (keyword), total (15), sub, clips (tile pictures; sample reels by default), labels (|), cols (4), rows (3), step (.1), accent, highlight, ink, background. Full-screen end card.'),
    'lines_of_light': (3.0, {}, 'Options ("props"): shape (timeline), at (seconds of the cue; 62% in), label (TIMELINE), text (NO TIMELINE), height (.2).'),
}
FPS, LEAD = 30, 12
out_dir = here / 'signature' / 'clips'; out_dir.mkdir(parents=True, exist_ok=True)
wanted = set(sys.argv[1:])
for name, (secs, props, _) in PREVIEW.items():
    if wanted and name not in wanted: continue
    n = int(secs * FPS); video = cv2.VideoCapture(str(here / 'sample/clip.mp4')); video.set(cv2.CAP_PROP_POS_FRAMES, 20)
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '270x480', '-r', str(FPS), '-i', 'pipe:0',
                           '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(out_dir / f'{name}.mp4')], stdin=subprocess.PIPE)
    for i in range(n + 2 * LEAD):
        ok, image = video.read()
        if not ok: video.set(cv2.CAP_PROP_POS_FRAMES, 20); ok, image = video.read()
        image = cv2.resize(image, (540, 960), interpolation=cv2.INTER_AREA)       # rendered at half size, shown at a quarter
        if LEAD <= i < LEAD + n:
            image = effect(name, image, (i - LEAD) / max(1, n - 1), 1, i, 1, props={**props, 'seconds': secs, 'fps': FPS})
        ff.stdin.write(cv2.resize(image, (270, 480), interpolation=cv2.INTER_AREA).tobytes())
    ff.stdin.close(); ff.wait(); print(name)

# Catalogs. Two kinds live in signature.py:
#  - looks (LOOKS): filters over the footage, any length, an amount dial. They join every theme's effects catalog.
#  - moments (the rest): scripted set pieces with their own content (text, cards, reels, a background) and their own
#    timeline; they take over the frame for a few seconds. They get one shared catalog, the dashboard's "Effects" section
#    (the theme effects catalogs are titled "Filters"). Ids stay: catalog id "moments", storyboard key "effects" for both.
LOOKS = {'cop_lights': 'Lighting', 'color_grade': 'Look'}
MOMENT_GROUPS = ['Hook', 'Above the head', 'Cutaway', 'End card', 'Style']
MOMENT_GROUP = {'text_behind_slice': 'Hook', 'gta6_poster': 'Hook', 'ai_prompt': 'Above the head', 'feed_scroll': 'Above the head',
                'storyboard_pages': 'Above the head', 'insights_zoom': 'Above the head', 'edit_preview': 'Cutaway', 'raw_vs_edit': 'Cutaway',
                'reel_flythrough': 'Cutaway', 'catalog_grid': 'End card', 'lines_of_light': 'Style'}
def hint(key): return PREVIEW[key][2] if key in PREVIEW else ''

for catalog in sorted((here.parent / 'themes').glob('*/effects/catalog.json')):
    data = json.loads(catalog.read_text())
    data['title'] = 'Filters'                                   # filters change the shot's look; "Effects" is the moments catalog
    data['items'] = [i for i in data['items'] if i['id'] not in EFFECTS or i['id'] in LOOKS]      # moments left the effects catalogs
    data['groups'] = [g for g in data['groups'] if g != 'Signature']
    have = {i['id']: i for i in data['items']}
    for key, group in LOOKS.items():
        _, title, desc = EFFECTS[key]
        entry = {'id': key, 'name': title.lower(), 'group': group, 'src': f'../../../_shared/signature/clips/{key}.mp4', 'portrait': True,
                 'description': desc + ' ' + hint(key)}
        if key in have: have[key].update(entry)
        else: data['items'].append(entry)
        if group not in data['groups']: data['groups'].append(group)
    catalog.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

moments = [k for k in EFFECTS if k not in LOOKS]
(here / 'signature' / 'catalog.json').write_text(json.dumps({
    'id': 'moments', 'title': 'Effects',
    'summary': 'Scripted set pieces, the same in every theme. Unlike a filter (a look over the shot, any length, '
               'an amount dial), an effect brings its own content — title, cards, reels, a background — and its own few-second timeline, '
               'and takes over the frame while it plays.',
    'usage': 'In a footage storyboard, as an effect entry that spans the moment: {"name": "gta6_poster", "at": 0, "seconds": 3, "where": "all", '
             '"amount": 1, "props": {"text": "CLAUDE|DID THIS"}}. Engine: library/_shared/signature.py.',
    'groups': [g for g in MOMENT_GROUPS if any(MOMENT_GROUP.get(k, 'Hook') == g for k in moments)],
    'items': [{'id': k, 'name': EFFECTS[k][1].lower(), 'group': MOMENT_GROUP.get(k, 'Hook'), 'src': f'clips/{k}.mp4', 'portrait': True,
               'description': EFFECTS[k][2] + ' ' + hint(k)} for k in moments],
}, indent=2, ensure_ascii=False) + '\n')

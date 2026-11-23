"""Quality checks for a finished video.

    npm run qa <project>              # projects/<project>/out/cut.mp4, with out/layout.json if the combiner wrote one
    npm run qa <project> --json       # print the JSON report only
    npm run qa <project> --preview    # before the make: steps through the draft and checks placement, captions and text
    python pipeline/qa.py path/to/video.mp4   # any video; placement is checked only with a layout.json beside it

Writes qa.json (the report) and qa.png (a contact sheet: face box green, caption box yellow, red where it failed,
app safe zone grey) next to the video. Exit code 0 = PASS (warnings allowed), 1 = FAIL. Every problem has a `fix`.
The checks and the loop around them are described in skills/quality-check/SKILL.md.
"""
import argparse, difflib, json, os, re, subprocess, sys
from pathlib import Path
import cv2
import numpy as np

ROOT = str(Path(__file__).resolve().parents[1])
WARN, FAIL = 'WARN', 'FAIL'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from settings import settings, safe_zone
# The app safe zone (library/_shared/safe-zone.json, the same numbers library/_shared/placement.js uses), 1080x1920.
_Z = safe_zone()
SAFE = dict(left=_Z['left'], top=_Z['top'], right=_Z['right'], right_low=_Z['rightLow'], split=_Z['split'], bottom=_Z['bottom'], caption_bottom=_Z['captionBottom'])
VOICE_LUFS = float(settings().get('audio', {}).get('voiceLufs', -14))   # the house voice level (settings audio.voiceLufs)


def run(*command):
    return subprocess.run(list(map(str, command)), text=True, capture_output=True)


def _ffmpeg_log(video, *options):
    """What FFmpeg prints while reading the whole video through a measuring filter (nothing is written)."""
    return run('ffmpeg', '-hide_banner', '-nostats', '-i', video, *options, '-f', 'null', '-').stderr

def flag(issues, check, level, msg, fix, **more):
    """Record one finding. `more`: at (seconds), and anything else the report should carry."""
    issues.append(dict(check=check, level=level, msg=msg, fix=fix, **more))

def probe(video):
    asked = 'stream=codec_type,width,height,r_frame_rate:format=duration'
    found = json.loads(run('ffprobe', '-v', 'error', '-show_entries', asked, '-of', 'json', video).stdout or '{}')
    streams = found.get('streams', [])
    picture = next((s for s in streams if s['codec_type'] == 'video'), {})
    frames, per = picture.get('r_frame_rate', '0/1').split('/')
    return dict(w=picture.get('width', 0), h=picture.get('height', 0), fps=float(frames) / max(1.0, float(per)),
                dur=float(found.get('format', {}).get('duration', 0)), audio=any(s['codec_type'] == 'audio' for s in streams))


def ranges(times, gap=0.2):
    """Moments closer together than `gap` seconds, joined into [start, end] stretches."""
    spans = []
    for t in sorted(times):
        joins = spans and t - spans[-1][1] <= gap
        if joins: spans[-1][1] = t
        else: spans.append([t, t])
    return spans


def fmt(spans, limit=6):
    shown = [f'{a:.1f}s' if b - a <= 0.05 else f'{a:.1f}-{b:.1f}s' for a, b in spans[:limit]]
    extra = len(spans) - limit
    return ', '.join(shown) + (f' (+{extra} more)' if extra > 0 else '')


def area(r): return max(0, r[2] - r[0]) * max(0, r[3] - r[1])
def overlap(a, b): return max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
def face_box(f):
    """The tracker's box with the forehead added: what a caption must never touch (placement keeps a wider margin)."""
    x0, y0, x1, y1 = f; h = y1 - y0
    return [x0, y0 - 0.2 * h, x1, y1]


class Occupancy:
    """out/occupancy.json: where graphics are drawn, one bit per cell, a few samples a second."""
    def __init__(self, j):
        self.fps, self.cell = j['fps'], j['cell']; n = j['rows'] * j['cols']
        self.maps = [np.unpackbits(np.frombuffer(bytes.fromhex(h), np.uint8))[:n].reshape(j['rows'], j['cols']) for h in j['frames']]

    def covered(self, t, r):
        if not self.maps: return 0.0
        m = self.maps[max(0, min(len(self.maps) - 1, round(t * self.fps)))]; c = self.cell
        c0, r0, c1, r1 = max(0, int(r[0] // c)), max(0, int(r[1] // c)), min(m.shape[1], int(-(-r[2] // c))), min(m.shape[0], int(-(-r[3] // c)))
        return float(m[r0:r1, c0:c1].mean()) if c1 > c0 and r1 > r0 else 0.0


def check_format(v, issues):
    w, h, fps, dur = v['w'], v['h'], v['fps'], v['dur']
    bad = lambda level, msg, fix: flag(issues, 'format', level, msg, fix)
    if not w: return bad(FAIL, 'no video stream', 'the render broke; make it again')
    if w >= h: bad(FAIL, f'landscape {w}x{h}', 'reels need 9:16 portrait (1080x1920)')
    elif abs(w / h - 9 / 16) > 0.02: bad(WARN, f'{w}x{h} is not 9:16', 'set "format" to 1080x1920')
    # out/cut.mp4 is what they watch on the review page: a half-size draft there looks blurry full screen, so it fails
    if min(w, h) < 1080: bad(FAIL, f'{w}x{h} is a draft size, blurry full screen', 'npm run make <name> (full size is the default; --scale .5 is only for a --section look)')
    if not 23.9 <= fps <= 60.1: bad(WARN, f'{fps:.2f} fps', 'use 24, 25, 30 or 60 fps')
    if dur < 3: bad(FAIL, f'only {dur:.1f} s long', 'check the render did not stop early')
    if dur > 180: bad(WARN, f'{dur:.0f} s long', 'reels over 3 min lose reach; trim')


def check_audio(path, p, issues, info, no_voice=False):
    if not p['audio']: issues.append(dict(check='audio', level=WARN, msg='no audio track', fix='add the narration (npm run voice <name>) unless a silent video is intended')); return
    meter = _ffmpeg_log(path, '-map', '0:a:0', '-af', 'ebur128=peak=true')
    m, pk, lra = re.findall(r'I:\s+(-?[\d.]+) LUFS', meter), re.findall(r'Peak:\s+(-?[\d.]+) dBFS', meter), re.findall(r'LRA:\s+([\d.]+) LU', meter)
    if m:
        lufs = info['lufs'] = float(m[-1])
        if no_voice: pass   # sound effects only: no voice level to hit
        elif lufs < -40: issues.append(dict(check='audio', level=FAIL, msg=f'audio is silent ({lufs:.0f} LUFS)', fix='the voice track is missing or muted'))
        elif lufs < VOICE_LUFS - 7 or lufs > VOICE_LUFS + 4: issues.append(dict(check='audio', level=FAIL, msg=f'loudness {lufs:.1f} LUFS', fix=f'bring it to {VOICE_LUFS:g} LUFS: clean footage with npm run cut (it normalises), or ffmpeg -af loudnorm=I={VOICE_LUFS:g}:TP=-1.5:LRA=11'))
        elif lufs < VOICE_LUFS - 4 or lufs > VOICE_LUFS + 2: issues.append(dict(check='audio', level=WARN, msg=f'loudness {lufs:.1f} LUFS (target {VOICE_LUFS:g})', fix=f'loudnorm=I={VOICE_LUFS:g}:TP=-1.5:LRA=11, or lower the sound effects\' "gain"'))
    if lra:
        rng = info['loudness_range'] = float(lra[-1])
        # Phone speakers want an even voice: a wide range means whispers get lost and shouts blare.
        if rng > 10: issues.append(dict(check='audio', level=WARN, msg=f'loudness range {rng:.1f} LU (aim for under 8)', fix='even out the voice: a compressor before loudnorm (ffmpeg -af acompressor=threshold=-20dB:ratio=3:attack=5:release=120), or re-record the quiet or loud lines'))
    if pk:
        peak = info['true_peak'] = float(pk[-1])
        if peak > -0.5: issues.append(dict(check='audio', level=WARN, msg=f'true peak {peak:.1f} dBFS, may clip', fix='lower the loudest sound effect\'s "gain", or loudnorm with TP=-1.5'))
    if no_voice: return
    quiet = _ffmpeg_log(path, '-map', '0:a:0', '-af', 'silencedetect=n=-40dB:d=0.6')
    starts, ends = ([float(x) for x in re.findall(pattern, quiet)] for pattern in (r'silence_start: (-?[\d.]+)', r'silence_end: ([\d.]+)'))
    if starts and ends and starts[0] <= 0.05 and ends[0] > 0.6:
        issues.append(dict(check='audio', level=WARN, msg=f'{ends[0]:.1f} s of silence before the first word', fix='start the hook at once: npm run cut trims the start of footage'))
    gaps = [(a, b) for a, b in zip(starts, ends) if a > 0.05 and b - a > 1.5 and b < p['dur'] - 0.3]
    if gaps: issues.append(dict(check='audio', level=WARN, msg='dead air: ' + fmt(gaps), fix='cut the pauses (npm run cut) or cover them with a sound or a graphic'))


def check_mix(folder, video, issues):
    """What the storyboard asks for in the mix must be in it: music and sound effects it names but the mix report
    (out/sound-report.json, written by pipeline/sounds.py) does not show are a FAIL, not a silent miss."""
    sb_path, rp = os.path.join(os.path.dirname(folder), 'storyboard.json'), os.path.join(folder, 'sound-report.json')
    if os.path.basename(video) != 'cut.mp4' or not os.path.isfile(sb_path): return
    sb = json.load(open(sb_path)); want_music, want_sounds = bool(sb.get('music')), len(sb.get('sounds') or [])
    if not (want_music or want_sounds): return
    r = json.load(open(rp)) if os.path.isfile(rp) else None
    if r is None: issues.append(dict(check='mix', level=FAIL, msg='the storyboard has music or sound effects but there is no mix report', fix='npm run make <name> --no-cache')); return
    if want_music and (r.get('levelsVsVoice') or {}).get('musicUnderWords') is None:
        issues.append(dict(check='mix', level=FAIL, msg=f"storyboard music '{sb['music'].get('name')}' is not in the mix", fix='the music never reached pipeline/sounds.py: check the plan combine.mjs writes, then npm run make <name> --no-cache'))
    got = len(r['sounds']) if isinstance(r.get('sounds'), list) else r.get('sounds')
    if isinstance(got, int) and got < want_sounds:
        issues.append(dict(check='mix', level=FAIL, msg=f'{got} of {want_sounds} storyboard sound effects are in the mix', fix='a sound file is missing or timed past the end; see out/sound-report.json'))

def check_picture(video, p, issues):
    log = _ffmpeg_log(video, '-vf', 'blackdetect=d=0.4:pix_th=0.04:pic_th=0.98,freezedetect=n=0.002:d=2', '-an')
    seconds = lambda pattern: [float(x) for x in re.findall(pattern, log)]
    black = [(a, b) for a, b in zip(seconds(r'black_start:([\d.]+)'), seconds(r'black_end:([\d.]+)')) if a > 0.05 and b < p['dur'] - 0.6]
    if black: flag(issues, 'picture', WARN, 'black frames: ' + fmt(black), 'a piece failed to draw or a cut leaves a gap; look at those seconds', at=black[0][0])
    starts, ends = seconds(r'freeze_start: ([\d.]+)'), seconds(r'freeze_end: ([\d.]+)')
    frozen = list(zip(starts, ends + [p['dur']] * (len(starts) - len(ends))))                # a freeze that runs to the end has no end mark
    if frozen: flag(issues, 'picture', WARN, 'frozen picture: ' + fmt(frozen), 'nothing moves for 2 s or more; add a zoom, a graphic or a cut', at=frozen[0][0])


def check_layout(layout, issues, info):
    W, H = layout['W'], layout['H']; sx, sy = W / 1080, H / 1920; occ = Occupancy(layout['occupancy']) if layout.get('occupancy') else None
    z = {k: v * (sx if k in ('left', 'right', 'right_low') else sy) for k, v in SAFE.items()}; tol = 6 * sx
    on_face, off_safe, clash, cover, lost, worst, high, on_text = [], [], [], [], 0, (0, None), [], []
    frames = layout['frames']
    for fr in frames:
        t, cap, face = fr['t'], (fr.get('caption') or {}).get('rect'), fr.get('face')
        if fr.get('cutaway'): continue                      # a full-screen graphic: no face, captions sit on it by design
        if face is None and not fr.get('noFace') and layout.get('kind') == 'footage': lost += 1      # noFace: tracked, and no face in view there (black under an app screen)
        fb = face_box(face) if face else None
        if fb and occ and occ.covered(t, fb) > .25: cover.append(t)
        if fb and fb[1] < z['top'] - tol: high.append(t)
        # a headline-size word drawn by a graphic across the face (user: big words never on the face)
        if fb and any(len(x) > 3 and x[3] and x[2] >= 60 * sy and overlap(x[3], fb) > .2 * max(1, area(x[3])) for x in fr.get('texts', [])): on_text.append(t)        # the face (with forehead) under the app's top bar / search field
        if not cap: continue
        if fb:
            c = overlap(cap, fb) / max(1, area(fb))
            if c > .03: on_face.append(t); worst = max(worst, (c, t))
        right = z['right_low'] if cap[3] > z['split'] else z['right']
        if cap[0] < z['left'] - tol or cap[1] < z['top'] - tol or cap[2] > right + tol or cap[3] > z['caption_bottom'] + tol: off_safe.append(t)
        if occ and occ.covered(t, cap) > .08: clash.append(t)
        # text drawn by a graphic under the caption (a full-frame shot has no occupancy map: its pieces' own words are
        # measured instead), e.g. a terminal's prompt line behind the caption
        elif any(len(x) > 3 and x[3] and overlap(cap, x[3]) > .15 * max(1, area(x[3])) for x in fr.get('texts', [])): clash.append(t)
    info['caption_frames'] = sum(1 for f in frames if f.get('caption'))
    if on_face: issues.append(dict(check='captions-on-face', level=FAIL, msg='captions cover the face at ' + fmt(ranges(on_face)), at=worst[1],
                                   fix='remove "captionPlacement": "fixed" (placement is face-aware without it), or set captionBreaks so phrases are shorter'))
    if off_safe: issues.append(dict(check='captions-safe-zone', level=FAIL, msg='captions outside the app safe zone at ' + fmt(ranges(off_safe)), at=off_safe[0],
                                    fix='no clear spot inside the safe zone (in a footage video the caption went below it to stay off the face; in a shot video check "captionPlacement"). Make room: end or shrink the graphic above the head then, lower that moment\'s zoom (the face fills the frame), or put the clip in a "top"/"card" layout'))
    if clash: issues.append(dict(check='captions-collide', level=FAIL, msg='captions run into a graphic at ' + fmt(ranges(clash)), at=clash[0],
                                 fix='no clear spot for the caption: end the graphic sooner, start it after the phrase, give it a smaller "region", or hide captions for that span (captionTrack "hide")'))
    if high: issues.append(dict(check='face-top-bar', level=FAIL, msg='the face is under the app\'s top bar (above y ' + str(SAFE['top']) + ') at ' + fmt(ranges(high)), at=high[0],
                                fix='the user never wants the face at the very top: start the clip\'s window lower (layout "y" so the face with forehead stays below y 220, e.g. y 300+ for a small window), lower "face" (fy) in a full layout, or lower that moment\'s zoom'))
    # words drawn by graphics (cutaways too: the app's bars sit over everything) outside the app safe zone are hidden
    # under its search field, caption or buttons. Big words there fail; small print warns .
    big_out, small_out = {}, {}
    for fr in frames:
        for x in fr.get('texts', []):
            if len(x) < 4 or not x[3]: continue
            label, text, h, r = x[:4]
            right = z['right_low'] if r[3] > z['split'] else z['right']
            side = 'top bar and search field' if r[1] < z['top'] - tol else 'caption and buttons' if r[3] > z['bottom'] + tol else 'right-side buttons' if r[2] > right + tol and r[3] > z['split'] else 'edge' if r[0] < z['left'] - tol or r[2] > right + tol else None
            if not side: continue
            # headline-size words under the top bar or the bottom caption fail; small print and words near a side edge warn
            (big_out if h >= 60 * sy and side in ('top bar and search field', 'caption and buttons') else small_out).setdefault((label, text), []).append((fr['t'], side, r))
    # big words seen there in two samples or more fail (one sample is usually a word sliding in); the rest warn
    fails = {k: v for k, v in big_out.items() if len(v) >= 2}
    warns = {**small_out, **{k: v for k, v in big_out.items() if len(v) < 2}}
    for into, level, what in ((fails, FAIL, 'big text'), (warns, WARN, 'text')):
        by = {}
        for (label, text), hits in into.items():
            for t, side, r in hits: by.setdefault((label, side), []).append((t, text, r))
        for (label, side), hits in list(by.items())[:6]:
            ts = sorted({h[0] for h in hits}); t, text, r = min(hits)
            issues.append(dict(check='text-safe-zone', level=level, at=t, msg=f'{what} from {label} under the app\'s {side} at {fmt(ranges(ts, .6))}: "{text}" at y {r[1]}-{r[3]}',
                               fix=f'keep words inside the safe zone (x {SAFE["left"]}-{SAFE["right"]}, y {SAFE["top"]}-{SAFE["bottom"]}, right edge {SAFE["right_low"]} below y {SAFE["split"]}): move the overlay\'s "region", or a smaller "scale"/fewer words'))
    if on_text: issues.append(dict(check='text-on-face', level=FAIL, msg='big words drawn over the face at ' + fmt(ranges(on_text, .6)), at=on_text[0],
                                   fix='the user never wants big words on the face: move the word above the head or below the chin (its "y"), inside the safe zone'))
    rs = [r for r in ranges(cover) if r[1] - r[0] >= 0.5]
    if rs: issues.append(dict(check='overlay-on-face', level=WARN, msg='a graphic covers the face at ' + fmt(rs), at=rs[0][0],
                              fix='move it above or below the face, use "behind": true, or make it a full-screen "cutaway" if covering is intended'))
    seen = [f for f in frames if not f.get('cutaway')]
    if layout.get('kind') == 'footage' and seen and lost > 0.3 * len(seen):
        issues.append(dict(check='face-tracking', level=WARN, msg=f'no face track for {lost / len(seen):.0%} of the frames', fix='run npm run footage again so faces.json exists; captions could not avoid the face'))


# ---------- captions against the words ----------
FILLERS = {'um', 'uh', 'uhm', 'erm', 'er', 'ah', 'hmm', 'mm', 'mhm', 'okay', 'ok'}
# A number can be said one way and written another ("eight" in the caption, "8" from the listener): compare them as the same word.
NUMBER_WORDS = {w: str(i) for i, w in enumerate('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split())}
NUMBER_WORDS.update(thirty='30', forty='40', fifty='50', sixty='60', seventy='70', eighty='80', ninety='90', hundred='100', thousand='1000')


def norm(w):
    w = re.sub(r"[^a-z0-9']", '', w.lower()).strip("'")
    return NUMBER_WORDS.get(w, w)
def tokens(text): return [x for x in (norm(w) for w in text.split()) if x]
def similar(a, b): return a == b or (min(len(a), len(b)) >= 4 and difflib.SequenceMatcher(None, a, b).ratio() >= .8)


def check_sync(lay, issues, info):
    """Every word, while it is being said, must be in the caption on screen; captions must not hang on long after the words."""
    if not lay.get('captions') or not lay.get('words'): return
    words = [(norm(w), a, b) for w, a, b in lay['words'] if norm(w)]
    step = 1 / lay['fps']; spoken, bad, missing, linger, examples = 0, [], [], [], []
    for seen in lay['frames']:
        t, cap = seen['t'], seen.get('caption')
        if seen.get('hidden'): continue
        cur = next((w for w in words if w[1] + .1 <= t < w[2]), None)
        if cur:
            spoken += 1
            if not cap: missing.append(t)
            elif not any(similar(cur[0], x) for x in tokens(cap['text'])):
                bad.append(t)
                if len(examples) < 3 and not any(abs(t - e[0]) < .5 for e in examples): examples.append((t, cur[0], cap['text']))
        elif cap:
            last = max((b for _, a, b in words if b <= t), default=None); nxt = min((a for _, a, b in words if a > t), default=None)
            if (last is None or t - last > 1.0) and (nxt is None or nxt - t > .3): linger.append(t)
    info['spoken_frames'] = spoken
    off = sorted(bad + missing)
    if spoken and len(off) / spoken > .03 and len(off) * step >= .3:
        what = '; '.join(f'"{w}" said at {t:.1f}s, caption showed "{c}"' for t, w, c in examples)
        issues.append(dict(check='captions-sync', level=FAIL, at=off[0],
                           msg=f'captions miss the word being said in {len(off) / spoken:.0%} of spoken frames ({fmt(ranges(off, step * 2))})' + (f': {what}' if what else ''),
                           fix='words.json does not match this video: re-transcribe after any cut (npm run transcribe), and check captionTrack "hide" spans; then make again'))
    rs = [r for r in ranges(linger, step * 2) if r[1] - r[0] >= .4]
    if rs: issues.append(dict(check='captions-linger', level=WARN, at=rs[0][0], msg='a caption stays up with nothing being said at ' + fmt(rs),
                              fix='the words end earlier than the caption: re-transcribe, or add a captionBreaks entry at the next word'))


def transcribe(video, folder):
    """What is actually heard in the finished video (local faster-whisper, cached in out/heard.json). None if the transcriber is not installed."""
    cache, stamp_file = os.path.join(folder, 'heard.json'), os.path.join(folder, 'heard-audio.txt')
    if os.path.isfile(cache) and os.path.getmtime(cache) >= os.path.getmtime(video): return json.load(open(cache))['words']
    # a re-make that changed only the picture keeps the very same sound: what was heard last time still holds
    # (a fingerprint of the decoded audio, a second or two, against a minute or more of listening again)
    r = run('ffmpeg', '-v', 'error', '-i', video, '-map', '0:a:0', '-f', 'md5', '-')
    audio = r.stdout.strip() if r.returncode == 0 else None
    if audio and os.path.isfile(cache) and os.path.isfile(stamp_file) and open(stamp_file).read().strip() == audio:
        os.utime(cache); return json.load(open(cache))['words']
    py = os.path.join(ROOT, '.tools/venv-transcribe', 'Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not os.path.isfile(py): return None
    r = subprocess.run([py, os.path.join(ROOT, 'pipeline/transcribe.py'), video, cache, os.path.join(ROOT, '.tools/transcribe-models'), '--clean'], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.isfile(cache): return None
    if audio: open(stamp_file, 'w').write(audio + '\n')
    return json.load(open(cache))['words']


def check_heard(video, folder, lay, issues, info):
    """Listen to the finished video and compare: every word heard should be in the captions around that moment, and every caption word should be heard."""
    if not lay or not lay.get('captions') or not lay.get('words'): return
    heard = transcribe(video, folder)
    if heard is None:
        issues.append(dict(check='captions-heard', level=WARN, msg='could not listen to the video, so the captions were only checked against words.json', fix='install the transcriber: npm run setup')); return
    frames, step = lay['frames'], 1 / lay['fps']
    def shown(t, pad=.4):
        i0, i1 = max(0, int((t - pad) / step)), min(len(frames), int((t + pad) / step) + 1)
        fs = [f for f in frames[i0:i1] if abs(f['t'] - t) <= pad + step]
        # Captions hidden on purpose (captionTrack "hide", under a graphic) are fine: a word near or inside such a
        # stretch is not counted, even mid-phrase (often you don't want captions on screen).
        if any(f.get('hidden') for f in fs): return None
        return {x for f in fs if f.get('caption') for x in tokens(f['caption']['text'])}
    said = [(norm(w['text']), (w['start'] + w['end']) / 2) for w in heard if norm(w['text']) and norm(w['text']) not in FILLERS]
    cap = [(norm(w), (a + b) / 2) for w, a, b in lay['words'] if norm(w) and norm(w) not in FILLERS]
    unshown = [(w, t) for w, t in said if (s := shown(t)) is not None and not any(similar(w, x) for x in s)]
    unheard = [(w, t) for w, t in cap if (s := shown(t)) is not None and not any(similar(w, h) for h, ht in said if abs(ht - t) <= .6)]
    rate = max(len(unshown) / max(1, len(said)), len(unheard) / max(1, len(cap)))
    info['heard_words'] = len(said); info['caption_word_mismatch'] = round(rate, 3)
    # Two runs of the recogniser rarely disagree on more than a word or two; a wrong caption word is seen by every viewer.
    if max(len(unshown), len(unheard)) >= 2 and rate > .03:
        ex = [f'heard "{w}" at {t:.1f}s, not in the caption' for w, t in unshown[:3]] + [f'caption says "{w}" at {t:.1f}s, not heard' for w, t in unheard[:3]]
        issues.append(dict(check='captions-heard', level=FAIL if rate > .08 else WARN, at=(unshown or unheard)[0][1],
                           msg=f'{rate:.0%} of words differ between what is said and the captions: ' + '; '.join(ex),
                           fix='fix the misheard words in words.json (or re-transcribe: npm run transcribe), keep names and numbers spelled the way they are said, then make again'))


# ---------- can it be read ----------
def caption_background(video, p, lay, times):
    """Median colour behind each caption at the given times, from the finished picture (frames read once, 2 per second)."""
    want = sorted(times); out = {}
    if not want: return out
    # exact source frames every half second (select by frame number: the fps filter resamples and can hand back a
    # frame from just after a cut, pairing one shot's caption with the next shot's picture)
    step = max(1, round(lay.get('fps', 30) / 2))
    proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', video, '-vf', f"select=not(mod(n\\,{step}))", '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    n, size = 0, p['w'] * p['h'] * 3
    try:
        while want:
            buf = proc.stdout.read(size)
            if len(buf) < size: break
            t = n / 2; n += 1
            if abs(want[0] - t) > .26: continue
            out[want.pop(0)] = np.frombuffer(buf, np.uint8).reshape(p['h'], p['w'], 3)
    finally: proc.kill()
    return out


def lum(c):
    c = np.asarray(c, np.float64) / 255; c = np.where(c <= .03928, c / 12.92, ((c + .055) / 1.055) ** 2.4)
    return .2126 * c[..., 0] + .7152 * c[..., 1] + .0722 * c[..., 2]


def check_readability(lay, issues, video=None, p=None):
    """Caption letters big enough and in contrast with what is behind them; text inside graphics not too small."""
    if not lay: return
    sx = lay['W'] / 1080; step = 1 / lay['fps']
    caps = [(f['t'], f['caption']) for f in lay['frames'] if f.get('caption')]
    tiny = [t for t, c in caps if c.get('font') and c['font'] < 28 * sx]; small = [t for t, c in caps if c.get('font') and 28 * sx <= c['font'] < 34 * sx]
    if tiny: issues.append(dict(check='text-size', level=FAIL, at=tiny[0], msg=f"caption letters under 28 px at {fmt(ranges(tiny, step * 2))} (smallest {min(c['font'] for _, c in caps if c.get('font'))} px)",
                                fix='a bigger caption style, or shorter phrases (captionBreaks) and more room so placement does not have to shrink them'))
    elif small: issues.append(dict(check='text-size', level=WARN, at=small[0], msg='caption letters under 34 px at ' + fmt(ranges(small, step * 2)), fix='a bigger caption style, or shorter phrases so they keep full size'))
    # contrast: against the caption's own box or outline when it has one, else against the picture behind it
    low, poor, worst, open_runs = [], [], (99, None), {}
    for t, c in caps:
        for r in c.get('runs', []):
            if r.get('ratio') is not None:
                q = r['ratio']
            else:
                # one sample per half second: the caption from the frame nearest that moment, so caption and picture
                # are from the same instant (not a frame from the previous shot, across a cut)
                key = round(t * 2) / 2
                if key not in open_runs or abs(t - key) < abs(open_runs[key][2] - key): open_runs[key] = (c, r, t)
                continue
            if q < 3: low.append(t)
            elif q < 4.5: poor.append(t)
            worst = min(worst, (q, t))
    if open_runs and video and p and p['w']:
        pics = caption_background(video, p, lay, list(open_runs))
        for t, im in pics.items():
            c, r, _ = open_runs[t]; k = p['w'] / lay['W']
            x0, y0, x1, y1 = [int(v * k) for v in (r.get('rect') or c['rect'])]; crop = im[max(0, y0):max(0, y1), max(0, x0):max(0, x1)].reshape(-1, 3)
            if not len(crop): continue
            # the picture, not the letters: drop pixels near any run's colour (a bold word's dark letters are not background)
            inks = np.array([x['color'] for x in c.get('runs', []) if x.get('color')] or [r['color']])
            keep = crop[(np.abs(crop.astype(int)[:, None, :] - inks[None, :, :]).sum(2) > 90).all(1)]
            if len(keep) < 20: continue
            bg = np.median(lum(keep)); fg = float(lum(r['color'])); q = (max(bg, fg) + .05) / (min(bg, fg) + .05)
            if q < 3: low.append(t)
            elif q < 4.5: poor.append(t)
            worst = min(worst, (q, t))
    if low: issues.append(dict(check='text-contrast', level=FAIL, at=worst[1], msg=f'captions hard to read against what is behind them at {fmt(ranges(low, .6))} (contrast {worst[0]:.1f}:1, need 3:1)',
                               fix='a caption style with a box or a dark outline, or move/darken what is behind (a scrim piece)'))
    elif poor: issues.append(dict(check='text-contrast', level=WARN, at=worst[1], msg=f'caption contrast only {worst[0]:.1f}:1 at {fmt(ranges(poor, .6))} (4.5:1 reads easily)', fix='a style with a box or outline'))
    # text inside graphics
    # judged at its largest: text animating in passes through small sizes on the way
    big = {}
    for f in lay['frames']:
        for label, text, h, *_ in f.get('texts', []):
            if len(re.sub(r'[^A-Za-z0-9]', '', text)) < 8: continue
            k = (label, text)
            if k not in big or h > big[k][1]: big[k] = (f['t'], h)
    by = {}
    for (label, text), (t, h) in big.items():
        if h < 26 * sx and (label not in by or h < by[label][2]): by[label] = (t, text, h)
    for label, (t, text, h) in list(by.items())[:5]:
        issues.append(dict(check='text-size', level=WARN, at=t, msg=f'{label}: "{text}" is only {h} px tall at {t:.1f}s', fix=f'larger text in {label} (a prop, or the piece itself), or fewer words so it can be bigger'))

def _still(video, t, w, h):
    """One frame of the video at t seconds (BGR), or None when it cannot be read."""
    grab = ['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-']
    raw = subprocess.run(grab, capture_output=True).stdout
    return np.frombuffer(raw[:w * h * 3], np.uint8).reshape(h, w, 3).copy() if len(raw) >= w * h * 3 else None

def sheet(video, p, lay, issues, out):
    """8 evenly spaced frames plus each problem's moment, with the face, caption and safe-zone boxes drawn."""
    w, h = p['w'], p['h']
    flagged, spread = [i['at'] for i in issues if 'at' in i], [p['dur'] * (k + .5) / 8 for k in range(8)]
    kx, ky = (w / lay['W'], h / lay['H']) if lay else (w / 1080, h / 1920)
    tiles = []
    for t in sorted({round(x, 2) for x in flagged + spread})[:12]:
        picture = _still(video, t, w, h)
        if picture is None: continue
        outline = lambda b, colour, thick: cv2.rectangle(picture, (int(b[0] * kx), int(b[1] * ky)), (int(b[2] * kx), int(b[3] * ky)), colour, thick)
        nearest = min(lay['frames'], key=lambda f: abs(f['t'] - t)) if lay and lay['frames'] else None
        if nearest and abs(nearest['t'] - t) < .1:
            face = face_box(nearest['face']) if nearest.get('face') else None
            if face: outline(face, (80, 220, 80), 3)
            caption = (nearest.get('caption') or {}).get('rect')
            if caption: outline(caption, (40, 40, 240) if face and overlap(caption, face) / max(1, area(face)) > .03 else (0, 220, 255), 4)
        outline([SAFE['left'], SAFE['top'], SAFE['right'], SAFE['bottom']], (200, 200, 200), 2)
        tile = cv2.resize(picture, (360, int(360 * h / w)))
        problem_here = any(abs(i.get('at', -9) - t) < .01 for i in issues)                   # a red time label marks a problem's moment
        cv2.rectangle(tile, (0, 0), (110, 34), (40, 40, 240) if problem_here else (30, 30, 30), -1)
        cv2.putText(tile, f'{t:.1f}s', (8, 25), cv2.FONT_HERSHEY_SIMPLEX, .75, (255, 255, 255), 2)
        tiles.append(tile)
    if tiles:
        tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 4)                                # fill the last row of four
        cv2.imwrite(out, np.vstack([np.hstack(tiles[k:k + 4]) for k in range(0, len(tiles), 4)]))
        return out
    return None


def main():
    cli = argparse.ArgumentParser(description='Quality checks for a finished video')
    cli.add_argument('target', help='a project name (projects/<name>/out/cut.mp4) or a video file')
    cli.add_argument('--json', action='store_true'); cli.add_argument('--no-sheet', action='store_true')
    cli.add_argument('--preview', action='store_true', help='check out/layout-preview.json (written by npm run qa <name> --preview) instead of a finished video')
    args = cli.parse_args()
    folder = os.path.join(ROOT, 'projects', args.target, 'out') if not args.target.endswith('.mp4') else os.path.dirname(os.path.abspath(args.target))
    issues = []
    if args.preview:            # before the make: placement, captions against the words, text size, contrast where the caption has its own box or outline
        lp = os.path.join(folder, 'layout-preview.json')
        if not os.path.isfile(lp): sys.exit(f'No preview yet. Run: npm run qa {args.target} --preview')
        lay = json.load(open(lp)); info = {'preview': True, 'duration': round(lay['frames'][-1]['t'], 2) if lay['frames'] else 0}
        check_layout(lay, issues, info); check_sync(lay, issues, info); check_readability(lay, issues)
        report(issues, info, os.path.join(folder, 'qa-preview.json'), args.json, f"preview of {args.target}, {info['duration']} s (audio, picture and words heard are checked on the finished video)")
        return
    video = args.target if args.target.endswith('.mp4') else os.path.join(folder, 'cut.mp4')
    if not os.path.isfile(video): sys.exit(f'No video at {video}. Make it first: npm run make {args.target}')
    lp = os.path.join(folder, 'layout.json')
    lay = json.load(open(lp)) if os.path.isfile(lp) and os.path.getmtime(lp) >= os.path.getmtime(video) - 600 else None
    p = probe(video); info = {'video': os.path.abspath(video), 'size': f"{p['w']}x{p['h']}", 'fps': round(p['fps'], 2), 'duration': round(p['dur'], 2)}
    check_format(p, issues); check_audio(video, p, issues, info); check_mix(folder, video, issues); check_picture(video, p, issues)
    if lay:
        check_layout(lay, issues, info); check_sync(lay, issues, info); check_heard(video, folder, lay, issues, info); check_readability(lay, issues, video, p)
    else: issues.append(dict(check='layout', level=WARN, msg='no layout.json for this video, so captions and placement were not checked',
                             fix='make the video with npm run make (it writes out/layout.json); otherwise look at the sheet yourself'))
    sheet_path = None if args.no_sheet else sheet(video, p, lay, issues, os.path.join(folder, 'qa.png'))
    report(issues, info, os.path.join(folder, 'qa.json'), args.json, f"{info['size']}, {info['fps']} fps, {info['duration']} s" + (f", {info['lufs']:.1f} LUFS" if 'lufs' in info else ''), sheet_path)


def report(issues, info, path, as_json, headline, sheet_path=None):
    status = FAIL if any(i['level'] == FAIL for i in issues) else 'PASS'
    rep = dict(status=status, **info, issues=issues, **({'sheet': sheet_path} if sheet_path else {}))
    json.dump(rep, open(path, 'w'), indent=1)
    if as_json: print(json.dumps(rep, indent=1))
    else:
        print(f'{status}: {headline}')
        for i in sorted(issues, key=lambda i: i['level'] != FAIL): print(f"  {i['level']} {i['check']}: {i['msg']}\n       fix: {i['fix']}")
        if sheet_path: print('Sheet (look at it):', sheet_path)
    sys.exit(1 if status == FAIL else 0)


if __name__ == '__main__':
    main()

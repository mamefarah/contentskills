"""Plan a clean-up edit of a talking-head recording from its word timings and its sound.
  python pipeline/cut.py <video> <words.json> <plan.json> [--gap 0.3] [--pad-in 0.07] [--pad-out 0.1] [--drop 12-15,40] [--keep 3-4]
Decides which words stay, groups them into segments, and finds each segment's in and out points.
Dropped automatically: filler words (um, uh…; "like" and "you know" only when set off by commas),
stutters (the same word twice in a row) and repeated takes (a phrase started again within a few
words: the LAST take is kept). --drop / --keep take word numbers (as printed by `npm run cut … --list`)
for the editor's own decisions. Any silence longer than --gap (default 0.15 s, the user's "keep it tight") between kept
words becomes a jump cut, and so does a silence measured in the SOUND inside a kept stretch: a recogniser often
stretches a word over the pause after it, so word gaps alone miss those. The end of a sentence keeps its tail (the
falling last syllable is quiet): it gets --pad-end (0.22 s) and a softer threshold, so it is never clipped.
--tight <word numbers> overrides that for a word the user wants the next line to follow at once: the segment ends
at the word's own end plus --pad-out, ignoring the tail and any movement noise after it.
In and out points are moved to where the sound actually starts and stops (word times from a
recogniser are a few hundredths out), padded a little so no word is clipped, then put on whole
frames. Writes {fps, duration, segments: [{in, out, at, first, last, text}], removed: [...], words: [...]}.
"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np

args = [a for a in sys.argv[1:] if not a.startswith('--')]
video, words_file, plan_file = args[:3]
def option(name, default, kind=float): return kind(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default
GAP, PAD_IN, PAD_OUT, PAD_END = option('--gap', .15), option('--pad-in', .07), option('--pad-out', .1), option('--pad-end', .22)
MIN_TRIM = .12
def spans(text):
    out = set()
    for part in filter(None, (text or '').split(',')):
        a, _, b = part.partition('-'); out.update(range(int(a), int(b or a) + 1))
    return out
drop_by_hand, keep_by_hand, tight_by_hand = spans(option('--drop', '', str)), spans(option('--keep', '', str)), spans(option('--tight', '', str))

words = json.loads(Path(words_file).read_text())['words']
norm = [re.sub(r"[^a-z0-9']", '', w['text'].lower()) for w in words]
n = len(words)
reason = [None] * n

# ---- what to drop
FILLERS = {'um', 'umm', 'uh', 'uhh', 'uhm', 'er', 'erm', 'ah', 'hmm', 'mm', 'mhm'}
comma = lambda i: 0 <= i < n and words[i]['text'].rstrip().endswith((',', '…', '...'))
for i in range(n):
    if norm[i] in FILLERS: reason[i] = 'filler'
    elif norm[i] == 'like' and comma(i) and (i == 0 or comma(i - 1)): reason[i] = 'filler'          # ", like, "
    elif norm[i] == 'you' and i + 1 < n and norm[i + 1] == 'know' and comma(i + 1) and (i == 0 or comma(i - 1)): reason[i] = reason[i + 1] = 'filler'
live = [i for i in range(n) if not reason[i]]
k = 0
while k < len(live):
    hit = None
    for size, reach in ((4, 16), (3, 14), (2, 6), (1, 1)):          # longer phrases may restart further on
        for later in range(k + size, min(k + reach, len(live) - size) + 1):
            if all(norm[live[k + j]] == norm[live[later + j]] and norm[live[k + j]] for j in range(size)): hit = later
        if hit: break
    if hit and hit - k > 1:
        # A list, not a retake: "add some sirens, add some charts." The earlier phrase is a finished clause (it ends on
        # a comma or full stop), the later one is as long, ends the same way and says something different. A failed
        # start breaks off mid-clause ("before it finalizes edit, and | before it finalizes anything") or is repeated word for word.
        a, b = [live[j] for j in range(k, hit)], [live[j] for j in range(hit, min(hit + hit - k, len(live)))]
        ends = lambda i: words[i]['text'].rstrip().endswith((',', '.', '!', '?', ';', ':'))
        if len(b) == len(a) and ends(a[-1]) and ends(b[-1]) and [norm[i] for i in a] != [norm[i] for i in b]: hit = None
    if hit:
        for j in range(k, hit): reason[live[j]] = 'stutter' if hit - k == 1 else 'repeated take'
        k = hit
    else: k += 1
for i in drop_by_hand:
    if 0 <= i < n: reason[i] = 'editor'
for i in keep_by_hand:
    if 0 <= i < n: reason[i] = None

# ---- the sound: loudness every 10 ms, to find where speech really starts and stops
# (first_pts=0 pads the start when the audio track begins later than the picture, as phone recordings do, so times here are clip times)
RATE, HOP = 16000, 160
pcm = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', str(RATE), '-af', 'aresample=async=1:first_pts=0,highpass=f=100', '-f', 's16le', '-'], capture_output=True, check=True).stdout, dtype=np.int16).astype(np.float32) / 32768
frames = len(pcm) // HOP
level = 20 * np.log10(np.sqrt((pcm[:frames * HOP].reshape(frames, HOP) ** 2).mean(axis=1)) + 1e-7)
floor, peak = np.percentile(level, 10), np.percentile(level, 98)
quiet = max(floor + 8, peak - 24)            # below this is room tone and breaths
loud = lambda t, q=None: 0 <= int(t * 100) < frames and level[int(t * 100)] >= (quiet if q is None else q)
SOFT = quiet - 8                             # a sentence's last syllable trails off below speech level: still the sentence
def onset(t, back=.3, forward=.5):
    """Where the sound that is under way at t began (or, if t is silent, where the next one begins)."""
    if loud(t):
        start = t
        while start > t - back and (loud(start - .01) or loud(start - .03)): start -= .01
        return start
    for step in range(int(forward * 100)):
        if loud(t + step / 100): return t + step / 100
    return t
def offset(t, forward=.6, back=.2, q=None):
    """Where the sound around t stops. A hush of up to 0.15 s is not the end: the closure before a final t, k or ch is that long."""
    resumes = lambda at: any(loud(at + k / 100, q) for k in range(1, 16))
    if loud(t, q) or resumes(t):
        end = t
        while end < t + forward and resumes(end): end += .01
        return end + .01
    for step in range(int(back * 100)):
        if loud(t - step / 100, q): return t - step / 100 + .01
    return t

# ---- segments
probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate:format=duration', '-of', 'json', video], capture_output=True, check=True, text=True).stdout)
num, den = probe['streams'][0]['r_frame_rate'].split('/'); fps = float(num) / float(den); duration = float(probe['format']['duration'])
kept = [i for i in range(n) if not reason[i]]
if not kept: sys.exit('Nothing left to keep.')
groups = [[kept[0]]]
for a, b in zip(kept, kept[1:]):
    joined = b == a + 1 and words[b]['start'] - words[a]['end'] <= GAP
    groups[-1].append(b) if joined else groups.append([b])
segments, cursor, last_out = [], 0.0, 0.0
for group in groups:
    first, last = group[0], group[-1]
    tight = last in tight_by_hand          # the editor's call: no tail after this word, the next take starts right away
    final = words[last]['text'].rstrip().endswith(('.', '!', '?')) and not tight          # the end of a sentence: keep its tail
    start = onset(words[first]['start'], forward=min(.5, max(.1, words[first]['end'] - words[first]['start'])))
    end = words[last]['end'] if tight else offset(words[last]['end'], q=SOFT if final else None)      # tight: stop at the word, not at the noise after it
    if start < words[first]['end'] - .04: words[first] = {**words[first], 'start': round(float(start), 3)}      # the caption follows the sound
    # never reach into a word that was dropped, or into the neighbouring segment
    if first > 0 and reason[first - 1]: start = max(start, (words[first - 1]['end'] + words[first]['start']) / 2)
    if last + 1 < n: end = min(end, max(words[last]['end'], words[last + 1]['start'] - .02))
    t_in = max(last_out, np.floor(max(0, start - PAD_IN) * fps) / fps)
    t_out = min(duration, np.ceil((end + (PAD_END if final else PAD_OUT)) * fps) / fps)
    if last + 1 < n and not reason[last + 1] and t_out > words[last + 1]['start'] - PAD_IN: t_out = max(t_in + 1 / fps, np.floor((words[last + 1]['start'] - PAD_IN) * fps) / fps)
    if last + 1 < n and reason[last + 1] and t_out > words[last + 1]['start']: t_out = max(t_in + 1 / fps, np.floor(words[last + 1]['start'] * fps) / fps)      # the tail pad must not reach into a dropped word either
    if segments and t_in - segments[-1]['out'] < MIN_TRIM:      # too little to remove to be worth a jump cut: run on
        s = segments[-1]; cursor += t_out - s['out']; last_out = t_out
        s.update({'out': round(float(t_out), 4), 'last': last, 'text': s['text'] + ' ' + ' '.join(words[i]['text'] for i in group if not reason[i])}); continue
    segments.append({'in': round(float(t_in), 4), 'out': round(float(t_out), 4), 'at': round(cursor, 4), 'first': first, 'last': last, 'text': ' '.join(words[i]['text'] for i in group)})
    cursor += t_out - t_in; last_out = t_out

# ---- pauses hidden inside a kept stretch: measured in the sound, not the word times
# A quiet run longer than GAP + both pads is cut down to the pads. Runs under 0.15 s are never touched (the closure
# before a final t/k/ch), and a run after a sentence end keeps the sentence's tail (PAD_END).
def split_silences(segs):
    out, cursor = [], 0.0
    for s in segs:
        pieces, a, t = [], s['in'], s['in']
        run_start = None
        while t <= s['out']:
            if not loud(t):
                if run_start is None: run_start = t
            else:
                if run_start is not None and t - run_start > GAP + PAD_IN + PAD_OUT and run_start > a + .05:
                    ends_sentence = any(words[i]['text'].rstrip().endswith(('.', '!', '?')) and abs(words[i]['end'] - run_start) < .6 for i in range(s['first'], s['last'] + 1) if not reason[i])
                    cut_from = np.ceil((run_start + (PAD_END if ends_sentence else PAD_OUT)) * fps) / fps
                    cut_to = np.floor((t - PAD_IN) * fps) / fps
                    if cut_to - cut_from >= MIN_TRIM: pieces.append((a, cut_from)); a = cut_to
                run_start = None
            t = round(t + .01, 2)
        pieces.append((a, s['out']))
        for p_in, p_out in pieces:
            out.append({**s, 'in': round(float(p_in), 4), 'out': round(float(p_out), 4), 'at': round(cursor, 4)}); cursor += p_out - p_in
    return out, cursor
segments, cursor = split_silences(segments)
for s in segments: s['text'] = ' '.join(words[i]['text'] for i in range(n) if not reason[i] and s['in'] - .02 <= words[i]['start'] < s['out'])

# ---- word timings on the new timeline: each kept word mapped through the segments (a time inside a removed pause
# lands on the next kept frame, so a word the recogniser stretched over a pause is shortened to its sound)
def to_new(t):
    for s in segments:
        if t < s['in']: return s['at']
        if t <= s['out']: return s['at'] + t - s['in']
    return cursor
new_words = []
for i in range(n):
    if reason[i]: continue
    a = to_new(words[i]['start']); b = max(to_new(words[i]['end']), a + .02)
    new_words.append({'text': words[i]['text'], 'start': round(float(a), 3), 'end': round(float(b), 3)})
removed, i = [], 0
while i < n:
    if reason[i]:
        j = i
        while j + 1 < n and reason[j + 1] == reason[i]: j += 1
        removed.append({'reason': reason[i], 'from': words[i]['start'], 'to': words[j]['end'], 'text': ' '.join(w['text'] for w in words[i:j + 1])}); i = j + 1
    else: i += 1
edges = [0] + [x for s in segments for x in (s['in'], s['out'])] + [duration]
pauses = [{'from': round(a, 3), 'to': round(b, 3)} for a, b in zip(edges[::2], edges[1::2]) if b - a > .001]
suspicious = [{'n': i, 'text': w['text'], 'start': w['start'], 'seconds': round(w['end'] - w['start'], 2)} for i, w in enumerate(words) if not reason[i] and w['end'] - w['start'] > .7]
Path(plan_file).write_text(json.dumps({'fps': fps, 'duration': {'before': round(duration, 3), 'after': round(float(cursor), 3)}, 'settings': {'gap': GAP, 'padIn': PAD_IN, 'padOut': PAD_OUT, 'padEnd': PAD_END}, 'suspicious': suspicious,
    'segments': segments, 'removed': removed, 'pauses': pauses, 'words': new_words, 'allWords': [{'n': i, 'text': w['text'], 'start': w['start'], 'end': w['end'], 'dropped': reason[i]} for i, w in enumerate(words)]}))

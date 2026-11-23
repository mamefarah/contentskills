"""Even out the voice phrase by phrase before loudness normalisation (a "rider", like an engineer riding the fader).
  python pipeline/level.py <media> <words.json> <out.wav> [--max-up 10] [--max-down 6] [--report report.json]
A talking-head take is recorded at different distances from the mic: one sentence close and loud, the next leaning
back and 8 dB quieter. Loudness normalisation (loudnorm, linear) only moves the whole clip, so those swings stay.
Here every phrase (words joined by gaps under 0.25 s, split at sentence ends and kept under ~3 s) is measured, and
gained to the level of the phrases around the loud end of the take (the 70th percentile), so quiet stretches come up
and shouted words come down. The gain changes inside the pauses between phrases with a 60 ms ramp (120 ms across a
boundary with no pause), so no word is pumped. Gains are capped (+10 / -6 dB by default). Writes 48 kHz 24-bit
WAV with the same channels; the caller then normalises the whole clip to its LUFS target (pipeline/cut.mjs).
"""
import json, subprocess, sys
import numpy as np

args = [a for a in sys.argv[1:] if not a.startswith('--')]
media, words_file, out_file = args[:3]
def option(name, default): return float(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default
MAX_UP, MAX_DOWN = option('--max-up', 10), option('--max-down', 6)
report = sys.argv[sys.argv.index('--report') + 1] if '--report' in sys.argv else None
RATE = 48000

raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', media, '-vn', '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
channels = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', media], capture_output=True, text=True, check=True).stdout.strip() or 1)
pcm = np.frombuffer(raw, dtype=np.float32).reshape(-1, channels).copy()
n = len(pcm)

# loudness per 50 ms of the mono mix, after a 100 Hz high-pass (rumble and handling noise should not count as voice)
mono = pcm.mean(axis=1)
k = np.exp(-2 * np.pi * 100 / RATE)
hp = np.empty_like(mono); y = 0.0; x0 = 0.0
d = np.diff(mono, prepend=mono[:1])                                 # one-pole high-pass: y[i] = k*y[i-1] + x[i] - x[i-1]
try:
    from scipy.signal import lfilter; hp = lfilter([1, -1], [1, -k], mono)
except ImportError:
    for i, v in enumerate(d): y = k * y + v; hp[i] = y
HOP = RATE // 20
frames = len(hp) // HOP
power = (hp[:frames * HOP].reshape(frames, HOP) ** 2).mean(axis=1) + 1e-12

words = json.loads(open(words_file).read()); words = words.get('words', words)
key = next(k for k in words[0] if k not in ('start', 'end'))
phrases, cur = [], []
for w in words:
    if cur and (w['start'] - cur[-1]['end'] > .25 or w['end'] - cur[0]['start'] > 3.2): phrases.append(cur); cur = []
    cur.append(w)
    if w[key].rstrip().endswith(('.', '!', '?')): phrases.append(cur); cur = []
if cur: phrases.append(cur)

def level(a, b):
    p = power[int(a * 20):max(int(a * 20) + 1, int(b * 20))]
    if not len(p): return None
    db = 10 * np.log10(p); voiced = p[db > db.max() - 15]        # the voiced part only, not the breaths between words
    return 10 * np.log10(voiced.mean())
levels = [level(p[0]['start'], p[-1]['end']) for p in phrases]
known = [l for l in levels if l is not None]
target = float(np.percentile(known, 70))
gains = [0.0 if l is None else float(np.clip(target - l, -MAX_DOWN, MAX_UP)) for l in levels]

# the gain curve: each phrase's gain, changing in the pause before it
curve = np.full(n, gains[0], dtype=np.float32)
edges = []
for i in range(1, len(phrases)):
    a, b = phrases[i - 1][-1]['end'], phrases[i][0]['start']
    mid, ramp = (a + b) / 2, (.06 if b - a >= .06 else .12)
    edges.append((mid - ramp / 2, mid + ramp / 2, gains[i - 1], gains[i]))
t0 = 0
for (s, e, g0, g1), g in zip(edges, gains[:-1]):
    si, ei = max(t0, int(s * RATE)), min(n, int(e * RATE))
    curve[t0:si] = g
    if ei > si: curve[si:ei] = g0 + (g1 - g0) * (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, ei - si)))
    t0 = max(t0, ei)
curve[t0:] = gains[-1]
out = pcm * (10 ** (curve / 20))[:, None]

subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', str(channels), '-i', '-', '-c:a', 'pcm_s24le', out_file], input=out.astype(np.float32).tobytes(), check=True)
spread = lambda v: round(float(np.percentile(v, 90) - np.percentile(v, 10)), 1)
after = [l + g for l, g in zip(levels, gains) if l is not None]
summary = {'phrases': len(phrases), 'spreadBefore': spread(known), 'spreadAfter': spread(after), 'maxUp': round(max(gains), 1), 'maxDown': round(min(gains), 1),
           'gains': [{'start': p[0]['start'], 'text': ' '.join(w[key] for w in p)[:50], 'gain': round(g, 1)} for p, g in zip(phrases, gains)]}
if report: open(report, 'w').write(json.dumps(summary, indent=1))
print(f"Levelled {len(phrases)} phrases: spread between quiet and loud phrases {summary['spreadBefore']} dB -> {summary['spreadAfter']} dB (gain {summary['maxDown']} to +{summary['maxUp']} dB)")

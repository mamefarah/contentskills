"""Synthesizes the shared sound effects: short, clean, fully local (numpy + the stdlib only, no samples).
  .tools/venv-effects/bin/python library/_shared/sfx/generate.py
Writes 48 kHz mono 16-bit wavs next to this file and updates their entries in catalog.json. Every effect in the
catalog is synthesized here or in generate_extra.py, so the files can be shared freely. A catalog entry that names another
"source" (your own recording) is never overwritten (see main()). Running it again gives the same files. Every effect is peak-normalised to -3 dBFS with short fades at
both ends; a storyboard sets how loud each one plays ("gain", dB) and pipeline/sounds.py mixes them
under the voice.
"""
import json, math, wave
from pathlib import Path
import numpy as np

SR = 48000
here = Path(__file__).resolve().parent

def T(seconds): return np.arange(int(round(seconds * SR))) / SR
def noise(n, seed): return np.random.default_rng(seed).standard_normal(n)
def fade(x, a=.004, r=.012):
    """Short raised-cosine fades so nothing clicks at the edges."""
    x = x.copy(); na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    x[:na] *= .5 - .5 * np.cos(np.pi * np.arange(na) / na); x[-nr:] *= .5 + .5 * np.cos(np.pi * np.arange(nr) / nr)
    return x
def band(x, lo, hi):
    """Static band-pass by FFT with soft (half-octave) skirts."""
    spec = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR) + 1e-9
    gain = 1 / (1 + (lo / f) ** 6) / (1 + (f / hi) ** 6)
    return np.fft.irfft(spec * gain, len(x))
def sweep_filter(x, fc, q=.9):
    """State-variable band-pass whose centre frequency follows fc (Hz per sample, kept under 7.5 kHz for stability)."""
    out = np.empty_like(x); low = bp = 0.
    k = 2 * np.sin(np.pi * np.minimum(fc, 7500) / SR)
    for i in range(len(x)):
        low += k[i] * bp; high = x[i] - low - q * bp; bp += k[i] * high; out[i] = bp
    return out
def bell(t, centre, width): return np.exp(-((t - centre) / width) ** 2)
def phase(freq): return 2 * np.pi * np.cumsum(freq) / SR
def place(parts, seconds):
    """Lay [(start seconds, samples)] onto silence of this length."""
    out = np.zeros(int(round(seconds * SR)))
    for at, x in parts: i = int(round(at * SR)); n = min(len(x), len(out) - i); out[i:i + n] += x[:n]
    return out

def whoosh(seconds, f0, f1, seed, peak_at=.55, q=.5, air=.12):
    t = T(seconds); u = t / seconds; n = noise(len(t), seed)
    shape = np.clip(np.sin(np.pi * u ** (math.log(.5) / math.log(peak_at))), 0, 1)      # 0 -> 1 at peak_at -> 0
    fc = f0 * (f1 / f0) ** np.where(u < peak_at, shape, .45 + .55 * shape)              # pitch rises to the peak, falls part of the way back
    body = sweep_filter(n, fc, q)
    env = shape ** 2.2
    return (body + air * band(n, 5000, 12000)) * env
def blip(seconds, f0, f1, decay, harm=.15):
    t = T(seconds); f = f1 + (f0 - f1) * np.exp(-t / (seconds * .22)); ph = phase(f)
    return (np.sin(ph) + harm * np.sin(2 * ph)) * np.exp(-t / decay)
def click(seed, f=2600, decay=.004, body=.6):
    t = T(.03); n = band(noise(len(t), seed), 1800, 9000)
    return n * np.exp(-t / decay) + body * np.sin(2 * np.pi * f * t) * np.exp(-t / (decay * 1.6))
def key(seed, pitch=1.):
    """One soft keyboard tick: a tiny filtered-noise tap with a low thock under it."""
    t = T(.045); n = band(noise(len(t), seed), 1500 * pitch, 6500)
    return n * np.exp(-t / .0035) + .5 * np.sin(2 * np.pi * 420 * pitch * t) * np.exp(-t / .009)
def thump(seconds=.32, f0=120, f1=52, decay=.075):
    t = T(seconds); f = f1 + (f0 - f1) * np.exp(-t / .03)
    return np.sin(phase(f)) * np.exp(-t / decay)

def build():
    s = {}
    s['whoosh'] = whoosh(.36, 500, 4200, 11)
    s['whoosh_fast'] = whoosh(.2, 800, 5600, 12, peak_at=.5)
    s['whoosh_low'] = whoosh(.5, 180, 1500, 13, peak_at=.6, q=.45, air=.04)
    t = T(.15); s['swish'] = band(noise(len(t), 14), 4500, 14000) * np.sin(np.pi * (t / .15) ** .7) ** 2 + .5 * sweep_filter(noise(len(t), 15), 3000 + 4000 * t / .15, .6) * np.sin(np.pi * t / .15) ** 2
    s['pop'] = blip(.12, 620, 300, .028)
    s['pop_hi'] = blip(.1, 1250, 720, .022)
    s['click'] = click(21)
    s['tick'] = key(31)
    # A typing run: irregular gaps and slightly different keys, like a real burst of typing.
    gaps = [0, .085, .16, .255, .33, .43, .5, .59, .665, .745]
    rng = np.random.default_rng(32)
    s['key_run'] = place([(g, key(40 + i, .85 + .3 * rng.random()) * (.7 + .3 * rng.random())) for i, g in enumerate(gaps)], .8)
    s['thump'] = thump()
    t = T(.34); s['impact'] = place([(0, thump(.34, 150, 48, .085)), (0, .5 * band(noise(len(t), 51), 700, 7000) * np.exp(-t / .028))], .34)
    t = T(.8); u = t / .8
    s['riser'] = (sweep_filter(noise(len(t), 61), 400 * (5200 / 400) ** u, .7) * .9 + .35 * np.sin(phase(220 * (880 / 220) ** u))) * u ** 2.2
    s['shutter'] = place([(0, click(71, 1900, .005, .4)), (.062, click(72, 1500, .007, .5) * .85)], .12)
    t = T(.7); s['ding'] = (np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t / .16) + .45 * np.sin(2 * np.pi * 1975.5 * t) * np.exp(-t / .1) + .2 * np.sin(2 * np.pi * 2637 * t) * np.exp(-t / .05)) * (1 - np.exp(-t / .002))
    note = lambda f, d: (np.sin(2 * np.pi * f * T(d)) + .2 * np.sin(4 * np.pi * f * T(d))) * np.exp(-T(d) / (d * .35)) * (1 - np.exp(-T(d) / .003))
    s['blip_up'] = place([(0, note(660, .12)), (.09, note(990, .2))], .3)
    # Gentle two-tone wail: a sine with a little triangle colour gliding between two notes, low-passed by construction.
    t = T(1.); f = 560 + 190 * (.5 - .5 * np.cos(2 * np.pi * 2 * t)); ph = phase(f)
    s['siren'] = (np.sin(ph) + .12 * np.sin(3 * ph) / 3 + .05 * np.sin(5 * ph) / 5) * np.sin(np.pi * np.clip(t / 1., 0, 1)) ** .6
    t = T(.4); s['sub_drop'] = np.sin(phase(42 + 110 * np.exp(-t / .09))) * np.exp(-t / .16)
    # The cinematic hit: a long low boom, a crack of noise on top and a dark tail.
    t = T(1.4); s['trailer_hit'] = place([(0, thump(1.4, 95, 34, .38) * 1.2), (0, .7 * band(noise(len(t), 101), 300, 6000) * np.exp(-t / .06)),
                                          (0, .35 * sweep_filter(noise(len(t), 102), 900 * np.exp(-t / .3) + 90, .7) * np.exp(-t / .45))], 1.4)
    t = T(.22); s['stamp'] = place([(0, thump(.22, 170, 70, .04)), (0, .8 * band(noise(len(t), 111), 900, 5000) * np.exp(-t / .012))], .22)
    t = T(.2); s['punch'] = place([(0, thump(.2, 210, 62, .05) * 1.1), (0, .6 * band(noise(len(t), 121), 250, 2600) * np.exp(-t / .02))], .2)
    s['notif'] = place([(0, note(880, .16)), (.11, note(1318.5, .32))], .45)
    buzz = lambda f, d: sum(np.sin(2 * np.pi * f * k * T(d)) / k for k in (1, 3, 5, 7)) * np.exp(-T(d) / (d * .6)) * (1 - np.exp(-T(d) / .004))
    s['reject'] = place([(0, buzz(196, .16)), (.15, buzz(147, .28))], .45)
    # Digital glitch: short gated bursts of noise and a stepped (bit-crushed) tone.
    t = T(.36); gate = (np.sin(2 * np.pi * 31 * t + 1.3) > .15) * (np.sin(2 * np.pi * 9 * t) > -.4)
    crushed = np.round(np.sin(phase(300 + 2400 * np.abs(np.sin(2 * np.pi * 13 * t)))) * 3) / 3
    s['glitch'] = (.7 * band(noise(len(t), 131), 1200, 9000) + .6 * crushed) * gate * (1 - .6 * t / .36)
    chime = lambda f, d: (np.sign(np.sin(2 * np.pi * f * T(d))) * .35 + np.sin(2 * np.pi * f * T(d))) * np.exp(-T(d) / (d * .4)) * (1 - np.exp(-T(d) / .002))
    s['coin'] = place([(0, chime(987.8, .09)), (.075, chime(1318.5, .42))], .5)
    s['win'] = place([(i * .085, note(f, .22 if i < 3 else .5)) for i, f in enumerate((523.3, 659.3, 784, 1046.5))], .8)
    rng = np.random.default_rng(141)
    s['sparkle'] = place([(g, .7 * note(f, .22)) for g, f in zip(np.sort(rng.uniform(0, .45, 9)), rng.choice((2093, 2637, 3136, 3520, 4186), 9))], .7)
    return s

INFO = {
    'whoosh': ('Whoosh', 'Moves', 'A filtered-noise sweep that swells and falls away: the standard move for a transition or a layout change.'),
    'whoosh_fast': ('Fast whoosh', 'Moves', 'A shorter, brighter sweep for whips and punch-ins.'),
    'whoosh_low': ('Low whoosh', 'Moves', 'A darker, longer sweep for a card or panel sliding in.'),
    'swish': ('Swish', 'Moves', 'A thin, airy flick for small things arriving: a word, a tab, a line.'),
    'riser': ('Riser', 'Moves', 'Noise and a tone climbing for most of a second: end it on a cut or a hit.'),
    'pop': ('Pop', 'Interface', 'A soft blip that drops in pitch, for a graphic popping in.'),
    'pop_hi': ('High pop', 'Interface', 'The same, smaller and higher: for the second and third things in a row.'),
    'click': ('Click', 'Interface', 'A short interface click: a button, a toggle, a cursor press.'),
    'tick': ('Key tick', 'Interface', 'One quiet keyboard tick, for a letter typed or a counter stepping.'),
    'key_run': ('Typing run', 'Interface', 'Ten irregular key ticks over 0.8 seconds, for a line being typed.'),
    'shutter': ('Shutter', 'Interface', 'Two close clicks like a camera shutter: a still, a snapshot, a cut.'),
    'ding': ('Ding', 'Interface', 'A soft small bell: sent, done, confirmed.'),
    'blip_up': ('Blip up', 'Interface', 'Two rising notes: success, switched on.'),
    'thump': ('Thump', 'Hits', 'A soft low impact with a fast decay, under a slam or a hard cut.'),
    'impact': ('Impact', 'Hits', 'The thump with a short burst of noise on top: the loud hit, once or twice a video.'),
    'sub_drop': ('Sub drop', 'Hits', 'A low sine falling in pitch: weight under a big number or a title landing.'),
    'siren': ('Siren', 'Colour', 'One second of a gentle two-tone wail, mellow rather than piercing.'),
    'trailer_hit': ('Trailer hit', 'Hits', 'A long low boom with a crack on top and a dark tail: the one big moment of a video.'),
    'stamp': ('Stamp', 'Hits', 'A short dry thud with a slap of noise: a stamp, a label slammed down.'),
    'punch': ('Punch', 'Hits', 'A tight low hit for a word punched in or a hard zoom.'),
    'notif': ('Notification', 'Interface', 'Two soft rising notes: a message arriving.'),
    'reject': ('Reject', 'Interface', 'Two falling buzzy notes: wrong, crossed out, denied.'),
    'glitch': ('Glitch', 'Colour', 'A third of a second of gated noise and a stepped tone: a digital stutter.'),
    'coin': ('Coin', 'Rewards', 'Two bright notes, the second ringing: money, a point scored.'),
    'win': ('Win', 'Rewards', 'A quick four-note rise: done, success, the payoff.'),
    'sparkle': ('Sparkle', 'Rewards', 'Nine tiny high pings scattered over half a second: a shine on a reveal.'),
}

def main():
    """Regenerates only the synthesized effects. An effect whose catalog entry names another "source" (your own
    recording) is never touched: its wav and its catalog entry stay exactly as they are. `--only a,b` limits the run;
    `--force` also overwrites recordings that share a name with a synth here (you almost never want that)."""
    import sys
    argv = sys.argv[1:]; force = '--force' in argv
    only = set(argv[argv.index('--only') + 1].split(',')) if '--only' in argv else None
    path = here / 'catalog.json'
    catalog = json.loads(path.read_text()) if path.exists() else {'id': 'sfx', 'title': 'Sound effects',
        'summary': 'Short sound effects shared by every theme. Each file peaks at -3 dBFS; a storyboard sets how loud each one plays.',
        'usage': 'In a footage storyboard: "sounds": [{"name": "whoosh", "at": 3.8, "gain": -14}]. gain is dB (default -14); the voice is never changed.',
        'groups': ['Moves', 'Interface', 'Hits', 'Colour'], 'items': []}
    by_id = {i['id']: i for i in catalog['items']}
    kept = []
    for name, x in build().items():
        if only and name not in only: continue
        entry = by_id.get(name)
        if entry and entry.get('source') not in (None, 'synth') and not force: kept.append(name); continue
        x = x - x.mean()                                           # no DC
        x = fade(np.asarray(x, np.float64)); x = x / np.abs(x).max() * 10 ** (-3 / 20)
        with wave.open(str(here / f'{name}.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.rint(x * 32767).astype('<i2').tobytes())
        title, group, description = INFO[name]
        made = {'id': name, 'name': title, 'group': group, 'file': f'{name}.wav', 'seconds': round(len(x) / SR, 3), 'description': description}
        if entry: entry.update({'file': made['file'], 'seconds': made['seconds']}); entry.pop('source', None) if force else None
        else: catalog['items'].append(made); by_id[name] = made
        if group not in catalog['groups']: catalog['groups'].append(group)
        print(f'{name:12} {len(x) / SR:.2f}s')
    path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + '\n')
    if kept: print('Left alone (recordings, not synthesized here): ' + ', '.join(kept))

if __name__ == '__main__': main()

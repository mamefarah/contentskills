"""Extra synthesized sounds, made here and merged into catalog.json by id (re-running replaces only these entries).
  python3 library/_shared/sfx/generate_extra.py
"""
import json, wave
import numpy as np
from generate import SR, T, noise, fade, band, sweep_filter, place, thump, phase, here

def water_shot(seed):
    """A toy water pistol firing: a hard plastic snap, a wet squirt of filtered noise and a small low pop."""
    t = T(.32)
    snap = band(noise(len(t), seed), 1800, 9000) * np.exp(-t / .006)
    squirt = sweep_filter(noise(len(t), seed + 1), 2600 * np.exp(-t / .12) + 900, .8) * np.exp(-t / .07) * (1 - np.exp(-t / .004))
    body = np.sin(phase(320 * np.exp(-t / .02) + 140)) * np.exp(-t / .03)
    return 1.0 * snap + .8 * squirt + .7 * body

def build():
    s = {}
    s['water_shot'] = water_shot(81)
    s['water_burst'] = place([(0, water_shot(82)), (.11, water_shot(84) * .85), (.21, water_shot(86) * .75)], .55)
    t = T(1.1)
    crack = band(noise(len(t), 91), 400, 9000) * np.exp(-t / .05)
    rumble = sweep_filter(noise(len(t), 92), 1800 * np.exp(-t / .18) + 120, .7) * np.exp(-t / .32)
    debris = band(noise(len(t), 93), 2500, 11000) * np.exp(-((t - .25) / .2) ** 2) * .25
    s['explosion'] = place([(0, thump(1.1, 110, 38, .22) * 1.2), (0, crack), (0, rumble * .9), (0, debris)], 1.1)
    return s

INFO = {
    'water_shot': ('Water pistol shot', 'Hits', 'A toy water pistol firing once: plastic snap, wet squirt, small pop. Not a real gun.'),
    'water_burst': ('Water pistol burst', 'Hits', 'Three quick water-pistol shots in 0.2 s, for a cartoon shoot-out.'),
    'explosion': ('Cartoon explosion', 'Hits', 'A punchy comic explosion: crack, low boom and a rumble with a little debris. A sign blowing apart.'),
}

def main():
    cat = json.loads((here / 'catalog.json').read_text()); items = cat['items']
    for name, x in build().items():
        x = x - x.mean(); x = fade(np.asarray(x, np.float64)); x = x / np.abs(x).max() * 10 ** (-3 / 20)
        with wave.open(str(here / f'{name}.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.rint(x * 32767).astype('<i2').tobytes())
        title, group, description = INFO[name]
        entry = {'id': name, 'name': title, 'group': group, 'file': f'{name}.wav', 'seconds': round(len(x) / SR, 3), 'description': description, 'source': 'synth'}
        items[:] = [i for i in items if i['id'] != name] + [entry]
        print(f'{name:12} {len(x) / SR:.2f}s')
    (here / 'catalog.json').write_text(json.dumps(cat, indent=2) + '\n')

if __name__ == '__main__': main()

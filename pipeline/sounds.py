"""Stage 3 helper: lay timed sound effects under the voice of a finished video.
  python pipeline/sounds.py <in.mp4> <out.mp4> <plan.json>
plan = {sfxDir, sounds: [{name, at, gain?}], music?, voiceLufs?, report?}
  voiceLufs  optional target (e.g. -14, the user's audio.voiceLufs): the voice is first loudness-normalised to it (EBU R128 two-pass, true peak
          -1.5 dBTP), then everything else is laid under it. Without it the voice is left exactly as it is.
  music   optional bed {dir, name, gain?, duck?, start?, offset?, at? (seconds into the video it comes in), parts?, drops?}
          parts [{at, from}]: from video second `at` the track plays from `from` s of the file (jump to its big section
          on a reveal, on a beat); drops [[a, b]]: the music stops from a to b (a dropout before a reveal); lifts [{start, end, db, duck?}]: the bed
          turned up db (and dipped only duck dB under the words) over that stretch, e.g. an upbeat first 5 seconds.: <dir>/<name>.mp3 from `start` s (+ `offset`, for a section),
          set `gain` LU (default -15, never above -10) against the voice's loudness (LUFS, as heard), and dipped `duck` dB
          (default 6) during speech, so it sits about 21 LU under the words; short fade in, 1.2 s fade out at the end.
  sfxDir  folder with the effect wavs and their catalog.json (library/_shared/sfx)
  name    an effect id from that catalog; at = seconds into the video; gain = the storyboard's dB (default -14).
          LEVELS ARE RELATIVE TO THE VOICE, never to the file: each effect's loudest 100 ms is set to the speaking level
          + (gain + 6) dB, so the default -14 lands 8 dB under the voice, and no effect is ever set above voice -4 dB.
          Where there is speech the effects are dipped a further 4 dB, so they punctuate without covering words.
House mix (always): voice at the house level (voiceLufs; settings audio.voiceLufs), the loudest thing; music quiet under it; effects pop in the gaps.
  voiceEq optional "voice": a spoken-voice polish applied before the normalisation (rumble cut under 80 Hz, less boxy
          low-mids around 250 Hz, presence lift at 3.5 kHz, gentle air shelf, soft de-essing, a light 2:1 compressor).
          Only when the storyboard asks for it ("voiceEq": "voice"); otherwise the voice keeps its own tone.
  voiceGains optional [{start, end, db}]: the voice turned up by db over that stretch (a quiet passage), after the
          normalisation, so the rest keeps its level (storyboard "voiceGains"; a note like "turn up audio here").
  report  optional path for a json report {voiceLufs, voiceTruePeak, mixLufs, truePeak, busTrim, sounds, duckedSeconds, note}
The picture is copied untouched. Apart from the optional normalisation, the voice is never changed: it is decoded, the effects are added to it
sample by sample at unity gain, and the sum is encoded once (AAC 192k, the source rate and channels).
Peaks: where an effect lands on a loud moment of the voice and the sum would pass -1.5 dBTP, the effects are
dipped for those few milliseconds (soft edges). Afterwards the encoded mix is measured (EBU R128); if its true peak is
still above -1.5 dBTP, or it is more than 0.5 LU louder than the voice alone, the whole effects bus is turned
down (never the voice) and the mix is redone.
"""
import json, re, subprocess, sys, tempfile, wave
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from settings import settings
_A = settings().get('audio', {})             # the house mix, from settings/defaults.json + settings/user.json (audio.*)
_FX, _MU = _A.get('effects', {}), _A.get('music', {})
CEILING, HEADROOM, DEFAULT_GAIN = float(_A.get('truePeak', -1.5)), .5, float(_FX.get('gain', -14))
SFX_OFFSET, SFX_MAX, SFX_DUCK = float(_FX.get('offset', 6)), float(_FX.get('max', -4)), float(_FX.get('duck', 4))        # effect level vs the voice = gain + offset dB, capped at max; duck dB more under speech
MUSIC_GAIN, MUSIC_MAX, MUSIC_DUCK = float(_MU.get('gain', -15)), float(_MU.get('max', -10)), float(_MU.get('duck', 6))  # music vs the voice in the gaps (capped), and the extra dip under speech
OVERSAMPLE, ENCODE_MARGIN = 4, .3          # true peaks are estimated at 4x; the AAC encode moves peaks a little, so aim this far under the ceiling

def run(argv): return subprocess.run(argv, check=True, capture_output=True)
def loudness(path):
    """(integrated LUFS, true peak dBTP) of a file's audio."""
    log = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    summary = log[log.rfind('Summary:'):]
    lufs, peak = re.search(r'I:\s*(-?[\d.]+) LUFS', summary), re.search(r'Peak:\s*(-?inf|-?[\d.]+) dBFS', summary)
    if not lufs or not peak: sys.exit(f'Could not measure the loudness of {path}')
    return float(lufs.group(1)), max(-120.0, float(peak.group(1)))   # a silent track (a template with no voice) reports -inf
def peaks(x):
    """|x| at OVERSAMPLE times the rate (band-limited interpolation), the largest of the channels: an estimate of the true peak at every moment."""
    n = len(x); size = 1 << (n - 1).bit_length(); out = np.zeros(size * OVERSAMPLE, np.float32)
    for c in range(x.shape[1]):
        spec = np.fft.rfft(x[:, c], size); wide = np.zeros(size * OVERSAMPLE // 2 + 1, spec.dtype); wide[:len(spec)] = spec
        out = np.maximum(out, np.abs(np.fft.irfft(wide, size * OVERSAMPLE) * OVERSAMPLE).astype(np.float32))
    return out[:n * OVERSAMPLE]
def read_wav(path, rate):
    with wave.open(str(path)) as w:
        if w.getsampwidth() != 2: sys.exit(f'{path}: expected 16-bit audio')
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32).reshape(-1, w.getnchannels()).mean(1) / 32768; sr = w.getframerate()
    if sr != rate:                                                   # linear resample to the video's rate
        n = int(round(len(x) * rate / sr)); x = np.interp(np.arange(n) * sr / rate, np.arange(len(x)), x).astype(np.float32)
    return x

VOICE_EQ = {'voice': 'highpass=f=80:p=2,equalizer=f=250:t=q:w=1.2:g=-2.5,equalizer=f=3500:t=q:w=1.0:g=2.5,'
                     'highshelf=f=10000:g=1.5,deesser=i=0.25,acompressor=threshold=-20dB:ratio=2:attack=8:release=120:makeup=1'}

def boosts(gains):
    """An ffmpeg volume filter for the storyboard's "voiceGains" [{start, end, db}]: the voice turned up (or down) by
    `db` over that stretch of the video, with 60 ms ramps at both ends. Applied after the loudness normalisation (which
    is measured without it), so the rest of the video keeps exactly its level; the limiter after it catches peaks."""
    terms = [f"({10 ** (float(g['db']) / 20) - 1:.5f})*clip(min(t-{float(g['start']):.3f},{float(g['end']):.3f}-t)/0.06,0,1)"
             for g in gains or [] if float(g.get('db') or 0) and float(g['end']) > float(g['start'])]
    return f"volume='1+{'+'.join(terms)}':eval=frame," if terms else ''

def normalise(source, rate, channels, target, eq=None, gains=None):
    """The voice track loudness-normalised to `target` LUFS (two-pass loudnorm, linear when it can be, TP -1.5),
    after the optional `eq` filter chain (VOICE_EQ), then the optional per-stretch `gains` (boosts())."""
    pre = f'{eq},' if eq else ''
    first = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', source, '-map', '0:a:0', '-af', f'{pre}loudnorm=I={target}:TP={CEILING}:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(first[first.rfind('{'):first.rfind('}') + 1])
    # straight gain to the target, then a fast limiter catches the few peaks it pushes past the ceiling (a linear-only
    # loudnorm stops short of the target when the voice has sharp peaks); a second pass trims any residual error
    gain = target - float(j['input_i'])
    lim = f"alimiter=limit={10 ** ((CEILING - 1.2) / 20):.4f}:attack=1:release=60:level=disabled"
    x = None
    for _ in range(4):
        af = f'{pre}volume={gain:.2f}dB,{lim}'
        probe = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', source, '-map', '0:a:0', '-af', af + ',ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
        got = float(probe[probe.rfind('I:'):].split()[1])
        if abs(got - target) < .2: break
        gain += target - got
        af = f'{pre}volume={gain:.2f}dB,{lim}'
    af = f'{pre}volume={gain:.2f}dB,{boosts(gains)}{lim}'
    x = np.frombuffer(run(['ffmpeg', '-v', 'error', '-i', source, '-map', '0:a:0', '-af', af, '-ar', str(rate), '-ac', str(channels), '-f', 'f32le', '-']).stdout, '<f4').reshape(-1, channels).copy()
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / 'v.wav'
        with wave.open(str(p), 'wb') as w:
            w.setnchannels(channels); w.setsampwidth(2); w.setframerate(rate); w.writeframes(np.clip(np.rint(x * 32767), -32768, 32767).astype('<i2').tobytes())
        lufs, peak = loudness(p)
    print(('Voice EQ applied. ' if eq else '') + f'Voice normalised: {j["input_i"]} -> {lufs} LUFS (target {target}), true peak {peak} dBTP.')
    return x, lufs, peak

def speech(voice, rate):
    """(the speaking level as linear RMS, a 0..1 envelope per sample of Where there is speech: quick attack, ~.25 s release)."""
    hop = int(.05 * rate); mono = voice.mean(1)
    frames = np.sqrt(np.mean(np.pad(mono, (0, -len(mono) % hop)).reshape(-1, hop) ** 2, 1) + 1e-12)
    gate = frames.max() * 10 ** (-30 / 20)
    talking = frames[frames > gate]
    act = (frames > gate).astype(np.float32); env = np.zeros_like(act); a = 0.
    for i, v in enumerate(act): a = max(v, a * .82); env[i] = a
    return (float(np.mean(talking)) if len(talking) else .05), np.repeat(env, hop)[:len(mono)]

def loudest(x, rate):
    """RMS of an effect's loudest 100 ms: how loud it is heard (a peak says little about a click vs a boom)."""
    n = max(1, int(.1 * rate)); c = np.concatenate([[0.], np.cumsum(x.astype(np.float64) ** 2)])
    if len(x) <= n: return float(np.sqrt(c[-1] / max(1, len(x))) + 1e-9)
    return float(np.sqrt(np.max(c[n:] - c[:-n]) / n) + 1e-9)

def lufs_of(x, rate):
    """Integrated loudness (LUFS) of a mono float signal: how loud it sounds, not its raw power (bass counts for little)."""
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / 'x.wav'
        with wave.open(str(p), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(np.clip(np.rint(x * 32767), -32768, 32767).astype('<i2').tobytes())
        return loudness(p)[0]

def music_bed(m, voice, rate, voice_lufs):
    """The music bed, mono, as long as the voice: its loudness (LUFS, as heard) set `gain` LU against the voice's
    loudness, then dipped `duck` dB under the words."""
    path = Path(m['dir']) / f"{m['name']}.mp3"
    if not path.exists(): sys.exit(f'No music file {path}')
    read = lambda frm, secs: np.frombuffer(run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, frm):.3f}', '-i', str(path), '-ac', '1', '-ar', str(rate), '-t', f'{secs + .1:.3f}', '-f', 'f32le', '-']).stdout, '<f4').copy()
    if m.get('parts') or m.get('drops'):
        # The music follows the edit: `parts` [{at, from}] = at this second of the video the track plays from `from` s
        # of the file (a jump to its big section on a reveal, cut on a beat); `drops` [[a, b]] = the music stops (a
        # dropout before a reveal) and comes back at b. Times are video seconds; `offset` is where this render starts.
        vt0, n = float(m.get('offset', 0)), len(voice)
        parts = sorted(m.get('parts') or [{'at': float(m.get('at', 0)), 'from': float(m.get('start', 0))}], key=lambda p: p['at'])
        x = np.zeros(n, np.float32); xf = int(.015 * rate)
        for i, p in enumerate(parts):
            a, b = max(float(p['at']), vt0), (float(parts[i + 1]['at']) if i + 1 < len(parts) else vt0 + n / rate + 1)
            if b <= a: continue
            ia, ib = int((a - vt0) * rate), min(n, int((b - vt0) * rate))
            if ib <= ia: continue
            seg = read(float(p['from']) + a - float(p['at']), (ib - ia) / rate + .05)
            seg = np.pad(seg, (0, max(0, ib - ia + xf - len(seg))))
            if i: seg[:xf] *= np.linspace(0, 1, xf)                              # 15 ms crossfade at the jump
            end = min(n, ib + xf) if i + 1 < len(parts) else ib
            seg = seg[:end - ia].copy()
            if end > ib: seg[ib - ia:] *= np.linspace(1, 0, end - ib)
            x[ia:end] += seg
        fd = int(.04 * rate)
        for a, b in m.get('drops') or []:
            ia, ib = max(0, int((a - vt0) * rate)), min(n, int((b - vt0) * rate))
            if ib <= ia: continue
            x[max(0, ia - fd):ia] *= np.linspace(1, 0, ia - max(0, ia - fd)); x[ia:ib] = 0
    else:
        start = float(m.get('start', 0)) + float(m.get('offset', 0))
        x = read(start, len(voice) / rate)
        if float(m.get('at', 0)) > 0: x = np.concatenate([np.zeros(int(float(m['at']) * rate), np.float32), x])     # `at`: the bed comes in this many seconds into the video
    x = np.pad(x, (0, max(0, len(voice) - len(x))))[:len(voice)]
    _, env = speech(voice, rate)
    m_lufs = lufs_of(x, rate)
    if m_lufs > -70: x *= 10 ** ((voice_lufs + min(MUSIC_MAX, float(m.get('gain', MUSIC_GAIN))) - m_lufs) / 20)
    duck = max(0., float(m.get('duck', MUSIC_DUCK)))
    # `lifts` [{start, end, db, duck?}]: the bed turned up db over a stretch of the video (an upbeat open), and dipped
    # only `duck` dB under the words there; 0.25 s ramps at both ends. Video seconds; `offset` is where this render starts.
    lift, dk = np.zeros(len(x), np.float32), np.full(len(x), duck, np.float32)
    if m.get('lifts'):
        tv = float(m.get('offset', 0)) + np.arange(len(x), dtype=np.float32) / rate
        for L in m['lifts']:
            a, b, r = float(L['start']), float(L['end']), .25
            w = np.clip(np.minimum((tv - a) / r + 1, (b - tv) / r + 1), 0, 1)     # 1 inside [a, b], ramping over r outside it
            lift = np.maximum(lift, w * float(L.get('db', 0)))
            if 'duck' in L: dk = dk * (1 - w) + w * max(0., float(L['duck']))
    x *= 10 ** ((lift - dk * env[:len(x)]) / 20)      # dipped under the words (and lifted where asked)
    fi, fo = int(.08 * rate), int(1.2 * rate)
    x[:fi] *= np.linspace(0, 1, fi); x[-fo:] *= np.linspace(1, 0, min(fo, len(x)))[-len(x[-fo:]):]
    return x.astype(np.float32)

def main():
    source, output, plan = sys.argv[1], sys.argv[2], json.loads(Path(sys.argv[3]).read_text())
    sounds, sfx, music = plan.get('sounds') or [], Path(plan['sfxDir']), plan.get('music')
    if not sounds and not music and plan.get('voiceLufs') is None:
        run(['ffmpeg', '-v', 'error', '-y', '-i', source, '-c', 'copy', '-movflags', '+faststart', output]); print('No sound effects: copied.'); return
    known = {item['id']: item['file'] for item in json.loads((sfx / 'catalog.json').read_text())['items']}
    unknown = sorted({s.get('name') for s in sounds if s.get('name') not in known}, key=str)
    if unknown: sys.exit(f'Unknown sound effect(s): {", ".join(map(str, unknown))}. Options: {", ".join(known)}.')
    probe = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels', '-of', 'json', source]).stdout)['streams']
    if not probe and not sounds and not music:
        run(['ffmpeg', '-v', 'error', '-y', '-i', source, '-c', 'copy', '-movflags', '+faststart', output]); print('No audio: copied.'); return
    if not probe: sys.exit(f'{source} has no audio to mix the sound effects under.')
    rate, channels = int(probe[0]['sample_rate']), int(probe[0]['channels'])
    if plan.get('voiceLufs') is not None:
        voice, voice_lufs, voice_peak = normalise(source, rate, channels, float(plan['voiceLufs']), VOICE_EQ.get(plan.get('voiceEq')) if plan.get('voiceEq') else None, plan.get('voiceGains'))
    else:
        voice = np.frombuffer(run(['ffmpeg', '-v', 'error', '-i', source, '-map', '0:a:0', '-f', 'f32le', '-'], ).stdout, '<f4').reshape(-1, channels).copy()
        voice_lufs, voice_peak = loudness(source)

    cache, placed = {}, []                                            # placed: [first sample, samples, gain dB, sound]
    for s in sounds:
        x = cache.get(s['name'])
        if x is None: x = cache[s['name']] = read_wav(sfx / known[s['name']], rate)
        at = int(round(float(s['at']) * rate))
        if at < 0:                                                    # a section preview: an effect that began before the section is heard from where the section starts
            x, at = x[-at:], 0
            if not len(x): continue
        if at >= len(voice): print(f"Skipped {s['name']} at {s['at']}s: outside the video"); continue
        placed.append([at, x[:len(voice) - at], float(s.get('gain', DEFAULT_GAIN)) + float(s.get('trim', 0)), s])
    v_rms, talking = speech(voice, rate)
    def bus():
        out = np.zeros(len(voice), np.float32)
        for at, x, gain, _ in placed:
            rel = min(SFX_MAX, gain + SFX_OFFSET)                      # dB against the speaking level
            out[at:at + len(x)] += x * (v_rms * 10 ** (rel / 20) / loudest(x, rate))
        return out * 10 ** (-SFX_DUCK * talking / 20)                  # a little softer under the words
    # First, before any encode: where an effect lands on a loud moment of the voice and the sum would pass the
    # ceiling, dip the effects (never the voice) for those few milliseconds, with soft edges.
    effects = bus(); fx_only = effects.copy()
    bed = music_bed(music, voice, rate, voice_lufs) if music else None
    if bed is not None: effects += bed
    limit, duck = 10 ** ((CEILING - ENCODE_MARGIN) / 20), np.ones(len(voice), np.float32)
    half = int(.012 * rate); window = np.hanning(2 * half + 1).astype(np.float32); ducked = 0
    for _ in range(24):
        hot = np.unique(np.flatnonzero(peaks(voice + (effects * duck)[:, None]) > limit) // OVERSAMPLE)
        hot = hot[np.abs(effects[hot]) > 1e-5] if len(hot) else hot  # where the voice alone is over, there is nothing of ours to turn down
        if not len(hot): break
        mark = np.zeros(len(voice), np.float32); mark[hot] = 1
        duck *= 1 - .3 * np.clip(np.convolve(mark, window, 'same'), 0, 1)
    effects *= duck; ducked = round(float(np.count_nonzero(duck < .999)) / rate, 3)

    trim = 0.
    with tempfile.TemporaryDirectory() as tmp:
        mixed = Path(tmp) / 'mix.wav'
        for attempt in range(16):
            total = voice + (effects * 10 ** (trim / 20))[:, None]
            with wave.open(str(mixed), 'wb') as w:                    # 24-bit, so the voice is not requantised before the one encode
                w.setnchannels(channels); w.setsampwidth(3); w.setframerate(rate)
                ints = np.clip(np.rint(total * 8388607), -8388608, 8388607).astype('<i4')
                w.writeframes(ints.view(np.uint8).reshape(-1, 4)[:, :3].tobytes())
            run(['ffmpeg', '-v', 'error', '-y', '-i', source, '-i', str(mixed), '-map', '0:v?', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output])
            mix_lufs, mix_peak = loudness(output)
            # only what the effects and music add counts: a peak that is the voice's own is not fixed by turning them down
            over = max(mix_peak - max(CEILING, voice_peak + .6), mix_lufs - voice_lufs - HEADROOM)
            if over <= 0 or trim <= -36: break
            trim -= max(1., over + .5)
    # the balance, measured against the speaking level: music in the gaps and under the words, the loudest effect
    db = lambda v: round(20 * np.log10(max(v, 1e-9) / v_rms), 1)
    g = 10 ** (trim / 20); levels = {}
    if bed is not None:
        b = bed * duck * g; on = talking > .5
        levels['musicUnderWords'] = db(float(np.sqrt(np.mean(b[on] ** 2)))) if on.any() else None
        levels['musicInGaps'] = db(float(np.sqrt(np.mean(b[~on] ** 2)))) if (~on).any() else None
        levels['musicLoudnessLU'] = round(lufs_of(b, rate) - voice_lufs, 1)       # as heard, against the voice
    if placed: levels['loudestEffect'] = db(loudest(fx_only * duck * g, rate))
    note = ''
    if mix_peak > CEILING: note = f' The voice alone peaks at {voice_peak} dBTP in the source, so the ceiling of {CEILING} dBTP cannot be met by turning the effects down; the voice was left alone.'
    report = {'voiceLufs': voice_lufs, 'voiceTruePeak': voice_peak, 'mixLufs': mix_lufs, 'truePeak': mix_peak, 'busTrim': round(trim, 2), 'sounds': len(placed),
              'duckedSeconds': ducked, 'levelsVsVoice': levels, 'note': note.strip()}
    if plan.get('report'): Path(plan['report']).write_text(json.dumps(report, indent=1) + '\n')
    print((f"Music bed '{music['name']}'. " if music else '') + f'Mixed {len(placed)} sound effect(s): voice {voice_lufs} LUFS / {voice_peak} dBTP -> mix {mix_lufs} LUFS / {mix_peak} dBTP'
          + (f', effects dipped for {ducked}s in total where they met a peak of the voice' if ducked else '') + (f', all effects turned down {-trim:.1f} dB' if trim else '') + '.' + note)
    if levels: print('Levels vs the voice: ' + ', '.join(f'{k} {v:+} dB' for k, v in levels.items() if v is not None) + '.')

if __name__ == '__main__': main()

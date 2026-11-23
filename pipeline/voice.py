"""Stage 1b: narrate a storyboard with the free local Kokoro voice.
Writes projects/<name>/voice/<shot>.wav and voice/voice.json (durations + word timings).
Run through `npm run voice <project>`; no network or paid call is made.
"""
import json, sys
from pathlib import Path
import numpy as np
import soundfile as sf
import onnxruntime as ort
from kokoro_onnx import Kokoro
from phonemizer import phonemize

project, models = Path(sys.argv[1]), Path(sys.argv[2])
storyboard = json.loads((project / 'storyboard.json').read_text())
settings = {'provider': 'kokoro', 'voice': 'af_maple', 'speed': 1.0, **storyboard.get('voice', {})}
if settings['provider'] != 'kokoro':
    sys.exit(f"Only the local 'kokoro' voice is wired into the pipeline so far (storyboard asks for '{settings['provider']}').")
out = project / 'voice'; out.mkdir(exist_ok=True)
index_file = out / 'voice.json'
previous = json.loads(index_file.read_text()) if index_file.exists() else {}
same_voice = all(previous.get(k) == settings[k] for k in ('provider', 'voice', 'speed'))

options = ort.SessionOptions(); options.intra_op_num_threads = 4
session = ort.InferenceSession(str(models / 'kokoro-v1.1-zh.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
kokoro = Kokoro.from_session(session, str(models / 'voices-v1.1-zh.bin'), vocab_config=str(models / 'config.json'))

def spread(tokens, duration):
    """Fallback timing: share the real duration between words by letter count."""
    weights = [len(t) + 2 for t in tokens]; total = sum(weights); at = 0.0; words = []
    for token, weight in zip(tokens, weights):
        end = at + duration * weight / total; words.append({'text': token, 'start': round(at, 3), 'end': round(end, 3)}); at = end
    return words

shots = {}
for shot in storyboard['shots']:
    text = (shot.get('narration') or '').strip()
    if not text: continue
    old = previous.get('shots', {}).get(shot['id'])
    if same_voice and old and old['text'] == text and (out / old['file']).exists():
        shots[shot['id']] = old; print(f"  {shot['id']}: unchanged, kept"); continue
    raw = phonemize(text, language='en-us', preserve_punctuation=True, with_stress=True).strip()
    phones = raw.replace('ɚ', 'əɹ').replace('ɝ', 'ɜːɹ').replace('ɐ', 'ə').replace('ɬ', 'l')
    phones = ''.join(c for c in phones if c in kokoro.tokenizer.vocab)
    audio, rate, timings = kokoro.create_timed(phones, voice=settings['voice'], speed=settings['speed'], lang='en-us', is_phonemes=True, sentence_pause=.12, clause_pause=.05)
    duration = len(audio) / rate
    # Group phoneme timings into words at the spaces the model actually spoke.
    words, group = [], []
    for t in [*timings, None]:
        if t is not None and t.phoneme != ' ': group.append(t); continue
        spoken = [p for p in group if p.phoneme not in '.,!?;:…']
        if spoken: words.append({'start': round(float(spoken[0].start), 3), 'end': round(float(spoken[-1].end), 3)})
        group = []
    tokens = text.split()
    if len(words) == len(tokens):
        for word, token in zip(words, tokens): word['text'] = token
        timing = 'model'
    else:
        words, timing = spread(tokens, duration), 'spread'
    file = f"{shot['id']}.wav"
    sf.write(out / file, audio, rate, subtype='PCM_16')
    shots[shot['id']] = {'text': text, 'file': file, 'duration': round(duration, 3), 'timing': timing, 'words': words}
    print(f"  {shot['id']}: {duration:.2f}s, {len(words)} words ({timing} timing)", flush=True)

index_file.write_text(json.dumps({**settings, 'shots': shots}, indent=2) + '\n')
print(f"Narrated {len(shots)} shots with Kokoro {settings['voice']} -> {out.name}/")

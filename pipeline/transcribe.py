"""Word-level transcript of a recording, made locally with faster-whisper (nothing leaves this machine).
  python pipeline/transcribe.py <video or audio> <words.json> <models dir> [--model small.en] [--clean]
Writes {"source", "transcriber", "duration", "words": [{"text", "start", "end"}]}, times in seconds.
The model is read from <models dir>/faster-whisper-<model>; if it is not there, faster-whisper
downloads it into <models dir> once. By default the transcript is VERBATIM: Whisper is nudged to
write down fillers and restarts (um, uh, repeated words) so the clean-up edit can find and cut them.
--clean turns that off. Word times are the recogniser's estimates, good to a few hundredths of a second.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

args = [a for a in sys.argv[1:] if not a.startswith('--')]
if len(args) < 3: sys.exit(__doc__)
source, output, models = args[0], args[1], Path(args[2])
name = sys.argv[sys.argv.index('--model') + 1] if '--model' in sys.argv else 'small.en'
local = models / f'faster-whisper-{name}'
if (local / 'model.bin').exists(): model = WhisperModel(str(local), device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
else:
    print(f'Downloading the {name} speech model into {models} (once)…')
    model = WhisperModel(name, device='cpu', compute_type='int8', cpu_threads=4, download_root=str(models))
# A prompt written the way the speech should be transcribed keeps the hesitations in.
verbatim = None if '--clean' in sys.argv else 'Um, uh, so, like, you know, I, I mean, uh, okay.'
# Decode with FFmpeg so word times are clip times: a recording's audio track often starts a little after its
# picture (0.13 s on a phone), and first_pts=0 pads that gap instead of silently dropping it.
decoded = subprocess.run(['ffmpeg', '-v', 'error', '-i', source, '-vn', '-ac', '1', '-ar', '16000', '-af', 'aresample=async=1:first_pts=0', '-f', 'f32le', '-'], capture_output=True)
if decoded.returncode != 0 or not decoded.stdout: sys.exit('Could not read the audio of ' + source + '\n' + decoded.stderr.decode()[-500:])
segments, info = model.transcribe(np.frombuffer(decoded.stdout, dtype=np.float32), language='en' if name.endswith('.en') else None, word_timestamps=True, vad_filter=True,
                                  condition_on_previous_text=False, beam_size=5, initial_prompt=verbatim)
words = []
for segment in segments:
    for word in segment.words or []:
        text = word.word.strip()
        if text and word.end > word.start: words.append({'text': text, 'start': round(float(word.start), 3), 'end': round(float(word.end), 3)})
Path(output).write_text(json.dumps({'source': Path(source).name, 'transcriber': f'faster-whisper {name} (local)', 'duration': round(float(info.duration), 3), 'words': words}, indent=1) + '\n')
print(f'Transcribed {len(words)} words locally -> {output}')

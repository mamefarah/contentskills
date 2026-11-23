"""Stage 1b (paid): narrate a storyboard with an ElevenLabs voice. Spends ElevenLabs credits.
Writes projects/<name>/voice/<shot>.wav and voice/voice.json (durations + word timings), like voice.py.

  python voice_elevenlabs.py <project dir>            narrate (only new or changed lines are paid for)
  python voice_elevenlabs.py --list                   list the voices on the account (free)

Storyboard: "voice": {"provider": "elevenlabs", "voice": "<voice id>", "speed": 1.3, "model": "eleven_multilingual_v2",
                      "stability": 0.45, "similarity": 0.8, "style": 0.2}
"speed" is applied afterwards with ffmpeg atempo (pitch kept), so any speed works; word timings are scaled to match.
Key: ELEVENLABS_API_KEY in the environment, or in .env.local at the repository root (ELEVENLABS_API_KEY=...). It is never printed.
"""
import base64, json, os, subprocess, sys, tempfile, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = 'https://api.elevenlabs.io/v1'


def api_key():
    if os.environ.get('ELEVENLABS_API_KEY'): return os.environ['ELEVENLABS_API_KEY'].strip()
    env = ROOT / '.env.local'
    if env.exists():
        for line in env.read_text().splitlines():
            k, _, v = line.partition('=')
            if k.strip().removeprefix('export ').strip() == 'ELEVENLABS_API_KEY': return v.strip().strip('"\'')
    sys.exit('No ElevenLabs key: set ELEVENLABS_API_KEY or add ELEVENLABS_API_KEY=... to .env.local')


def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'xi-api-key': api_key(), 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as refused:
        sys.exit(f'ElevenLabs {refused.code}: {refused.read().decode(errors="replace")[:300]}')


def list_voices():
    for v in call('/voices').get('voices', []):
        print(f"{v['voice_id']}  {v.get('category', ''):10s}  {v['name']}")


def words_from_alignment(al):
    chars, st, en = al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']
    words, cur, s0, e0 = [], '', None, None
    for c, a, b in zip(chars, st, en):
        if c.isspace():
            if cur: words.append({'text': cur, 'start': s0, 'end': e0}); cur = ''
            continue
        if not cur: s0 = a
        cur += c; e0 = b
    if cur: words.append({'text': cur, 'start': s0, 'end': e0})
    return words


def main():
    if '--list' in sys.argv: return list_voices()
    project = Path(sys.argv[1])
    storyboard = json.loads((project / 'storyboard.json').read_text())
    s = {'provider': 'elevenlabs', 'speed': 1.0, 'model': 'eleven_multilingual_v2', 'stability': 0.45, 'similarity': 0.8, 'style': 0.2,
         **storyboard.get('voice', {})}
    if not s.get('voice'): sys.exit('storyboard "voice" needs "voice": "<ElevenLabs voice id>" (python pipeline/voice_elevenlabs.py --list)')
    out = project / 'voice'; out.mkdir(exist_ok=True)
    index_file = out / 'voice.json'
    previous = json.loads(index_file.read_text()) if index_file.exists() else {}
    keys = ('provider', 'voice', 'model', 'stability', 'similarity', 'style')
    same_voice = all(previous.get(k) == s.get(k) for k in keys)
    speed = float(s['speed'])
    shots, paid = {}, 0
    for shot in storyboard['shots']:
        text = (shot.get('narration') or '').strip()
        if not text: continue
        raw = out / f"{shot['id']}.raw.json"
        old = json.loads(raw.read_text()) if raw.exists() else None
        if not (same_voice and old and old.get('text') == text):
            body = {'text': text, 'model_id': s['model'],
                    'voice_settings': {'stability': s['stability'], 'similarity_boost': s['similarity'], 'style': s['style'], 'use_speaker_boost': True}}
            r = call(f"/text-to-speech/{s['voice']}/with-timestamps?output_format=mp3_44100_192", body)
            old = {'text': text, 'audio': r['audio_base64'], 'words': words_from_alignment(r.get('alignment') or r['normalized_alignment'])}
            raw.write_text(json.dumps(old)); paid += len(text)
        # speed up (pitch kept), trim leading/trailing silence lightly, write wav
        file = f"{shot['id']}.wav"
        with tempfile.NamedTemporaryFile(suffix='.mp3') as tmp:
            tmp.write(base64.b64decode(old['audio'])); tmp.flush()
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp.name, '-af', f'atempo={speed}', '-ar', '44100', '-ac', '1', str(out / file)], check=True)
        duration = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(out / file)],
                                        capture_output=True, text=True).stdout)
        tokens = text.split()
        words = [{'text': w['text'], 'start': round(w['start'] / speed, 3), 'end': round(w['end'] / speed, 3)} for w in old['words']]
        if len(words) == len(tokens):
            for w, t in zip(words, tokens): w['text'] = t
        shots[shot['id']] = {'text': text, 'file': file, 'duration': round(duration, 3), 'timing': 'model', 'words': words}
        print(f"  {shot['id']}: {duration:.2f}s, {len(words)} words", flush=True)
    index_file.write_text(json.dumps({**s, 'shots': shots}, indent=2) + '\n')
    print(f"Narrated {len(shots)} shots with ElevenLabs at x{speed} -> {out.name}/  ({paid} characters billed this run)")


if __name__ == '__main__':
    main()

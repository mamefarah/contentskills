#!/usr/bin/env python3
"""Measure a video's pacing, so a reference and our cut can be compared in numbers, not by feel.

  npm run pace -- <video.mp4> [words.json]      (no words.json: the audio is transcribed first, locally)

Prints: words per second (overall and while talking), pauses, first word, how often the picture changes (visual hits:
peaks of frame-to-frame change, at least 0.15 s apart), the share of frames in motion, and the longest still stretch.
Rule of thumb from the user's references: a hit about every 1-1.5 s, nothing still for more than about 1 s, voice
from frame 0. Compare the reference's numbers with a section render of ours before sending a storyboard.
"""
import json, os, subprocess, sys, tempfile
import numpy as np

def words_of(video, words):
    if not words:
        tmp = tempfile.mkdtemp(); wav = os.path.join(tmp, 'a.wav'); words = os.path.join(tmp, 'words.json')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-ac', '1', '-ar', '16000', wav], check=True)
        subprocess.run(['node', os.path.join(os.path.dirname(__file__), 'transcribe.mjs'), wav, words], check=True, capture_output=True)
    W = json.load(open(words))
    return W['words'] if isinstance(W, dict) else W

def main(video, words=None):
    W = words_of(video, words)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], capture_output=True, text=True).stdout)
    if W:
        span = W[-1]['end'] - W[0]['start']; gaps = [b['start'] - a['end'] for a, b in zip(W, W[1:])] or [0]
        print(f'{dur:.1f}s, {len(W)} words: {len(W)/dur:.2f} words/s overall, {len(W)/span:.2f} while talking; first word at {W[0]["start"]:.2f}s')
        print(f'pauses over 0.25s: {sum(g > .25 for g in gaps)} ({sum(g for g in gaps if g > .25):.1f}s in all, longest {max(gaps):.2f}s)')
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', 'fps=30,scale=54:96,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, 96, 54).astype(np.float32)
    d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    thr = max(2.0, np.percentile(d, 80)); hits = []
    for i in range(1, len(d) - 1):
        if d[i] >= thr and d[i] >= d[i - 1] and d[i] >= d[i + 1] and (not hits or i - hits[-1] >= 5): hits.append(i)
    still, run = [], 0
    for x in list(d) + [99]:
        if x < .3: run += 1
        else:
            if run: still.append(run / 30)
            run = 0
    gap = np.median(np.diff(hits)) / 30 if len(hits) > 1 else 0
    print(f'visual hits: {len(hits)} ({len(hits)/dur:.2f}/s, median {gap:.2f}s apart); frames in motion {(d > .6).mean()*100:.0f}%')
    print(f'still stretches over 0.5s: {sum(s > .5 for s in still)}, longest {max(still + [0]):.2f}s')

if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__)
    main(*sys.argv[1:3])

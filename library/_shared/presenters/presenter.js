// A presenter character that narrates the whole video: it stands at the bottom of the frame, idles (blinks, arm
// swings, cap wobble: the body Lottie on the clock), bobs, and talks: its mouth Lottie is set every frame from the
// loudness of the narration at that moment, with a little squash on loud syllables.
// Everything is a pure function of t, so the review player and the frame renderer agree frame for frame.
//
// storyboard.presenter = {name: 'mushroom', x: 840, height: 700, bottom: -40, room: .8}
//   name    a folder here with body.json + mouth.json (generate.mjs writes them)
//   x       centre of the character, px from the left of a 1080 frame (default 820: bottom right, clear of most content)
//   height  px tall (default 560); bottom: px from the frame's bottom edge (negative = feet below it, default -40)
//   room    the player scales each shot's picture by this (default .8, from the top centre) so the graphics sit above
//           the character instead of under it; captions are not scaled

const RATE = 60;                                     // mouth envelope samples per second

async function lottieRuntime() {
  if (window.lottie) return window.lottie;
  await new Promise((ok, fail) => { const s = document.createElement('script'); s.src = '/library/_shared/vendor/lottie-5.12.2.min.js'; s.onload = ok; s.onerror = fail; document.head.append(s); });
  return window.lottie;
}

/**
 * The mouth track over the whole video at RATE per second: {open: 0..1, round: 0|1}.
 * - loudness from each shot's narration clip (RMS per 1/60 s, against that clip's loud syllables);
 * - gated by the transcript's word times, so it only moves on words (no flapping on breaths or room tone), and it
 *   shuts in the gaps between words;
 * - LEAD s early, as animators do: the mouth shape reads a frame before the sound arrives;
 * - quick to open, quick to close, so syllables read separately;
 * - round ("o", "oo", "w") vs wide: a low zero-crossing rate with energy means a dark, rounded vowel.
 */
const LEAD = .04;
async function mouthTrack(project, shots, words, duration) {
  const n = Math.ceil(duration * RATE) + 2, open = new Float32Array(n), zcr = new Float32Array(n), gate = new Float32Array(n);
  for (const w of words ?? []) for (let k = Math.max(0, Math.floor((w.start - .05) * RATE)); k <= Math.min(n - 1, Math.ceil((w.end + .02) * RATE)); k++) gate[k] = 1;
  const decoder = new OfflineAudioContext(1, 1, 44100);
  for (const shot of shots) {
    if (!shot.audio?.file) continue;
    let buf;
    try { buf = await decoder.decodeAudioData(await (await fetch(`/projects/${project}/voice/${shot.audio.file}`)).arrayBuffer()); } catch { continue; }
    const d = buf.getChannelData(0), hop = Math.round(buf.sampleRate / RATE), rms = [], zc = [];
    for (let i = 0; i + hop <= d.length; i += hop) {
      let e = 0, c = 0; for (let j = i; j < i + hop; j++) { e += d[j] * d[j]; if (j > i && (d[j] >= 0) !== (d[j - 1] >= 0)) c++; }
      rms.push(Math.sqrt(e / hop)); zc.push(c / hop);
    }
    const loud = [...rms].sort((a, b) => a - b)[Math.floor(rms.length * .95)] || 1;
    const start = Math.round((shot.audio.at - LEAD) * RATE);
    rms.forEach((v, k) => {
      const at = start + k; if (at < 0 || at >= n) return;
      const db = 20 * Math.log10(v / loud + 1e-9);                       // 0 at the loud syllables
      const o = Math.max(0, Math.min(1, (db + 22) / 18));
      const eased = o * o * (3 - 2 * o);                                 // smoothstep: crisp closed / open
      if (eased > open[at]) { open[at] = eased; zcr[at] = zc[k]; }
    });
  }
  // gate by words (allow LEAD of slack), then shape: open fast, close fast (about 50 ms to half)
  for (let k = 0; k < n; k++) if (!gate[Math.min(n - 1, k + Math.round(LEAD * RATE))]) open[k] = 0;
  for (let k = 1; k < n; k++) open[k] = Math.max(open[k], open[k - 1] * .62);
  // round vs wide: low zero-crossing rate while open (a dark vowel), held for at least 4 samples so it doesn't flicker
  const voiced = [...zcr].filter((z, k) => open[k] > .4 && z > 0).sort((a, b) => a - b), cut = voiced[Math.floor(voiced.length * .28)] ?? 0;
  const round = new Uint8Array(n); let hold = 0, cur = 0;
  for (let k = 0; k < n; k++) {
    const want = open[k] > .4 && zcr[k] > 0 && zcr[k] < cut ? 1 : 0;
    if (want !== cur && hold <= 0) { cur = want; hold = 4; } else hold--;
    round[k] = cur;
  }
  return {open, round};
}

export async function mountPresenter(host, spec, {project, shots, words, duration, width = 1080, height: frameH = 1920}) {
  const lottie = await lottieRuntime();
  const name = spec.name ?? 'mushroom', base = `/library/_shared/presenters/${name}`;
  const [bodyData, mouthData] = await Promise.all(['body', 'mouth'].map(part => fetch(`${base}/${part}.json`).then(r => { if (!r.ok) throw Error(`No presenter "${name}"`); return r.json(); })));
  const tall = spec.height ?? 560, wide = tall * bodyData.w / bodyData.h, x = spec.x ?? 840, bottom = spec.bottom ?? -40;
  const box = host.ownerDocument.createElement('div');
  Object.assign(box.style, {position: 'absolute', left: `${x - wide / 2}px`, top: `${frameH - bottom - tall}px`, width: `${wide}px`, height: `${tall}px`, transformOrigin: '50% 100%', pointerEvents: 'none', filter: 'drop-shadow(0 18px 30px rgba(0,0,0,.45))'});
  const layers = ['body', 'mouth'].map(() => { const d = document.createElement('div'); Object.assign(d.style, {position: 'absolute', inset: '0'}); box.append(d); return d; });
  host.append(box);
  const body = lottie.loadAnimation({container: layers[0], renderer: 'svg', loop: false, autoplay: false, animationData: bodyData});
  const mouth = lottie.loadAnimation({container: layers[1], renderer: 'svg', loop: false, autoplay: false, animationData: mouthData});
  const track = await mouthTrack(project, shots, words, duration), env = track.open, bodyFrames = bodyData.op - bodyData.ip, M = mouthData.meta?.mouthFrames ?? 20;
  return {
    seek(t) {
      const k = Math.max(0, Math.min(env.length - 1, t * RATE)), i = Math.floor(k), f = k - i;
      const open = env[i] * (1 - f) + (env[Math.min(i + 1, env.length - 1)] ?? 0) * f;
      body.goToAndStop((t * bodyData.fr) % bodyFrames, true);
      mouth.goToAndStop((track.round[i] ? M + 1 : 0) + open * M, true);        // wide shape on frames 0..M, round on M+1..2M+1
      const pop = t < .45 ? 1 - Math.pow(1 - t / .45, 3) * (1 - .55) : 1;            // springs up at the start
      const bob = Math.sin(t * Math.PI * 2 * .8) * 6, sway = Math.sin(t * Math.PI * 2 * .4) * 1.6;
      box.style.transform = `translateY(${bob.toFixed(2)}px) rotate(${sway.toFixed(2)}deg) scale(${(pop * (1 - .025 * open)).toFixed(4)}, ${(pop * (1 + .045 * open)).toFixed(4)})`;
    },
    dispose() { body.destroy(); mouth.destroy(); box.remove(); },
  };
}

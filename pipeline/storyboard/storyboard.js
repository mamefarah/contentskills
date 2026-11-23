// The storyboard page: the animatic. Before any money is spent or anything is rendered, the user sees the user's video as a
// comic strip of scenes next to a phone-size preview that plays right away, says 👍 or "change this" per scene, and
// presses one button to make the video. Written for people who know nothing about video tools: plain words, one next step.
//   /pipeline/storyboard/                    every project, with where it is
//   /pipeline/storyboard/?project=<name>     one video
// Stages (the steps in the header): story (the scenes and their words exist), pictures (every scene has its picture and
// a still in out/review/), preview (narration exists: free draft voice or their own), your video (out/cut.mp4).
// The picture is the rough-draft player (/pipeline/draft/?render=1, the same frames the final video is drawn from).
// Feedback is stored as review marks with "stage": "storyboard" in projects/<name>/review.json:
//   a change request  kind "change", status "open"   → `npm run review <name>` lists it for Claude Code
//   a 👍               kind "keep",   status "done"   → ref "fp:<scene fingerprint>", so a 👍 on an older version shows as stale
// "Make my video" is refused while change requests are open; it records the approval and runs `node pipeline/make.mjs`.
import {buildTimeline, pickOf} from '/pipeline/timeline.js';
import {settings} from '/library/_shared/settings.js';

// The house mix, from the user's settings (audio.*): the same numbers pipeline/sounds.py mixes the made video with.
const AUDIO = settings.audio ?? {}, FX = {gain: -14, offset: 6, max: -4, duck: 4, ...AUDIO.effects}, MUSIC = {gain: -15, max: -10, duck: 6, ...AUDIO.music};
const VOICE_LUFS = AUDIO.voiceLufs ?? -14;

const params = new URLSearchParams(location.search), project = params.get('project');
const $ = id => document.getElementById(id);
const h = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v); else if (k === 'class') node.className = v; else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter(c => c != null && c !== false));
  return node;
};
const secs = t => t.toFixed(1);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
/** A short fingerprint of a scene's content, to notice that Claude changed it. */
const fingerprint = value => { let x = 5381; for (const ch of JSON.stringify(value ?? '')) x = (x * 33 + ch.charCodeAt(0)) >>> 0; return x.toString(36); };
const store = {get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }};
let toastTimer;
function toast(text, bad = false) { const t = $('toast'); t.textContent = text; t.className = bad ? 'bad' : ''; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200); }
async function send(method, url, body) {
  const r = await fetch(url, {method, headers: {'content-type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(data.error || r.statusText);
  return data;
}

if (!project) await listing(); else await board();

// ---------------------------------------------------------------- every project
async function listing() {
  $('list').hidden = false;
  const projects = (await (await fetch('/api/projects')).json()).filter(p => !p.error);
  const states = await Promise.all(projects.map(p => fetch(`/api/projects/${p.name}/storyboard`).then(r => r.json()).catch(() => null)));
  $('list').append(h('div', {class: 'intro'}, h('h2', {}, 'Your videos'), h('p', {}, 'Open one to watch a free preview, say what you like and what to change, then make the video.')),
    h('div', {class: 'grid'}, projects.map((p, i) => {
      const s = states[i], label = s?.make?.running ? ['run', 'Making…'] : s?.notes ? ['todo', `${plural(s.notes, 'change')} asked`] : s?.video ? ['ok', 'Video made'] : s?.approval.approved ? ['ok', 'Approved'] : ['wait', 'Ready to check'];
      return h('a', {class: 'card-link', href: `?project=${p.name}`}, h('b', {}, p.title || p.name), h('span', {class: 'meta'}, p.footage ? `talking video · ${Math.round(p.duration)} s` : plural(p.shots, 'scene')), h('span', {class: `pill ${label[0]}`}, label[1]));
    })));
}

// ---------------------------------------------------------------- one video
async function board() {
  const api = `/api/projects/${project}/`;
  const storyboard = await (await fetch(`/projects/${project}/storyboard.json`, {cache: 'no-store'})).json();
  const voice = await fetch(`/projects/${project}/voice/voice.json`, {cache: 'no-store'}).then(r => (r.ok ? r.json() : null)).catch(() => null);
  document.title = `${storyboard.title || project} · Storyboard`;
  $('title').textContent = storyboard.title || project;
  $('draft-link').href = `/pipeline/draft/?project=${project}`; $('review-link').href = `/pipeline/review/?project=${project}`;
  for (const id of ['links', 'board', 'actions', 'steps']) $(id).hidden = false;

  // ----- scenes: shots for a faceless video; sections for a talking video (one recorded clip, graphics along it)
  let scenes, duration, audio = [], sfx = [], bed = null; const mix = {};
  const has = async url => (await fetch(url, {method: 'HEAD', cache: 'no-store'}).catch(() => null))?.ok ?? false;
  if (storyboard.footage) {
    const {sectionsOf} = await import('/pipeline/sections.js');
    duration = storyboard.footage.duration;
    const said = await fetch(`/projects/${project}/words.json`, {cache: 'no-store'}).then(r => (r.ok ? r.json() : [])).catch(() => []);
    const words = Array.isArray(said) ? said : said.words ?? [];
    scenes = sectionsOf(storyboard, {words}).map((s, i) => ({id: s.id, n: i + 1, start: s.start, end: s.end, edit: s.derived ? '' : s.title,
      still: `/projects/${project}/out/review/${String(i + 1).padStart(2, '0')}-${s.id}.jpg`, stripSrc: `/projects/${project}/out/review/${String(i + 1).padStart(2, '0')}-${s.id}-strip.jpg`, clip: `/projects/${project}/out/sections/${s.id}.mp4`, line: words.filter(w => w.start >= s.start - .05 && w.start < s.end).map(w => w.text ?? w.word).join(' ') || s.title,
      fp: fingerprint([s.start, s.end, (storyboard.overlays ?? []).filter(o => o.start < s.end && o.end > s.start), (storyboard.effects ?? []).filter(e => e.at < s.end && e.at + (e.seconds ?? 0) > s.start)]), ready: true, pick: 0}));
    await Promise.all(scenes.map(async s => { [s.hasStill, s.hasClip, s.hasStrip] = await Promise.all([has(s.still), has(s.clip), has(s.stripSrc)]); }));
  } else {
    const timeline = buildTimeline(storyboard, 'usable', voice, {});
    duration = timeline.duration;
    const byId = Object.fromEntries(storyboard.shots.map(s => [s.id, s]));
    scenes = storyboard.shots.map((shot, i) => {
      const t = timeline.shots.find(x => x.id === shot.id), pick = pickOf(shot);
      return {id: shot.id, n: i + 1, start: t?.start ?? 0, end: t?.end ?? 0, inCut: Boolean(t), line: shot.narration ?? shot.title ?? '', pick,
        still: `/projects/${project}/out/review/${String(i + 1).padStart(2, '0')}-${shot.id}.jpg`, fp: fingerprint([shot.narration, shot.candidates[pick], shot.duration, shot.emphasis]), ready: pick >= 0};
    });
    await Promise.all(scenes.map(async s => { s.hasStill = s.ready && await has(s.still); }));
    // sound effects, so the preview sounds like the video: one decoded buffer per effect, fired as the playhead passes it
    const ctx = window.AudioContext ? new AudioContext() : null, buffers = {};
    sfx = ctx ? (timeline.sounds ?? []).map(x => ({...x})) : [];
    sfx.ctx = ctx;
    // The house mix, as in the made video (pipeline/sounds.py, numbers from settings audio.*): the voice raised to a fixed
    // speaking level, the music MUSIC.gain dB under it in the gaps and MUSIC.duck dB lower under the words, each effect
    // `gain + FX.offset` dB under the voice (never above FX.max) and FX.duck dB softer during speech; a limiter on the
    // master. Levels are measured from the decoded audio.
    if (ctx) {
      mix.limiter = Object.assign(ctx.createDynamicsCompressor(), {}); const L = mix.limiter;
      L.threshold.value = -3; L.knee.value = 0; L.ratio.value = 20; L.attack.value = .002; L.release.value = .1; L.connect(ctx.destination);
      mix.voice = ctx.createGain(); mix.voice.connect(L); mix.music = ctx.createGain(); mix.music.gain.value = 0; mix.music.connect(L);
    }
    for (const name of new Set(sfx.map(x => x.name))) buffers[name] = fetch(`/library/_shared/sfx/${name}.wav`).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).catch(() => null);
    sfx.buffers = buffers;
    // music bed: its level is set by the house mix below
    bed = timeline.music ? Object.assign(new Audio(`/library/_shared/music/${timeline.music.name}.mp3`), {volume: Math.min(1, .55 * Math.pow(10, (timeline.music.gain ?? -12) / 20 + .25)), preload: 'auto', startAt: timeline.music.start ?? 0}) : null;
    audio = timeline.shots.filter(t => t.audio && byId[t.id]).map(t => ({at: t.audio.at, duration: t.audio.duration, el: new Audio(`/projects/${project}/voice/${t.audio.file}`)}));
    if (ctx) {
      for (const a of audio) ctx.createMediaElementSource(a.el).connect(mix.voice);
      if (bed) { ctx.createMediaElementSource(bed).connect(mix.music); bed.volume = 1; }
      mix.ready = levels(ctx, project, timeline, audio).then(l => { Object.assign(mix, l); mix.voice.gain.value = l.voiceGain; }).catch(e => console.warn('mix levels', e));
    }
  }
  const pictures = scenes.every(s => s.ready), spoken = storyboard.footage || Boolean(voice);

  // ----- which voice the preview uses, in plain words
  const want = storyboard.voice?.provider ?? 'kokoro', have = voice?.provider;
  const ownVoice = have === 'elevenlabs' || have === 'recorded';
  $('voice').replaceChildren(storyboard.footage ? h('span', {class: 'tag own'}, '● Your recording') : !voice ? h('span', {class: 'tag'}, 'No voice yet · timing is estimated')
    : ownVoice ? h('span', {class: 'tag own'}, '● Your voice') : h('span', {class: 'tag'}, '● Draft voice (free)', want === 'elevenlabs' ? h('em', {}, ' · your voice is added when you make the video') : null));

  // ----- the live picture
  const frame = $('player');
  frame.src = `/pipeline/draft/?project=${project}&render=1&cut=usable${storyboard.footage ? '&embed=1' : ''}`;   // embed: talking videos show the clip too
  let draft = null, time = Math.min(1.2, scenes[0]?.end || 0), playing = false, last = 0, shown = null;      // a moment with something on screen, not the empty first frame
  const ready = new Promise(ok => { const poll = () => (frame.contentWindow?.__ready && frame.contentWindow.draft ? ok(frame.contentWindow.draft) : setTimeout(poll, 100)); frame.addEventListener('load', poll); });
  const fit = () => { const box = $('screen').getBoundingClientRect(); frame.style.transform = `scale(${box.width / 1080})`; };
  new ResizeObserver(fit).observe($('screen')); fit();
  async function fire(from, to) {
    for (const x of sfx) if (x.at > from && x.at <= to) {
      const buf = await sfx.buffers[x.name]; if (!buf) continue;
      const src = sfx.ctx.createBufferSource(), g = sfx.ctx.createGain();
      const rel = Math.min(FX.max, (x.gain ?? FX.gain) + (x.trim ?? 0) + FX.offset) - (talking(x.at) ? FX.duck : 0);
      g.gain.value = (mix.target ?? .12) * Math.pow(10, rel / 20) / loudest(buf);
      src.buffer = buf; src.connect(g).connect(mix.limiter ?? sfx.ctx.destination); src.start();
    }
  }
  const talking = t => { const k = Math.floor(t / .05); return Boolean(mix.speech?.[k]); };
  function seek(t) {
    const before = time;
    if (mix.music && mix.musicBase) {                           // music dips under the words (quick attack, slow release)
      const on = talking(t), want = mix.musicBase * (on ? Math.pow(10, -MUSIC.duck / 20) : 1);
      mix.music.gain.setTargetAtTime(want, sfx.ctx.currentTime, on ? .03 : .12);
    }
    time = Math.max(0, Math.min(duration, t));
    if (playing && time > before && time - before < .5) fire(before, time);
    draft?.seek(time);
    $('scrub').max = String(duration); $('scrub').value = String(time);
    $('time').textContent = `${secs(time)} / ${secs(duration)} s`;
    const on = scenes.find(s => s.inCut !== false && time >= s.start && time < s.end) ?? scenes.filter(s => s.inCut !== false).at(-1);
    for (const li of document.querySelectorAll('li.scene[data-scene]')) li.classList.toggle('current', li.dataset.scene === on?.id);
    for (const seg of $('strip').querySelectorAll('b')) seg.classList.toggle('current', seg.dataset.id === on?.id);
    $('head').style.left = `${duration ? time / duration * 100 : 0}%`;
    if (on && on.id !== shown) {                                    // a new scene on screen: bring its panel into view while playing
      shown = on.id;
      const typing = /TEXTAREA|INPUT/.test(document.activeElement?.tagName) && document.activeElement.id !== 'scrub';
      if (playing && !typing) document.querySelector(`li.scene[data-scene="${on.id}"]`)?.scrollIntoView({block: 'center', behavior: 'smooth'});
    }
    for (const a of audio) {
      const at = time - a.at, due = playing && at >= 0 && at < a.duration;
      if (!due) { if (!a.el.paused) a.el.pause(); continue; }
      if (a.el.paused || Math.abs(a.el.currentTime - at) > .25) { a.el.currentTime = at; a.el.play().catch(() => {}); }
    }
  }
  const loop = now => { if (!playing) return; seek(time + (now - last) / 1000); last = now; if (time >= duration) return stop(); requestAnimationFrame(loop); };
  function play() { sfx.ctx?.resume(); if (bed) { bed.currentTime = bed.startAt + (time >= duration - .05 ? 0 : time); bed.play().catch(() => {}); } if (time >= duration - .05) seek(0); playing = true; $('play').textContent = '❚❚ Pause'; draft?.play?.(); last = performance.now(); requestAnimationFrame(loop); }
  function stop() { bed?.pause(); playing = false; $('play').textContent = '▶ Play'; draft?.pause?.(); seek(time); }
  $('play').addEventListener('click', () => (playing ? stop() : play()));
  // the app safe zone stays hidden; "Show safe zones" draws it (remembered per browser)
  const showSafe = on => { $('safe').hidden = !on; $('safe-toggle').setAttribute('aria-pressed', String(on)); $('safe-toggle').textContent = on ? 'Hide safe zones' : 'Show safe zones'; try { localStorage.setItem('storyboard.safe', on ? '1' : ''); } catch {} };
  $('safe-toggle').addEventListener('click', () => showSafe($('safe').hidden));
  try { showSafe(localStorage.getItem('storyboard.safe') === '1'); } catch { showSafe(false); }
  const scrubTo = t => { if (playing) { bed?.pause(); playing = false; $('play').textContent = '▶ Play'; draft?.pause?.(); } seek(t); };
  $('scrub').addEventListener('input', e => scrubTo(Number(e.target.value)));
  const strip = $('strip'), atX = e => { const r = strip.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration; };
  strip.addEventListener('pointerdown', e => { strip.setPointerCapture(e.pointerId); scrubTo(atX(e)); });
  strip.addEventListener('pointermove', e => { if (strip.hasPointerCapture(e.pointerId)) scrubTo(atX(e)); });
  addEventListener('keydown', e => {
    const tag = document.activeElement.tagName, free = !/TEXTAREA|SELECT|BUTTON/.test(tag) && !(tag === 'INPUT' && document.activeElement.id !== 'scrub');
    if (!free) return;
    if (e.code === 'Space') { e.preventDefault(); playing ? stop() : play(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); scrubTo(time + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 1 / 30)); }
  });
  ready.then(d => { draft = d; seek(time); });
  // A scene with a rendered preview (npm run make <p> -- --section <id>) plays that, effects and all, in its card;
  // otherwise the big player jumps there (its live picture has the graphics but not the effects drawn at render time).
  const watch = (s, pic) => {
    if (s.inCut === false) return toast('This scene has no picture yet.');
    seenOne(s);
    if (s.hasClip && pic) {
      stop(); seek(s.start + .001);
      const v = h('video', {src: `${s.clip}?v=${status?.modified ?? ''}`, autoplay: true, playsInline: true, controls: false, class: 'clip'});
      v.addEventListener('ended', () => v.remove()); v.addEventListener('click', e => { e.stopPropagation(); v.remove(); });
      pic.querySelector('video')?.remove(); pic.append(v); return;
    }
    stop(); seek(s.start + .001); play();
  };

  // ----- feedback per scene
  let notes = [], status = null;
  const drafts = {};          // what they are typing per scene, kept across redraws
  const seen = store.get(`sb:${project}:seen`) ?? {};          // what this viewer last saw of each scene, to badge "Updated"
  const firstVisit = !Object.keys(seen).length;
  const likeOf = s => notes.find(m => m.section === s.id && m.kind === 'keep');
  const asksOf = s => notes.filter(m => m.section === s.id && m.kind !== 'keep').sort((a, b) => a.created.localeCompare(b.created));
  const updated = s => {
    const like = likeOf(s);
    if (like && like.ref !== `fp:${s.fp}`) return true;                                     // liked an older version
    if (asksOf(s).some(m => m.status === 'done' && m.reply && Date.parse(m.updated) > (seen[s.id]?.at ?? 0))) return true;   // Claude answered since
    return !firstVisit && seen[s.id] && seen[s.id].fp !== s.fp;
  };
  function markSeen() { const now = Date.now(); for (const s of scenes) seen[s.id] = {fp: s.fp, at: now}; store.set(`sb:${project}:seen`, seen); }
  function seenOne(s) { if (seen[s.id]?.fp === s.fp && !updated(s)) return; seen[s.id] = {fp: s.fp, at: Date.now()}; store.set(`sb:${project}:seen`, seen); setTimeout(drawScenes, 1200); }

  async function like(s) {
    const old = likeOf(s);
    try {
      if (old && old.ref === `fp:${s.fp}`) { await send('DELETE', `${api}review/marks/${old.id}`); await refresh(); return; }
      if (old) await send('DELETE', `${api}review/marks/${old.id}`);
      await send('POST', api + 'review/marks', {stage: 'storyboard', section: s.id, kind: 'keep', status: 'done', note: 'Looks good', ref: `fp:${s.fp}`, start: +s.start.toFixed(3), end: +Math.max(s.end, s.start + .1).toFixed(3)});
      seenOne(s);
      await refresh();
    } catch (error) { toast('Could not save: ' + error.message, true); }
  }
  async function ask(s, text) {
    const note = text.trim(); if (!note) return false;
    try {
      await send('POST', api + 'review/marks', {stage: 'storyboard', section: s.id, start: +s.start.toFixed(3), end: +Math.max(s.end, s.start + .1).toFixed(3), note, kind: 'change', ref: `${project} · scene ${s.n} ${s.id} (${secs(s.start)}–${secs(s.end)} s)`});
      const old = likeOf(s); if (old) await send('DELETE', `${api}review/marks/${old.id}`);
      delete drafts[s.id]; toast(`Sent: “${note}”`); await refresh(); return true;
    } catch (error) { toast('Could not save: ' + error.message, true); return false; }
  }
  async function drop(m) { try { await send('DELETE', `${api}review/marks/${m.id}`); toast('Removed'); await refresh(); } catch (error) { toast(error.message, true); } }

  /** Under every scene: one box for what should change. It saves itself as they type (no Send); emptying it removes the note. */
  const saving = {};          // scene id -> timer
  const mineOf = s => asksOf(s).filter(m => m.status !== 'done').at(-1);      // the note this scene's box edits
  async function autosave(s, text, state) {
    const note = text.trim(), mine = mineOf(s);
    try {
      state.textContent = 'Saving…';
      if (!note && mine) await send('DELETE', `${api}review/marks/${mine.id}`);
      else if (note && mine) { if (mine.note !== note) await send('PATCH', `${api}review/marks/${mine.id}`, {note}); }
      else if (note) await send('POST', api + 'review/marks', {stage: 'storyboard', section: s.id, start: +s.start.toFixed(3), end: +Math.max(s.end, s.start + .1).toFixed(3), note, kind: 'change', ref: `${project} · scene ${s.n} ${s.id} (${secs(s.start)}–${secs(s.end)} s)`});
      seenOne(s); await refresh();
      state.textContent = note ? '✓ Saved' : '';
    } catch (error) { state.textContent = ''; toast('Could not save: ' + error.message, true); }
  }
  function feedback(s, hook) {
    const mine = mineOf(s);
    const box = h('textarea', {rows: 1, placeholder: hook ? 'Would this stop you scrolling? Type what should change…' : 'Type what should change…', 'aria-label': `What to change in scene ${s.n}`});
    box.value = drafts[s.id] ?? mine?.note ?? ''; box.dataset.scene = s.id;
    const state = h('span', {class: 'saved'}, mine && !drafts[s.id] ? '✓ Saved' : '');
    const grow = () => { box.style.height = 'auto'; box.style.height = Math.min(140, box.scrollHeight + 2) + 'px'; };
    box.addEventListener('input', () => {
      drafts[s.id] = box.value; grow(); state.textContent = '…';
      clearTimeout(saving[s.id]); saving[s.id] = setTimeout(() => autosave(s, box.value, state).then(() => { if (drafts[s.id] === box.value) delete drafts[s.id]; }), 900);
    });
    box.addEventListener('blur', () => { if (saving[s.id]) { clearTimeout(saving[s.id]); autosave(s, box.value, state).then(() => { delete drafts[s.id]; if (pendingDraw) drawScenes(); }); } else if (pendingDraw) drawScenes(); });
    setTimeout(grow, 0);
    return h('div', {class: 'feedback'}, h('div', {class: 'say'}, box, state));
  }

  /** Four moments across the scene (npm run frames <p> -- --scenes), so the edit reads at a glance: before, during, after. */
  function frameStrip(s) {
    const box = h('div', {class: 'frames', title: 'The scene over time; click a frame to jump there'});
    const img = h('img', {src: `${s.stripSrc}?v=${status?.modified ?? ''}`, alt: `Scene ${s.n} over time`, loading: 'lazy'});
    img.addEventListener('click', e => { const r = img.getBoundingClientRect(), k = Math.floor((e.clientX - r.left) / r.width * 4); stop(); seek(s.start + (s.end - s.start) * (k + .5) / 4); });
    box.append(img); return box;
  }
  // A scene's thumbnail before anything is rendered: a small copy of the live player (graphics, and the clip for a talking
  // video), paused on the middle of the scene. Loaded one at a time as panels scroll into view, so the page stays light.
  const thumbQueue = [], thumbs = {}; let thumbBusy = false;     // thumbs: scene id -> {fp, frame, ok}, kept across redraws
  const nextThumb = () => {
    if (thumbBusy || !thumbQueue.length) return;
    thumbBusy = true;
    const {s, pic} = thumbQueue.shift();
    if (thumbs[s.id]?.fp === s.fp) { thumbBusy = false; return nextThumb(); }   // already made (a redraw queued it again)
    const f = h('iframe', {class: 'thumb', title: '', tabindex: '-1', 'aria-hidden': 'true'});
    const entry = thumbs[s.id] = {fp: s.fp, frame: f, ok: false};
    const at = s.start + Math.max(0, s.end - s.start) * .5;
    let tries = 0;
    const done = () => { thumbBusy = false; entry.ok = true; f.closest('.pic')?.classList.add('loaded'); nextThumb(); };
    const poll = () => {
      const d = f.contentWindow?.__ready && f.contentWindow.draft;
      if (d) { Promise.resolve(d.seek(at)).finally(() => setTimeout(done, 250)); return; }
      if (++tries > 150) return done();                           // give up after ~15 s, move on
      setTimeout(poll, 100);
    };
    f.addEventListener('load', poll);
    f.src = `/pipeline/draft/?project=${project}&render=1&cut=usable${storyboard.footage ? '&embed=1' : ''}`;
    showThumb(pic, entry);
  };
  const showThumb = (pic, entry) => {
    const f = entry.frame, fitThumb = () => { f.style.transform = `scale(${pic.clientWidth / 1080})`; };
    pic.append(f); fitThumb(); new ResizeObserver(fitThumb).observe(pic);
    if (entry.ok) pic.classList.add('loaded');
  };
  const thumbSeen = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { thumbSeen.unobserve(e.target); thumbQueue.push(e.target.__thumb); nextThumb(); }
  }, {rootMargin: '300px'});
  function liveThumb(s, pic) {
    pic.classList.add('live');
    pic.append(h('span', {class: 'wait'}, ''));
    if (thumbs[s.id]?.fp === s.fp) return showThumb(pic, thumbs[s.id]);   // keep the one already drawn
    pic.__thumb = {s, pic};
    thumbSeen.observe(pic);
  }
  function panel(s, {hook = false} = {}) {
    const like_ = likeOf(s), asks = asksOf(s), open = asks.filter(m => m.status !== 'done'), fresh = updated(s);
    const liked = like_ && like_.ref === `fp:${s.fp}`;
    const pic = h('button', {type: 'button', class: 'pic', title: s.hasClip ? 'Play this scene as it will look' : 'Watch this scene', onclick: () => watch(s, pic)});
    if (s.hasStill) {
      const img = new Image();
      img.onload = () => { const n = Math.round(img.naturalWidth / 378); pic.style.backgroundImage = `url("${img.src}")`; pic.style.backgroundSize = `${n * 100}% 100%`; pic.style.backgroundPosition = `${n > 1 ? s.pick * 100 / (n - 1) : 0}% 0`; pic.classList.add('loaded'); };
      img.src = `${s.still}?v=${status?.modified ?? ''}`;
    } else if (s.ready && s.inCut !== false) liveThumb(s, pic);     // no rendered still at the storyboard stage: draw the scene live
    else pic.append(h('span', {class: 'wait'}, 'Picture on the way…'));
    if (storyboard.footage) pic.classList.add('footage');
    if (s.hasClip) {                  // hover: the scene plays as it will look (muted, looping); click plays it with sound
      pic.addEventListener('mouseenter', () => { if (pic.querySelector('video')) return; const v = h('video', {src: `${s.clip}?v=${status?.modified ?? ''}`, muted: true, loop: true, autoplay: true, playsInline: true, class: 'clip hover'}); v.muted = true; pic.append(v); });
      pic.addEventListener('mouseleave', () => pic.querySelector('video.hover')?.remove());
    }
    const badge = open.length ? h('span', {class: 'badge ask'}, `✎ ${plural(open.length, 'change')} asked`) : fresh ? h('span', {class: 'badge new'}, 'Updated') : liked ? h('span', {class: 'badge ok'}, '✓ Looks good') : null;
    const li = h('li', {class: ['scene', hook ? 'hook' : '', open.length ? 'asked' : '', liked && !fresh ? 'liked' : ''].join(' ').trim()},
      h('div', {class: 'pic-wrap'}, pic, badge, h('span', {class: 'num'}, String(s.n))),
      h('div', {class: 'text'},
        h('q', {}, s.line || '(no words)'),
        s.edit ? h('span', {class: 'edit'}, s.edit) : null,
        s.inCut === false ? h('span', {class: 'when'}, 'not in the video yet') : null,
        asks.filter(m => m !== mineOf(s)).length ? h('ul', {class: 'asks'}, asks.filter(m => m !== mineOf(s)).map(m => h('li', {class: m.status},
          h('span', {}, m.note), m.reply ? h('em', {}, '↳ ' + m.reply) : m.status === 'done' ? h('em', {}, '↳ done') : null,
          m.status !== 'done' ? h('button', {type: 'button', class: 'x', title: 'Remove this request', onclick: () => drop(m)}, '×') : null))) : null,
        s.hasStrip ? frameStrip(s) : null,
        feedback(s, hook)));
    li.dataset.scene = s.id;
    return li;
  }

  let pendingDraw = false;
  function drawScenes() {
    if (document.activeElement?.tagName === 'TEXTAREA' && document.activeElement.dataset.scene) { pendingDraw = true; return; }
    pendingDraw = false;
    const real = scenes.filter(s => s.inCut !== false);
    $('strip').replaceChildren(...real.map(s => {
      const open = asksOf(s).some(m => m.status !== 'done');
      const seg = h('b', {class: open ? 'has-notes' : likeOf(s)?.ref === `fp:${s.fp}` ? 'liked' : '', title: `Scene ${s.n} · ${secs(s.start)}–${secs(s.end)} s`}, String(s.n));
      seg.dataset.id = s.id; seg.style.left = `${s.start / duration * 100}%`; seg.style.width = `${Math.max(0, s.end - s.start) / duration * 100}%`;
      return seg;
    }), $('head'));
    shown = null;
    // keep what they are typing: the box that had focus gets it back after the redraw
    const active = document.activeElement?.dataset?.scene, caret = document.activeElement?.selectionStart;
    const [first, ...rest] = scenes;
    $('lead').replaceChildren(
      first ? h('ol', {class: 'hook-row'}, panel(first, {hook: true})) : '');
    $('scenes').replaceChildren(...rest.map(s => panel(s)));
    if (active) { const box = document.querySelector(`textarea[data-scene="${active}"]`); if (box) { box.focus(); if (caret != null) box.setSelectionRange(caret, caret); } }
    seek(time);
  }

  // ----- where it stands, and the one next step
  function drawState() {
    const open = notes.filter(m => m.kind !== 'keep' && m.status !== 'done').length, a = status.approval, make = status.make;
    const liked = scenes.filter(s => likeOf(s)?.ref === `fp:${s.fp}` && !asksOf(s).some(m => m.status !== 'done')).length;
    // the steps in the header
    const step = status.video || make?.running ? 'video' : spoken && pictures ? 'preview' : pictures ? 'pictures' : 'story';
    const order = ['story', 'pictures', 'preview', 'video'];
    for (const li of $('steps').children) { const i = order.indexOf(li.dataset.step), j = order.indexOf(step); li.className = i < j ? 'done' : i === j ? 'now' : ''; }
    // the line on the left of the bar
    const lines = [];
    if (make?.running) lines.push(h('b', {}, 'Making your video… '), `started ${new Date(make.started).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}. You can close this page.`);
    else if (make && make.code === 0) lines.push(h('b', {}, 'Your video is ready. '), h('a', {href: `/pipeline/review/?project=${project}`}, 'Watch it →'));
    else if (make && make.qa === 'FAIL') lines.push(h('b', {class: 'bad'}, 'Your video is made, but it failed the quality check. '), 'Tell Claude “fix the quality check”, or ', h('a', {href: `/pipeline/review/?project=${project}`}, 'watch it →'));
    else if (make && make.code !== 0) lines.push(h('b', {class: 'bad'}, 'Something went wrong while making it. '), 'Tell Claude “the make failed”. The details are below.');
    else if (open) lines.push(h('b', {}, `${plural(open, 'note')} saved.`), ' Send them to Claude to apply, then make the video.');
    else if (!pictures) lines.push(h('b', {}, 'Pictures on the way…'));
    else lines.push(h('b', {}, 'Type a note on any scene to change it,'), ' or make the video as it is.');
    $('state').replaceChildren(...lines);
    // the button and what it costs
    const btn = $('approve');
    btn.disabled = Boolean(make?.running) || (!open && !pictures);
    btn.dataset.mode = open ? 'notes' : 'make';
    btn.textContent = make?.running ? 'Making…' : open ? 'Send my notes to Claude' : status.video && a.approved ? 'Make it again' : 'Make my video';
    btn.title = open ? 'Copies one line to paste into Claude Code; it applies every note' : !pictures ? 'Wait until every scene has its picture' : '';
    const chars = (storyboard.shots ?? []).reduce((n, s) => n + (s.narration?.length ?? 0), 0);
    const paid = want === 'elevenlabs' && have !== 'elevenlabs';
    $('cost').textContent = !make?.running && paid ? `uses about ${Math.ceil(chars / 50) * 50} ElevenLabs credits` : '';   // only shown when it costs something
    $('copy').hidden = true;
    const log = $('log'); log.hidden = !make || make.code === 0;
    if (make && !log.hidden) { const end = log.scrollTop + log.clientHeight >= log.scrollHeight - 8; log.textContent = make.log.join('\n'); if (end) log.scrollTop = log.scrollHeight; }
  }
  $('approve').addEventListener('click', async () => {
    if ($('approve').dataset.mode === 'notes') return $('copy').click();
    try {
      if (!status.approval.approved) await send('POST', api + 'approve');
      await send('POST', api + 'make', {scale: $('quick').checked ? .5 : 1});
      toast('Making your video…');
      await refresh();
    } catch (error) { toast(error.message, true); await refresh(); }
  });
  $('copy').addEventListener('click', async () => {
    const text = `Apply my storyboard changes for ${project} (npm run review ${project}).`;
    try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into Claude Code.'); } catch { toast(text); }
  });

  // ----- keep in step with Claude: requests it answers, a storyboard it changes, a make that runs
  let shownModified = null;
  async function refresh() {
    const [review, state] = await Promise.all([fetch(api + 'review', {cache: 'no-store'}).then(r => r.json()), fetch(api + 'storyboard', {cache: 'no-store'}).then(r => r.json())]);
    const next = review.marks.filter(m => m.stage === 'storyboard');
    const changed = JSON.stringify(next) !== JSON.stringify(notes) || state.modified !== status?.modified;
    notes = next; status = state;
    if (shownModified && state.modified !== shownModified) { toast('Claude changed the storyboard. Loading the new version…'); setTimeout(() => location.reload(), 900); return; }
    shownModified ??= state.modified;
    if (changed) drawScenes();
    drawState();
  }
  await refresh();
  if (firstVisit) markSeen();      // later, a scene counts as seen once it is watched, liked or asked about
  setInterval(() => { if (!document.hidden) refresh().catch(() => {}); }, 1500);
}

// ----- house-mix levels for the preview: the speaking level, a per-50ms "is someone speaking" map, the music's level
async function levels(ctx, project, timeline, audio) {
  const TARGET = Math.pow(10, (VOICE_LUFS - 4) / 20);           // the speaking RMS after normalising to the house level (about 4 dB under its LUFS)
  const dec = url => fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b));
  const frames = (buf, hop = .05) => { const d = buf.getChannelData(0), n = Math.round(hop * buf.sampleRate), out = [];
    for (let i = 0; i + n <= d.length; i += n) { let e = 0; for (let j = i; j < i + n; j++) e += d[j] * d[j]; out.push(Math.sqrt(e / n)); } return out; };
  const clips = await Promise.all(audio.map(a => dec(a.el.src).catch(() => null)));
  let peak = 0; const all = clips.map(c => (c ? frames(c) : [])); for (const f of all) for (const v of f) peak = Math.max(peak, v);
  const gate = peak * Math.pow(10, -30 / 20), talk = []; let sum = 0, cnt = 0;
  all.forEach((f, i) => f.forEach((v, k) => { if (v > gate) { sum += v; cnt++; const at = Math.floor(audio[i].at / .05) + k; for (let r = 0; r < 5; r++) talk[at + r] = true; } }));
  const vRms = cnt ? sum / cnt : .05, out = {target: TARGET, speech: talk};
  out.voiceGain = Math.min(12, TARGET / vRms); 
  if (timeline.music) {
    const m = await dec(`/library/_shared/music/${timeline.music.name}.mp3`), f = frames(m).filter(v => v > 1e-4);
    const mRms = f.length ? f.reduce((a, b) => a + b, 0) / f.length : 1;
    out.musicBase = TARGET * Math.pow(10, Math.min(MUSIC.max, timeline.music.gain ?? MUSIC.gain) / 20) / mRms;
  }
  return out;
}
function loudest(buf) {
  const d = buf.getChannelData(0), n = Math.max(1, Math.round(.1 * buf.sampleRate)); let e = 0, best = 0;
  for (let i = 0; i < d.length; i++) { e += d[i] * d[i]; if (i >= n) e -= d[i - n] * d[i - n]; if (e > best) best = e; }
  return Math.sqrt(best / Math.min(n, d.length)) + 1e-9;
}

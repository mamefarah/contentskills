// Stage 2: the rough draft. Plays a storyboard live in the browser straight from library
// pieces — nothing is rendered to video, so a change to storyboard.json shows on reload.
// Each shot lists candidate pieces; here you look at them, mark each draft / usable / rejected,
// and choose which usable one goes in the cut.
//   /pipeline/draft/?project=<name>            review player
//   /pipeline/draft/?project=<name>&render=1   bare frame for the combiner (window.draft.seek)
//   ...&render=1&embed=1                       bare frame that still shows the footage, for pages that embed the picture (the storyboard page)
import {resolveStyle, captionStyle as styleCaptions, loadStyleFonts} from '/library/_shared/style.js';
import {loadPiece, loadTheme, loadThemeFonts} from '/library/_shared/loader.js';
import {themePath} from '/library/_shared/themes.js';
import {mountCaptions} from '/library/_shared/captions.js';
import {measureCaption, measureTexts} from '/library/_shared/inspect.js';
import {placeCaption, SAFE} from '/library/_shared/placement.js';
import {buildTimeline, pickOf, describe, STATUSES, DEFAULT_THEME} from '/pipeline/timeline.js';

const params = new URLSearchParams(location.search), project = params.get('project'), renderMode = params.has('render'), embed = renderMode && params.has('embed');
const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, ...children) => { const node = Object.assign(document.createElement(tag), attrs); node.append(...children); return node; };
const frame = $('frame');

if (!project) {
  // No project chosen: list them.
  const projects = await (await fetch('/api/projects')).json();
  $('title').textContent = 'Rough drafts';
  $('note').textContent = projects.length ? 'Pick a project to play its storyboard.' : 'No projects yet. Create projects/<name>/storyboard.json.';
  $('review').href = '/pipeline/review/';
  for (const id of ['play', 'scrub', 'time', 'cuts']) $(id).hidden = true;
  $('shots').replaceWith(el('div', {className: 'projects'}, ...projects.map(p => el('a', {href: `?project=${p.name}`}, p.title || p.name, el('span', {}, p.error ? `Cannot read: ${p.error}` : p.footage ? `Footage, ${p.duration.toFixed(1)}s, ${p.graphics} graphics · projects/${p.name}/` : `${p.usable} of ${p.shots} shots have a usable piece · projects/${p.name}/`)))));
} else {
  if (renderMode) document.body.classList.add('render');
  $('review').href = `/pipeline/review/?project=${project}`;
  const storyboard = await (await fetch(`/projects/${project}/storyboard.json`, {cache: 'no-store'})).json();
  if (storyboard.footage) await (await import('./footage.js')).run({project, storyboard, renderMode, embed});   // recorded clip + graphics
  else {
  const voiceResponse = await fetch(`/projects/${project}/voice/voice.json`, {cache: 'no-store'});
  const voice = voiceResponse.ok ? await voiceResponse.json() : null;
  let cut = params.get('cut') === 'usable' ? 'usable' : 'all';
  const viewing = {};                 // shot id -> candidate being looked at (when it is not the pick)
  const mounted = new Map();          // "shot:candidate" -> mounted view, reused between rebuilds
  let timeline, shotViews = [], captions, time = 0, playing = false;

  const themeName = storyboard.theme ?? DEFAULT_THEME, theme = await loadTheme(themeName);
  const {styles: captionStyles} = await import(`/library/${themePath(themeName)}/captions/styles.js`);
  await loadThemeFonts(themeName);
  frame.style.background = theme.frame.background;
  frame.style.setProperty('--heading-font', theme.frame.headingFont); frame.style.setProperty('--heading-color', theme.frame.headingColor);
  const style = await resolveStyle(storyboard.style, async path => { const r = await fetch('/' + path, {cache: 'no-store'}); return r.ok ? r.json() : null; });      // the user's look over the theme
  await loadStyleFonts(style);
  const captionStyle = style?.captions ? styleCaptions(style.captions) : captionStyles.find(s => s.id === storyboard.captions);
  if (captionStyle) await document.fonts.load(`20px "${captionStyle.font}"`);
  const layer = el('div', {id: 'captions'});
  // a narrating character over every shot, under the captions (library/_shared/presenters, storyboard.presenter)
  const presenterLayer = el('div', {id: 'presenter'}); Object.assign(presenterLayer.style, {position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '5'});
  let presenter = null;

  /** Mount one candidate of one shot: background, headline and visual. */
  async function mount(shot) {
    const root = el('div', {className: 'shot'}), pieces = [];
    frame.insertBefore(root, layer.parentNode === frame ? layer : null);
    const slot = async (className, spec) => {
      if (!spec?.piece) return () => {};
      const host = el('div', {className}); root.append(host);
      // a piece may borrow from a second theme ("theme" on the slot): it keeps that theme's own look, not the user's style
      const from = spec.theme ?? themeName, piece = await loadPiece(host, spec.piece, spec.props, from, from === themeName ? style : null); pieces.push(piece);
      // with a presenter at the bottom, the graphics are scaled up into the space above it; the slot itself (the theme's
      // field colour) still fills the frame, and captions are not touched
      // storyboard.room = {scale, origin} does the same to keep the graphics clear of a caption band (no presenter needed)
      const room = storyboard.presenter ? {scale: storyboard.presenter.room ?? .8, origin: '50% 13%'} : storyboard.room;
      if (room) for (const child of host.children) Object.assign(child.style, {transform: `scale(${room.scale ?? .8})`, transformOrigin: room.origin ?? '50% 13%'});
      if (piece.background && className === 'visual') host.style.background = piece.background;
      // a theme's ambient layer (kit sets el.__ambient) keeps moving on the shot's own clock, past the piece's duration
      const amb = () => host.__ambient ?? host.querySelector('*')?.__ambient;
      return local => { piece.seek(piece.loops ? local % piece.duration : Math.min(local, piece.duration)); amb()?.(local); };
    };
    const background = await slot('bg', shot.background);
    if (shot.title) root.append(el('div', {className: 'heading'}, shot.title));
    const visual = await slot('visual', shot.visual);
    const flag = el('div', {className: 'flag'}); root.append(flag);
    const sound = shot.audio && !renderMode ? new Audio(`/projects/${project}/voice/${shot.audio.file}`) : null;
    // Camera on the picture (never the captions): a slow push-in, and a kick (zoom bump + decaying shake) at each
    // "kicks" time. Pure in t, like the pieces. shot.camera = {push: scale per second, kicks: [{at, amp}]}.
    const bgHost = root.querySelector('.bg'), cam = shot.camera;
    const camera = !cam || !bgHost ? () => {} : local => {
      let scale = 1 + (cam.push ?? 0) * local, x = 0, y = 0;
      for (const k of cam.kicks ?? []) {
        const dt = local - k.at, amp = k.amp ?? 1; if (dt < 0 || dt > .8) continue;
        scale += amp * .05 * Math.exp(-9 * dt);
        const fall = amp * 1.5 * Math.exp(-11 * dt);                     // % of the frame
        x += fall * Math.sin(dt * 61 + k.at * 7); y += fall * Math.sin(dt * 47 + k.at * 13 + 1);
      }
      bgHost.style.transform = `translate(${x.toFixed(3)}%, ${y.toFixed(3)}%) scale(${scale.toFixed(4)})`;
    };
    return {root, flag, sound, draw: local => { camera(local); background(local); visual(local); }, dispose: () => { sound?.pause(); for (const piece of pieces) piece.dispose?.(); root.remove(); }};
  }

  async function build() {
    timeline = buildTimeline(storyboard, cut, voice, viewing);
    const {width, height} = timeline.format;
    Object.assign(frame.style, {width: width + 'px', height: height + 'px', marginLeft: renderMode ? '0' : -width / 2 + 'px', marginTop: renderMode ? '0' : -height / 2 + 'px'});
    if (presenterLayer.parentNode !== frame) frame.append(presenterLayer);
    if (layer.parentNode !== frame) frame.append(layer);
    // Keep what is already on screen; mount only candidates that are newly shown.
    const wanted = new Set(timeline.shots.map(shot => `${shot.id}:${shot.candidateIndex}`));
    for (const [key, view] of mounted) if (!wanted.has(key)) { view.dispose(); mounted.delete(key); }
    shotViews = [];
    for (const shot of timeline.shots) {
      const key = `${shot.id}:${shot.candidateIndex}`;
      if (!mounted.has(key)) mounted.set(key, await mount(shot));
      const view = mounted.get(key);
      view.shot = shot;
      view.flag.textContent = shot.picked ? '' : shot.status === 'usable' ? 'usable · not picked' : shot.status;
      view.flag.className = `flag ${shot.status}`; view.flag.hidden = shot.picked;
      shotViews.push(view);
    }
    layer.replaceChildren();
    captions = captionStyle ? mountCaptions(layer, captionStyle, timeline.words) : {seek() {}};
    presenter?.dispose(); presenter = null;
    if (storyboard.presenter) {
      const {mountPresenter} = await import('/library/_shared/presenters/presenter.js');
      presenter = await mountPresenter(presenterLayer, storyboard.presenter, {project, shots: timeline.shots, words: timeline.words, duration: timeline.duration, width: timeline.format.width, height: timeline.format.height});
    }
    fit(); seek(Math.min(time, timeline.duration));
  }

  function seek(t) {
    time = Math.max(0, Math.min(timeline.duration, t));
    // The last shot stays up at the very end instead of cutting to an empty frame.
    const active = shotViews.find(v => time >= v.shot.start && time < v.shot.end) ?? shotViews.at(-1);
    for (const view of shotViews) view.root.classList.toggle('on', view === active);
    active?.draw(time - active.shot.start);
    captions.seek(time);
    presenter?.seek(time);
    // Keep the caption inside the app safe zone (the style's own spot can sit under the app's text): same placement as footage, without a face.
    // storyboard.captionAt = y px: the caption's bottom edge sits there in every shot (a fixed band the graphics keep clear of, see "room")
    if (captions.box && storyboard.captionAt) {
      layer.style.transform = '';
      const r = document.createRange(); r.selectNodeContents(captions.box); const b = r.getBoundingClientRect(), f = frame.getBoundingClientRect(), k = timeline.format.width / f.width;
      if (b.height > 0) {
        // inside the app safe zone (safe-zone.json): below y `split` the right edge is `rightLow` (the app's buttons), so
        // centre the caption in that lane (x 35-945: centre 490) and shrink it if it is wider than the lane less 50 px
        const left = (b.left - f.left) * k, right = (b.right - f.left) * k, bottom = (b.bottom - f.top) * k, sc = Math.min(1, (SAFE.rightLow - SAFE.left - 50) / Math.max(1, right - left));
        layer.style.transformOrigin = '0 0';
        layer.style.transform = `translate(${((SAFE.left + SAFE.rightLow) / 2 - sc * (left + right) / 2).toFixed(1)}px, ${(storyboard.captionAt - sc * bottom).toFixed(1)}px) scale(${sc.toFixed(4)})`;
      }
    } else if (captions.box && storyboard.captionPlacement !== 'fixed') {
      layer.style.transform = '';
      const r = document.createRange(); r.selectNodeContents(captions.box); const b = r.getBoundingClientRect(), f = frame.getBoundingClientRect(), k = timeline.format.width / f.width;
      if (b.height > 0) { const spot = placeCaption([(b.left - f.left) * k, (b.top - f.top) * k, (b.right - f.left) * k, (b.bottom - f.top) * k], {W: timeline.format.width, H: timeline.format.height}); if (Math.abs(spot.dy) > .5 || spot.scale !== 1) layer.style.transform = `translateY(${spot.dy.toFixed(1)}px) scale(${spot.scale})`; }
    }
    // Narration follows the picture: play the active shot's recording from the matching moment.
    for (const view of shotViews) {
      if (!view.sound) continue;
      const at = time - view.shot.audio.at, due = playing && view === active && at >= 0 && at < view.shot.audio.duration;
      if (!due) { if (!view.sound.paused) view.sound.pause(); continue; }
      if (view.sound.paused || Math.abs(view.sound.currentTime - at) > .25) { view.sound.currentTime = at; view.sound.play().catch(() => {}); }
    }
    if (!renderMode) updatePanel(active);
  }

  function fit() {
    if (renderMode) return;
    const box = $('viewer').getBoundingClientRect(), {width, height} = timeline.format;
    frame.style.transform = `scale(${Math.min((box.width - 40) / width, (box.height - 40) / height)})`;
  }

  // ---------- review panel ----------
  const stop = () => { playing = false; $('play').textContent = 'Play'; };
  function updatePanel(active) {
    $('scrub').max = String(timeline.duration); $('scrub').value = String(time);
    $('time').textContent = `${time.toFixed(1)}s / ${timeline.duration.toFixed(1)}s`;
    for (const li of $('shots').children) li.classList.toggle('current', li.dataset.id === active?.shot.id);
  }
  async function save(shot, index, body) {
    const response = await fetch(`/api/projects/${project}/shots/${shot.id}/candidates/${index}`, {method: 'POST', body: JSON.stringify(body)});
    const result = await response.json();
    if (!response.ok) { $('note').textContent = `Could not save: ${result.error}`; return; }
    shot.candidates[index].status = result.status;
    if (result.pick == null) delete shot.pick; else shot.pick = result.pick;
    delete viewing[shot.id];            // go back to showing whatever is now in the cut
    if (pickOf(shot) < 0) viewing[shot.id] = index;
    await build(); drawShotList();
  }
  function drawShotList() {
    const placed = new Map(timeline.shots.map(s => [s.id, s]));
    $('shots').replaceChildren(...storyboard.shots.map(shot => {
      const inCut = placed.get(shot.id), pick = pickOf(shot);
      const rows = shot.candidates.map((candidate, index) => {
        const status = candidate.status ?? 'draft', shown = inCut?.candidateIndex === index;
        const name = el('button', {className: 'name', title: 'Show this piece in the frame'}, `${'ABCDEFGH'[index]} · ${describe(candidate)}`);
        name.addEventListener('click', async event => {
          event.stopPropagation(); if (cut === 'usable') return;
          viewing[shot.id] = index; stop(); await build(); drawShotList(); seek(timeline.shots.find(s => s.id === shot.id).start + .001);
        });
        const marks = el('div', {className: 'marks'}, ...STATUSES.map(s => {
          const button = el('button', {textContent: s}); button.dataset.status = s; button.setAttribute('aria-pressed', String(s === status));
          button.addEventListener('click', event => { event.stopPropagation(); save(shot, index, {status: s}); });
          return button;
        }));
        const choose = index === pick ? el('span', {className: 'incut'}, 'in the cut')
          : status === 'usable' ? Object.assign(el('button', {className: 'use'}, 'use this one'), {onclick: event => { event.stopPropagation(); save(shot, index, {pick: true}); }}) : '';
        return el('div', {className: `cand${shown ? ' shown' : ''}${index === pick ? ' picked' : ''}`}, el('div', {className: 'line'}, name, choose), marks);
      });
      const li = el('li', {className: inCut ? '' : 'skipped'}, el('div', {className: 'top'}, el('span', {}, shot.id), el('span', {}, inCut ? `${inCut.start.toFixed(1)}s` : 'no usable piece')), el('q', {}, shot.narration || shot.title || ''), ...rows);
      li.dataset.id = shot.id;
      if (inCut) li.addEventListener('click', () => { stop(); seek(inCut.start + .001); });
      return li;
    }));
    const ready = storyboard.shots.filter(shot => pickOf(shot) >= 0).length, total = storyboard.shots.length;
    const timing = timeline.estimated === 0 ? 'Timed to the recorded voiceover.' : `${timeline.estimated} shot(s) have no voiceover yet and use estimated timing (npm run voice ${project}).`;
    const effects = storyboard.shots.some(shot => shot.candidates.some(c => c.effect)) ? ' Effects are added when the cut is combined, not in this preview.' : '';
    $('note').textContent = `${ready} of ${total} shots have a usable piece. ${timing}${effects}`;
    $('next').textContent = ready === total ? `Every shot has a usable piece:  npm run combine ${project}` : `Mark a usable piece for every shot, then:  npm run combine ${project}`;
  }

  await build();
  // view(shot, n) shows candidate n of a shot, for tools that review candidates without the panel.
  window.draft = {get duration() { return timeline.duration; }, fps: timeline.format.fps, seek, view: async (shotId, index) => { viewing[shotId] = index; await build(); },
    /** What is on screen right now, for pipeline/qa.py (no face in a shot video); with `texts`, the size of the text in the shot's pieces. */
    layout: texts => {
      const on = captions.phraseAt?.(time) ? measureCaption(captions.box, frame, timeline.format.width) : null, active = shotViews.find(v => v.root.classList.contains('on'));
      return {t: time, face: null, caption: on, cutaway: false, hidden: !captionStyle, ...(texts ? {texts: active ? measureTexts([[active.shot.id, active.root]], frame, timeline.format.width) : []} : {})};
    },
    words: () => timeline.words.map(w => [w.text, w.start, w.end]), get captions() { return Boolean(captionStyle); }};
  window.__ready = true;

  if (!renderMode) {
    $('title').textContent = storyboard.title;
    drawShotList();
    addEventListener('resize', fit);
    $('play').addEventListener('click', () => { playing = !playing; if (playing && time >= timeline.duration) time = 0; $('play').textContent = playing ? 'Pause' : 'Play'; seek(time); });
    $('scrub').addEventListener('input', event => { stop(); seek(Number(event.target.value)); });
    for (const chip of $('cuts').children) {
      chip.setAttribute('aria-pressed', String(chip.dataset.cut === cut));
      chip.addEventListener('click', async () => {
        cut = chip.dataset.cut; for (const other of $('cuts').children) other.setAttribute('aria-pressed', String(other === chip));
        stop(); time = 0; await build(); drawShotList();
      });
    }
    let last = performance.now();
    requestAnimationFrame(function tick(now) {
      if (playing) { seek(time + (now - last) / 1000); if (time >= timeline.duration) { stop(); seek(time); } }
      last = now; requestAnimationFrame(tick);
    });
  }
}
}

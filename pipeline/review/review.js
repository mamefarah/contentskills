// The review page: watch the finished video, see what is where, and mark the parts that should change.
//   /pipeline/review/                    the projects
//   /pipeline/review/?project=<name>     one project: player, timeline of its sections and lanes, marks
// Nothing here is rendered or stored in the browser: the video is projects/<name>/out/cut.mp4, the timeline is read from
// storyboard.json (sections and lanes come from /pipeline/sections.js, the same code the pipeline uses), and marks are
// saved through the local server into projects/<name>/review.json, where `npm run review <name>` reads them.
import {buildTimeline, buildFootageTimeline} from '/pipeline/timeline.js';
import {sectionsOf, lanesOf, within, touching, referenceOf, sectionAt, secs} from '/pipeline/sections.js';

const $ = id => document.getElementById(id);
/** Tiny element builder: h('div', {class: 'x', onclick}, child, 'text'). */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'style') el.style.cssText = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat(Infinity).filter(c => c != null && c !== false && c !== ''));
  return el;
}
const getJson = async (url, optional = false) => { const r = await fetch(url, {cache: 'no-store'}); if (!r.ok) { if (optional) return null; throw Error((await r.json().catch(() => ({}))).error || `${url}: ${r.status}`); } return r.json(); };
const send = async (method, url, data) => { const r = await fetch(url, {method, headers: {'content-type': 'application/json'}, body: data ? JSON.stringify(data) : undefined}), out = await r.json().catch(() => ({})); if (!r.ok) throw Error(out.error || `${r.status}`); return out; };
let toastTimer;
function toast(text, bad = false) { const t = $('toast'); t.textContent = text; t.className = bad ? 'bad' : ''; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, bad ? 4000 : 1400); }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const a = h('textarea', {style: 'position:fixed;opacity:0'}); a.value = text; document.body.append(a); a.select(); document.execCommand('copy'); a.remove(); }
  toast('Copied: ' + text);
}
const KINDS = ['change', 'cut', 'keep', 'question'],
  // What each kind of mark means, in plain words: the button, the line under it, and the note's prompt.
  KIND_INFO = {change: {label: 'Change it', hint: 'Tell Claude what to do differently in this part.', ask: 'What should change? e.g. make this chart bigger'},
    cut: {label: 'Remove it', hint: 'This part comes out of the video.', ask: 'Anything to add? e.g. cut the pause before "First"'},
    keep: {label: 'Keep it', hint: 'Leave this part exactly as it is.', ask: 'Optional: what you like about it'},
    question: {label: 'Ask a question', hint: 'Claude answers you here; nothing in the video changes.', ask: 'Your question, e.g. why is the text orange here?'}}, STATUS_NAMES = {open: 'Open', 'in-progress': 'In progress', done: 'Done'};
const project = new URLSearchParams(location.search).get('project');

if (!project) await listProjects(); else await review(project).catch(error => { $('title').textContent = 'Cannot open this project'; $('list').hidden = false; $('list').replaceChildren(h('p', {}, error.message), h('p', {}, h('a', {href: '/pipeline/review/', style: 'color:var(--cyan)'}, 'All projects'))); document.body.classList.add('listing'); });

// ---------- the list of projects ----------
async function listProjects() {
  document.body.classList.add('listing');
  const projects = await getJson('/api/projects');
  $('title').textContent = 'Finished videos'; $('all-link').hidden = true; $('list').hidden = false;
  const fact = (text, cls) => h('span', {class: cls}, text);
  $('list').replaceChildren(
    h('h1', {}, 'Review a video'),
    h('p', {}, 'Open a project to watch its finished video, see what is where on the timeline, and mark the parts you want changed. Marks are saved in the project folder as review.json.'),
    h('div', {class: 'grid'}, projects.sort((a, b) => (b.review?.open ?? 0) - (a.review?.open ?? 0) || Number(b.review?.video ?? 0) - Number(a.review?.video ?? 0) || a.name.localeCompare(b.name)).map(p => h('a', {class: 'project' + (p.review?.video ? '' : ' novideo'), href: `?project=${p.name}`},
      h('b', {}, p.title || p.name), h('span', {class: 'id'}, `projects/${p.name}/`),
      p.error ? h('span', {class: 'facts'}, fact('cannot read: ' + p.error)) : h('span', {class: 'facts'},
        fact(p.footage ? `footage · ${p.duration.toFixed(1)}s` : `${p.shots} shots`), fact(p.review.video ? (p.review.versions > 1 ? `${p.review.versions} versions` : 'video ready') : 'no video yet'),
        p.review.open ? fact(`${p.review.open} to do`, 'todo') : p.review.marks ? fact(`${p.review.marks} marks, all done`) : null)))));
}

// ---------- one project ----------
async function review(name) {
  const base = `/projects/${name}/`, api = `/api/projects/${name}/`;
  const storyboard = await getJson(base + 'storyboard.json', true);
  if (!storyboard) throw Error(`There is no project called “${name}” (no projects/${name}/storyboard.json).`);
  const words = storyboard.footage ? (await getJson(base + 'words.json', true))?.words ?? [] : [];
  const edl = storyboard.footage ? await getJson(base + 'edit/edl.json', true) : null;      // the cut's pieces: trimming needs it
  const ROUND = edl?.trims?.length ?? 0;      // trims this page's timeline is after: sent with notes and cuts, so a trim since then moves them (pipeline/trim.mjs)
  const timeline = storyboard.footage ? buildFootageTimeline(storyboard, words, null) : buildTimeline(storyboard, 'all', await getJson(base + 'voice/voice.json', true));
  const sections = sectionsOf(storyboard, {words, timeline}), lanes = lanesOf(storyboard, timeline), D = timeline.duration, fps = timeline.format.fps;
  const video = $('video'), track = $('track'), scroll = $('scroll');
  const state = {jobs: {}, applying: new Set(), history: [], marks: [], versions: [], version: 'cut.mp4', sel: null, loop: false, zoom: 1, editing: null, filter: 'open', kind: 'change', time: 0, modified: 0};
  document.title = `Review · ${storyboard.title || name}`;
  $('title').textContent = storyboard.title || name; $('draft-link').href = `/pipeline/draft/?project=${name}`; $('app').hidden = false; $('seek').max = String(D);
  const pct = t => `${t / D * 100}%`, snap = t => Math.max(0, Math.min(D, Math.round(t * fps) / fps));
  const ref = (start, end) => referenceOf(name, sections, start, end);

  // ----- player -----
  const hasVideo = () => Boolean(video.getAttribute('src'));
  const now = () => hasVideo() ? Math.min(D, video.currentTime) : state.time;
  function seek(t) { t = Math.max(0, Math.min(D - .5 / fps, t)); state.time = t; if (hasVideo()) video.currentTime = t; }
  const step = n => { video.pause(); seek((Math.floor(now() * fps + 1e-3) + n + .5) / fps); };        // the middle of the frame, so the picture is that frame for certain
  const toggle = () => { if (!hasVideo()) return; if (video.paused) { if (state.sel && state.loop && (now() < state.sel.start - .05 || now() >= state.sel.end - 1 / fps)) seek(state.sel.start); else if (now() >= D - 1.5 / fps) seek(0); video.play().catch(() => {}); } else video.pause(); };
  $('play').addEventListener('click', toggle); video.addEventListener('click', toggle);
  $('back1').addEventListener('click', () => step(-1)); $('fwd1').addEventListener('click', () => step(1));
  $('seek').addEventListener('input', e => { video.pause(); seek(Number(e.target.value)); });
  $('speed').addEventListener('change', e => { video.playbackRate = Number(e.target.value); });
  $('loop').addEventListener('click', () => { state.loop = !state.loop; $('loop').setAttribute('aria-pressed', String(state.loop)); });
  $('mute').addEventListener('click', () => { video.muted = !video.muted; $('mute').setAttribute('aria-pressed', String(video.muted)); $('mute').textContent = video.muted ? 'Muted' : 'Sound'; });
  function showVersion(file) {
    const v = state.versions.find(x => x.file === file) ?? state.versions[0], at = now(), playing = hasVideo() && !video.paused;
    $('novideo').hidden = Boolean(v); $('version-field').hidden = state.versions.length < 2;
    $('novideo').replaceChildren('There is no finished video for this project yet. Make it with', h('code', {}, `npm run make ${name}`));
    for (const id of ['play', 'back1', 'fwd1', 'mute', 'speed']) $(id).disabled = !v;
    if (!v) { video.removeAttribute('src'); return; }
    state.version = v.file; state.modified = v.modified;
    $('version').replaceChildren(...state.versions.map(x => h('option', {value: x.file, selected: x.file === v.file}, x.file === 'cut.mp4' ? 'Latest version' : `Earlier: version ${x.file.replace(/^cut-v?|\.mp4$/g, '')}`)));
    video.src = `${base}out/${v.file}?v=${v.modified}`; video.playbackRate = Number($('speed').value);
    video.addEventListener('loadedmetadata', () => { seek(at); if (playing) video.play().catch(() => {}); }, {once: true});
    thumbnails();
  }
  $('version').addEventListener('change', e => showVersion(e.target.value));

  // ----- timeline -----
  const rows = [];       // {id, label, height, el}
  const row = (id, label, height, cls = '') => { const el = h('div', {class: `row ${cls}`, 'data-lane': id, style: `height:${height}px`}); rows.push({id, label, height, el}); return el; };
  const ruler = row('ruler', '', 22, 'ruler'), secRow = row('sections', 'Sections', 92), markRow = row('marks', 'Marks', 17);
  const tip = i => `${i.label} · ${i.point ? secs(i.at) : `${secs(i.start)}–${secs(i.end)}`} s${i.detail ? ' · ' + i.detail : ''}`;
  for (const lane of lanes) {
    // Things that overlap in time (two graphics at once) go on rows of their own.
    const flat = ['words', 'sounds', 'transitions'].includes(lane.id), ends = [];
    const placed = lane.items.map(item => { let r = flat ? 0 : ends.findIndex(end => end <= item.start + 1e-6); if (r < 0) r = ends.length; ends[r] = item.end; return {...item, r}; });
    const el = row(lane.id, lane.label, Math.max(1, ends.length) * 17 + 4);
    for (const i of placed) el.append(h('div', {class: `item${i.point ? ' point' : ''}${lane.id === 'words' ? ' word' + (i.emph ? ' emph' : '') : ''}${lane.id === 'transitions' ? ' mid' : ''}${i.hidden ? ' ghost' : ''}`, title: tip(i),
      style: `left:${pct(i.start)};width:${pct(i.end - i.start)};top:${3 + i.r * 17}px`, 'data-start': i.start, 'data-end': i.end}, i.point ? '' : i.label.replace(/^[a-z0-9]+\//, '')));
  }
  const sel = h('div', {id: 'sel', hidden: true}), head = h('div', {id: 'head'});
  track.replaceChildren(...rows.map(r => r.el), sel, head);
  $('labels').replaceChildren(...rows.map(r => h('div', {'data-lane': r.id, style: `height:${r.height}px`}, r.label)));
  // Most people need only the sections and the effects: the other rows (marks, graphics, layout, zooms, transitions,
  // sounds, captions, words) are folded away until "Show all rows". The choice is remembered in this browser.
  const ROWS_KEY = 'review-all-rows';
  const setAllRows = on => {
    $('tl').classList.toggle('collapsed', !on); $('rows-toggle').setAttribute('aria-pressed', String(on));
    $('rows-toggle').textContent = on ? 'Show fewer rows' : 'Show all rows';
    try { localStorage.setItem(ROWS_KEY, on ? '1' : '0'); } catch {}
  };
  let allRows = false; try { allRows = localStorage.getItem(ROWS_KEY) === '1'; } catch {}
  setAllRows(allRows);
  $('rows-toggle').addEventListener('click', () => setAllRows($('tl').classList.contains('collapsed')));
  const secEls = sections.map((s, i) => {
    const el = h('button', {class: 'sec', style: `left:${pct(s.start)};width:calc(${pct(s.end - s.start)} - 2px)`, title: `${s.id} · ${s.title} · ${secs(s.start)}–${secs(s.end)} s${s.job ? ' · ' + s.job : ''}`, 'data-id': s.id},
      s.job && h('span', {class: 'job'}, s.job), h('span', {class: 'n', hidden: true}), h('span', {class: 'txt'}, h('b', {}, s.title), h('span', {}, `${s.id} · ${secs(s.start)}–${secs(s.end)}`)));
    el.addEventListener('click', e => { if (e.shiftKey || state.ranging || dragged) return; select(s.start, s.end, true); });
    secRow.append(el); return el;
  });
  function drawRuler() {
    const px = track.clientWidth / D, stepS = [.1, .2, .5, 1, 2, 5, 10, 30, 60].find(s => s * px >= 46) ?? 60;
    ruler.replaceChildren(...Array.from({length: Math.floor(D / stepS) + 1}, (_, i) => h('div', {class: 'tick', style: `left:${pct(i * stepS)}`}, stepS < 1 ? (i * stepS).toFixed(1) : String(i * stepS))));
    for (const el of track.querySelectorAll('.item:not(.point)')) el.classList.toggle('tight', (Number(el.dataset.end) - Number(el.dataset.start)) * px < (el.classList.contains('word') ? el.textContent.length * 6.1 + 3 : 16));      // no room for the label: a bar only
  }
  function setZoom(z, anchor = null) {
    z = Math.max(1, Math.min(12, z)); const view = scroll.clientWidth, t = anchor ?? (scroll.scrollLeft + view / 2) / track.clientWidth * D, offset = anchor == null ? view / 2 : anchor / D * track.clientWidth - scroll.scrollLeft;
    state.zoom = z; $('zoom').value = String(z); track.style.width = `${z * 100}%`; scroll.scrollLeft = t / D * track.clientWidth - offset; drawRuler();
  }
  $('zoom').addEventListener('input', e => setZoom(Number(e.target.value)));
  scroll.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); setZoom(state.zoom * Math.exp(-e.deltaY * .01), timeAt(e)); }, {passive: false});
  addEventListener('resize', drawRuler);
  const timeAt = e => Math.max(0, Math.min(D, (e.clientX - track.getBoundingClientRect().left) / track.clientWidth * D));
  // Pointer on the timeline: a plain click or drag moves the playhead; shift-drag (or "Mark range") selects any range.
  let drag = null, dragged = false;
  $('range-mode').addEventListener('click', () => { state.ranging = !state.ranging; $('range-mode').setAttribute('aria-pressed', String(state.ranging)); track.classList.toggle('ranging', state.ranging); });
  track.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const ranging = e.shiftKey || state.ranging, t = timeAt(e); dragged = false;
    if (!ranging && e.target.closest('.sec, .mk')) return;                       // those have their own click
    drag = {ranging, t0: t, x0: e.clientX}; track.setPointerCapture(e.pointerId);
    if (!ranging) { video.pause(); seek(t); }
  });
  track.addEventListener('pointermove', e => {
    if (!drag) return; const t = timeAt(e);
    if (Math.abs(e.clientX - drag.x0) > 3) dragged = true;
    if (drag.ranging) { if (dragged) select(snap(Math.min(drag.t0, t)), snap(Math.max(drag.t0, t)), false, false); } else seek(t);
  });
  const release = e => {
    if (!drag) return; const was = drag; drag = null; try { track.releasePointerCapture(e.pointerId); } catch {}
    if (!was.ranging && !state.loop && !state.editing) {      // a click on the timeline is a deliberate move: the note (typed or not) goes with it
      const at = sectionAt(sections, now()); if (!state.sel || now() < state.sel.start - .05 || now() >= state.sel.end + .05) select(at.start, at.end, false, false);
    }
    if (was.ranging) {
      if (dragged && state.sel && state.sel.end - state.sel.start >= 1.5 / fps) { select(state.sel.start, state.sel.end, true); if (state.ranging) $('range-mode').click(); }
      else { const s = sectionAt(sections, was.t0); select(s.start, s.end, true); }      // a shift-click picks the section under it
    }
    setTimeout(() => dragged = false, 0);
  };
  track.addEventListener('pointerup', release); track.addEventListener('pointercancel', release);
  track.addEventListener('dblclick', e => { const item = e.target.closest('.item'); if (item) select(snap(Number(item.dataset.start)), snap(Number(item.dataset.end)), true); });

  // ----- selection, inspector and composer -----
  function select(start, end, jump = false, focus = true) {
    state.sel = {start, end}; if (focus && state.editing) stopEditing();
    if (jump) { seek(start); if (hasVideo()) video.play().catch(() => {}); }      // keeps playing into the next section unless Loop is on
    drawSelection();
  }
  function clearSelection() { state.sel = null; stopEditing(); drawSelection(); }
  $('clear').addEventListener('click', clearSelection);
  const clock = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  const ago = iso => { const s = (Date.now() - Date.parse(iso)) / 1000; if (!(s >= 0)) return ''; return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };
  const svg = d => { const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); el.setAttribute('viewBox', '0 0 24 24'); el.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d); el.append(path); return el; };
  function drawSelection() {
    const s = state.sel; sel.hidden = !s; $('clear').hidden = true; $('composer').hidden = !s;      // no Clear: the selection follows the playhead
    for (const [i, el] of secEls.entries()) el.classList.toggle('selected', Boolean(s) && Math.abs(sections[i].start - s.start) < .02 && Math.abs(sections[i].end - s.end) < .02);
    $('here').replaceChildren();
    if (!s) { drawMarks(); $('selection').replaceChildren(h('p', {class: 'empty'}, 'Click a section in the timeline below, then type what should change.')); return; }
    Object.assign(sel.style, {left: pct(s.start), width: pct(s.end - s.start)});
    const hit = touching(sections, s.start, s.end), whole = hit.length === 1 && Math.abs(hit[0].start - s.start) < .02 && Math.abs(hit[0].end - s.end) < .02, text = ref(s.start, s.end);
    const here = within(lanes, s.start, s.end), said = (timeline.words ?? []).filter(w => w.start < s.end - .02 && w.end > s.start + .02).map(w => w.text).join(' ');
    $('selection').replaceChildren(
      h('h2', {}, whole ? hit[0].title : hit.length === 1 ? `Part of “${hit[0].title}”` : hit.length ? `${hit[0].title} → ${hit.at(-1).title}` : 'Custom range'),
      h('div', {class: 'range', title: `${text} · ${Math.round((s.end - s.start) * fps)} frames`}, `${clock(s.start)} – ${clock(s.end)}`));
    // What the user said reads first; the technical list (pieces, layouts, sounds) folds away for anyone curious.
    $('here').replaceChildren(said ? h('p', {class: 'said'}, h('q', {}, said)) : '', h('details', {class: 'onscreen'}, h('summary', {}, 'What’s on screen'),
      h('dl', {class: 'here'},
        here.filter(l => l.id !== 'words' && l.id !== 'zooms').map(l => [h('dt', {}, l.label), h('dd', {}, [...new Map(l.items.map(i => [i.label, i])).values()].slice(0, 12).map(i => h('span', {title: tip(i)}, i.label)), l.items.length > 12 && h('span', {}, `+${l.items.length - 12}`))]),
        here.filter(l => l.id === 'zooms').map(l => [h('dt', {}, 'Zooms'), h('dd', {}, h('span', {}, `${l.items.length} punch-in${l.items.length > 1 ? 's' : ''}`))]))));
    drawMarks();
  }
  // No kind buttons: every note is a change request; the note itself says what to do (keep, cut or a question included).
  function setKind(kind) { state.kind = kind; $('note').placeholder = KIND_INFO[kind]?.ask ?? KIND_INFO.change.ask; }
  setKind('change');
  function stopEditing() { state.editing = null; setShots([]); $('note').value = ''; $('save').textContent = 'Add TODO'; $('cancel').hidden = true; setKind('change'); }
  $('cancel').addEventListener('click', () => { stopEditing(); drawMarks(); });
  $('note').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('save-apply').click(); } });      // ⌘↵ = Fix Now
  // Screenshot: grab the frame on screen, save it as a file in the project (projects/<name>/review-shots/) right away,
  // and attach its path to the note being written. The agent sees the path in the mark (`shots`) and opens the image.
  function setShots(list) {
    state.shots = list;
    $('shots').hidden = !list.length;
    $('shots').replaceChildren(...list.map(path => h('span', {class: 'shot'}, h('a', {href: base + path, target: '_blank'}, h('img', {src: base + path, alt: 'Screenshot'})),
      h('button', {type: 'button', title: 'Remove', 'aria-label': 'Remove screenshot', onclick: () => setShots(state.shots.filter(p => p !== path))}, '×'))));
  }
  setShots([]);
  $('shot').addEventListener('click', async () => {
    if (!video.videoWidth) { toast('No frame to capture yet', true); return; }
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    try {
      const {path} = await send('POST', api + 'review/shots', {image: canvas.toDataURL('image/jpeg', .9), at: video.currentTime});
      setShots([...state.shots, path]); toast('Screenshot attached');
    } catch (error) { toast('Could not save the screenshot: ' + error.message, true); }
  });
  $('save-apply').addEventListener('click', () => { state.applyNext = true; $('composer').requestSubmit(); });
  $('composer').addEventListener('submit', async e => {
    e.preventDefault(); const s = state.sel, note = $('note').value.trim();
    if (!s) return; if (!note) { $('note').focus(); toast('Write what should happen here first', true); return; }
    const locked = busySection(s.start, s.end); if (locked) { toast(`Claude is changing ${locked.title || locked.id} right now. Notes there are locked until it is done.`, true); return; }
    const data = {round: ROUND, start: s.start, end: s.end, note, kind: state.kind, section: touching(sections, s.start, s.end)[0]?.id ?? '', ref: ref(s.start, s.end), shots: state.shots};
    try {
      if (state.editing) { const id = state.editing; await send('PATCH', `${api}review/marks/${id}`, data); toast('Mark updated'); if (state.applyNext) { state.applyNext = false; await applyMark(id); } }
      else {
        const mark = await send('POST', api + 'review/marks', {...data, video: state.version}); toast('Mark added');
        if (state.applyNext) { state.applyNext = false; await applyMark(mark.id); }
      }
      stopEditing(); await refresh();
    } catch (error) { toast('Could not save: ' + error.message, true); }
  });

  // ----- marks -----
  for (const chip of $('filter').children) chip.addEventListener('click', () => { state.filter = chip.dataset.filter; for (const c of $('filter').children) c.setAttribute('aria-pressed', String(c === chip)); drawMarks(); });
  const change = async (mark, patch, done) => { try { await send('PATCH', `${api}review/marks/${mark.id}`, patch); if (done) toast(done); await refresh(); } catch (error) { toast('Could not save: ' + error.message, true); } };
  function drawMarks() {
    const all = [...state.marks].sort((a, b) => a.start - b.start || a.created.localeCompare(b.created)), open = all.filter(m => !isDone(m)), shown = state.filter === 'open' ? open : all;
    $('mark-count').textContent = all.length ? `${open.length} to do` : '';
    const current = m => Boolean(state.sel) && Math.abs(m.start - state.sel.start) < .02 && Math.abs(m.end - state.sel.end) < .02;
    $('mark-list').replaceChildren(...(shown.length ? shown.map(m => {
      // A note reads like a chat message (the Frame.io pattern): who, when, the moment as a time chip, the words.
      // Edit / delete appear as icons on hover; Claude's reply sits under it like a reply in a thread.
      // Open notes show an "Apply now" button at all times. Once pressed (or while Claude works on this section for
      // another note) the section is locked: its notes cannot be edited or deleted and no new note can be added there.
      const stop = fn => e => { e.stopPropagation(); fn(); }, done = isDone(m), locked = lockedFor(m);
      const icon = (label, path, fn, cls = '') => h('button', {type: 'button', class: `ic ${cls}`, title: label, 'aria-label': label, onclick: stop(fn)},
        svg(path));
      const remove = async () => { if (!confirm('Delete this note?')) return; try { await send('DELETE', `${api}review/marks/${m.id}`); if (state.editing === m.id) stopEditing(); toast('Note deleted'); await refresh(); } catch (error) { toast('Could not delete: ' + error.message, true); } };
      return h('div', {class: `mark${done ? ' done' : ''}${locked ? ' locked' : ''}${current(m) ? ' current' : ''}${state.editing === m.id ? ' editing' : ''}`, 'data-id': m.id, onclick: () => select(m.start, m.end, true)},
        h('div', {class: 'msg'},
          h('span', {class: 'avatar you'}, 'You'),
          h('div', {class: 'body'},
            h('div', {class: 'who'}, h('b', {}, 'You'), h('span', {class: 'ago'}, ago(m.created)), h('span', {class: 'grow'}),
              !locked && h('span', {class: 'tools'},
                icon('Edit', 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4', () => edit(m)),
                icon('Delete', 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', remove, 'danger')),
              !done && !locked && h('button', {type: 'button', class: 'apply-now', title: 'Claude changes just this part of the video now. The part is locked until it is done.', onclick: stop(() => applyMark(m.id))}, 'Apply now'),
              locked && h('span', {class: 'lock', title: 'Claude is changing this part: notes here are locked until it is done'}, svg('M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z'), 'Locked')),
            h('p', {class: 'note'}, h('span', {class: 'tc'}, clock(m.start)), m.note),
            m.shots?.length ? h('div', {class: 'shots'}, m.shots.map(path => h('a', {class: 'shot', href: base + path, target: '_blank', onclick: e => e.stopPropagation()}, h('img', {src: base + path, alt: 'Screenshot', loading: 'lazy'})))) : null,
            jobOf(m) && (jobOf(m).marks ?? []).includes(m.id) ? h('p', {class: `jobline ${jobOf(m).state}`, title: jobOf(m).error || jobOf(m).step || ''}, h('i'), JOB_NAMES[jobOf(m).state] ?? jobOf(m).state, jobOf(m).state === 'failed' && jobOf(m).error ? `: ${jobOf(m).error}` : '')
              : m.status === 'in-progress' && !m.reply && h('p', {class: 'working'}, 'Claude is working on this…'))),
        m.reply && h('div', {class: 'msg reply'},
          h('span', {class: 'avatar claude'}, 'C'),
          h('div', {class: 'body'}, h('div', {class: 'who'}, h('b', {}, 'Claude')), h('p', {class: 'note'}, m.reply))));
    }) : [h('p', {class: 'empty'}, all.length ? 'Everything is done. “All” shows the finished notes.' : 'No notes yet. Pause on a moment and type what should change.')]));
    markRow.replaceChildren(...all.map(m => h('div', {class: `mk${isDone(m) ? ' done' : ''}`, 'data-kind': m.kind, title: `${m.id} · ${m.kind} · ${STATUS_NAMES[m.status]} · ${m.note}`, style: `left:${pct(m.start)};width:${pct(m.end - m.start)}`, onclick: () => select(m.start, m.end, true)})));
    for (const [i, el] of secEls.entries()) { const n = open.filter(m => touching([sections[i]], m.start, m.end).length).length, badge = el.querySelector('.n'); badge.hidden = !n; badge.textContent = String(n); }
  }
  function edit(m) { select(m.start, m.end, false, false); state.editing = m.id; setShots(m.shots ?? []); $('note').value = m.note; setKind(m.kind); $('save').textContent = 'Save changes'; $('cancel').hidden = false; drawMarks(); $('note').focus(); }

  // ----- data from the server: marks and versions; asked again every few seconds so an agent's replies and a fresh render show up -----
  async function refresh() {
    const data = await getJson(api + 'review'), first = !state.versions.length && !state.loaded; state.loaded = true;
    data.marks = data.marks.filter(m => m.stage !== 'storyboard');      // notes on the storyboard live on the storyboard page
    const marksChanged = JSON.stringify(data.marks) !== JSON.stringify(state.marks); state.marks = data.marks;
    const before = state.versions.find(v => v.file === state.version)?.modified; state.versions = data.versions;
    const after = data.versions.find(v => v.file === state.version)?.modified;
    if (first || before !== after) { if (!first && after) toast('New render loaded'); showVersion(state.version); }
    const jobsChanged = JSON.stringify(data.jobs ?? {}) !== JSON.stringify(state.jobs); state.jobs = data.jobs ?? {}; state.history = data.history ?? [];
    if (marksChanged || jobsChanged || first) drawMarks();
    drawJobs(); drawHistory();
    if (before !== after && !first) thumbnails();
  }
  // ----- parts of the video being changed: one job per section (npm run patch), shown on the timeline and on the notes -----
  const JOB_NAMES = {trimming: '✂ Cutting', editing: 'Claude is editing', rendering: 'Rendering', queued: 'Waiting to splice in', assembling: 'Splicing in', done: 'Updated ✓', failed: 'Failed'};
  const jobOf = m => state.jobs[m.section] ?? state.jobs[`${m.start}-${m.end}`];
  const ACTIVE = new Set(['trimming', 'editing', 'rendering', 'queued', 'assembling']);
  // A note counts as done as soon as its section's update has landed ("Updated ✓"), even before Claude records the
  // reply a moment later: otherwise it sat in To do with an "Apply now" button under a green Updated pill. A note
  // reopened (or edited) after that update is open again.
  const isDone = m => { if (m.status === 'done') return true; const j = jobOf(m); return j?.state === 'done' && (j.marks ?? []).includes(m.id) && Date.parse(m.updated ?? m.created) <= (j.finished ?? j.updated ?? 0); };
  const lockedFor = m => !isDone(m) && (ACTIVE.has(jobOf(m)?.state) || state.applying.has(m.id));
  const busySection = (start, end) => touching(sections, start, end).find(s => ACTIVE.has(state.jobs[s.id]?.state));
  function drawJobs() {
    sections.forEach((s, i) => {
      const job = state.jobs[s.id], el = secEls[i]; el.querySelector('.work')?.remove();
      if (!job) { el.removeAttribute('data-job'); return; }
      el.dataset.job = job.state;
      el.prepend(h('span', {class: 'work', title: job.error || job.step || job.note || ''}, JOB_NAMES[job.state] ?? job.state));
    });
  }
  async function applyMark(id) {
    state.applying.add(id); drawMarks();
    try { const r = await send('POST', `${api}review/marks/${id}/apply`); toast(`Claude is changing ${r.section}. Keep reviewing: other parts can change at the same time.`); await refresh(); }
    catch (error) { toast(error.message, true); }
    finally { state.applying.delete(id); drawMarks(); }
  }
  function drawHistory() {
    const list = state.history; $('history').hidden = !list.length; $('history-count').textContent = list.length ? `(${list.length})` : '';
    $('history-list').replaceChildren(...list.map(e => h('li', {},
      h('span', {title: e.label}, h('b', {}, e.section), ' ', e.label, h('small', {}, ago(e.made))),
      h('button', {type: 'button', class: 'quiet', title: `Put ${e.section} back the way it was before this change (only that part; other changes stay)`, onclick: async () => {
        if (!confirm(`Undo "${e.label}" on ${e.section}?`)) return;
        try { await send('POST', api + 'review/undo', {id: e.id}); toast(`Undoing ${e.section}…`); await refresh(); } catch (error) { toast(error.message, true); }
      }}, 'Undo'))));
  }
  async function thumbnails() {
    if (!state.versions.length) return;
    const times = sections.map(s => Math.round((s.start + (s.end - s.start) * .6) * 100) / 100);
    try { const {thumbs} = await send('POST', api + 'thumbnails', {file: state.version, times}); thumbs.forEach(t => { const i = times.indexOf(t.t); if (i >= 0 && t.url) secEls[i].style.backgroundImage = `url("${t.url}")`; }); } catch (error) { console.warn('Thumbnails:', error.message); }
  }

  // ----- keys -----
  addEventListener('keydown', e => {
    const typing = /^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement?.tagName) && document.activeElement.type !== 'range';
    if (e.key === 'Escape') { if (typing) document.activeElement.blur(); else clearSelection(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); toggle(); }
    else if (k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); const dir = k === 'arrowleft' ? -1 : 1; if (e.shiftKey) { video.pause(); seek(now() + dir); } else step(dir); }
    else if (k === 'arrowup' || k === 'arrowdown') { e.preventDefault(); const i = sections.indexOf(sectionAt(sections, state.sel ? state.sel.start + .01 : now())), s = sections[Math.max(0, Math.min(sections.length - 1, i + (k === 'arrowup' ? -1 : 1)))]; select(s.start, s.end, true); }
    else if (k === 'm') { e.preventDefault(); if (!state.sel) { const s = sectionAt(sections, now()); select(s.start, s.end, false); } video.pause(); $('note').focus(); }
    else if (k === 'l') $('loop').click();
  });

  // ----- Trim: cut a scene's start up to the playhead, or from the playhead to the scene's end -----
  // Pause on the moment (the mark), then "Cut start → here" or "Cut here → end". The cut starts at once (POST trim,
  // pipeline/trim.mjs: seconds, every graphic stays on its word, nothing is re-made). They can go straight on to another
  // scene and cut there too: the server queues trims and runs them one after another, each moved onto the timeline the
  // ones before it left. The red hatch shows every cut still running or waiting, and playback already skips it. Once
  // all of theirs are done the page loads the shorter timeline.
  const canTrim = Boolean(edl?.segments?.length && Math.abs(edl.duration.after - D) < .15);
  let sent = [];      // {id, a, b, state: sending | queued | running | done | failed}, on this page's timeline
  const live = () => sent.filter(c => c.state !== 'failed');
  const cutLayer = h('div', {id: 'cuts'}); track.append(cutLayer);
  const merge = list => { const out = []; for (const [a, b] of [...list].sort((x, y) => x[0] - y[0])) { const l = out.at(-1); if (l && a <= l[1] + 1e-3) l[1] = Math.max(l[1], b); else out.push([a, b]); } return out; };
  const pendingCuts = () => merge(live().map(c => [c.a, c.b]));
  const CUT_NAMES = {sending: 'Starting', queued: 'Waiting for the cut before it', running: 'Cutting', done: 'Cut ✓'};
  function drawCuts() {
    const px = track.clientWidth / D;
    cutLayer.replaceChildren(...live().map(c => h('div', {class: `cutzone ${c.state}`, style: `left:${pct(c.a)};width:${pct(c.b - c.a)}`, title: `${CUT_NAMES[c.state] ?? c.state} ${secs(c.a)}–${secs(c.b)} s (playback already skips it)`},
      (c.b - c.a) * px > 44 ? `✂ ${(c.b - c.a).toFixed(2)}s` : '✂')));
    drawTrimbar();
  }
  async function trimTo(side) {
    if (!canTrim) return toast('Trimming works on a talking-head video cut by npm run cut.', true);
    if (state.version !== 'cut.mp4') return toast('Switch to the latest version first: trims apply to it.', true);
    const t = snap(now()), sc = sectionAt(sections, t), [a, b] = side === 'head' ? [sc.start, t] : [t, sc.end];
    if (b - a < 1 / fps) return toast(side === 'head' ? 'Move the playhead into the scene first: nothing before it to cut.' : 'Move the playhead into the scene first: nothing after it to cut.', true);
    const already = live().filter(c => c.a < sc.end && c.b > sc.start).reduce((n, c) => n + c.b - c.a, 0);
    if (sc.end - sc.start - already - (b - a) < .2) return toast('That would cut the whole scene. Leave at least a moment of it.', true);
    if (live().some(c => a < c.b - 1e-3 && b > c.a + 1e-3)) return toast('Part of that is already being cut. Move the playhead outside the red stretch.', true);
    const job = state.jobs[sc.id]?.state;
    if (job && job !== 'trimming' && ACTIVE.has(job)) return toast(`${sc.title || sc.id} is being worked on right now: cut it when that is done. Other scenes can be cut now.`, true);
    const cut = {id: `t${Date.now().toString(36)}${sent.length}`, a, b, state: 'sending'};
    sent.push(cut); drawCuts(); video.pause();
    seek(Math.max(0, a - 1.2)); video.play().catch(() => {});      // play across the new edit
    const r = await fetch(api + 'trim', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({cut: [[a, b]], round: ROUND, id: cut.id})}), out = await r.json().catch(() => ({}));
    if (!r.ok) { cut.state = 'failed'; drawCuts(); return toast(out.error || 'Could not start the cut.', true); }
    cut.state = out.trim?.queued ? 'queued' : 'running'; drawCuts();
    toast(out.trim?.queued ? `Cut queued in ${sc.title || sc.id}: it runs right after the one before it. Keep going.` : `Cutting ${sc.title || sc.id}. Keep going: cut other scenes or leave notes meanwhile.`);
    refresh().catch(() => {}); watchTrim();
  }
  $('trim-head').addEventListener('click', () => trimTo('head'));
  $('trim-tail').addEventListener('click', () => trimTo('tail'));
  for (const b of [$('trim-head'), $('trim-tail')]) { b.disabled = !canTrim; if (!canTrim) b.title = 'Trimming works on a talking-head video cut with npm run cut (this one has no edit/edl.json, or the video no longer matches it).'; }
  addEventListener('resize', drawCuts);
  $('trim-apply').hidden = true; $('trim-reset').hidden = true;      // cuts start when marked: nothing to apply or clear
  function drawTrimbar() {
    const open = live().filter(c => c.state !== 'done'), total = open.reduce((n, c) => n + c.b - c.a, 0);
    const running = open.filter(c => c.state === 'running' || c.state === 'sending').length, waiting = open.filter(c => c.state === 'queued').length;
    $('trimbar').hidden = !open.length;
    $('trim-sum').textContent = `✂ ${total.toFixed(2)} s · ${running ? `cutting ${running}` : ''}${running && waiting ? ' · ' : ''}${waiting ? `${waiting} waiting` : ''}`;
  }
  let watching = false, othersSeen = false;
  async function watchTrim() {
    if (watching) return; watching = true;
    try {
      for (;;) {
        const {trim} = await getJson(api + 'trim', true) ?? {}, runs = trim?.runs ?? [];
        for (const c of sent) { const r = runs.find(x => x.id === c.id); if (r && c.state !== r.state) { c.state = r.state; if (r.state === 'failed') toast(`A cut failed: ${(r.last || 'see out/make.log').slice(0, 140)}`, true); } }
        drawCuts();
        const mine = sent.filter(c => c.state !== 'failed'), busyMine = mine.some(c => c.state !== 'done'), others = runs.some(r => (r.state === 'running' || r.state === 'queued') && !sent.some(c => c.id === r.id));
        if (others) othersSeen = true;
        const st = $('trim-status');
        if (busyMine || others) { st.hidden = !others || busyMine; st.textContent = 'Another cut on this video is running…'; await new Promise(r => setTimeout(r, 1000)); continue; }
        st.hidden = true;
        if (mine.length || othersSeen) { st.hidden = false; st.textContent = 'Cut. Loading the shorter timeline (your draft note comes with it)…'; setTimeout(() => reloadKeeping(mine.map(c => [c.a, c.b])), 600); }
        return;
      }
    } finally { watching = false; }
  }
  // After a trim the page loads the shorter timeline, keeping what they were doing: the draft note, its range, the marked
  // and the playhead, all moved onto the new timeline (the stretches cut out are taken out of them).
  const draftKey = `review-draft:${name}`;
  function reloadKeeping(removed) {
    const ranges = removed.map(([a, b]) => [Math.min(a, b), Math.max(a, b)]).sort((x, y) => x[0] - y[0]);
    const move = t => { let shift = 0; for (const [a, b] of ranges) { if (t >= b) shift += b - a; else if (t > a) return a - shift; else break; } return t - shift; };
    const span = ([a, b]) => [move(a), move(b)];
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({note: $('note').value, kind: state.kind, editing: state.editing, sel: state.sel && span([state.sel.start, state.sel.end]),
        time: move(now()), playing: hasVideo() && !video.paused}));
    } catch {}
    location.reload();
  }
  const restoreDraft = () => { try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); sessionStorage.removeItem(draftKey);
    if (draft) {
      seek(draft.time ?? 0);
      const m = draft.editing && state.marks.find(x => x.id === draft.editing);
      if (m) edit(m); else if (draft.sel) select(draft.sel[0], draft.sel[1], false, false);
      if (draft.note) { $('note').value = draft.note; setKind(draft.kind ?? 'change'); }
      if (draft.playing) video.play().catch(() => {});
    }
  } catch {} };
  if (canTrim) watchTrim();

  // ----- the clock: the video is the clock; everything else follows it -----
  let lastSection = null;
  requestAnimationFrame(function tick() {
    const t = now(), playing = hasVideo() && !video.paused, s = state.sel;
    if (playing && s && state.loop && (t >= s.end - .5 / fps || t >= D - 1 / fps) && t > s.start) seek(s.start);
    if (playing && state.version === 'cut.mp4') { const cut = pendingCuts().find(([a, b]) => t >= a - .01 && t < b - .01); if (cut) seek(cut[1]); }      // preview the trims: skip what will be cut
    head.style.left = pct(t);
    if (playing) { const x = t / D * track.clientWidth; if (x < scroll.scrollLeft || x > scroll.scrollLeft + scroll.clientWidth - 30) scroll.scrollLeft = x - scroll.clientWidth * .15; }
    $('play').textContent = playing ? 'Pause' : 'Play'; if (document.activeElement !== $('seek')) $('seek').value = String(t);
    $('clock').textContent = `${t.toFixed(2)} / ${D.toFixed(2)} s · f${Math.floor(t * fps + 1e-3)}`;
    const here = sectionAt(sections, t);
    // The note follows the playhead (the Frame.io way): while the note box is empty, the selection is the scene under the
    // playhead, so a note is never filed on a scene they have already moved away from. Typing freezes it (they are looking at
    // this moment); Loop and editing a note keep their selection.
    const outside = !s || t < s.start - .05 || t >= s.end + .05;
    if (outside && !drag && !state.loop && !state.editing && !$('note').value.trim()) select(here.start, here.end, false, false);
    if (here !== lastSection) { lastSection = here; for (const [i, el] of secEls.entries()) el.classList.toggle('current', sections[i] === here); $('now').replaceChildren(h('i', {}, here.id), here.title); }
    requestAnimationFrame(tick);
  });

  // ----- "Make a new version": Claude Code applies the open notes and re-makes (dashboard/serve.mjs, /apply) -----
  const remake = $('remake'), panel = $('apply');
  let applyRun = null, dismissed = null;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  function showApply(title, last, log, done) {
    panel.hidden = false; panel.classList.toggle('done', Boolean(done));
    $('apply-title').textContent = title; $('apply-last').textContent = last || '';
    const pre = $('apply-log'), end = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 8;
    pre.textContent = log || ''; if (end) pre.scrollTop = pre.scrollHeight; $('apply-more').hidden = !log;
    if (!done && !panel.dataset.opened) { $('apply-more').open = true; panel.dataset.opened = '1'; }      // live log open while it runs
  }
  async function refreshApply() {
    const {apply: run, open} = await getJson(api + 'apply'), was = applyRun?.running; applyRun = run;
    remake.hidden = !open && !run?.running; remake.disabled = Boolean(run?.running);
    const mins = run ? Math.max(0, Math.round(((run.finished ?? Date.now()) - run.started) / 60000)) : 0;
    remake.textContent = run?.running ? 'Claude is making it…' : `Make a new version · ${plural(open, 'note')}`;
    if (run && dismissed !== run.started) {
      const title = run.running ? `Claude is applying your notes · ${mins} min · ${plural(run.steps ?? 0, 'step')}` : run.code === 0 ? 'New version ready' : 'Claude stopped before finishing';
      const last = run.running ? run.log.at(-1) : run.code === 0 ? 'Pick it in Version, or watch cut.mp4 (the newest). Your previous cut is kept as a cut-v file.' : 'Open the details below, or tell Claude in your terminal "the remake from the review page failed".';
      showApply(title, last, run.log.join('\n'), !run.running);
    }
    if (was && !run.running) toast(run.code === 0 ? 'New version ready' : 'Claude stopped before finishing', run.code !== 0);
  }
  remake.addEventListener('click', async () => {
    remake.disabled = true;
    try {
      const r = await fetch(api + 'apply', {method: 'POST'}), out = await r.json().catch(() => ({}));
      if (r.status === 501) {
        let copied = true; try { await navigator.clipboard.writeText(out.prompt); } catch { copied = false; }
        showApply('Claude Code is not installed here', copied ? 'Copied the request: paste it into your coding agent.' : out.prompt, '', true);
      } else if (!r.ok) toast(out.error || 'Could not start', true);
      else { dismissed = null; toast('Claude is applying your notes…'); }
    } catch (error) { toast(error.message, true); }
    await refreshApply().catch(() => {});
  });
  $('apply-close').addEventListener('click', () => { panel.hidden = true; dismissed = applyRun?.started ?? null; });

  // ----- finishing: the version they are happy with becomes out/final.mp4, downloads, and shows as Final in My videos -----
  const fileName = `${(storyboard.title || name).replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || name}.mp4`;
  const download = () => { const a = h('a', {href: `${base}out/final.mp4?v=${Date.now()}`, download: fileName}); document.body.append(a); a.click(); a.remove(); };
  let finalRec = null;
  async function refreshFinal() {
    finalRec = (await getJson(api + 'final')).final;
    const open = state.marks.filter(m => !isDone(m) && m.kind !== 'keep').length, hasCut = state.versions.length > 0;
    $('final').hidden = !finalRec; $('finish').hidden = Boolean(finalRec) || !hasCut;
    $('finish').classList.toggle('quiet', open > 0);          // with notes open, "Make a new version" is the next step
    if (finalRec) { $('final').title = `Finished ${new Date(finalRec.finished).toLocaleString()} from ${finalRec.file}`; $('final-dl').href = `${base}out/final.mp4`; $('final-dl').setAttribute('download', fileName); }
  }
  $('finish').addEventListener('click', async () => {
    const open = state.marks.filter(m => !isDone(m) && m.kind !== 'keep').length;
    if (open && !confirm(`${open} note(s) are still open. Finish this version anyway?`)) return;
    try {
      const {final} = await send('POST', api + 'final', {file: state.version});
      download();
      toast(final.qa === 'FAIL' ? 'Finished, but its last quality check failed: worth a look' : 'Finished ✓ Downloading the video…', final.qa === 'FAIL');
    } catch (error) { toast(error.message, true); }
    await refreshFinal().catch(() => {});
  });
  // Download gives the version on screen: if a newer render (or another version) is showing than the one frozen as final, finish that one first.
  $('final-dl').addEventListener('click', async e => {
    e.preventDefault();
    const stale = finalRec && (finalRec.file !== state.version || (state.modified || 0) > Date.parse(finalRec.finished));
    if (stale) {
      try { await send('POST', api + 'final', {file: state.version}); toast('Saved this version as final ✓ Downloading…'); }
      catch (error) { return toast(error.message, true); }
      await refreshFinal().catch(() => {});
    }
    download();
  });
  $('reopen').addEventListener('click', async () => { try { await send('DELETE', api + 'final'); toast('Reopened'); } catch (error) { toast(error.message, true); } await refreshFinal().catch(() => {}); });

  drawSelection(); await refresh(); restoreDraft(); setZoom(1); refreshApply().catch(() => {}); refreshFinal().catch(() => {});
  setInterval(() => { if (!document.hidden) { refresh().catch(() => {}); refreshApply().catch(() => {}); refreshFinal().catch(() => {}); } }, 4000);
  window.__review = {state, sections, select, seek};      // for checks from a console or a headless browser
  window.__ready = true;
}

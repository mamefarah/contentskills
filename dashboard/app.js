// Master dashboard. Shows every piece of one theme (?theme=<name>): a theme is a unified style —
// its own fonts, captions, effects and animations — in library/themes/<name>/.
// No build step: the catalogs are the source of truth, this file only draws them.
import {mountCaptions} from '/library/_shared/captions.js';
import {loadTheme, loadThemeFonts} from '/library/_shared/loader.js';
import {themePath, COMMON} from '/library/_shared/themes.js';

const themeNames = await (await fetch('/library/themes/index.json')).json();
const requested = new URLSearchParams(location.search).get('theme');
const THEME = themeNames.includes(requested) ? requested : themeNames[0];
const BASE = `/library/${themePath(THEME)}`;
const theme = await loadTheme(THEME), ORDER = theme.categories;
const {styles: captionStyles} = await import(`${BASE}/captions/styles.js`);
const STAGE = `/library/_shared/stage.html?theme=${THEME}`;

/** Tiny element builder: h('div', {class: 'x', onclick}, child, 'text'). */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'muted') { el.muted = el.defaultMuted = true; el.setAttribute('muted', ''); }      // the attribute alone leaves a scripted <video> audible
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'style') el.style.cssText = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter(c => c != null && c !== false && c !== ''));
  return el;
}
const json = url => fetch(url).then(r => { if (!r.ok) throw Error(`${url}: ${r.status}`); return r.json(); });
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Voices are not a matter of style, so every theme shares one voiceover catalog.
// "Effects" on the page (catalog id "moments": scripted set pieces such as gta6_poster, reel_flythrough) are the same
// in every theme, so they share one catalog too, shown just before the theme's own effects catalog, titled "Filters".
const SHARED = {voiceover: '/library/voiceover', moments: '/library/_shared/signature'};
const dir = id => SHARED[id] ?? `${BASE}/${id}`;
const SECTIONS = ORDER.includes('effects') ? ORDER.flatMap(id => id === 'effects' ? ['moments', id] : [id]) : ['moments', ...ORDER];
const catalogs = await Promise.all(SECTIONS.map(id => json(`${dir(id)}/catalog.json`)));
// Shared pieces (library/_shared/common) are worn by every theme: listed in the theme's section of the same name (marked
// "shared"), or as their own section when the theme has none. A theme's own piece of the same name wins.
const COMMON_CATS = ['overlays', 'd3', 'three'];
for (const id of COMMON_CATS) {
  const shared = await fetch(`/library/${COMMON}/${id}/catalog.json`).then(r => r.ok ? r.json() : null).catch(() => null);
  if (!shared?.items?.length) continue;
  const own = catalogs.find(c => c.id === id), have = new Set(own?.items.map(i => i.piece));
  const items = shared.items.filter(i => !have.has(i.piece)).map(i => ({...i, shared: true}));
  if (own) { own.items.push(...items); own.groups = [...new Set([...(own.groups ?? []), ...(shared.groups ?? [])])]; }
  else catalogs.push({...shared, items});
}
const byId = Object.fromEntries(catalogs.map(c => [c.id, c]));
const SAMPLE = '/library/_shared/sample/clip.mp4';
const words = (await json('/library/_shared/sample/words.json')).words;

await loadThemeFonts(THEME);   // every font in the theme, for specimens and caption styles

// ---------- activation: only on-screen cards play video, run WebGL or update captions ----------
const liveCaptions = new Set();
const io = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const card = entry.target;
    if (entry.isIntersecting) card.activate?.(); else card.deactivate?.();
  }
}, {rootMargin: '200px'});
requestAnimationFrame(function tick() { for (const c of liveCaptions) c.handle.seek(c.video.currentTime); requestAnimationFrame(tick); });

const loopVideo = (src, {muted = true} = {}) => h('video', {src, loop: true, muted, playsinline: true, preload: 'metadata'});

// ---------- one shared audio player for the voiceover section ----------
const audio = new Audio();
let playingButton = null, playingBar = null;
function toggleAudio(src, button, bar) {
  if (playingButton === button && !audio.paused) { audio.pause(); return; }
  if (playingButton !== button) { audio.src = src; resetAudioUi(); playingButton = button; playingBar = bar; }
  audio.play();
}
function resetAudioUi() { if (playingButton) playingButton.textContent = '▶'; if (playingBar) playingBar.style.width = '0'; }
audio.addEventListener('play', () => { if (playingButton) playingButton.textContent = '❚❚'; });
audio.addEventListener('pause', () => { if (playingButton) playingButton.textContent = '▶'; });
audio.addEventListener('ended', resetAudioUi);
audio.addEventListener('timeupdate', () => { if (playingBar && audio.duration) playingBar.style.width = `${audio.currentTime / audio.duration * 100}%`; });

// ---------- cards ----------
const cardText = (name, id, description, tag) => h('div', {class: 'body'},
  tag && h('span', {class: 'tag'}, tag), h('h3', {}, name), h('span', {class: 'id'}, id), h('p', {}, description));

/** A looping clip: effects and transitions. */
function effectCard(item, category = 'effects') {
  const video = loopVideo(`${dir(category)}/${item.src}`);
  const card = h('button', {class: 'card', style: `--ratio:${item.portrait ? '9/16' : '470/450'}`, onclick: () => openModal(category, item)},
    h('div', {class: 'media'}, video), cardText(item.name, item.id, item.description, item.group));
  card.activate = () => video.play().catch(() => {});
  card.deactivate = () => video.pause();
  return card;
}

function pieceCard(category, item) {
  // Overlay pieces have no background of their own: show them over the sample footage, as they would be used.
  const under = item.over ? loopVideo(SAMPLE) : null;
  const layer = h('div', {style: 'position:absolute;inset:0'});
  const media = h('div', {class: 'media', style: item.over || item.tall ? '--ratio:9/16' : null}, under, layer);   // tall: a full-frame portrait card with its own background
  const card = h('button', {class: 'card', onclick: () => openModal(category, item)}, media, cardText(item.name, item.piece, item.description, item.shared ? `${item.group} · shared` : item.group));
  card.style.setProperty('--ratio', item.over || item.tall ? '9/16' : '1');
  card.activate = () => { under?.play().catch(() => {}); if (!layer.firstChild) layer.append(h('iframe', {src: `${STAGE}&piece=${item.piece}${item.over ? '&clear=1' : ''}`, title: item.name, loading: 'lazy', tabindex: '-1', allowtransparency: 'true'})); };
  card.deactivate = () => { under?.pause(); layer.replaceChildren(); };          // frees the WebGL context
  return card;
}

function captionCard(item) {
  const style = captionStyles.find(s => s.id === item.id);
  const video = loopVideo(SAMPLE);
  const layer = h('div', {class: 'cap-layer'});
  const entry = {video, handle: mountCaptions(layer, style, words)};
  const card = h('button', {class: 'card', style: '--ratio:9/16', onclick: () => openModal('captions', {...style, ...item})},
    h('div', {class: 'media'}, video, layer), cardText(style.name, item.id, style.description, `${item.group} · ${style.font}`));
  card.activate = () => { video.play().catch(() => {}); liveCaptions.add(entry); };
  card.deactivate = () => { video.pause(); liveCaptions.delete(entry); };
  return card;
}

function fontCard(item, sample) {
  const specimen = h('div', {class: 'specimen', style: `font-family:"${item.family}";font-weight:${item.weights.at(-1)}`}, sample());
  const card = h('article', {class: 'card font-card'}, specimen,
    item.weights.length > 1 && h('div', {class: 'weights', style: `font-family:"${item.family}"`}, item.weights.map(w => h('span', {style: `font-weight:${w};margin-right:14px`}, `Weight ${w}`))),
    h('div', {class: 'alphabet', style: `font-family:"${item.family}";font-weight:${item.weights[0]}`}, 'AaBbCcDdEeFfGg 0123456789 ?!&$%'),
    cardText(item.family, item.file.replace('files/', ''), item.note, `${item.group} · ${item.license}`));
  card.specimen = specimen;
  return card;
}

function voiceCard(item) {
  const fill = h('i'), button = h('button', {class: 'play', 'aria-label': `Play ${item.name}`}, '▶');
  const src = `/library/voiceover/${item.src}`;
  const bar = h('div', {class: 'bar', onclick: e => { if (playingButton === button && audio.duration) audio.currentTime = e.offsetX / e.currentTarget.clientWidth * audio.duration; }}, fill);
  button.addEventListener('click', () => toggleAudio(src, button, fill));
  return h('article', {class: 'card voice'},
    h('div', {class: 'row'}, button, h('div', {}, h('span', {class: 'tag'}, item.provider), h('h3', {}, item.name))),
    bar,
    h('div', {class: 'facts'}, [`voice: ${item.voice}`, item.model, item.settings, clock(item.seconds), item.wpm && `${item.wpm} words/min`].filter(Boolean).map(f => h('span', {}, f))),
    h('p', {}, item.note), h('blockquote', {}, item.script));
}

// ---------- sections ----------
const sections = document.getElementById('sections'), nav = document.getElementById('nav');
const state = {query: '', group: {}};
const allCards = [];

for (const catalog of catalogs) {
  let sampleText = 'Five ways to make money';
  const cards = catalog.items.map(item => {
    const card = {effects: () => effectCard(item), transitions: () => effectCard(item, 'transitions'), moments: () => effectCard(item, 'moments'), captions: () => captionCard(item), voiceover: () => voiceCard(item),
      fonts: () => fontCard(item, () => sampleText)}[catalog.id]?.() ?? pieceCard(catalog.id, item);
    const style = catalog.id === 'captions' ? captionStyles.find(s => s.id === item.id) : null;
    card.dataset.group = item.group;
    card.dataset.search = [item.id, item.name, item.family, item.group, item.description, item.note, item.voice, style?.name, style?.description, style?.font].filter(Boolean).join(' ').toLowerCase();
    allCards.push({card, catalog: catalog.id});
    if (card.activate) io.observe(card);
    return card;
  });
  const chips = h('div', {class: 'chips'}, ['All', ...catalog.groups].map(group => h('button', {class: 'chip', 'aria-pressed': String(group === 'All'), onclick: e => {
    state.group[catalog.id] = group === 'All' ? null : group;
    for (const chip of chips.children) chip.setAttribute('aria-pressed', String(chip === e.currentTarget));
    applyFilter();
  }}, group)));
  const min = {effects: 230, moments: 230, transitions: 230, fonts: 320, captions: 210, voiceover: 340, hud: 210}[catalog.id] ?? 260;
  const count = h('span', {class: 'count'});
  const section = h('section', {id: catalog.id},
    h('header', {}, h('h2', {}, catalog.title), count),
    h('p', {class: 'summary'}, catalog.summary),
    h('details', {class: 'usage'}, h('summary', {}, 'How to use these'), h('code', {}, catalog.usage)),
    chips,
    catalog.id === 'fonts' && h('div', {class: 'tryout'}, h('label', {for: 'font-sample'}, 'Sample text'), h('input', {id: 'font-sample', value: sampleText, oninput: e => {
      sampleText = e.target.value || 'Five ways to make money';
      for (const card of cards) card.specimen.textContent = sampleText;
    }})),
    h('div', {class: 'grid', style: `--min:${min}px`}, cards));
  section.count = count; section.total = cards.length;
  sections.append(section);
  nav.append(h('a', {href: `#${catalog.id}`, 'data-for': catalog.id}, catalog.title, h('b', {}, String(cards.length))));
}
document.getElementById('tally').textContent = `${theme.title} theme · ${allCards.length} pieces across ${catalogs.length} categories. ${theme.summary}`;
const themePick = document.getElementById('themes');
themePick.append(...themeNames.map(name => h('option', {value: name, selected: name === THEME || null}, name[0].toUpperCase() + name.slice(1).replaceAll('-', ' '))));
themePick.addEventListener('change', () => { location.search = `?theme=${themePick.value}`; });
const jump = document.querySelector('.jump'); if (jump) jump.href = '/pipeline/draft/';

function applyFilter() {
  const shown = {};
  for (const {card, catalog} of allCards) {
    const ok = (!state.query || card.dataset.search.includes(state.query)) && (!state.group[catalog] || card.dataset.group === state.group[catalog]);
    card.hidden = !ok;
    if (ok) shown[catalog] = (shown[catalog] || 0) + 1;
  }
  let any = false;
  for (const section of sections.children) {
    const n = shown[section.id] || 0;
    section.hidden = n === 0 && Boolean(state.query);
    section.count.textContent = n === section.total ? `${n} pieces` : `${n} of ${section.total}`;
    nav.querySelector(`[data-for="${section.id}"] b`).textContent = String(n);
    any ||= n > 0;
  }
  document.getElementById('empty').hidden = any;
}
document.getElementById('search').addEventListener('input', e => { state.query = e.target.value.trim().toLowerCase(); applyFilter(); });
applyFilter();

// Highlight the section being read in the sidebar.
const spy = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) for (const a of nav.children) a.classList.toggle('active', a.dataset.for === entry.target.id);
}, {rootMargin: '-20% 0px -70% 0px'});
for (const section of sections.children) spy.observe(section);

// ---------- detail view ----------
const modal = document.getElementById('modal'), stage = document.getElementById('modal-stage'), info = document.getElementById('modal-info');
let modalCleanup = () => {};

function openModal(category, item) {
  audio.pause(); modalCleanup(); modalCleanup = () => {};
  let snippet, path, controls = null, ratio = '1';
  if (category === 'effects' || category === 'transitions' || category === 'moments') {
    ratio = item.portrait ? '9/16' : '470/450';
    const video = h('video', {src: `${dir(category)}/${item.src}`, loop: true, controls: true, autoplay: true, playsinline: true, muted: true});      // everything starts muted; unmute with the player's controls
    stage.replaceChildren(h('div', {class: 'frame', style: `--ratio:${ratio}`}, video));
    snippet = {effects: `{"effect": {"name": "${item.id}", "amount": 0.4, "where": "in"}}`, transitions: `{"transition": {"name": "${item.id}", "seconds": 0.5}}`,
      moments: `{"name": "${item.id}", "at": 0, "seconds": 3, "where": "all", "amount": 1, "props": {}}`}[category];
    path = `${dir(category).slice(1)}/${item.src}`;
  } else if (category === 'captions') {
    ratio = '9/16';
    const video = h('video', {src: SAMPLE, loop: true, controls: true, autoplay: true, playsinline: true, muted: true});
    const layer = h('div', {class: 'cap-layer', style: 'pointer-events:none'});
    const entry = {video, handle: mountCaptions(layer, captionStyles.find(s => s.id === item.id), words)};
    liveCaptions.add(entry); modalCleanup = () => liveCaptions.delete(entry);
    stage.replaceChildren(h('div', {class: 'frame', style: `--ratio:${ratio}`}, video, layer));
    snippet = `{"captions": "${item.id}"}`; path = `library/${themePath(THEME)}/captions/styles.js`;
  } else {
    ratio = item.over || item.tall ? '9/16' : '1';
    const under = item.over ? h('video', {src: SAMPLE, loop: true, autoplay: true, muted: true, playsinline: true}) : null;
    const frame = h('iframe', {src: `${STAGE}&piece=${item.piece}${item.over ? '&clear=1' : ''}`, title: item.name, allowtransparency: 'true'});
    const range = h('input', {type: 'range', min: '0', max: '1', step: '0.01', value: '0', 'aria-label': 'Scrub'});
    const out = h('output', {}, '0.00s');
    let playing = true;
    const toggle = h('button', {onclick: () => { playing = !playing; toggle.textContent = playing ? 'Pause' : 'Play'; frame.contentWindow.postMessage(playing ? {play: true} : {seek: Number(range.value)}, '*'); }}, 'Pause');
    range.addEventListener('input', () => { playing = false; toggle.textContent = 'Play'; out.textContent = `${Number(range.value).toFixed(2)}s`; frame.contentWindow.postMessage({seek: Number(range.value)}, '*'); });
    const onMessage = e => {
      if (e.source !== frame.contentWindow) return;
      if (e.data.ready) range.max = String(e.data.duration);
      if (typeof e.data.t === 'number' && playing) { range.value = String(e.data.t); out.textContent = `${e.data.t.toFixed(2)}s`; }
    };
    addEventListener('message', onMessage); modalCleanup = () => removeEventListener('message', onMessage);
    stage.replaceChildren(h('div', {class: 'frame', style: `--ratio:${ratio}`}, under, frame));
    controls = h('div', {class: 'ctl'}, toggle, range, out);
    snippet = `{"piece": "${item.piece}"}`;
    path = category === 'lottie' ? `library/${themePath(THEME)}/lottie/animations/${item.id}.json` : `library/${item.shared ? COMMON : themePath(THEME)}/${category}/pieces/${item.id}.js`;
  }
  const copy = h('button', {onclick: async () => { await navigator.clipboard.writeText(snippet); copy.textContent = 'Copied'; setTimeout(() => copy.textContent = 'Copy', 1200); }}, 'Copy');
  info.replaceChildren(
    h('span', {class: 'tag'}, `${byId[category].title} · ${item.group}`), h('h2', {}, item.name), h('p', {}, item.description),
    ...(controls ? [controls] : []), h('p', {}, 'Use it in a storyboard:'), h('div', {class: 'snippet'}, h('code', {}, snippet), copy), h('span', {class: 'path'}, path));
  modal.showModal();
}
function closeModal() { modalCleanup(); modalCleanup = () => {}; stage.replaceChildren(); }
modal.addEventListener('close', () => { if (!modal.open) closeModal(); });   // the event is async; a new piece may already be open
modal.querySelector('.close').addEventListener('click', () => modal.close());
modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });


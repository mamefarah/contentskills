// Rough draft for a footage project: one recorded clip with theme graphics superimposed.
// Preview plays the real video underneath; in render mode the video is left out and the page
// is transparent, so the combiner can lay the graphics over the footage itself.
import {loadPiece, loadTheme, loadThemeFonts} from '/library/_shared/loader.js';
import {themePath} from '/library/_shared/themes.js';
import {mountCaptions, back} from '/library/_shared/captions.js';
import {resolveStyle, captionStyle, loadStyleFonts} from '/library/_shared/style.js';
import {faceKeep, readOccupancy, placeCaption, captionCost, overlap, area} from '/library/_shared/placement.js';
import {measureCaption, measureTexts} from '/library/_shared/inspect.js';
import {buildFootageTimeline, zoomAt, panesAt, faceInFrame, faceSeen, projectStats, DEFAULT_THEME, VISUAL_REGION} from '/pipeline/timeline.js';

const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, ...children) => { const node = Object.assign(document.createElement(tag), attrs); node.append(...children); return node; };
const box = (node, r) => Object.assign(node.style, {position: 'absolute', left: r.x + 'px', top: r.y + 'px', width: r.width + 'px', height: r.height + 'px'});
const fill = node => { Object.assign(node.style, {position: 'absolute', inset: '0'}); return node; };

export async function run({project, storyboard, renderMode, embed = false}) {
  const frame = $('frame'), base = `/projects/${project}/`;
  const get = async file => { const response = await fetch(base + file, {cache: 'no-store'}); return response.ok ? response.json() : null; };
  const words = (await get('words.json'))?.words ?? [], faces = await get('faces.json');
  // Where graphics are drawn, a few times a second (written by the combiner's first pass); captions keep clear of them.
  const occupancy = readOccupancy(await get('out/occupancy.json'));
  const timeline = buildFootageTimeline(storyboard, words, faces), {width, height} = timeline.format, track = timeline.track;
  const themeName = storyboard.theme ?? DEFAULT_THEME, theme = await loadTheme(themeName), layouts = timeline.layouts;
  // Numbers a piece may show about this very edit (props.project): counts from the storyboard and, if the clip was cleaned with `npm run cut`, its edit decision list.
  const stats = projectStats(storyboard, storyboard.overlays?.some(o => o.props?.use === 'project') ? await get('edit/edl.json') : null);
  await loadThemeFonts(themeName);
  // A style ("style" in the storyboard): the user's look over the theme — its colours, fonts and captions (library/_shared/style.js).
  const style = await resolveStyle(storyboard.style, async path => { const r = await fetch('/' + path, {cache: 'no-store'}); return r.ok ? r.json() : null; });
  await loadStyleFonts(style);

  Object.assign(frame.style, {width: width + 'px', height: height + 'px', marginLeft: renderMode ? '0' : -width / 2 + 'px', marginTop: renderMode ? '0' : -height / 2 + 'px', background: renderMode ? 'transparent' : '#000'});
  if (renderMode) document.body.style.background = document.documentElement.style.background = 'transparent';
  const source = () => { const v = el('video', {src: base + storyboard.footage.file, playsInline: true, preload: 'auto', muted: true}); return v; };
  const video = renderMode && !embed ? null : source();       // embed: a bare frame that still shows the clip
  // Preview only. With layouts the clip sits in windows over a backdrop; the combiner draws the same thing itself (pipeline/composite.py).
  let backdrop = null, blurred = null, windows = [];
  if (video) {
    video.muted = false;
    if (layouts) {
      backdrop = fill(el('div')); blurred = source(); Object.assign(fill(blurred).style, {width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(40px) brightness(.62) saturate(.85)', transform: 'scale(1.3)'}); backdrop.append(blurred); frame.append(backdrop);
    } else { Object.assign(video.style, {position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover'}); frame.append(video); }
  }
  const under = fill(el('div')); frame.append(under);          // overlays marked "behind": true sit under the clip's windows
  if (video && layouts) windows = [video, source()].map(v => { const w = el('div'); Object.assign(w.style, {position: 'absolute', overflow: 'hidden', visibility: 'hidden'}); Object.assign(v.style, {position: 'absolute', left: '0', top: '0', width: width + 'px', height: height + 'px', transformOrigin: '0 0', objectFit: 'cover'}); w.append(v); frame.append(w); return {w, v}; });
  // Overlays marked "behind": "person": the combiner lays this layer over the clip except where the person is (pipeline/composite.py).
  // The browser has no person cut-out, so the preview simply shows them over the clip.
  const behindPerson = fill(el('div')); frame.append(behindPerson);
  const over = fill(el('div')); frame.append(over);

  // Where the face is in the finished frame at time t, after any zoom and layout.
  const locate = t => faceInFrame(storyboard, track, t, timeline.format);
  const views = [];
  const mount = async (overlay, parent) => {
    const host = el('div'), outer = overlay.cutaway ? el('div') : host, from = overlay.theme ?? themeName;      // an overlay may name its own theme: a second style as an accent
    if (overlay.cutaway) {          // full screen: covers the footage with the theme background
      const bg = (await loadTheme(from)).frame.background;
      if (overlay.cell && overlay.region) {     // one cell of a grid of cutaways: only its own box gets the theme background
        box(outer, overlay.region); Object.assign(outer.style, {background: bg, overflow: 'hidden', borderRadius: (overlay.radius ?? 14) + 'px'});
        Object.assign(host.style, {position: 'absolute', inset: '0'}); outer.append(host);
      } else {
        Object.assign(outer.style, {position: 'absolute', inset: '0', background: bg}); // Text title cards are full-frame designs; diagrams and 3D sit in the square visual area.
        box(host, overlay.region ?? (overlay.piece.startsWith('text/') ? {x: 0, y: 0, width, height} : VISUAL_REGION)); outer.append(host);
      }
    } else if (overlay.region) box(host, overlay.region); else Object.assign(host.style, {position: 'absolute', inset: '0'});
    outer.style.visibility = 'hidden'; parent.append(outer);
    const props = {...overlay.props, life: overlay.life + (overlay.offset ?? 0), at: overlay.start - (overlay.offset ?? 0), locate, project: stats};
    if (overlay.region && !overlay.cutaway) props.clear ??= true;      // a card floating over footage is see-through
    const piece = await loadPiece(host, overlay.piece, props, from, from === themeName ? style : null);      // an accent theme keeps its own look
    for (const child of host.children) Object.assign(child.style, {display: 'block', width: '100%', height: '100%'});
    return {outer, piece};
  };
  for (const overlay of timeline.overlays) {
    const parent = overlay.behind === 'person' ? behindPerson : overlay.behind ? under : over;
    const slice = sliceOf(overlay);
    if (!slice) { views.push({overlay, ...await mount(overlay, parent)}); continue; }
    // "exit": "slice": the piece is mounted twice, each copy in a full-frame wrapper that is clipped to one side of the cut line
    // and slides away from it; plus the cut line itself, clipped to the overlay's box.
    const halves = [fill(el('div')), fill(el('div'))], cutBox = el('div'), line = el('div');
    parent.append(halves[0]); const first = await mount(overlay, halves[0]);
    parent.append(halves[1]); const twin = await mount(overlay, halves[1]);
    box(cutBox, slice.bounds); Object.assign(cutBox.style, {overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none'}); cutBox.append(line); parent.append(cutBox);
    const thick = Math.max(4, width * .007);
    Object.assign(line.style, {position: 'absolute', left: slice.cx - slice.bounds.x + 'px', top: slice.cy - slice.bounds.y - thick / 2 + 'px', height: thick + 'px', width: '0px', borderRadius: thick + 'px',
      background: '#fff', boxShadow: `0 0 ${thick * 1.5}px ${thick * .4}px rgba(255,255,255,.9), 0 0 ${thick * 5}px ${thick}px rgba(255,255,255,.45)`, transformOrigin: '0 50%', transform: `rotate(${slice.angle}deg) translateX(${-slice.length / 2}px)`});
    views.push({overlay, ...first, slice: {...slice, halves, twin, cutBox, line}});
  }
  /** An overlay's "exit": "slice" (or {"type": "slice", "at", "angle", "y"}), resolved: when the cut comes, the cut line (through the
   *  middle of the overlay's box, or just above the head for one behind the person), and how far each half travels to leave the frame. */
  function sliceOf(overlay) {
    const exit = overlay.exit === 'slice' ? {type: 'slice'} : overlay.exit;
    if (exit?.type !== 'slice') return null;
    const at = exit.at ?? overlay.life * .6, angle = exit.angle ?? -9, a = angle * Math.PI / 180;
    const bounds = !overlay.cutaway && overlay.region ? overlay.region : {x: 0, y: 0, width, height};
    const cx = bounds.x + bounds.width / 2, face = exit.y == null && overlay.behind === 'person' && track ? locate(overlay.start + at) : null;
    const cy = exit.y != null ? bounds.y + exit.y * bounds.height : face ? Math.max(bounds.y + bounds.height * .12, Math.min(bounds.y + bounds.height * .88, (face.y - face.h * .45) * height)) : bounds.y + bounds.height / 2;
    const nx = -Math.sin(a), ny = Math.cos(a), reach = sign => Math.max(...[[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => sign * ((x - cx) * nx + (y - cy) * ny))) + 40;
    return {at, angle, cx, cy, nx, ny, bounds, length: Math.hypot(bounds.width, bounds.height) * 1.05, travel: [reach(-1), reach(1)]};      // half 0 lies on the -normal side
  }
  const SLICE_DRAW = .14, SLICE_PART = .45, SLICE_FADE = .3;      // seconds: the cut line draws across, the halves slide apart, the line fades
  const inOut = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  /** The slice at `u` seconds into the overlay (null: not on screen). Pure function of u: nothing animates on its own. */
  function placeSlice({slice: s, outer}, u) {
    const k = u == null ? -1 : u - s.at, q = inOut(k / SLICE_DRAW), p = inOut((k - SLICE_DRAW) / SLICE_PART), fade = 1 - Math.max(0, Math.min(1, (k - SLICE_DRAW) / SLICE_FADE));
    const L = 4 * (width + height), poly = sign => {      // a large polygon covering one side of the cut line
      const dx = Math.cos(s.angle * Math.PI / 180) * L, dy = Math.sin(s.angle * Math.PI / 180) * L, ox = sign * s.nx * L, oy = sign * s.ny * L;
      return `polygon(${[[s.cx - dx, s.cy - dy], [s.cx + dx, s.cy + dy], [s.cx + dx + ox, s.cy + dy + oy], [s.cx - dx + ox, s.cy - dy + oy]].map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;
    };
    const split = k >= SLICE_DRAW && p < 1;
    s.halves.forEach((half, i) => {
      const sign = i ? 1 : -1, d = s.travel[i] * p;
      half.style.clipPath = split ? poly(sign) : 'none';
      half.style.transform = split ? `translate(${(sign * s.nx * d).toFixed(2)}px, ${(sign * s.ny * d).toFixed(2)}px)` : '';
    });
    if (k >= 0 && p >= 1) outer.style.visibility = 'hidden';      // both halves have left the frame
    s.twin.outer.style.visibility = split ? 'visible' : 'hidden';
    const lineOn = k >= 0 && fade > 0;
    s.cutBox.style.visibility = lineOn ? 'visible' : 'hidden';
    if (lineOn) { s.line.style.width = (s.length * q).toFixed(1) + 'px'; s.line.style.opacity = fade.toFixed(3); }
  }
  // Captions: the storyboard's style, and any others "captionTrack" switches to for a while ({start, end, style, theme, dy, hide,
  // size, words, profile}). profile: false keeps the theme's own captions there even when the user's style replaces them. size scales the user's style (1.8 = huge); words sets how many words a caption holds. A span naming another
  // theme uses that theme's own captions even when the user's style replaces the main theme's.
  const layer = el('div', {id: 'captions'}); over.append(layer);
  const captionSets = new Map(), spans = storyboard.captionTrack ?? [];
  const captionsFor = async (styleId, from, {size = 1, words = 0, plain = false} = {}) => {
    const key = `${from}/${styleId}@${size}/${words}${plain ? '/plain' : ''}`; if (captionSets.has(key)) return captionSets.get(key);
    // the style's captions replace the theme's (each caption-track style keeps its own grouping: one word, a phrase)
    const one = style?.captions && styleId !== storyboard.captions && /word/.test(styleId), mine = style?.captions && from === themeName && !plain;
    const tag = (one ? 'profile-word' : 'profile') + (size !== 1 || words ? `-${String(size).replace('.', '_')}-${words}` : '');
    const own = mine ? captionStyle({...style.captions, ...(one ? {words: 1} : {}), ...(words ? {words} : {}), ...(size !== 1 ? {size: (style.captions.size ?? 5.4) * size} : {})}, tag) : null;
    const capStyle = own ?? (await import(`/library/${themePath(from)}/captions/styles.js`)).styles.find(s => s.id === styleId);
    let set = {seek() {}, host: null};
    if (capStyle) { await loadThemeFonts(from); await document.fonts.load(`20px "${capStyle.font}"`); const host = fill(el('div')); layer.append(host); set = {...mountCaptions(host, capStyle, timeline.words), host, key}; }
    captionSets.set(key, set); return set;
  };
  const mainCaptions = storyboard.captions ? await captionsFor(storyboard.captions, themeName) : {seek() {}, host: null};
  for (const span of spans) span.set = span.style || span.size || span.words || span.theme || span.profile === false ? await captionsFor(span.style ?? storyboard.captions, span.theme ?? themeName, {size: Number(span.size) || 1, words: Number(span.words) || 0, plain: span.profile === false}) : mainCaptions;
  const ramp = (t, a, b, len = .16) => Math.max(0, Math.min(1, (t - a) / len, (b - t) / len));

  // Face-aware captions: each phrase takes the first clear spot (bottom of the safe zone, under the chin, above the head, smaller),
  // and is checked again every frame: if a graphic arrives on it or the face moves into it, it pops up in a clear spot
  // (a jump, never a slide, which could cross the face). "captionPlacement": "fixed" keeps the style's own position.
  const autoPlace = storyboard.captionPlacement !== 'fixed', step = 1 / timeline.format.fps;
  const cutawayOn = t => views.some(({overlay}) => overlay.cutaway && overlay.behind !== 'person' && t >= overlay.start && t < overlay.end);      // behind the person, the face is still in view
  const faceBox = t => track && !cutawayOn(t) ? faceKeep(locate(t), width, height) : null;
  const toFrame = b => { const f = frame.getBoundingClientRect(), k = width / f.width; return [(b.left - f.left) * k, (b.top - f.top) * k, (b.right - f.left) * k, (b.bottom - f.top) * k]; };
  const textRect = node => { const r = document.createRange(); r.selectNodeContents(node); const b = r.getBoundingClientRect(); return b.width > 0 && b.height > 0 ? toFrame(b) : null; };
  // Stateless, so any frame drawn on its own (parallel browsers, the frame cache) matches: the phrase's spot is found by
  // replaying it frame by frame from its start — first spot, then a jump whenever that spot stops being clear.
  function spotAt(phrase, rect, t) {
    // Look one frame ahead: a layout cut or a graphic landing on the next frame counts already, so the caption has moved
    // before the frame where the face or the graphic arrives (the video and the graphics can be a frame apart at a cut).
    const ctxAt = u => {
      const face = faceBox(u), next = faceBox(u + step);
      const nextFace = next && (!face || overlap(face, next) < .8 * area(next)) ? next : null;
      return {face, W: width, H: height,
              covered: r => Math.max(occupancy.covered(u, r), occupancy.covered(u + step, r), nextFace ? overlap(r, nextFace) / Math.max(1, area(r)) * 2 : 0)};
    };
    const moved = p => { const cx = (rect[0] + rect[2]) / 2, cy = (rect[1] + rect[3]) / 2 + p.dy, hw = (rect[2] - rect[0]) * p.scale / 2, hh = (rect[3] - rect[1]) * p.scale / 2; return [cx - hw, cy - hh, cx + hw, cy + hh]; };
    let spot = null;
    for (let n = 0, u = phrase.start; u <= t + 1e-6; u = phrase.start + ++n * step) {
      const ctx = ctxAt(u);
      if (!spot) spot = placeCaption(rect, ctx);
      else if (captionCost(moved(spot), ctx) > .01) { const next = placeCaption(rect, ctx); if (Math.abs(next.dy - spot.dy) > 2 || next.scale !== spot.scale) spot = {...next, pop: u}; }
    }
    return spot ?? placeCaption(rect, ctxAt(t));
  }
  function placeCaptions(set, t, shifted) {
    set.host.style.transform = '';
    const phrase = set.phraseAt?.(t), rect = phrase && autoPlace && !shifted ? textRect(set.box) : null;
    if (!rect) return;
    const spot = spotAt(phrase, rect, t), pop = spot.pop != null ? .6 + .4 * back((t - spot.pop) / .14) : 1;
    if (Math.abs(spot.dy) < .5 && spot.scale === 1 && pop === 1) return;
    set.host.style.transformOrigin = `${(rect[0] + rect[2]) / 2}px ${(rect[1] + rect[3]) / 2}px`;
    set.host.style.transform = `translateY(${spot.dy.toFixed(1)}px) scale(${(spot.scale * pop).toFixed(3)})`;
  }

  let time = 0;
  function seek(t) {
    time = Math.max(0, Math.min(timeline.duration, t));
    if (embed && video) {           // the embedding page is the clock: follow it (exactly while paused, loosely while playing)
      for (const v of [video, blurred, windows[1]?.v].filter(Boolean)) { const off = Math.abs(v.currentTime - time); if (v.paused ? off > .02 : off > .25) v.currentTime = time; }
    }
    for (const view of views) {
      const {overlay, outer, piece, slice} = view, on = time >= overlay.start && time < overlay.end;
      outer.style.visibility = on ? 'visible' : 'hidden';
      if (on) {
        // A slice exit holds the piece still from the cut on (both copies show the same picture).
        const local = (slice ? Math.min(time - overlay.start, slice.at) : time - overlay.start) + (overlay.offset ?? 0); /* "offset": the piece is already that far into its animation when it appears */
        const at = piece.meta?.live ? local : piece.loops ? local % piece.duration : Math.min(local, piece.duration);
        piece.seek(at);
        if (slice && time - overlay.start >= slice.at + SLICE_DRAW) slice.twin.piece.seek(at);
      }
      if (slice) placeSlice(view, on ? time - overlay.start : null);
    }
    const span = spans.find(s => time >= s.start && time < s.end), active = span ? (span.hide ? null : span.set) : mainCaptions;
    for (const set of captionSets.values()) if (set.host) set.host.style.visibility = set === active ? 'visible' : 'hidden';
    active?.seek(time);
    let dy = 0; for (const s of spans) if (s.dy) { const q = Math.min(s.start <= 0 ? 1 : ramp(time, s.start, Infinity), s.end >= timeline.duration ? 1 : ramp(time, -Infinity, s.end)); dy += s.dy * q * q * (3 - 2 * q); }   // a span that covers the clip's start or end is already in place there (no slide)
    layer.style.transform = dy ? `translateY(${dy.toFixed(1)}px)` : '';
    if (active?.host) placeCaptions(active, time, Math.abs(dy) > .5);
    if (!video) return;
    if (!layouts) { const zoom = zoomAt(storyboard, track, time); video.style.transformOrigin = `${zoom.cx * 100}% ${zoom.cy * 100}%`; video.style.transform = `scale(${zoom.scale})`; return; }
    const {panes, backdrop: back, full} = panesAt(storyboard, track, time, timeline.format);
    backdrop.style.background = back === 'blur' ? '#000' : back; blurred.style.visibility = back === 'blur' && !full ? 'visible' : 'hidden';
    windows.forEach(({w, v}, i) => {
      const p = panes[i]; w.style.visibility = p ? 'visible' : 'hidden'; if (!p) return;
      Object.assign(w.style, {left: p.x + 'px', top: p.y + 'px', width: p.width + 'px', height: p.height + 'px', transform: `rotate(${p.rotate}deg)`, borderRadius: p.radius + 'px', opacity: p.k, boxShadow: p.shadow > .01 ? `0 ${24 * p.shadow}px ${80 * p.shadow}px rgba(0,0,0,${.45 * p.shadow})` : 'none', outline: p.border > .1 ? `${p.border}px solid #fff` : 'none'});
      v.style.transform = `translate(${p.tx}px, ${p.ty}px) scale(${p.s})`;
    });
  }
  seek(0);
  const clips = () => [video, blurred, windows[1]?.v].filter(Boolean);
  window.draft = {duration: timeline.duration, fps: timeline.format.fps, seek, footage: true,
    /** Embed mode: play or pause the clip itself (its sound), while the page drives seek(). */
    play: () => { for (const v of clips()) { v.currentTime = time; v.play().catch(() => {}); } }, pause: () => { for (const v of clips()) v.pause(); },
    /** Render mode: is anything drawn under the clip at t? Then the combiner takes that layer as a separate picture. */
    hasUnder: t => views.some(({overlay}) => overlay.behind === true && t >= overlay.start && t < overlay.end),
    /** Render mode: is anything drawn behind the person at t? Then the combiner takes that layer as a third picture. */
    hasPerson: t => views.some(({overlay}) => overlay.behind === 'person' && t >= overlay.start && t < overlay.end),
    /** Which layers to show: 'under' (under the clip's windows), 'person' (behind the person), 'over' (on top), 'top' (under and over: everything
     *  but the person layer, for a frame with no separate under picture), 'both' (everything; the default). */
    layer: which => {
      under.style.display = ['under', 'top', 'both'].includes(which) ? '' : 'none';
      behindPerson.style.display = ['person', 'both'].includes(which) ? '' : 'none';
      over.style.display = ['over', 'top', 'both'].includes(which) ? '' : 'none';
    },
    /** Quality-check pass: show only the graphics captions must avoid (no captions, full-screen cutaways, scrims, graphics under the clip,
     *  or full-frame graphics behind the person). */
    occupancyMode: on => {
      layer.style.display = on ? 'none' : ''; under.style.display = on ? 'none' : '';
      for (const {overlay, outer, slice} of views) if (overlay.cutaway || /scrim|backdrop/.test(overlay.piece) || (overlay.behind === 'person' && !overlay.region)) for (const node of slice ? [...slice.halves, slice.cutBox] : [outer]) node.style.display = on ? 'none' : '';
    },
    /** What is on screen right now, for pipeline/qa.py: the face (null in a cutaway), the caption (box, words, size, colours),
     *  whether a cutaway is up or captions are hidden; with `texts`, also the size of the text inside graphics. */
    layout: texts => {
      const span = spans.find(s => time >= s.start && time < s.end), cap = [...captionSets.values()].find(s => s.host && s.host.style.visibility !== 'hidden' && s.phraseAt?.(time));
      const f = track && !cutawayOn(time) && faceSeen(track, time) ? locate(time) : null;      // no face where the tracker saw none (black under an app screen)
      return {t: time, face: f ? [f.x * width, f.y * height, (f.x + f.w) * width, (f.y + f.h) * height].map(v => Math.round(v)) : null,
        caption: cap ? measureCaption(cap.box, frame, width) : null, cutaway: cutawayOn(time), ...(track && !f && !cutawayOn(time) ? {noFace: true} : {}), hidden: !storyboard.captions || Boolean(span?.hide),
        ...(texts ? {texts: measureTexts(views.filter(v => v.outer.style.visibility !== 'hidden').map(v => [v.overlay.piece, v.outer]), frame, width)} : {})};
    },
    /** The words the captions are built from (words.json), for the caption sync check. */
    words: () => timeline.words.map(w => [w.text, w.start, w.end]), captions: Boolean(storyboard.captions)};
  window.__ready = true;
  if (renderMode) return;

  // ---------- preview panel ----------
  const fit = () => { const area = $('viewer').getBoundingClientRect(); frame.style.transform = `scale(${Math.min((area.width - 40) / width, (area.height - 40) / height)})`; };
  fit(); addEventListener('resize', fit);
  $('title').textContent = storyboard.title; $('cuts').hidden = true;
  $('note').textContent = `Footage with ${timeline.overlays.length} graphics from the ${theme.title} theme. The color grade, effects, transitions and sound effects are added when the video is made, not in this preview.`;
  $('next').textContent = `Make the video:  npm run make ${project}`;
  $('scrub').max = String(timeline.duration);
  $('shots').replaceChildren(...[...timeline.overlays].sort((a, b) => a.start - b.start).map(o => {
    const li = el('li', {}, el('div', {className: 'top'}, el('span', {}, o.piece + (o.theme ? ` · ${o.theme}` : '') + (o.cutaway ? ' · full screen' : '') + (o.behind === 'person' ? ' · behind the person (made video only; shown in front here)' : '') + (o.exit ? ' · slice exit' : '')), el('span', {}, `${o.start.toFixed(1)}s – ${o.end.toFixed(1)}s`)));
    li.addEventListener('click', () => { video.pause(); video.currentTime = o.start + .3; });
    return li;
  }));
  const extras = [blurred, windows[1]?.v].filter(Boolean);      // silent copies of the clip (backdrop, second window) follow the main one
  $('play').addEventListener('click', () => { if (video.paused) { if (video.ended) video.currentTime = 0; video.play(); } else video.pause(); });
  $('scrub').addEventListener('input', event => { video.pause(); video.currentTime = Number(event.target.value); });
  requestAnimationFrame(function tick() {
    seek(video.currentTime);                       // the video is the clock, so graphics never drift from the voice
    for (const copy of extras) { if (Math.abs(copy.currentTime - video.currentTime) > .12) copy.currentTime = video.currentTime; if (video.paused !== copy.paused) video.paused ? copy.pause() : copy.play().catch(() => {}); }
    $('play').textContent = video.paused ? 'Play' : 'Pause'; $('scrub').value = String(time); $('time').textContent = `${time.toFixed(1)}s / ${timeline.duration.toFixed(1)}s`;
    requestAnimationFrame(tick);
  });
}

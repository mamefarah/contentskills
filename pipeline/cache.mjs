// The per-frame graphics cache: what makes a re-make fast.
//
// Drawing a frame's graphics in headless Chrome is the slow part of making a video, and the picture of
// frame N is a pure function of what is on screen at that moment. So every drawn frame is kept in
//   projects/<name>/.cache/frames/<width>x<height>/<kk>/<key>.png      (.jpg for shot storyboards)
// (footage projects also keep the composited picture in half-second chunks, .cache/chunks/, and the joined video and
// the transitions pass in .cache/passes/ — see pipeline/combine.mjs)
// under a key that is a hash of everything that can affect it. On the next make only frames whose key
// changed are drawn. The folder is hidden from the server, git-ignored and safe to delete at any time.
//
// What goes into a key (anything else cannot change the picture):
//   - the output size and scale, and a fingerprint of the code every frame shares (pipeline/draft, pipeline/timeline.js,
//     pipeline/browser.mjs, library/_shared's scripts, the browser binary)
//   - each graphic on screen at that moment, in drawing order: its whole storyboard entry, how far into its
//     animation it is, a fingerprint of its piece file and everything that file imports, a fingerprint of its
//     theme (theme.json, kit, fonts), any picture files its props point to, and — only for pieces whose code reads
//     them — the project's numbers (props.project) and the face/zoom/layout track (props.locate)
//   - the captions: the style in force, a fingerprint of the theme's captions/, the words of the phrase on screen
//     (with their emphasis) and the time
// When in doubt a frame is drawn again: a piece that loads things in ways this file cannot follow is fingerprinted
// with its whole theme. `--no-cache` ignores the cache altogether and draws everything.
import {settings} from './settings.mjs';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync} from 'node:fs';
import {register} from 'node:module';
import {spawnSync} from 'node:child_process';
import {dirname, extname, join, relative, resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DEFAULT_THEME, projectStats} from './timeline.js';
import {phrases} from '../library/_shared/captions.js';
import {root, themeFile, themeParent} from './tools.mjs';
import {COMMON, themePath} from '../library/_shared/themes.js';
import {captionGroup} from '../library/_shared/style.js';

const VERSION = 1;                                   // bump to throw every cached frame away
const TEXT = new Set(['.js', '.mjs', '.json', '.css', '.html', '.svg', '.txt', '.py', '.glsl']);
export const sha = value => createHash('sha1').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const memo = (store, key, make) => { if (!store.has(key)) store.set(key, make()); return store.get(key); };

// ---------- fingerprints of files ----------
const stamps = new Map();
/** One file: its content if it is code or data, its size and modified time if it is a font, picture or clip. */
export function fileStamp(file) {
  return memo(stamps, file, () => {
    let stat; try { stat = statSync(file); } catch { return 'missing'; }
    if (!stat.isFile()) return 'not-a-file';
    return TEXT.has(extname(file).toLowerCase()) && stat.size < 4e6 ? sha(readFileSync(file)) : `${stat.size}:${Math.round(stat.mtimeMs)}`;
  });
}
function walk(dir, skip, out = []) {
  let names; try { names = readdirSync(dir).sort(); } catch { return out; }
  for (const name of names) {
    if (name.startsWith('.') || name === '__pycache__') continue;
    const path = join(dir, name), rel = relative(root, path).split(sep).join('/');
    if (skip?.(rel, name)) continue;
    if (statSync(path).isDirectory()) walk(path, skip, out); else out.push(path);
  }
  return out;
}
/** A fingerprint of files and folders (paths from the repo root). `skip(relativePath, name)` leaves things out. */
export const fingerprint = (paths, skip = null) => sha(paths.flatMap(p => { const full = join(root, p); return existsSync(full) && statSync(full).isDirectory() ? walk(full, skip) : [full]; }).map(f => relative(root, f) + '=' + fileStamp(f)).join('\n'));

const lazy = new Map();
/**
 * Code files reached from `entries` by static imports (relative and from-the-root, plus an HTML page's own scripts and
 * stylesheets): [[path relative to the root, stamp]], sorted.
 */
function codeClosure(entries, skip = () => false) {
  const seen = new Map(), queue = entries.map(e => join(root, e));
  while (queue.length) {
    const file = queue.pop(); if (seen.has(file)) continue;
    const rel = relative(root, file).split(sep).join('/'); if (skip(rel)) continue;
    let source; try { source = readFileSync(file, 'utf8'); } catch { seen.set(file, 'missing'); continue; }
    seen.set(file, sha(source));
    const code = source.split('\n').filter(line => !/^\s*(\/\/|\/?\*)/.test(line)).join('\n');
    const specs = [...code.matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g), ...(file.endsWith('.html') ? code.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+\.(?:js|mjs|css))["']/g) : [])].map(m => m[1]);
    for (const spec of specs) { if (spec.startsWith('/')) queue.push(join(root, spec)); else if (spec.startsWith('.') || !spec.includes(':')) queue.push(resolve(dirname(file), spec)); }
  }
  return [...seen].map(([file, stamp]) => [relative(root, file).split(sep).join('/'), stamp]).sort();
}
/**
 * Code every frame shares: what the draft page loads to draw a frame, followed import by import from the page itself
 * (pipeline/draft/index.html), so an edit elsewhere in library/_shared or pipeline (a Python effect, the quality check, an
 * unrelated module) no longer redraws every frame of every video. What the page loads by a computed address (themes,
 * pieces, the project's own files) is in each frame's key on its own. library/_shared/inspect.js only measures what is
 * drawn (for the quality check) and changes no pixel, so it is left out.
 */
const DRAW_ENTRIES = ['pipeline/draft/index.html', 'pipeline/draft/player.js', 'pipeline/draft/footage.js'];
// pipeline/browser.mjs (how Chrome is opened) counts as one file: what it imports is the local server, which draws nothing
const baseStamp = browser => memo(lazy, 'base:' + browser, () => sha([VERSION, codeClosure(DRAW_ENTRIES, rel => rel === 'library/_shared/inspect.js'), fileStamp(join(root, 'pipeline/browser.mjs')), browser && fileStamp(browser),
  JSON.stringify(settings().me ?? {})]));   // the user's name, handle, … fill `{me.x}` piece defaults (pipeline/settings.mjs)
/** A theme without its pieces (each has its own fingerprint), its captions (theirs too) and its effects and transitions (applied later, in Python). */
const themeStamp = theme => memo(lazy, 'theme:' + theme, () => fingerprint([`library/${themePath(theme)}`], rel => /^library\/(?:themes\/[^/]+|ui\/[^/]+)\/(effects|transitions|captions|[^/]+\/pieces|lottie\/animations)$/.test(rel)));
const captionStamp = theme => memo(lazy, 'captions:' + theme, () => sha([fingerprint([`library/${themePath(theme)}/captions`]), themeStamp(theme)]));
/** The themes a theme extends (theme.json "extends"), as library paths: their pieces are its pieces too. */
function parentsOf(theme) {
  const out = []; let dir = join(root, 'library', themePath(theme));
  for (let hop = 0, p; hop < 4 && (p = themeParent(dir)); hop++) { dir = join(dir, '..', p); out.push('library/' + relative(join(root, 'library'), dir).split(sep).join('/')); }
  return out;
}
const everyPiece = theme => memo(lazy, 'pieces:' + theme, () => fingerprint([`library/${themePath(theme)}`, ...parentsOf(theme)], rel => /^library\/(?:themes\/[^/]+|ui\/[^/]+)\/(effects|transitions|captions)$/.test(rel)));

/**
 * One piece: {stamp, project, locate}. The stamp covers the piece file and every module it imports (followed through
 * relative and from-the-root imports); `project` / `locate` say whether any of that code mentions props.project / props.locate.
 * Code that loads things this cannot follow (computed imports, fetch, import.meta) falls back to the whole theme.
 */
function pieceInfo(theme, id) {
  return memo(lazy, `piece:${theme}/${id}`, () => {
    const [category, name] = String(id).split('/'), dir = join(root, 'library', themePath(theme));
    if (category === 'lottie') return {stamp: sha(['lottie', fileStamp(join(dir, 'lottie/animations', name + '.json'))]), project: false, locate: false};
    // the same lookup as library/_shared/loader.js importPiece: the theme's own piece, else the shared one
    const own = join(dir, category, 'pieces', name + '.js'), shared = join(root, 'library', COMMON, category, 'pieces', name + '.js');
    const common = !existsSync(themeFile(own)) && existsSync(shared);      // themeFile: a theme that extends another reads the parent's piece at its own address
    const seen = new Map(), queue = [common ? shared : own];
    let opaque = false, project = false, locate = false;
    while (queue.length) {
      const file = queue.pop(); if (seen.has(file)) continue;
      let source; try { source = readFileSync(themeFile(file), 'utf8'); } catch { seen.set(file, 'missing'); opaque = true; continue; }
      seen.set(file, sha(source));
      const code = source.split('\n').filter(line => !/^\s*(\/\/|\/?\*)/.test(line)).join('\n');      // whole-line comments only: anything else counts as code
      project ||= /\bproject\b/.test(code); locate ||= /\blocate\b/.test(code);
      if (/\bimport\s*\(\s*[^'"\s)]/.test(code) || /\bfetch\s*\(|import\.meta|\bWorker\s*\(|XMLHttpRequest/.test(code)) opaque = true;
      for (const m of code.matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        if (spec.startsWith('/')) queue.push(join(root, spec)); else if (spec.startsWith('.')) queue.push(resolve(dirname(file), spec)); else opaque = true;
      }
    }
    const files = [...seen].map(([file, stamp]) => relative(root, file) + '=' + stamp).sort();
    return {stamp: sha([files, opaque ? everyPiece(theme) : null, ...(opaque && common ? [fingerprint([`library/${COMMON}`])] : [])]), project: project || opaque, locate: locate || opaque};
  });
}

/** Picture (or other) files a piece is handed by address in its props: "/projects/<name>/storyboard-frames/01-hook.jpg". */
function filesIn(value, out = []) {
  if (typeof value === 'string') { if (/^\/(projects|library|pipeline|dashboard)\/[^?#]+\.[a-z0-9]{2,5}$/i.test(value)) out.push(value + '=' + fileStamp(join(root, value))); }
  else if (value && typeof value === 'object') for (const v of Object.values(value)) filesIn(v, out);
  return out;
}

// ---------- captions: which phrase is on screen ----------
// The theme's captions/styles.js imports the engine by its address on the server ("/library/_shared/captions.js");
// this teaches Node the same addresses so the very same file can be read here for its phrase grouping.
let hooked = false;
const styleSets = new Map();
async function captionStyle(theme, id) {
  if (!hooked) { hooked = true; register('data:text/javascript,' + encodeURIComponent(`const base = ${JSON.stringify(pathToFileURL(root + sep).href)}; export function resolve(s, c, next) { return next(/^\\/(library|pipeline)\\//.test(s) ? new URL('.' + s, base).href : s, c); }`)); }
  const styles = await memo(styleSets, theme, async () => { try { return (await import(pathToFileURL(join(root, 'library', themePath(theme), 'captions/styles.js')).href)).styles ?? []; } catch { return null; } });
  return styles === null ? {unreadable: true} : styles.find(s => s.id === id) ?? null;
}

/** The style a storyboard names ("style": "profile" | "<reference>" | {...}), read from disk; null without one. Mirrors resolveStyle in library/_shared/style.js. */
export function readStyle(storyboard) {
  const spec = storyboard.style; if (!spec) return null; if (typeof spec === 'object') return spec;
  const file = join(root, spec === 'profile' ? 'style/profile.json' : `style/references/${spec}/style.json`);
  if (!existsSync(file)) throw Error(`No such style: "${spec}" (looked for ${relative(root, file)}). Make one with npm run style -- from <reel>`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

// ---------- the store ----------
/** Where a project's cache lives. */
export const cacheDir = project => join(root, 'projects', project, '.cache');
/** A folder of files named by key. `put` writes atomically, so an interrupted render never leaves half a picture behind. */
export function frameStore(project, width, height, ext, kind = 'frames') {
  const dir = join(cacheDir(project), kind, `${width}x${height}`);
  const path = (key, layer = '') => join(dir, key.slice(0, 2), `${key}${layer}.${ext}`);
  return {dir, path,
    has: (key, layer = '') => { try { return statSync(path(key, layer)).size > 0; } catch { return false; } },
    put(key, data, layer = '') { const file = path(key, layer), tmp = `${file}.${process.pid}.tmp`; mkdirSync(dirname(file), {recursive: true}); writeFileSync(tmp, data); renameSync(tmp, file); },
    /** Mark as used now, so pruning removes the least recently used first. */
    touch(key, layer = '') { try { const now = new Date(); utimesSync(path(key, layer), now, now); } catch {} },
  };
}
/** Keep a project's cached frames and chunks under a size (default 3 GB, CONTENTSKILLS_CACHE_MB): the least recently used go first, never the ones in `keep`. */
export function prune(project, keep = new Set(), maxBytes = (Number(process.env.CONTENTSKILLS_CACHE_MB) || 3000) * 1e6) {
  const files = [...walk(join(cacheDir(project), 'frames')), ...walk(join(cacheDir(project), 'chunks'))].map(file => ({file, stat: statSync(file)}));
  let total = files.reduce((n, f) => n + f.stat.size, 0), removed = 0;
  for (const f of files.sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs)) {
    if (f.file.endsWith('.tmp') && Date.now() - f.stat.mtimeMs > 3600e3) { rmSync(f.file, {force: true}); total -= f.stat.size; continue; }      // left by a killed render
    if (total <= maxBytes) break;
    if (keep.has(f.file)) continue;
    rmSync(f.file, {force: true}); total -= f.stat.size; removed++;
  }
  return {bytes: total, removed};
}

// ---------- keys ----------
/**
 * Footage projects: one key per frame for its graphics picture, plus whether that frame also has a separate picture
 * of the graphics that go under the clip's windows ("behind": true, with layouts), and whether it has one of the graphics that go
 * behind the person ("behind": "person"). Mirrors seek() in pipeline/draft/footage.js — keep the two in step.
 * @returns {keys: [string], under: [boolean], person: [boolean]}
 */
export async function footageFrameKeys(project, storyboard, timeline, {scale, frames, words, edl, browser = null}) {
  const {width, height, fps} = timeline.format, baseTheme = storyboard.theme ?? DEFAULT_THEME, duration = timeline.duration;
  const look = readStyle(storyboard), head = sha(['footage', baseStamp(browser), width, height, scale, look]);
  const stats = sha(projectStats(storyboard, edl)), track = sha([storyboard.zooms ?? [], storyboard.layouts ?? [], timeline.track, timeline.format]);
  const overlays = timeline.overlays.map(o => {
    const theme = o.theme ?? baseTheme, info = pieceInfo(theme, o.piece), {index, life, end, ...spec} = o;
    return {start: o.start, end, offset: o.offset ?? 0, behind: o.behind === true, person: o.behind === 'person',
      // an "exit" slice behind the person aims its cut line just above the head, so it depends on the face track too
      fixed: sha([storyboard.overlays[index], life, theme, info.stamp, themeStamp(theme), filesIn(o.props), info.project ? stats : 0, info.locate ? track : 0, o.cutaway ? 1 : 0, ...(o.exit ? [track] : [])])};
  });
  const spans = storyboard.captionTrack ?? [], sets = new Map();
  const setFor = async (style, theme) => {
    const id = theme + '/' + style; if (sets.has(id)) return sets.get(id);
    // the style's captions replace the theme's (as in pipeline/draft/footage.js): a one-word track style stays one word
    const one = style !== storyboard.captions && /word/.test(style);
    const found = look?.captions ? {group: one ? {...captionGroup(look.captions), maxWords: 1} : captionGroup(look.captions)} : await captionStyle(theme, style);
    // No such style: nothing is drawn. A style file Node cannot read: every word counts, so any change to the words re-draws.
    const set = !found ? null : found.unreadable ? {stamp: sha([id, captionStamp(theme), words]), list: null} : {stamp: sha([id, captionStamp(theme)]), list: phrases(words, found.group)};
    sets.set(id, set); return set;
  };
  const main = storyboard.captions ? await setFor(storyboard.captions, baseTheme) : null;
  const spanSets = []; for (const span of spans) spanSets.push(span.hide ? null : span.style ? await setFor(span.style, span.theme ?? baseTheme) : main);
  // Captions place themselves off the face and clear of graphics (library/_shared/placement.js): what decides where they go.
  const placement = storyboard.captionPlacement === 'fixed' ? 0 : sha([track, fileStamp(join(root, 'library/_shared/placement.js')), fileStamp(join(root, 'projects', project, 'out/occupancy.json'))]);
  const ramp = (t, a, b, len = .16) => Math.max(0, Math.min(1, (t - a) / len, (b - t) / len));
  const keys = [], under = [], person = [];
  for (let frame = 0; frame < frames; frame++) {
    const time = Math.max(0, Math.min(duration, frame / fps));
    const on = overlays.filter(o => time >= o.start && time < o.end).map(o => [o.fixed, time - o.start + o.offset]);
    const at = spans.findIndex(s => time >= s.start && time < s.end), set = at >= 0 ? spanSets[at] : main;
    let caption = null;
    if (set) { const phrase = set.list ? set.list.find(p => time >= p.start && time < p.end) : true; if (phrase) caption = [set.stamp, phrase === true ? null : phrase, time, placement]; }
    const moved = spans.filter(s => s.dy && ramp(time, s.start, s.end) > 0).map(s => [s.start, s.end, s.dy]);
    const split = Boolean(timeline.layouts) && overlays.some(o => o.behind && time >= o.start && time < o.end);
    const cut = overlays.some(o => o.person && time >= o.start && time < o.end);      // a third picture: graphics behind the person
    under.push(split); person.push(cut);
    // A frame with nothing on it is the same empty picture whenever it happens; otherwise the time is part of what is drawn.
    keys.push(sha([head, on, caption, caption ? moved.map(m => [...m, time]) : [], split, ...(cut ? ['person'] : [])]));
  }
  return {keys, under, person};
}

/**
 * Shot storyboards: one key per frame of the whole picture. Mirrors seek() in pipeline/draft/player.js — keep the two in step.
 */
export async function shotFrameKeys(project, storyboard, timeline, {scale, frames, browser = null}) {
  const {width, height, fps} = timeline.format, theme = storyboard.theme ?? DEFAULT_THEME;
  const look = readStyle(storyboard), head = sha(['shots', baseStamp(browser), themeStamp(theme), width, height, scale, look, storyboard.room ?? null, storyboard.captionAt ?? null]);
  const found = look?.captions ? {group: captionGroup(look.captions)} : storyboard.captions ? await captionStyle(theme, storyboard.captions) : null;
  const placement = storyboard.captionPlacement === 'fixed' ? 0 : fileStamp(join(root, 'library/_shared/placement.js'));      // captions kept inside the safe zone
  const captions = !found ? null : found.unreadable ? {stamp: sha([storyboard.captions, captionStamp(theme), timeline.words]), list: null} : {stamp: sha([storyboard.captions, captionStamp(theme)]), list: phrases(timeline.words, found.group)};
  const shots = timeline.shots.map(shot => ({start: shot.start, end: shot.end, fixed: sha([shot.title ?? '', ...(shot.camera ? [shot.camera] : []), ['background', 'visual'].map(slot => shot[slot]?.piece ? [shot[slot], pieceInfo(shot[slot].theme ?? theme, shot[slot].piece).stamp, filesIn(shot[slot].props)] : null)])}));
  // the presenter talks along the whole narration, so its frames depend on the absolute time and on every clip
  const presenter = storyboard.presenter ? sha([storyboard.presenter, fingerprint(['library/_shared/presenters']), timeline.shots.map(s => s.audio ? [s.audio.file, s.audio.at, fileStamp(join(root, 'projects', project, 'voice', s.audio.file))] : null)]) : null;
  const keys = [];
  for (let frame = 0; frame < frames; frame++) {
    const time = Math.max(0, Math.min(timeline.duration, frame / fps)), shot = shots.find(s => time >= s.start && time < s.end) ?? shots.at(-1);
    let caption = null;
    if (captions) { const phrase = captions.list ? captions.list.find(p => time >= p.start && time < p.end) : true; if (phrase) caption = [captions.stamp, phrase === true ? null : phrase, time, placement]; }
    keys.push(sha([head, shot.fixed, time - shot.start, caption, presenter && [presenter, time]]));
  }
  return {keys};
}

/**
 * Per-effect code fingerprints for the composited chunks (pipeline/effect_stamps.py): {base, builtin, effects: {name: stamp}},
 * so a chunk's key holds only the code of the effects on it and an edit to one effect re-makes only the chunks it is on.
 * Computed once per change of the Python (kept in the project's cache folder); null if the script fails, and the caller
 * then falls back to the whole files.
 */
export function effectStamps(project, themeDirs, python) {
  const files = fingerprint(['library/_shared', 'pipeline/composite.py', 'pipeline/effect_stamps.py'], (rel, name) => /^library\/_shared\/(sample|sfx|music|vendor|presenters)$/.test(rel) || (!name.includes('.') ? false : !name.endsWith('.py')));
  const key = sha([VERSION, files, themeDirs.map(dir => [relative(root, dir), fileStamp(join(dir, 'effects/theme_effects.py'))])]);
  const file = join(cacheDir(project), 'effect-stamps.json');
  try { const kept = JSON.parse(readFileSync(file, 'utf8')); if (kept.key === key) return kept.stamps; } catch {}
  const r = spawnSync(python, [join(root, 'pipeline/effect_stamps.py'), ...themeDirs], {encoding: 'utf8', maxBuffer: 1 << 24});
  let stamps = null; try { stamps = r.status === 0 ? JSON.parse(r.stdout) : null; } catch {}
  if (!stamps) { console.warn('  (could not fingerprint the effects one by one, so every chunk is keyed on the whole effects code)'); return null; }
  mkdirSync(dirname(file), {recursive: true}); writeFileSync(file, JSON.stringify({key, stamps}));
  return stamps;
}

/** A fingerprint of the Python that turns graphics and footage into the finished picture, for the pass stamps in combine.mjs. */
export const passStamp = (files, themeDirs = []) => sha([VERSION, fingerprint(files), themeDirs.map(dir => [relative(root, dir), fileStamp(join(dir, 'effects/theme_effects.py')), fileStamp(join(dir, 'transitions/theme_transitions.py'))])]);

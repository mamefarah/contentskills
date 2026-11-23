// The user's settings: settings/defaults.json, overridden key by key by settings/user.json (git-ignored, their own:
// name, handle, loudness, …). CONTENTSKILLS_SETTINGS=<path> points at another user file. Same merge as pipeline/settings.py
// and library/_shared/settings.js (the browser side, through GET /api/settings).
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const DEFAULTS_FILE = join(root, 'settings/defaults.json');
export const userFile = () => process.env.CONTENTSKILLS_SETTINGS ? resolve(process.env.CONTENTSKILLS_SETTINGS) : join(root, 'settings/user.json');

const isObject = v => v && typeof v === 'object' && !Array.isArray(v);
export function merge(base, over) {
  if (!isObject(base) || !isObject(over)) return over === undefined ? base : over;
  const out = {...base};
  for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
  for (const k of Object.keys(out)) if (k.startsWith('_')) delete out[k];   // "_about" notes are for people
  return out;
}
const read = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch (error) { if (existsSync(file)) throw Error(`${file}: ${error.message}`); return {}; } };

const NUMBERS = ['audio.voiceLufs', 'audio.truePeak', 'audio.music.gain', 'audio.music.max', 'audio.music.duck', 'audio.effects.gain', 'audio.effects.offset', 'audio.effects.max', 'audio.effects.duck', 'captions.bottom'];
const OBJECTS = ['me', 'audio', 'audio.music', 'audio.effects', 'captions', 'style'];
const at = (o, path) => path.split('.').reduce((v, k) => isObject(v) ? v[k] : undefined, o);
/** What is wrong with a settings object, as sentences (empty: fine). */
export function settingsProblems(s) {
  if (!isObject(s)) return ['The file must hold one JSON object: {"me": {...}, "audio": {...}}.'];
  return [...OBJECTS.filter(p => at(s, p) !== undefined && !isObject(at(s, p))).map(p => `"${p}" must be an object.`),
    ...NUMBERS.filter(p => at(s, p) !== undefined && !(typeof at(s, p) === 'number' && Number.isFinite(at(s, p)))).map(p => `"${p}" must be a number, not ${JSON.stringify(at(s, p))}.`)];
}
/** The merged settings, read from disk now (the server, which runs for hours). Throws a plain sentence when settings/user.json is not valid. */
export function readSettings() {
  const defaults = read(DEFAULTS_FILE), user = read(userFile()), problems = settingsProblems(user);
  if (problems.length) throw Error(`${userFile()}: ${problems.join(' ')}`);
  return merge(defaults, user);
}
/** For pages: never throws. A broken settings/user.json gives the defaults plus {error}, so the dashboard stays up and says why. */
export function readSettingsSafe() {
  try { return readSettings(); } catch (error) { return {...merge(read(DEFAULTS_FILE), {}), error: error.message}; }
}
let memo;
/** The merged settings, read once per process (commands). */
export const settings = () => memo ??= readSettings();
/** Changes when either file changes: part of the cache key of everything drawn with the settings. */
export function settingsStamp() {
  return [DEFAULTS_FILE, userFile()].map(f => existsSync(f) ? readFileSync(f, 'utf8') : '-').join('\n');
}
/** The voice level every video is normalised to (LUFS): settings audio.voiceLufs. A storyboard's "voiceLufs" overrides it per video. */
export const houseLufs = () => Number(settings().audio?.voiceLufs ?? -14);

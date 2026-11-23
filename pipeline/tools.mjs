// Where the pipeline's own tools live. Everything is installed under .tools/ by `npm run setup`,
// so the system needs nothing outside this folder.
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));
export const tools = join(root, '.tools');
const WIN = process.platform === 'win32';
/** A Python environment's interpreter: bin/python on macOS and Linux, Scripts\python.exe on Windows. */
const venvPython = dir => join(dir, WIN ? 'Scripts/python.exe' : 'bin/python');
/** The headless browser's file name (Windows adds .exe). */
export const browserName = 'chrome-headless-shell' + (WIN ? '.exe' : '');
export const paths = {
  voicePython: venvPython(join(tools, 'venv-voice')),
  effectsPython: venvPython(join(tools, 'venv-effects')),
  voiceModels: join(tools, 'voice-models'),
  transcribePython: venvPython(join(tools, 'venv-transcribe')),
  transcribeModels: join(tools, 'transcribe-models'),
  browser: join(tools, 'browser'),
};
/** The three voice-model files, their sources, and the checksums they must match. */
export const voiceModelFiles = [
  {name: 'kokoro-v1.1-zh.onnx', sha256: '859f9ded9f53be16c24857cdab3254a45da53c3afd5ba6ef134c7de3f822e326', url: 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.1-zh.onnx'},
  {name: 'voices-v1.1-zh.bin', sha256: '14cb6186c99e4f6016871405f62046c5df863ae27465cbdc4ee08be7dd703acd', url: 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.1-zh.bin'},
  {name: 'config.json', sha256: 'bc333efa5ce4ceff433c8c8e5d027a1eca0166001e4e4a62bea2d26ff7a46890', url: 'https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh/resolve/main/config.json'},
];

const need = (path, what) => { if (!existsSync(path)) throw Error(`${what} is not installed. Run:  npm run setup`); return path; };
export const voicePython = () => process.env.CONTENTSKILLS_VOICE_PYTHON || need(paths.voicePython, 'The local voice');
export const voiceModels = () => process.env.CONTENTSKILLS_VOICE_MODELS || need(paths.voiceModels, 'The local voice model');
export const transcribePython = () => process.env.CONTENTSKILLS_TRANSCRIBE_PYTHON || need(paths.transcribePython, 'The transcriber');
export const transcribeModels = () => process.env.CONTENTSKILLS_TRANSCRIBE_MODELS || need(paths.transcribeModels, 'The speech model folder');
export const effectsPython = () => process.env.CONTENTSKILLS_EFFECTS_PYTHON || need(paths.effectsPython, 'The effects engine');

/** Find a file called `name` somewhere under dir (the browser download nests its binary a few folders deep). */
export function findFile(dir, name) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (entry === name && statSync(path).isFile()) return path;
    if (statSync(path).isDirectory() && !entry.endsWith('.app')) { const found = findFile(path, name); if (found) return found; }
  }
  return null;
}
export function browserBinary() {
  const chosen = process.env.CHROME_PATH;   // the user's own browser wins
  if (chosen) return chosen;
  const found = findFile(paths.browser, browserName);
  if (!found) throw Error('The headless browser is not installed. Run:  npm run setup');
  return found;
}

/**
 * A theme may extend another ("extends": "<theme>" in its theme.json): a piece file it does not have itself is the
 * parent's, read at the child's address, so the piece's relative imports (../../kit.js) still load the child's own kit.
 * One theme then restyles another by its kit alone, without a copy of every piece. Given the file a piece is asked for
 * (library/themes/<theme>/<category>/pieces/<name>.js), returns the file to read: itself, or the nearest parent's.
 * Used by the local server (the browser's imports), the frame cache (fingerprints) and nothing else.
 */
export function themeFile(file) {
  for (let hop = 0; hop < 4 && !existsSync(file); hop++) {
    const m = /^(.*[\\/]library[\\/]themes[\\/])([^\\/]+)([\\/][^\\/]+[\\/]pieces[\\/][^\\/]+\.js)$/.exec(file); if (!m) break;
    const parent = themeParent(m[1] + m[2]); if (!parent) break;
    file = m[1] + parent + m[3];
  }
  return file;
}
/** The theme a theme folder extends, or null. */
export function themeParent(dir) {
  try { const p = JSON.parse(readFileSync(join(dir, 'theme.json'), 'utf8')).extends; return typeof p === 'string' && /^[a-z0-9-]+$/.test(p) && existsSync(join(dir, '..', p)) ? p : null; } catch { return null; }
}

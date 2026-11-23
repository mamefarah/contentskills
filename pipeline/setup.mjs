#!/usr/bin/env node
// One-time setup: installs the pipeline's own tools into .tools/ .
//   npm run setup
// - Python environment for the local voice (Kokoro)      -> .tools/venv-voice
// - Python environment for effects and transitions (OpenCV, moderngl) -> .tools/venv-effects
// - Python environment for transcribing footage (faster-whisper) -> .tools/venv-transcribe
// - The Kokoro voice model (about 380 MB)                -> .tools/voice-models
// - The Whisper small.en speech model (about 470 MB)     -> .tools/transcribe-models
// - A headless Chrome for combining video                -> .tools/browser
// Needs `uv` and FFmpeg on PATH. Safe to run again: finished steps are skipped.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, createReadStream, createWriteStream, existsSync, mkdirSync, rmSync} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {join} from 'node:path';
import {root, tools, paths, voiceModelFiles, findFile, browserName} from './tools.mjs';

const WIN = process.platform === 'win32';
const run = (command, args) => { if (spawnSync(command, args, {stdio: 'inherit', shell: WIN && command === 'npx'}).status !== 0) throw Error(`${command} ${args[0]} failed`); };
const has = command => spawnSync(WIN ? 'where' : 'which', [command]).status === 0;
const sha256 = async file => { const hash = createHash('sha256'); await pipeline(createReadStream(file), hash); return hash.digest('hex'); };

function venv(name, python, requirements, probe) {
  if (existsSync(python) && spawnSync(python, ['-c', probe]).status === 0) { console.log(`✓ ${name} environment`); return; }
  console.log(`… installing ${name} environment`);
  const dir = join(python, '../..');
  rmSync(dir, {recursive: true, force: true});
  run('uv', ['venv', '--python', '3.13', '--quiet', dir]);
  run('uv', ['pip', 'install', '--quiet', '--python', python, '-r', join(root, 'pipeline', requirements)]);
  if (spawnSync(python, ['-c', probe]).status !== 0) throw Error(`${name} environment installed but does not import correctly`);
  console.log(`✓ ${name} environment`);
}

try {
  for (const command of ['uv', 'ffmpeg']) if (!has(command)) throw Error(`"${command}" is required and was not found on PATH.`);
  mkdirSync(tools, {recursive: true});
  venv('voice', paths.voicePython, 'requirements-voice.txt', 'import kokoro_onnx, phonemizer, soundfile');
  venv('effects', paths.effectsPython, 'requirements-effects.txt', 'import cv2, numpy, moderngl');
  venv('transcribe', paths.transcribePython, 'requirements-transcribe.txt', 'import faster_whisper, av');

  // The speech model: faster-whisper downloads it the first time footage is transcribed.
  mkdirSync(paths.transcribeModels, {recursive: true});
  const speech = join(paths.transcribeModels, 'faster-whisper-small.en');
  if (existsSync(join(speech, 'model.bin'))) console.log('✓ speech model: small.en');
  else console.log('· speech model small.en will be downloaded the first time footage is transcribed');

  mkdirSync(paths.voiceModels, {recursive: true});
  for (const file of voiceModelFiles) {
    const target = join(paths.voiceModels, file.name);
    if (!existsSync(target) || await sha256(target) !== file.sha256) {
      console.log(`… downloading ${file.name}`);
      const response = await fetch(file.url);
      if (!response.ok) throw Error(`Could not download ${file.url} (${response.status})`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
      if (await sha256(target) !== file.sha256) { rmSync(target); throw Error(`${file.name} does not match its expected checksum; removed it.`); }
    }
    console.log(`✓ voice model: ${file.name}`);
  }

  if (!findFile(paths.browser, browserName)) {
    console.log('… downloading headless browser'); run('npx', ['--yes', '@puppeteer/browsers', 'install', 'chrome-headless-shell@stable', '--path', paths.browser]);
  }
  console.log(`✓ headless browser`);
  console.log('\nSetup complete. Next: npm run dashboard, then ask your agent for a video (docs/REFERENCE.md has two walkthroughs).');
} catch (error) { console.error('Setup failed: ' + error.message); process.exitCode = 1; }

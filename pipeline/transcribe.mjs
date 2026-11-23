#!/usr/bin/env node
// Word-level transcript of a recording, made locally (faster-whisper, pipeline/transcribe.py):
//   node pipeline/transcribe.mjs <video or audio file> <words.json>
import {resolve} from 'node:path';
import {transcribe} from './cut.mjs';

try {
  const [media, output] = process.argv.slice(2);
  if (!media || !output) throw Error('Usage: node pipeline/transcribe.mjs <video or audio file> <words.json>');
  transcribe(resolve(media), resolve(output));
} catch (error) { console.error(error.message); process.exitCode = 1; }

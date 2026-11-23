#!/usr/bin/env node
// Stage 1b: narrate a storyboard. Free local Kokoro by default; "voice": {"provider": "elevenlabs", ...} uses the
// paid ElevenLabs voice (pipeline/voice_elevenlabs.py; spends credits, only for new or changed lines).
//   node pipeline/voice.mjs <project>          node pipeline/voice.mjs --list-elevenlabs
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {root, readStoryboard} from './check.mjs';
import {voicePython, voiceModels} from './tools.mjs';

try {
  const project = process.argv[2];
  const eleven = join(root, 'pipeline/voice_elevenlabs.py');
  if (project === '--list-elevenlabs') { process.exitCode = spawnSync(voicePython(), [eleven, '--list'], {stdio: 'inherit'}).status ?? 1; process.exit(); }
  const storyboard = readStoryboard(project);
  // "provider": "recorded": the narration was made elsewhere (e.g. one ElevenLabs take split per shot by a project
  // script) and is already in voice/voice.json. Nothing is generated; it only checks every line is covered.
  if (storyboard?.voice?.provider === 'recorded') {
    const {readFileSync, existsSync} = await import('node:fs');
    const file = join(root, 'projects', project, 'voice/voice.json');
    const spoken = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).shots ?? {} : {};
    const missing = storyboard.shots.filter(s => s.narration && spoken[s.id]?.text !== s.narration.trim()).map(s => s.id);
    if (missing.length) throw Error(`Recorded narration is missing or out of date for: ${missing.join(', ')} (voice/voice.json). Re-record or re-split it.`);
    console.log(`Recorded narration covers all ${storyboard.shots.length} shots (voice/voice.json); nothing to generate.`);
    process.exit(0);
  }
  const args = storyboard?.voice?.provider === 'elevenlabs' ? [eleven, join(root, 'projects', project)]
    : [join(root, 'pipeline/voice.py'), join(root, 'projects', project), voiceModels()];
  const result = spawnSync(voicePython(), args, {stdio: 'inherit'});
  process.exitCode = result.status ?? 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }

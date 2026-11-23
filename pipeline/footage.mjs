#!/usr/bin/env node
// Start a project from recorded footage (a talking head):
//   node pipeline/footage.mjs <project> <video file> [words.json] [--theme <theme>]
// Copies the video in as 1080x1920, finds the face through it, and — if there is no storyboard
// yet — writes a starter one with the theme's base treatment so a video can be made straight away.
// Word timings: pass a words.json ({words: [{text, start, end}]}); without one the clip is transcribed
// locally (pipeline/transcribe.py). For a raw recording, tighten it first: npm run cut (pipeline/cut.mjs).
import {spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {themePath} from '../library/_shared/themes.js';
import {root} from './check.mjs';
import {effectsPython} from './tools.mjs';
import {DEFAULT_THEME} from './timeline.js';
import {transcribe} from './cut.mjs';

try {
  const args = process.argv.slice(2), themeFlag = args.indexOf('--theme');
  const theme = themeFlag >= 0 ? args.splice(themeFlag, 2)[1] : DEFAULT_THEME;
  const uncutFlag = args.indexOf('--uncut'), uncut = uncutFlag >= 0; if (uncut) args.splice(uncutFlag, 1);
  const [project, video, words] = args;
  if (!/^[a-z0-9-]+$/.test(project || '') || !video) throw Error('Usage: node pipeline/footage.mjs <project> <video file> [words.json] [--theme <theme>] [--uncut]');
  // The clean-up cut (silences, fillers, false starts, -14 LUFS) comes first: footage takes its clean.mp4, never a raw take.
  // --uncut is only for clips that are already edited or too short to cut; it is recorded in the storyboard.
  const clean = join(root, 'projects', project, 'edit', 'clean.mp4');
  if (!uncut && resolve(video) !== clean) throw Error(`Cut the raw take first:\n  npm run cut ${project} ${video}\nthen: npm run footage ${project} projects/${project}/edit/clean.mp4 projects/${project}/edit/words.json\n(Only for a clip that is already edited or too short to cut: add --uncut.)`);
  const dir = join(root, 'projects', project); mkdirSync(dir, {recursive: true});
  const run = (command, args, what) => { if (spawnSync(command, args, {stdio: 'inherit'}).status !== 0) throw Error(what + ' failed.'); };
  // Fill a 9:16 frame: scale up to cover, crop the overflow.
  run('ffmpeg', ['-v', 'error', '-y', '-i', resolve(video), '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30', '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', join(dir, 'footage.mp4')], 'Preparing the footage');
  run(effectsPython(), [join(root, 'pipeline/faces.py'), join(dir, 'footage.mp4'), join(dir, 'faces.json'), join(root, 'library/models/yunet/face_detection_yunet_2026may.onnx')], 'Face detection');
  if (words) copyFileSync(resolve(words), join(dir, 'words.json'));
  else transcribe(join(dir, 'footage.mp4'), join(dir, 'words.json'));      // locally, with faster-whisper
  const faces = JSON.parse(readFileSync(join(dir, 'faces.json'), 'utf8')), file = join(dir, 'storyboard.json');
  // How bright is the picture where the captions sit (a white top, a pale wall)? White letters with no box of their own
  // need a contrast of 3:1, which fails once the background's relative luminance passes 0.3. Measured twice a second on
  // the caption band, and kept in faces.json so `npm run check` can refuse an unreadable caption style before the make.
  const band = spawnSync('ffmpeg', ['-v', 'error', '-i', join(dir, 'footage.mp4'), '-vf', 'fps=2,crop=880:230:100:1440,scale=1:1,format=gray', '-f', 'rawvideo', '-'], {maxBuffer: 1 << 24}).stdout ?? Buffer.alloc(0);
  const luminance = [...band].map(g => { const v = g / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  faces.captionBand = {light: luminance.length ? +(luminance.filter(l => l > .3).length / luminance.length).toFixed(2) : 0, samples: luminance.length};
  writeFileSync(join(dir, 'faces.json'), JSON.stringify(faces));
  if (!existsSync(file)) {
    // A neutral starting point that exists in every theme: its first caption style and two text effects.
    const themeDir = join(root, 'library', themePath(theme));
    if (!existsSync(themeDir)) throw Error(`No such theme "${theme}".`);
    const styles = JSON.parse(readFileSync(join(themeDir, 'captions/catalog.json'), 'utf8')).items;
    const captions = (faces.captionBand.light > .15 && styles.find(i => i.backed) || styles[0]).id;      // bright behind the captions: start on a style with its own box
    const hasText = existsSync(join(themeDir, 'text/catalog.json'));
    writeFileSync(file, JSON.stringify({
      title: project, theme, captions, plan: 'plan.json',      // the visual plan comes first (AGENTS.md, "The visual plan"); check requires it
      ...(existsSync(join(root, 'style/profile.json')) ? {style: 'profile'} : {}),      // their own look, when they have one (npm run style)
      footage: {file: 'footage.mp4', duration: faces.duration},
      zooms: [], effects: [], transitions: [],
      overlays: hasText ? [{piece: 'text/corner-labels', start: 0, end: faces.duration}, {piece: 'text/keyword-slam', start: .3, end: Math.min(faces.duration, 2.3)}] : [],
    }, null, 2) + '\n');
    console.log(`Wrote a starter storyboard: projects/${project}/storyboard.json`);
  }
  if (uncut) {      // record the decision, so `npm run check` accepts a footage project without edit/edl.json
    const storyboard = JSON.parse(readFileSync(file, 'utf8'));
    storyboard.footage = {...storyboard.footage, uncut: true}; writeFileSync(file, JSON.stringify(storyboard, null, 2) + '\n');
  }
  console.log(`Ready. Preview: /pipeline/draft/?project=${project}   Make the video: npm run make ${project}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }

#!/usr/bin/env node
// Clean-up edit of a raw talking-head recording, before it becomes a footage project:
//   node pipeline/cut.mjs <project> <video file> [words.json] [--list] [--gap 0.15] [--pad-end 0.22] [--pad-in 0.07] [--pad-out 0.1] [--drop 12-15,40] [--keep 3-4] [--tight 70] [--lufs -14]
// 1. Transcribes the recording locally if no word timings are given (pipeline/transcribe.py).
// 2. Plans the cut (pipeline/cut.py): drops dead air, long pauses, fillers, stutters and repeated
//    takes (keeping the last one), plus any words the editor names with --drop. --list prints the
//    numbered transcript with what would go and stops, so the editor can decide.
// 3. Makes the tightened clip: jump cuts on whole frames, an 8 ms audio fade either side of each cut,
//    an 80 Hz high-pass, and every phrase levelled to the same loudness (pipeline/level.py), then two-pass loudness normalisation (-13 LUFS, true peak -1.5 dB), then measures it.
// Writes into projects/<project>/edit/:
//   raw-words.json  the transcript of the recording as shot
//   clean.mp4       the tightened, normalised clip (same size and frame rate as the recording)
//   words.json      word timings on the new timeline
//   edl.json        the edit decision list: kept segments (source in/out -> new time), what was removed and why, loudness before/after
// Then:  npm run footage <project> projects/<project>/edit/clean.mp4 projects/<project>/edit/words.json
import {spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {root} from './check.mjs';
import {effectsPython, transcribePython, transcribeModels} from './tools.mjs';
import {houseLufs} from './settings.mjs';

const FADE = .008, HIGHPASS = 'highpass=f=80', CEILING = -1.5, CEILING_MARGIN = 1;
// The house level: the user's voice loudness from settings (audio.voiceLufs; default -14, the social-video level), with
// every phrase levelled first (pipeline/level.py) so a sentence said further from the mic is not quieter.
const HOUSE = () => houseLufs();   // read when a cut runs, never at import: the dashboard imports this file and must start even with a broken settings file
const run = (command, args, what) => { const r = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 1 << 28}); if (r.status !== 0) throw Error(`${what} failed.\n${(r.stderr || '').slice(-1500)}`); return r; };
/** Loudness of a file as loudnorm reports it: {input_i, input_tp, input_lra, input_thresh, target_offset}. */
export function measureLoudness(file, filters = [], target = '') {
  const {stderr} = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', [...filters, `loudnorm=${target}print_format=json`].join(','), '-f', 'null', '-'], 'Measuring loudness');
  return JSON.parse(stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1));
}
/** Transcribe a recording locally into {words: [{text, start, end}]}. */
export function transcribe(video, output) {
  const r = spawnSync(transcribePython(), [join(root, 'pipeline/transcribe.py'), video, output, transcribeModels()], {stdio: ['ignore', 'inherit', 'inherit']});
  if (r.status !== 0) throw Error('Transcribing failed.');
}

/** A second look where the recogniser is likely wrong. Whisper often merges a false start with its retake ("Claude
 * automatically posted it to… Claude automatically posted to nine…") into ONE take, stretching a word over the pause
 * and the lost words, so the repeated-take and pause rules never see them. Every word longer than 0.7 s gets its
 * stretch (2 s either side) transcribed again on its own; when that hears more words, they replace the old ones.
 * Then cut.py's repeated-take rule can find the false start. Marks the file so it is done once. */
function refine(source, wordsFile, dir) {
  const data = JSON.parse(readFileSync(wordsFile, 'utf8')); if (data.refined) return;
  let words = data.words; const long = words.filter(w => w.end - w.start > .7), wav = join(dir, '.span.wav'), out = join(dir, '.span.json');
  let fixed = 0;
  for (const w of long) {
    const from = Math.max(0, w.start - 2), to = w.end + 2;
    run('ffmpeg', ['-v', 'error', '-y', '-ss', String(from), '-to', String(to), '-i', source, '-vn', '-ac', '1', '-ar', '16000', wav], 'Cutting a stretch to re-check');
    try { transcribe(wav, out); } catch { continue; }
    const heard = JSON.parse(readFileSync(out, 'utf8')).words.map(x => ({...x, start: +(x.start + from).toFixed(3), end: +(x.end + from).toFixed(3)}))
      .filter(x => x.start >= from + .3 && x.end <= to - .3);      // the edges of a stretch are heard badly
    if (!heard.length) continue;
    const a = heard[0].start, b = heard.at(-1).end, old = words.filter(x => x.start >= a - .05 && x.end <= b + .05);
    if (heard.length > old.length) { words = [...words.filter(x => !(x.start >= a - .05 && x.end <= b + .05)), ...heard].sort((x, y) => x.start - y.start); fixed++; }
  }
  for (const f of [wav, out]) if (existsSync(f)) rmSync(f);
  writeFileSync(wordsFile, JSON.stringify({...data, refined: {longWords: long.length, replaced: fixed}, words}, null, 1) + '\n');
  if (long.length) console.log(`Re-checked ${long.length} stretched word(s); ${fixed} stretch(es) heard better and replaced.`);
}

const numbers = m => ({lufs: Number(m.input_i), truePeak: Number(m.input_tp), range: Number(m.input_lra)});
/** The audio of a cut clip: every phrase levelled (pipeline/level.py), then the whole clip normalised to `target` LUFS.
 * Loudness: measure, then apply what that measurement calls for (two-pass loudnorm). The ceiling asked of loudnorm is
 * CEILING_MARGIN below the real one because each AAC encode lifts peaks a little (the clip is encoded here and once
 * more by `npm run footage`). A final trim (with a peak limiter at the ceiling) lands the level on target, and the
 * finished file is measured again. `rough` keeps its picture (copied); `words` are timings on rough's timeline. */
function finishAudio(rough, words, clean, target, dir) {
  const rode = join(dir, '.rode.wav'), report = join(dir, '.level.json'), before = measureLoudness(rough);
  console.log(run(effectsPython(), [join(root, 'pipeline/level.py'), rough, words, rode, '--report', report], 'Levelling the voice').stdout.trim());
  const levelling = JSON.parse(readFileSync(report, 'utf8')); rmSync(report);
  const goal = `I=${target}:TP=${CEILING - CEILING_MARGIN}:LRA=11:`, first = measureLoudness(rode, [HIGHPASS], goal);
  const second = `loudnorm=${goal}measured_I=${first.input_i}:measured_TP=${first.input_tp}:measured_LRA=${first.input_lra}:measured_thresh=${first.input_thresh}:offset=${first.target_offset}:linear=true`;
  const levelled = join(dir, '.levelled.wav');
  run('ffmpeg', ['-v', 'error', '-y', '-i', rode, '-af', `${HIGHPASS},${second},aresample=48000`, '-c:a', 'pcm_s24le', levelled], 'Normalising the audio');
  const mid = measureLoudness(levelled), trim = Math.max(-3, Math.min(3, target - Number(mid.input_i)));
  const limit = 10 ** ((CEILING - CEILING_MARGIN) / 20);      // catches the few peaks the trim pushes over the ceiling; a fraction of a dB, not compression
  run('ffmpeg', ['-v', 'error', '-y', '-i', rough, '-i', levelled, '-map', '0:v', '-map', '1:a', '-af', `volume=${trim.toFixed(2)}dB,alimiter=limit=${limit.toFixed(4)}:attack=3:release=60:level=false`, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', clean], 'Writing the clean clip');
  rmSync(rode); rmSync(levelled);
  return {before, after: measureLoudness(clean), levelling: {phrases: levelling.phrases, spreadBefore: levelling.spreadBefore, spreadAfter: levelling.spreadAfter, maxUp: levelling.maxUp, maxDown: levelling.maxDown}};
}

// --relevel: redo only the audio of an existing cut (edit/clean.mp4 with edit/words.json): level every phrase and
// normalise to the house level (or --lufs). The picture and timings do not change, so nothing else needs remapping;
// run `npm run footage` again after it. The clip it replaces is kept as edit/clean-before-relevel.mp4.
if (process.argv[1] === new URL(import.meta.url).pathname && process.argv.includes('--relevel')) try {
  const argv = process.argv.slice(2), project = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--lufs');
  if (!/^[a-z0-9-]+$/.test(project || '')) throw Error('Usage: node pipeline/cut.mjs <project> --relevel [--lufs <LUFS>]');
  const dir = join(root, 'projects', project, 'edit'), clean = join(dir, 'clean.mp4'), keep = join(dir, 'clean-before-relevel.mp4'), rough = join(dir, '.rough.mp4');
  const target = argv.includes('--lufs') ? Number(argv[argv.indexOf('--lufs') + 1]) : HOUSE();
  if (!existsSync(keep)) copyFileSync(clean, keep);
  copyFileSync(keep, rough);
  const {before, after, levelling} = finishAudio(rough, join(dir, 'words.json'), clean, target, dir); rmSync(rough);
  const edlFile = join(dir, 'edl.json'), edl = JSON.parse(readFileSync(edlFile, 'utf8'));
  edl.settings = {...edl.settings, targetLufs: target, truePeakCeiling: CEILING}; edl.audio = {...edl.audio, after: numbers(after)}; edl.levelling = levelling;
  writeFileSync(edlFile, JSON.stringify(edl, null, 1) + '\n');
  console.log(`Loudness ${before.input_i} LUFS / ${before.input_tp} dBTP  ->  ${after.input_i} LUFS / ${after.input_tp} dBTP\nNext:  npm run footage ${project} projects/${project}/edit/clean.mp4 projects/${project}/edit/words.json`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
else if (process.argv[1] === new URL(import.meta.url).pathname) try {
  const argv = process.argv.slice(2), valued = ['--gap', '--pad-in', '--pad-out', '--drop', '--keep', '--pad-end', '--tight', '--lufs'];
  const plain = argv.filter((a, i) => !a.startsWith('--') && !valued.includes(argv[i - 1])), [project, video, given] = plain;
  if (!/^[a-z0-9-]+$/.test(project || '') || !video) throw Error('Usage: node pipeline/cut.mjs <project> <video file> [words.json] [--list] [--gap 0.15] [--drop 12-15,40] [--keep 3-4]');
  const source = resolve(video), dir = join(root, 'projects', project, 'edit'), target = Number(argv[argv.indexOf('--lufs') + 1]) || HOUSE();
  mkdirSync(dir, {recursive: true});
  const rawWords = join(dir, 'raw-words.json'), planFile = join(dir, '.plan.json'), rough = join(dir, '.rough.mov'), clean = join(dir, 'clean.mp4');
  if (given) copyFileSync(resolve(given), rawWords); else if (!existsSync(rawWords)) transcribe(source, rawWords);
  if (!given) refine(source, rawWords, dir);

  run(effectsPython(), [join(root, 'pipeline/cut.py'), source, rawWords, planFile, ...argv.filter((a, i) => valued.slice(0, 7).includes(a) || valued.slice(0, 7).includes(argv[i - 1]))], 'Planning the cut');
  const plan = JSON.parse(readFileSync(planFile, 'utf8')); rmSync(planFile);
  if (argv.includes('--list')) {
    for (const w of plan.allWords) console.log(`${String(w.n).padStart(4)}  ${w.start.toFixed(2).padStart(7)}  ${w.dropped ? `[${w.text}]  <- ${w.dropped}` : w.text}`);
    console.log(`\n${plan.segments.length} segments, ${plan.duration.before}s -> ${plan.duration.after}s. Words in [brackets] would be dropped; change that with --drop / --keep and word numbers.`);
    process.exit(0);
  }

  // The cut: every kept segment trimmed on whole frames and joined; a short fade either side of each cut stops clicks.
  const {segments, fps} = plan;
  const graph = segments.map((s, i) => { const d = s.out - s.in;
    return `[0:v]trim=start=${s.in}:end=${s.out},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=start=${s.in}:end=${s.out},asetpts=PTS-STARTPTS,afade=t=in:d=${FADE},afade=t=out:st=${(d - FADE).toFixed(4)}:d=${FADE}[a${i}]`; }).join(';')
    + `;${segments.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${segments.length}:v=1:a=1[v][a]`;
  console.log(`Cutting ${segments.length} segments · ${plan.duration.before}s -> ${plan.duration.after}s`);
  run('ffmpeg', ['-v', 'error', '-y', '-i', source, '-filter_complex', graph, '-map', '[v]', '-map', '[a]', '-r', String(fps), '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s24le', rough], 'Cutting');

  // Loudness: measure, then apply what that measurement calls for (two-pass loudnorm). The ceiling asked of loudnorm is
  // CEILING_MARGIN below the real one because each AAC encode lifts peaks a little (the clip is encoded here and once more by `npm run footage`). A final trim (with a peak limiter at the ceiling) lands the level on target,
  // and the finished file is measured again.
  const wordsTmp = join(dir, '.words.json'); writeFileSync(wordsTmp, JSON.stringify({words: plan.words}));
  const {before, after, levelling} = finishAudio(rough, wordsTmp, clean, target, dir); rmSync(rough); rmSync(wordsTmp);

  writeFileSync(join(dir, 'words.json'), JSON.stringify({source: relative(root, source), transcriber: JSON.parse(readFileSync(rawWords, 'utf8')).transcriber ?? 'supplied', duration: plan.duration.after, words: plan.words}, null, 1) + '\n');
  writeFileSync(join(dir, 'edl.json'), JSON.stringify({source: relative(root, source), output: 'clean.mp4', fps, duration: plan.duration, settings: {...plan.settings, audioFade: FADE, highpassHz: 80, targetLufs: target, truePeakCeiling: CEILING},
    cuts: segments.slice(1).map(s => s.at), segments: segments.map(s => ({in: s.in, out: s.out, at: s.at, length: Number((s.out - s.in).toFixed(4)), text: s.text})),
    removed: plan.removed, pauses: plan.pauses, levelling, audio: {before: numbers(before), after: numbers(after)}}, null, 1) + '\n');
  console.log(`Removed ${(plan.duration.before - plan.duration.after).toFixed(1)}s: ${plan.pauses.length} pauses, ${plan.removed.length} dropped phrase(s)${plan.removed.length ? ' (' + plan.removed.map(r => `${r.reason}: "${r.text}"`).join('; ') + ')' : ''}`);
  if (plan.suspicious?.length) console.log(`Check by ear: ${plan.suspicious.length} word(s) still longer than 0.7 s (a pause or a lost false start may hide there): ${plan.suspicious.map(w => `#${w.n} "${w.text}" at ${w.start.toFixed(2)}s (${w.seconds}s)`).join(', ')}`);
  console.log(`Loudness ${before.input_i} LUFS / ${before.input_tp} dBTP  ->  ${after.input_i} LUFS / ${after.input_tp} dBTP`);
  console.log(`Wrote projects/${project}/edit/: clean.mp4, words.json, edl.json\nNext:  npm run footage ${project} projects/${project}/edit/clean.mp4 projects/${project}/edit/words.json`);
} catch (error) { console.error(error.message); process.exitCode = 1; }

#!/usr/bin/env node
// Review stills of a footage project without making the whole video: the finished picture (clip, look,
// effects, layouts, graphics, captions — everything but shader transitions and sound) at single moments.
//   node pipeline/frames.mjs <project> <seconds> [<seconds> ...] [--scale 0.5] [--sheet]
//   node pipeline/frames.mjs <project> --from 3 --to 6 --fps 6          a run of frames
//   node pipeline/frames.mjs <project> --scenes      one picture per section, at the moment its edit shows best, for the
//                                                    storyboard page (out/review/NN-<id>.jpg), with effects drawn as in the final video
// Graphics come from the frame cache where nothing changed (pipeline/cache.mjs), and what is drawn here is kept for the next make.
// Writes projects/<project>/out/frames/<frame number>.jpg; --sheet also joins them into sheet.jpg, labelled with their times.
// Then runs the preview quality check over the whole clip (npm run qa <project> --preview); --no-check skips it.
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {rmSync, mkdirSync, readdirSync} from 'node:fs';
import {root, readStoryboard} from './check.mjs';
import {combineFootage} from './combine.mjs';
import {preview} from './qa.mjs';
import {DEFAULT_FORMAT} from './timeline.js';

const args = process.argv.slice(2), flag = (name, fallback) => args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback;
const flags = ['--scale', '--from', '--to', '--fps', '--cols', '--width'], project = args.find((a, i) => !a.startsWith('--') && !flags.includes(args[i - 1]));
try {
  const storyboard = readStoryboard(project);
  if (!storyboard.footage) throw Error('npm run frames is for footage projects. For shot storyboards use: npm run stills <project>');
  const fps = storyboard.format?.fps ?? DEFAULT_FORMAT.fps, total = Math.floor(storyboard.footage.duration * fps);
  let times = args.filter((a, i) => a !== project && !a.startsWith('--') && !flags.includes(args[i - 1])).map(Number).filter(Number.isFinite);
  let scenes = null;
  if (args.includes('--scenes')) {
    const {sectionsOf} = await import('./sections.js');
    scenes = sectionsOf(storyboard, {}).map(s => ({...s, t: sceneMoment(storyboard, s), across: [0, 1, 2, 3].map(k => s.start + (s.end - s.start) * (k + .5) / 4)}));
    times.push(...scenes.flatMap(s => [s.t, ...s.across]));
  }
  if (args.includes('--from')) { const step = 1 / flag('--fps', 4); for (let t = flag('--from', 0); t <= flag('--to', storyboard.footage.duration) + 1e-6; t += step) times.push(t); }
  if (!times.length) throw Error('Usage: node pipeline/frames.mjs <project> <seconds> [...]   or   --from <s> --to <s> [--fps 4]');
  const only = [...new Set(times.map(t => Math.max(0, Math.min(total - 1, Math.round(t * fps)))))].sort((a, b) => a - b);
  rmSync(join(root, 'projects', project, 'out', 'frames'), {recursive: true, force: true});
  const {output} = await combineFootage(project, storyboard, flag('--scale', .5), {only, noCache: args.includes('--no-cache')});
  console.log(`Wrote ${only.length} frame(s) to projects/${project}/out/frames/`);
  if (scenes) {                       // the storyboard page's scene pictures, 378 px wide like the shot stills
    const dir = join(root, 'projects', project, 'out', 'review'); mkdirSync(dir, {recursive: true});
    for (const f of readdirSync(dir)) if (f.endsWith('.jpg')) rmSync(join(dir, f));
    scenes.forEach((s, i) => {
      const f = Math.max(0, Math.min(total - 1, Math.round(s.t * fps)));
      spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', join(output, String(f).padStart(5, '0') + '.jpg'), '-vf', 'scale=378:-2', '-q:v', '3', join(dir, `${String(i + 1).padStart(2, '0')}-${s.id}.jpg`)], {stdio: 'inherit'});
      // the scene over time: four moments side by side (before, during, after), for the card's frame strip
      const fs = s.across.map(t => Math.max(0, Math.min(total - 1, Math.round(t * fps))));
      spawnSync('ffmpeg', ['-v', 'error', '-y', ...fs.flatMap(n => ['-i', join(output, String(n).padStart(5, '0') + '.jpg')]),
        '-filter_complex', fs.map((_, k) => `[${k}:v]scale=180:-2[f${k}]`).join(';') + ';' + fs.map((_, k) => `[f${k}]`).join('') + 'hstack=inputs=4', '-q:v', '4', join(dir, `${String(i + 1).padStart(2, '0')}-${s.id}-strip.jpg`)], {stdio: 'inherit'});
    });
    console.log(`Scene pictures: projects/${project}/out/review/ (${scenes.length})`);
  }
  if (args.includes('--sheet')) {
    const cols = Math.min(only.length, flag('--cols', 6)), rows = Math.ceil(only.length / cols), w = flag('--width', 300), parts = [];
    only.forEach((f, i) => parts.push(`[${i}:v]scale=${w}:-1,drawtext=text='${(f / fps).toFixed(2)}':fontsize=20:fontcolor=yellow:box=1:boxcolor=black@0.7:x=3:y=3[v${i}]`));
    const layout = only.map((_, i) => `${(i % cols)}*${w}_${Math.floor(i / cols)}*${Math.round(w * 16 / 9)}`.replace(/(\d+)\*(\d+)/g, (m, a, b) => a * b)).join('|');
    const graph = parts.join(';') + ';' + only.map((_, i) => `[v${i}]`).join('') + (only.length > 1 ? `xstack=inputs=${only.length}:layout=${layout}:fill=black` : 'null');
    const sheet = join(output, 'sheet.jpg');
    if (spawnSync('ffmpeg', ['-v', 'error', '-y', ...only.flatMap(f => ['-i', join(output, String(f).padStart(5, '0') + '.jpg')]), '-filter_complex', graph, '-frames:v', '1', sheet], {stdio: 'inherit'}).status !== 0) throw Error('Could not write the sheet');
    console.log(`Sheet: projects/${project}/out/frames/sheet.jpg (${rows} row(s) of ${cols})`);
  }
  // Catch caption and text problems over the whole clip now, not after the full make (--no-check skips it).
  if (!args.includes('--no-check') && await preview(project) !== 0) { console.log('Fix the FAILs above in the storyboard before making the video.'); process.exitCode = 1; }
} catch (error) { console.error(error.message); process.exitCode = 1; }

// The moment a section's edit shows best: inside the effect or graphic that covers most of it, at its strongest point
// (a title card before it is sliced, a poster in the middle, a fly-through in full flight, a graphic once it has landed); else its middle.
function sceneMoment(storyboard, s) {
  const over = (a, b) => Math.max(0, Math.min(b, s.end) - Math.max(a, s.start));
  const items = [...(storyboard.effects ?? []).filter(e => e.where !== 'pulse').map(e => ({kind: 'effect', e, a: e.at, b: e.at + (e.seconds ?? 0)})),
    ...(storyboard.overlays ?? []).map(o => ({kind: 'overlay', e: o, a: o.start, b: o.end}))].filter(x => over(x.a, x.b) > .15);
  if (!items.length) return (s.start + s.end) / 2;
  const x = items.reduce((m, y) => over(y.a, y.b) > over(m.a, m.b) ? y : m), a = Math.max(x.a, s.start), b = Math.min(x.b, s.end);
  let t = x.kind === 'overlay' ? x.a + Math.min((x.b - x.a) * .6, 2.2) : a + (b - a) * .45;
  if (x.e.name === 'text_behind_slice') t = x.a + Number(x.e.props?.at ?? (x.b - x.a) * .6) * .85;
  if (x.e.name === 'reel_flythrough') t = x.a + (x.b - x.a) * .3;
  return Math.max(s.start + .02, Math.min(s.end - .05, t));
}

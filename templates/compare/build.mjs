// compare: 2-4 videos side by side with labels, rendered straight to projects/<project>/out/cut.mp4.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const FONT = 'library/ui/claude/fonts/files/InterTight-Variable.ttf';
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\u2019").replace(/:/g, '\\:').replace(/%/g, '\\%');

export default async function build({spec, resolve, dir, root, run}) {
  const videos = spec.videos ?? [];
  if (videos.length < 2 || videos.length > 4) throw Error('The spec needs "videos": 2 to 4 entries [{file, label}]');
  const files = videos.map((v, i) => { const f = resolve(v.file); if (!existsSync(f)) throw Error(`Video ${i + 1} not found: ${f}`); return f; });
  const h = Math.round(Number(spec.height ?? 960) / 2) * 2, w = Math.round(h * 9 / 16 / 2) * 2, gap = Number(spec.gap ?? 0), audio = Number(spec.audio ?? 1);
  const font = join(root, FONT), size = Math.round(h / 20);
  const chains = files.map((_, i) => {
    let c = `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30`;
    if (spec.labels !== false && videos[i].label)
      c += `,drawtext=fontfile='${font}':text='${esc(videos[i].label)}':x=${Math.round(size * .8)}:y=${Math.round(size * .8)}:fontsize=${size}:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=${Math.round(size * .4)}`;
    if (gap && i < files.length - 1) c += `,pad=${w + gap}:${h}:0:0:color=black`;
    return c + `[v${i}]`;
  });
  const graph = [...chains, `${files.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${files.length},format=yuv420p[v]`].join(';');
  const out = join(dir, 'out'); mkdirSync(out, {recursive: true});
  const args = ['-v', 'error', '-y', ...files.flatMap(f => ['-i', f]), '-filter_complex', graph, '-map', '[v]'];
  const hasAudio = f => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', f]).toString().trim() !== '';
  if (audio >= 1 && audio <= files.length && hasAudio(files[audio - 1])) args.push('-map', `${audio - 1}:a`, '-c:a', 'aac', '-b:a', '192k');
  args.push('-shortest', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', join(out, 'cut.mp4'));
  console.log(`Comparing ${files.length} videos at ${w}x${h} each -> ${(w + gap) * files.length - gap}x${h}`);
  run('ffmpeg', args, 'The comparison render');
  writeFileSync(join(dir, 'template.json'), JSON.stringify({template: 'compare', kind: 'direct', spec}, null, 2));   // marks a direct render: no storyboard
}

#!/usr/bin/env node
// The sketch pass: a storyboard page to approve before anything is rendered for real.
// Every panel is the real picture at that moment (same pieces, same positions as the finished video),
// drawn as pencil line art, with the speaker's face (red), the app safe zone (blue) and each graphic's box (orange, numbered).
//   node pipeline/sketch.mjs <project> [--cols 4]
//   -> projects/<project>/out/sketch/storyboard.html and storyboard.jpg (one page), plus panels/*.jpg
// Shot storyboards: one row per shot, one panel per candidate (A, B, C…), caught when the piece has settled.
// Footage storyboards: one panel each time a graphic appears or the layout changes, with the words being said.
import {spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildTimeline, checkStoryboard, describe, faceInFrame, DEFAULT_FORMAT} from './timeline.js';
import {root, readLibrary, libraryOf, readStoryboard, readVoice} from './check.mjs';
import {openDraft} from './browser.mjs';
import {combineFootage} from './combine.mjs';
import {browserBinary, effectsPython} from './tools.mjs';

const SCALE = .35, LETTERS = 'ABCDEFGH';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const pieceName = o => [o.piece, o.theme && `(${o.theme})`].filter(Boolean).join(' ');

async function shotPanels(project, storyboard, raw) {
  const problems = checkStoryboard(storyboard, readLibrary(storyboard.theme), null, libraryOf);
  if (problems.length) throw Error('Fix the storyboard first:\n' + problems.map(p => '  - ' + p).join('\n'));
  const timeline = buildTimeline(storyboard, 'all', readVoice(project)), {width, height} = timeline.format, rows = [];
  const draft = await openDraft(project, {width, height, scale: SCALE});
  try {
    for (const [n, shot] of timeline.shots.entries()) {
      const row = {heading: `${n + 1}. ${shot.title || shot.id}`, time: `${fmt(shot.start)}–${fmt(shot.end)}`, line: shot.narration, panels: []};
      for (let i = 0; i < shot.candidates.length; i++) {
        await draft.evaluate(`window.draft.view(${JSON.stringify(shot.id)}, ${i})`);
        await draft.evaluate(`window.draft.seek(${shot.start + (shot.end - shot.start) * .85})`);
        const src = join(raw, `${n + 1}-${LETTERS[i]}.jpg`); writeFileSync(src, await draft.screenshot());
        const c = shot.candidates[i], status = c.status ?? 'draft';
        const tags = [c.visual && pieceName(c.visual), c.background && `background: ${pieceName(c.background)}`, c.effect && `effect: ${c.effect.name}`].filter(Boolean);
        row.panels.push({src, name: `${n + 1}${LETTERS[i]}`, label: LETTERS[i], tags, status, picked: shot.pick === i, face: null, boxes: []});
      }
      rows.push(row);
    }
  } finally { await draft.close(); }
  return {rows, cols: Math.max(...rows.map(r => r.panels.length))};
}

async function footagePanels(project, storyboard, raw) {
  const dir = join(root, 'projects', project), fps = storyboard.format?.fps ?? DEFAULT_FORMAT.fps, duration = storyboard.footage.duration;
  const format = {...DEFAULT_FORMAT, ...storyboard.format};
  const faces = existsSync(join(dir, 'faces.json')) ? JSON.parse(readFileSync(join(dir, 'faces.json'), 'utf8')) : null;
  const words = existsSync(join(dir, 'words.json')) ? JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8')).words ?? [] : [];
  const overlays = (storyboard.overlays ?? []).map((o, i) => ({...o, n: i + 1}));
  // Moments: each graphic once it has settled in, each layout once it has arrived, and the first frame.
  const moments = [{t: Math.min(.4, duration / 2), why: 'opening'}];
  for (const o of overlays) moments.push({t: Math.min(o.start + Math.min(.8, (Math.min(o.end, duration) - o.start) * .6), duration - .05), why: pieceName(o)});
  for (const l of storyboard.layouts ?? []) moments.push({t: Math.min(l.at + (l.ramp ?? .3) + .1, duration - .05), why: `layout: ${l.to ?? 'custom'}`});
  moments.sort((a, b) => a.t - b.t);
  const merged = [];
  for (const m of moments) { const last = merged.at(-1); if (last && m.t - last.t < .35) last.why += ` · ${m.why}`; else merged.push({...m}); }
  const total = Math.floor(duration * fps), only = [...new Set(merged.map(m => Math.max(0, Math.min(total - 1, Math.round(m.t * fps)))))];
  const {output} = await combineFootage(project, storyboard, SCALE, {only});
  const panels = [];
  for (const frame of only) {
    const t = frame / fps, file = join(output, String(frame).padStart(5, '0') + '.jpg'), src = join(raw, `${String(frame).padStart(5, '0')}.jpg`);
    copyFileSync(file, src); rmSync(file, {force: true});
    const live = overlays.filter(o => o.start <= t + 1e-6 && t < Math.min(o.end, duration) + 1e-6);
    const boxes = live.map(o => {
      if (o.region) return {n: o.n, x: o.region.x / format.width, y: o.region.y / format.height, w: o.region.width / format.width, h: o.region.height / format.height};
      return o.cutaway ? {n: o.n, x: 0, y: 0, w: 1, h: 1} : null;      // full-frame pieces place themselves: the sketch shows where, the list names them
    }).filter(Boolean);
    const cutaway = live.some(o => o.cutaway);
    const said = words.filter(w => w.end > t - 1.2 && w.start < t + .8).map(w => w.text).join(' ');
    panels.push({src, name: fmt(t), label: fmt(t), time: fmt(t), line: said, tags: live.map(o => `${o.n} · ${pieceName(o)}${o.cutaway ? ' (full-screen cutaway)' : o.region ? '' : ' (full frame)'}`),
      face: faces?.track && !cutaway ? faceInFrame(storyboard, faces.track, t, format) : null, boxes});
  }
  return {rows: [{heading: storyboard.title ?? project, time: `${fmt(0)}–${fmt(duration)}`, line: '', panels}], cols: 4, footage: true};
}

function page(project, storyboard, {rows, cols, footage}, panelW) {
  const card = p => `<figure class="${p.status === 'rejected' ? 'rejected' : ''}">
      <div class="img"><img src="panels/${esc(p.file)}"><span class="tag">${esc(p.label)}${p.picked ? ' ★' : ''}</span></div>
      <figcaption>${p.time && footage ? `<b>${esc(p.time)}</b> ` : ''}${p.line && footage ? `<q>${esc(p.line)}</q>` : ''}
        <ul>${p.tags.map(t => `<li>${esc(t)}</li>`).join('') || '<li class="none">no graphics</li>'}</ul>
        ${p.status ? `<i class="st ${esc(p.status)}">${esc(p.status)}</i>` : ''}</figcaption></figure>`;
  const body = rows.map(r => `<section><header><h2>${esc(r.heading)}</h2><span>${esc(r.time)}</span>${r.line ? `<q>${esc(r.line)}</q>` : ''}</header>
    <div class="grid" style="grid-template-columns: repeat(${footage ? cols : r.panels.length}, ${panelW}px)">${r.panels.map(card).join('')}</div></section>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Sketch · ${esc(project)}</title><style>
  @font-face{font-family:Inter;src:url(${pathToFileURL(join(root, 'dashboard/fonts/Inter-Variable.ttf')).href})}
  body{margin:0;padding:28px 32px;background:#f4f1ea;color:#2a2722;font:14px/1.35 Inter,system-ui,sans-serif;width:max-content}
  h1{font-size:26px;margin:0 0 4px} .sub{color:#7a746a;margin-bottom:10px} .key{display:flex;gap:16px;margin-bottom:18px;color:#5c574f}
  .key b{display:inline-block;width:18px;height:3px;vertical-align:middle;margin-right:6px}
  section{margin:0 0 22px} header{display:flex;gap:12px;align-items:baseline;margin-bottom:8px;max-width:${(panelW + 14) * cols}px}
  h2{font-size:17px;margin:0} header span{color:#8a8378} q{color:#4d4840;font-style:italic}
  .grid{display:grid;gap:14px} figure{margin:0;background:#fff;border:1px solid #ddd6c8;border-radius:8px;overflow:hidden}
  figure.rejected{opacity:.45} .img{position:relative;line-height:0} .img img{width:100%}
  .tag{position:absolute;top:6px;left:6px;background:#2a2722;color:#fff;font:600 12px Inter;padding:2px 7px;border-radius:5px;line-height:1.4}
  figcaption{padding:8px 10px 10px;font-size:12.5px} figcaption q{display:block;margin:2px 0 4px}
  ul{margin:4px 0 0;padding-left:16px} li.none{list-style:none;margin-left:-16px;color:#9a9388}
  .st{display:inline-block;margin-top:6px;font-style:normal;font-size:11px;padding:1px 6px;border-radius:4px;background:#eee}
  .st.usable{background:#dcefd8} .st.rejected{background:#f3d6d2}
  </style></head><body><h1>${esc(storyboard.title ?? project)}</h1>
  <div class="sub">Sketch · theme ${esc(storyboard.theme ?? 'modern')} · real pieces in their real positions, drawn as pencil — approve the layout, then <code>npm run approve ${esc(project)}</code> and <code>npm run make ${esc(project)}</code></div>
  <div class="key"><span><b style="background:#d63c3c"></b>face (keep clear)</span><span><b style="background:#f08c28"></b>graphic box (numbered)</span><span><b style="background:#5aa0c8"></b>app safe zone</span></div>
  ${body}</body></html>`;
}

const args = process.argv.slice(2), project = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--cols');
try {
  if (!project) throw Error('Usage: npm run sketch <project> [-- --cols 4]');
  const storyboard = readStoryboard(project), out = join(root, 'projects', project, 'out', 'sketch'), raw = join(out, '.raw'), panelsDir = join(out, 'panels');
  rmSync(out, {recursive: true, force: true}); mkdirSync(raw, {recursive: true}); mkdirSync(panelsDir, {recursive: true});
  const board = storyboard.footage ? await footagePanels(project, storyboard, raw) : await shotPanels(project, storyboard, raw);
  if (args.includes('--cols')) board.cols = Number(args[args.indexOf('--cols') + 1]) || board.cols;
  const all = board.rows.flatMap(r => r.panels);
  all.forEach((p, i) => { p.file = `${String(i + 1).padStart(2, '0')}-${p.name.replace(/[^\w.-]+/g, '_')}.jpg`; p.dst = join(panelsDir, p.file); });
  const manifest = join(raw, 'manifest.json');
  writeFileSync(manifest, JSON.stringify({panels: all.map(p => ({src: p.src, dst: p.dst, face: p.face, boxes: p.boxes, safe: true}))}));
  const py = spawnSync(effectsPython(), [join(root, 'pipeline/sketch.py'), manifest], {stdio: 'inherit'});
  if (py.status !== 0) throw Error('Sketching the frames failed');
  const panelW = 250, html = join(out, 'storyboard.html');
  writeFileSync(html, page(project, storyboard, board, panelW));
  // One image of the whole page, for a quick look (and for an agent): headless Chrome screenshots the HTML.
  const perRow = board.footage ? board.cols : board.cols, rowsCount = board.footage ? Math.ceil(all.length / board.cols) : board.rows.length;
  const pageW = 64 + perRow * (panelW + 14), pageH = 140 + rowsCount * (panelW * 16 / 9 + 125) + (board.footage ? 40 : board.rows.length * 40);
  const png = join(raw, 'page.png');
  spawnSync(browserBinary(), ['--headless', '--hide-scrollbars', '--allow-file-access-from-files', `--window-size=${Math.ceil(pageW)},${Math.ceil(pageH)}`, `--screenshot=${png}`, pathToFileURL(html).href], {stdio: 'ignore'});
  if (existsSync(png)) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '3', join(out, 'storyboard.jpg')], {stdio: 'inherit'});
  rmSync(raw, {recursive: true, force: true});
  console.log(`Sketch: projects/${project}/out/sketch/storyboard.html  (${all.length} panels)${existsSync(join(out, 'storyboard.jpg')) ? `\n        projects/${project}/out/sketch/storyboard.jpg` : ''}`);
  console.log(board.footage ? `Change positions or pieces in storyboard.json and sketch again until it is right.`
    : `Mark choices with: npm run mark ${project} <shot> <A|B|…> <usable|rejected|pick>, and sketch again until it is right.`);
  console.log(`Then show the user this page and wait. Once they approve: npm run approve ${project}, then npm run make ${project}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }

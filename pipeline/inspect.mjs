// Preview pass for the quality check: steps through the draft without making the video and records what would be
// on screen (face, captions, their words, size and colours, text in graphics) 10 times a second.
// Writes projects/<project>/out/layout-preview.json; `npm run qa <project> --preview` checks it.
// `npm run stills` and `npm run frames` run it at the end, so placement and caption problems show up before the make.
// `npm run qa` runs it at the video's own frame rate into out/layout.json whenever out/cut.mp4 is newer than that log.
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root, readStoryboard, readVoice, readProjectJson} from './check.mjs';
import {buildTimeline, buildFootageTimeline} from './timeline.js';
import {existsSync, readFileSync} from 'node:fs';
import {openDraft} from './browser.mjs';
import {mapOccupancy} from './combine.mjs';
import {footageFrameKeys, fileStamp, sha} from './cache.mjs';
import {browserBinary} from './tools.mjs';

const KEPT = '.layout-frames.json';
const readKept = outDir => { try { return JSON.parse(readFileSync(join(outDir, KEPT), 'utf8')); } catch { return {}; } };
/** One key per sampled frame: what the draft draws then (the make's frame key), the frame number, the track and the measuring code. */
async function recordKeys(project, storyboard, faces, rate, duration) {
  const words = readProjectJson(project, 'words.json')?.words ?? [], timeline = buildFootageTimeline(storyboard, words, faces);
  const frames = Math.floor(duration * rate), edl = storyboard.overlays?.some(o => o.props?.use === 'project') ? readProjectJson(project, 'edit/edl.json') : null;
  const scaled = {...timeline, format: {...timeline.format, fps: rate}};
  const {keys} = await footageFrameKeys(project, storyboard, scaled, {scale: 1, frames, words: timeline.words, edl, browser: browserBinary()});
  const track = sha([storyboard.zooms ?? [], storyboard.layouts ?? [], storyboard.captionTrack ?? [], timeline.track, fileStamp(join(root, 'library/_shared/inspect.js')), fileStamp(join(root, 'library/_shared/placement.js'))]);
  return keys.map((key, i) => sha([key, i, rate, track]));
}

/** `rate`: samples per second; `file`: what to write in out/ (layout-preview.json, or layout.json for the finished video at its own frame rate). */
export async function inspect(project, {rate = 10, file: name = 'layout-preview.json'} = {}) {
  const storyboard = readStoryboard(project), dir = join(root, 'projects', project), outDir = join(dir, 'out');
  const faces = existsSync(join(dir, 'faces.json')) ? JSON.parse(readFileSync(join(dir, 'faces.json'), 'utf8')) : null;
  const timeline = storyboard.footage ? buildFootageTimeline(storyboard, [], faces) : buildTimeline(storyboard, 'all', readVoice(project));
  const {width, height} = timeline.format;
  mkdirSync(outDir, {recursive: true});
  if (storyboard.footage) await mapOccupancy(project, timeline, outDir);
  // The finished-video pass (layout.json, one record per frame) re-measures only the frames whose picture changed: each
  // record is kept under its frame's graphics key (the same key the make uses, pipeline/cache.mjs) plus the frame number,
  // the face, zoom and layout track and the measuring code. A note on one scene re-measures that scene, not the video.
  const reuse = name === 'layout.json' && storyboard.footage ? await recordKeys(project, storyboard, faces, rate, timeline.duration) : null;
  const kept = reuse ? readKept(outDir) : {}, fresh = {};
  const draft = await openDraft(project, {width, height, scale: .25, transparent: Boolean(storyboard.footage)});
  try {
    const frames = []; let measured = 0;
    for (let i = 0; i / rate < timeline.duration; i++) {
      const texts = i % Math.max(1, Math.round(rate / 2)) === 0, key = reuse?.[i] && sha([reuse[i], texts]);
      if (key && kept[key]) { frames.push(fresh[key] = kept[key]); continue; }
      await draft.evaluate(`window.draft.seek(${i / rate})`);
      const record = await draft.evaluate(`window.draft.layout(${texts})`); measured++;
      frames.push(record); if (key) fresh[key] = record;
    }
    if (reuse) { writeFileSync(join(outDir, KEPT), JSON.stringify(fresh)); console.log(`Quality check: measured ${measured} of ${frames.length} frames (the rest had not changed).`); }
    const occupancy = join(outDir, 'occupancy.json'), file = join(outDir, name);
    writeFileSync(file, JSON.stringify({W: width, H: height, fps: rate, kind: storyboard.footage ? 'footage' : 'shots', preview: name !== 'layout.json', captions: await draft.evaluate('window.draft.captions'),
      words: await draft.evaluate('window.draft.words()'), frames, ...(storyboard.footage && existsSync(occupancy) ? {occupancy: JSON.parse(readFileSync(occupancy, 'utf8'))} : {})}));
    return file;
  } finally { await draft.close(); }
}

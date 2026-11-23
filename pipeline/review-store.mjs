// Review marks: what the user wants changed in a finished video, kept as a plain file.
//   projects/<name>/review.json
//   {"project": "…", "lastId": 3, "marks": [{"id": "m3", "ref": "talking-head-2-fashion · reels (18.2–20.4 s)", "section": "reels",
//     "start": 18.233, "end": 20.4, "kind": "change", "status": "open", "note": "make this chart bigger", "reply": "",
//     "video": "cut.mp4", "stage": "video", "created": "2026-…Z", "updated": "2026-…Z"}]}
// "stage" is "video" (a mark on the finished video, the review page) or "storyboard" (a note on one scene of the
// storyboard before the video is made, the storyboard page; "section" is then the shot or section id).
// The review page writes it through the local server (dashboard/serve.mjs) and agents through `npm run review`
// (pipeline/review.mjs); both use this module, so there is one set of rules and every write is atomic.
// Ids are never reused ("lastId"), so a mark can be referred to for good.
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export const KINDS = ['change', 'cut', 'keep', 'question'];
export const STATUSES = ['open', 'in-progress', 'done'];
const STAGES = ['video', 'storyboard'];
const PROJECT = /^[a-z0-9-]+$/;

const reviewFile = (root, project) => join(root, 'projects', project, 'review.json');
/** The project's marks; an empty review if there is no file yet. Throws if the project does not exist or the file is damaged. */
export function readReview(root, project) {
  if (!PROJECT.test(project || '')) throw Error('Bad project name.');
  if (!existsSync(join(root, 'projects', project, 'storyboard.json'))) throw Error(`No project "${project}".`);
  const file = reviewFile(root, project);
  if (!existsSync(file)) return {project, lastId: 0, marks: []};
  let data; try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { throw Error(`projects/${project}/review.json is not valid JSON (${error.message}). Fix or delete it.`); }
  const marks = Array.isArray(data.marks) ? data.marks.filter(m => m && typeof m.id === 'string') : [];
  return {project, lastId: Math.max(Number(data.lastId) || 0, ...marks.map(m => Number(/^m(\d+)$/.exec(m.id)?.[1]) || 0)), marks};
}
/** Write the whole file in one step (a temporary file, then a rename), so a reader never sees half of it. */
export function writeReview(root, project, review) {
  const file = reviewFile(root, project), tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({project, lastId: review.lastId, marks: review.marks}, null, 2) + '\n');
  renameSync(tmp, file);
}

const text = (value, max, name) => { if (value == null) return ''; if (typeof value !== 'string') throw Error(`"${name}" must be text.`); if (value.length > max) throw Error(`"${name}" is too long (at most ${max} characters).`); return value.trim(); };
const pick = (value, options, name) => { if (!options.includes(value)) throw Error(`"${name}" must be one of ${options.join(', ')}.`); return value; };
const time = (value, name) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 36000) throw Error(`"${name}" must be a time in seconds.`); return Math.round(value * 1000) / 1000; };

// Screenshots the user attaches to a mark: image files in projects/<name>/review-shots/, referenced by path relative to the project.
const SHOT = /^review-shots\/[\w.-]+\.(jpg|png)$/;
const shotList = value => { if (value == null) return []; if (!Array.isArray(value) || value.length > 8 || !value.every(v => typeof v === 'string' && SHOT.test(v))) throw Error('"shots" must be up to 8 paths like review-shots/<file>.jpg.'); return [...new Set(value)]; };
/** Save one screenshot (a data: URL of a JPEG or PNG) for a project; `at` = the video time it shows. Returns its path relative to the project. */
export function saveShot(root, project, image, at = 0) {
  if (!PROJECT.test(project || '') || !existsSync(join(root, 'projects', project, 'storyboard.json'))) throw Error(`No project "${project}".`);
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(typeof image === 'string' ? image : '');
  if (!match) throw Error('"image" must be a JPEG or PNG data URL.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 6e6) throw Error('Screenshot is too big (at most 6 MB).');
  const dir = join(root, 'projects', project, 'review-shots'); mkdirSync(dir, {recursive: true});
  const seconds = Number.isFinite(at) && at >= 0 ? at.toFixed(2) : '0.00';
  const name = `${seconds}s-${new Date().toISOString().replace(/[:.]/g, '-')}.${match[1] === 'png' ? 'png' : 'jpg'}`;
  writeFileSync(join(dir, name), bytes);
  return `review-shots/${name}`;
}

/** Add a mark. `input` = {start, end, note, kind?, status?, section?, ref?, video?, reply?, stage?, shots?}. Returns the new mark. */
export function addMark(review, input, now = new Date()) {
  if (!input || typeof input !== 'object') throw Error('A mark needs a range and a note.');
  const start = time(input.start, 'start'), end = time(input.end, 'end');
  if (!(end > start)) throw Error('"end" must be after "start".');
  const note = text(input.note, 2000, 'note');
  if (!note) throw Error('Say what should happen in "note".');
  const stamp = now.toISOString(), mark = {id: `m${++review.lastId}`, ref: text(input.ref, 200, 'ref'), section: text(input.section, 80, 'section'), start, end,
    kind: pick(input.kind ?? 'change', KINDS, 'kind'), status: pick(input.status ?? 'open', STATUSES, 'status'), note, reply: text(input.reply, 4000, 'reply'),
    video: text(input.video, 60, 'video') || 'cut.mp4', stage: pick(input.stage ?? 'video', STAGES, 'stage'), created: stamp, updated: stamp};
  const shots = shotList(input.shots); if (shots.length) mark.shots = shots;
  review.marks.push(mark);
  return mark;
}
/** Change a mark: any of note, kind, status, reply, start, end, section, ref, shots. Returns the mark, or null if there is no such id. */
export function updateMark(review, id, patch, now = new Date()) {
  const mark = review.marks.find(m => m.id === id);
  if (!mark) return null;
  if (!patch || typeof patch !== 'object') throw Error('Nothing to change.');
  const next = {...mark};
  if ('note' in patch) { next.note = text(patch.note, 2000, 'note'); if (!next.note) throw Error('A mark needs a note.'); }
  if ('reply' in patch) next.reply = text(patch.reply, 4000, 'reply');
  if ('kind' in patch) next.kind = pick(patch.kind, KINDS, 'kind');
  if ('status' in patch) next.status = pick(patch.status, STATUSES, 'status');
  if ('start' in patch) next.start = time(patch.start, 'start');
  if ('end' in patch) next.end = time(patch.end, 'end');
  if (!(next.end > next.start)) throw Error('"end" must be after "start".');
  if ('section' in patch) next.section = text(patch.section, 80, 'section');
  if ('ref' in patch) next.ref = text(patch.ref, 200, 'ref');
  if ('shots' in patch) { const shots = shotList(patch.shots); if (shots.length) next.shots = shots; else delete next.shots; }
  next.updated = now.toISOString();
  Object.assign(mark, next);
  return mark;
}
/** Remove a mark. Returns true if it was there. */
export function removeMark(review, id) {
  const at = review.marks.findIndex(m => m.id === id);
  if (at < 0) return false;
  review.marks.splice(at, 1);
  return true;
}

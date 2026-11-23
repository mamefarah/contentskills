#!/usr/bin/env node
// The user's sign-off on a storyboard. The final video (out/cut.mp4) is only made from a storyboard the user approved.
//   node pipeline/approve.mjs <project>             record the user's approval of the storyboard as it is now
//   node pipeline/approve.mjs <project> --status    say whether the current storyboard is approved
//   node pipeline/approve.mjs <project> --revoke    withdraw the approval
// The user approves on the storyboard page (http://localhost:4600/pipeline/storyboard/?project=<name>: live scenes, a note per
// scene, an "Approve & make video" button that calls approve() below). From the command line: run this only when the
// user has said they approve; never on your own judgement.
// A change to storyboard.json before the first video needs a new approval. Once out/cut.mp4 exists, changes made from the user's
// notes on the finished video need none: apply them and make again. Section previews (--section) and stills never need one.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const paths = project => {
  const dir = join(root, 'projects', project);
  return {dir, storyboard: join(dir, 'storyboard.json'), record: join(dir, 'approval.json')};
};
const fingerprint = file => createHash('sha256').update(readFileSync(file)).digest('hex');

/** {approved, reason}: whether out/cut.mp4 may be made from the storyboard as it is now. */
export function approvalStatus(project) {
  const p = paths(project);
  if (!existsSync(p.record)) return {approved: false, reason: 'the storyboard has not been approved yet'};
  const record = JSON.parse(readFileSync(p.record, 'utf8'));
  // Approval is needed once, before the first video. After that the user edits the finished video on the review page:
  // the user's notes are applied and the video is remade straight away, with no new storyboard sign-off.
  if (record.storyboard !== fingerprint(p.storyboard) && existsSync(join(p.dir, 'out', 'cut.mp4')))
    return {approved: true, at: record.at, via: record.via, editing: true, reason: `approved ${record.at}; final-edit changes since then need no new approval`};
  if (record.storyboard !== fingerprint(p.storyboard)) return {approved: false, changed: true, at: record.at, reason: `storyboard.json changed after it was approved (${record.at})`};
  return {approved: true, at: record.at, via: record.via, reason: `approved ${record.at}`};
}

/** Record the user's approval of the storyboard as it is now. `via` says where they gave it. */
export function approve(project, via = 'command line') {
  const p = paths(project);
  if (!existsSync(p.storyboard)) throw Error(`No storyboard: projects/${project}/storyboard.json`);
  writeFileSync(p.record, JSON.stringify({storyboard: fingerprint(p.storyboard), via, at: new Date().toISOString()}, null, 1) + '\n');
}

/** Throws, with what to do next, unless the current storyboard is approved. */
export function requireApproval(project) {
  const {approved, reason} = approvalStatus(project);
  if (approved) return;
  throw Error(`Not making the final video: ${reason}.
Show the user the storyboard first and wait for the user's approval:
  1. send the user the storyboard page (npm run link ${project} prints the link), with a short beat-by-beat summary, and stop
  2. they leave notes per scene there (npm run review ${project} lists them) or presses "Approve & make video"
  3. if they approve in chat instead:  npm run approve ${project}   then  npm run make ${project}
A quick look at one part needs no approval: npm run make ${project} -- --section <id>.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), project = args.find(a => !a.startsWith('--'));
    if (!project) throw Error('Usage: npm run approve <project> [-- --status | --revoke]');
    const p = paths(project);
    if (!existsSync(p.storyboard)) throw Error(`No storyboard: projects/${project}/storyboard.json`);
    if (args.includes('--status')) { const s = approvalStatus(project); console.log(`${project}: ${s.approved ? 'APPROVED' : 'NOT APPROVED'} (${s.reason})`); }
    else if (args.includes('--revoke')) { rmSync(p.record, {force: true}); console.log(`${project}: approval withdrawn.`); }
    else { approve(project); console.log(`${project}: storyboard approved. npm run make ${project} will now make the final video.`); }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

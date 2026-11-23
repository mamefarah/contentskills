#!/usr/bin/env node
// Undo a section change: put one section of the video, and its storyboard entries, back the way they were before a patch.
//   node pipeline/undo.mjs <project>            list the history (newest first; the last 12 changes are kept)
//   node pipeline/undo.mjs <project> <id|last>  undo that change
// Only that section goes back: changes made to other sections since then stay. The undo is itself a patch, so it can be
// undone too. Projects without a patch history can still go back to a kept version (out/cut-v<n>.mp4).
import {spawnSync} from 'node:child_process';
import {readFileSync, renameSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './check.mjs';
import {busy, history, historyManifest, withRangeFrom} from './segments.mjs';

const [project, which] = process.argv.slice(2);
try {
  if (!project) throw Error('Usage: npm run undo <project> [<id>|last]');
  const list = history(project);
  if (!which) {
    if (!list.length) console.log(`No section changes to undo in ${project} yet.`);
    for (const e of list) console.log(`${e.id}   ${e.section} (${e.start.toFixed(1)}–${e.end.toFixed(1)} s)   ${e.label}`);
    process.exit(0);
  }
  const entry = which === 'last' ? list[0] : list.find(e => e.id === which);
  if (!entry) throw Error(`No history entry "${which}" in ${project}. npm run undo ${project} lists them.`);
  if (busy(project, entry.section)) throw Error(`Section ${entry.section} is being worked on right now; undo it when that finishes.`);
  const before = historyManifest(project, entry.id)?.storyboard;
  if (!before) throw Error(`History entry ${entry.id} has no storyboard to go back to.`);
  const file = join(root, 'projects', project, 'storyboard.json'), current = JSON.parse(readFileSync(file, 'utf8'));
  const restored = withRangeFrom(current, before, entry);
  writeFileSync(file + '.undo.tmp', JSON.stringify(restored, null, 2) + '\n'); renameSync(file + '.undo.tmp', file);
  console.log(`Put the storyboard entries of ${entry.section} back as they were before "${entry.label}". Re-making that section…`);
  const run = spawnSync(process.execPath, [join(root, 'pipeline/patch.mjs'), project, entry.section, '--label', `undo: ${entry.label}`], {stdio: 'inherit'});
  process.exitCode = run.status ?? 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }

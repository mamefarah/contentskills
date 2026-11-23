#!/usr/bin/env node
// Review without a browser: one image per shot showing every candidate side by side
// (A, B, C… left to right), each caught late in the shot when its piece has settled.
//   node pipeline/stills.mjs <project>      ->  projects/<project>/out/review/<nn>-<shot>.jpg
// An agent looks at these, then marks pieces with `npm run mark`. People can use the draft player instead.
import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildTimeline, checkStoryboard, describe} from './timeline.js';
import {root, readLibrary, libraryOf, readStoryboard, readVoice} from './check.mjs';
import {openDraft} from './browser.mjs';
import {preview} from './qa.mjs';

let draft;
try {
  const project = process.argv[2], storyboard = readStoryboard(project), problems = checkStoryboard(storyboard, readLibrary(storyboard.theme), null, libraryOf);
  if (problems.length) throw Error('Fix the storyboard first:\n' + problems.map(p => '  - ' + p).join('\n'));
  const timeline = buildTimeline(storyboard, 'all', readVoice(project)), {width, height} = timeline.format;
  const dir = join(root, 'projects', project, 'out', 'review');
  rmSync(dir, {recursive: true, force: true}); mkdirSync(dir, {recursive: true});
  draft = await openDraft(project, {width, height, scale: .35});
  for (const [n, shot] of timeline.shots.entries()) {
    const files = [];
    for (let index = 0; index < shot.candidates.length; index++) {
      await draft.evaluate(`window.draft.view(${JSON.stringify(shot.id)}, ${index})`);
      await draft.evaluate(`window.draft.seek(${shot.start + (shot.end - shot.start) * .85})`);
      const file = join(dir, `.${shot.id}-${index}.jpg`); writeFileSync(file, await draft.screenshot()); files.push(file);
    }
    const sheet = join(dir, `${String(n + 1).padStart(2, '0')}-${shot.id}.jpg`);
    const stack = files.length > 1 ? ['-filter_complex', `hstack=inputs=${files.length}`] : [];
    if (spawnSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap(f => ['-i', f]), ...stack, sheet], {stdio: 'inherit'}).status !== 0) throw Error('Could not write ' + sheet);
    for (const file of files) rmSync(file);
    console.log(`  ${sheet.slice(root.length)}   ${shot.candidates.map((c, i) => `${'ABCDEFGH'[i]}=${describe(c)} (${c.status ?? 'draft'})`).join('   ')}`);
  }
  await draft.close(); draft = null;
  // Catch caption and text problems now, not after the full make (checks every shot's first non-rejected candidate).
  if (await preview(project) !== 0) console.log('Fix the FAILs above in the storyboard before making the video.');
  console.log(`\nLook at each image, then:  npm run mark ${project} <shot> <A|B|…> <usable|rejected|pick>`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await draft?.close(); }

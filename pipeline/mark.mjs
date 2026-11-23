#!/usr/bin/env node
// Record a review decision from the command line (the draft player does the same with buttons).
//   node pipeline/mark.mjs <project> <shot> <A|B|C…> <draft|usable|rejected|pick>
// "pick" marks the candidate usable and chooses it for the cut.
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root, readStoryboard} from './check.mjs';
import {STATUSES, pickOf} from './timeline.js';

try {
  const [project, shotId, letter, verdict] = process.argv.slice(2);
  const storyboard = readStoryboard(project), shot = storyboard.shots.find(s => s.id === shotId);
  if (!shot) throw Error(`No shot "${shotId}". Shots: ${storyboard.shots.map(s => s.id).join(', ')}`);
  const index = 'ABCDEFGH'.indexOf(String(letter).toUpperCase()), candidate = shot.candidates[index];
  if (!candidate) throw Error(`Shot "${shotId}" has candidates ${shot.candidates.map((c, i) => 'ABCDEFGH'[i]).join(', ')}.`);
  if (verdict === 'pick') { candidate.status = 'usable'; shot.pick = index; }
  else if (STATUSES.includes(verdict)) { candidate.status = verdict; if (verdict !== 'usable' && shot.pick === index) delete shot.pick; }
  else throw Error(`Verdict must be one of ${STATUSES.join(', ')}, pick.`);
  writeFileSync(join(root, 'projects', project, 'storyboard.json'), JSON.stringify(storyboard, null, 2) + '\n');
  const pick = pickOf(shot);
  console.log(`${shotId}: ${shot.candidates.map((c, i) => `${'ABCDEFGH'[i]} ${c.status ?? 'draft'}${i === pick ? ' (in the cut)' : ''}`).join(' · ')}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }

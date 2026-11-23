#!/usr/bin/env node
// The agent's side of the review page (/pipeline/review/?project=<name>): read what the user marked, and answer.
//   node pipeline/review.mjs                                   projects that have open marks
//   node pipeline/review.mjs <project>                         the open marks: reference, range, note, and what is on screen there
//   node pipeline/review.mjs <project> --all                   also the ones that are done
//   node pipeline/review.mjs <project> --json                  the same as data
//   node pipeline/review.mjs <project> --progress <id> ["…"]   mark as being worked on (optional reply)
//   node pipeline/review.mjs <project> --done <id> "<reply>"   record what was changed and close the mark; the page shows the reply
//   node pipeline/review.mjs <project> --reply <id> "<reply>"  answer without changing the status (a question back to the user)
//   node pipeline/review.mjs <project> --reopen <id>
//   node pipeline/review.mjs <project> --add <section|start-end> "<note>" [--kind change|cut|keep|question]
// Marks live in projects/<project>/review.json (pipeline/review-store.mjs).
import {existsSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {root, readSections} from './check.mjs';
import {lanesOf, within, touching, referenceOf, resolveRange, secs} from './sections.js';
import {readReview, writeReview, addMark, updateMark, KINDS} from './review-store.mjs';

const args = process.argv.slice(2), has = name => args.includes(name), after = (name, n = 1) => { const value = args.includes(name) ? args[args.indexOf(name) + n] : undefined; return value && !value.startsWith('--') ? value : undefined; };
const actions = ['--done', '--progress', '--reply', '--reopen', '--add'], valued = [...actions, '--kind'];
const project = args.find((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1]) && !(actions.includes(args[i - 2]) && args[i - 2] !== '--reopen'));

/** What is on screen between two moments, as lines of text. */
function onScreen(lanes, words, start, end) {
  const lines = [], range = i => i.point ? `${secs(i.at)}s` : `${secs(i.start)}–${secs(i.end)}s`;
  for (const lane of within(lanes, start, end)) {
    if (lane.id === 'words') continue;
    const few = lane.id === 'zooms' || lane.id === 'sounds';
    const items = lane.items.map(i => `${i.label}${lane.id === 'graphics' && i.index != null ? ` (overlays[${i.index}])` : ''} ${range(i)}${!few && i.detail ? ` · ${i.detail}` : ''}`);
    lines.push(`    ${(lane.label + ':').padEnd(13)}${few ? items.join(', ') : items.join(`\n    ${' '.repeat(13)}`)}`);
  }
  const said = words.filter(w => w.start < end && w.end > start).map(w => w.text).join(' ');
  if (said) lines.push(`    ${'Said:'.padEnd(13)}"${said}"`);
  return lines.join('\n');
}

try {
  if (!project) {
    const names = readdirSync(join(root, 'projects')).filter(n => /^[a-z0-9-]+$/.test(n) && existsSync(join(root, 'projects', n, 'review.json')));
    const rows = names.map(n => ({n, marks: readReview(root, n).marks})).filter(r => r.marks.length);
    if (!rows.length) console.log('No project has review marks yet. The user adds them on the review page (npm run link <project> review prints the link).');
    for (const r of rows) console.log(`${r.n.padEnd(28)} ${r.marks.filter(m => m.status !== 'done').length} open of ${r.marks.length}   →  npm run review ${r.n}`);
    process.exit(0);
  }
  const review = readReview(root, project), {storyboard, timeline, sections, words} = readSections(project), lanes = lanesOf(storyboard, timeline), said = timeline.words ?? words;
  const act = actions.find(has);
  if (act === '--add') {
    const range = resolveRange(sections, after('--add'), timeline.duration), note = after('--add', 2);
    if (!note) throw Error('Usage: npm run review <project> -- --add <section|start-end> "<note>" [--kind question]');
    const kind = after('--kind') ?? 'change'; if (!KINDS.includes(kind)) throw Error(`--kind must be one of ${KINDS.join(', ')}.`);
    const mark = addMark(review, {start: range.start, end: range.end, note, kind, section: range.sections[0]?.id ?? '', ref: referenceOf(project, sections, range.start, range.end)});
    writeReview(root, project, review); console.log(`Added ${mark.id}: ${mark.ref} — ${mark.note}`);
  } else if (act) {
    const id = after(act), reply = after(act, 2);
    if (!id) throw Error(`Usage: npm run review <project> -- ${act} <id>${act === '--reopen' ? '' : ' "<what you changed>"'}`);
    if (act === '--done' && !reply) throw Error('Say what was changed:  npm run review <project> -- --done <id> "<reply>"');
    if (act === '--reply' && !reply) throw Error('Usage: npm run review <project> -- --reply <id> "<reply>"');
    const patch = {...(reply ? {reply} : {}), ...(act === '--done' ? {status: 'done'} : act === '--progress' ? {status: 'in-progress'} : act === '--reopen' ? {status: 'open'} : {})};
    const mark = updateMark(review, id, patch);
    if (!mark) throw Error(`No mark "${id}" in projects/${project}/review.json. Marks: ${review.marks.map(m => m.id).join(', ') || 'none'}.`);
    writeReview(root, project, review); console.log(`${mark.id} is now ${mark.status}${mark.reply ? ` — reply: ${mark.reply}` : ''}`);
    if (act === '--done') console.log(`If "${mark.note}" is a taste they will want every time, not a one-off fix, keep it in the user's style:  npm run style -- learn "<the preference>" --project ${project}`);
  } else {
    const shown = review.marks.filter(m => has('--all') || m.status !== 'done');
    const full = shown.map(m => ({...m, ref: referenceOf(project, sections, m.start, m.end), sections: touching(sections, m.start, m.end).map(s => s.id),
      onScreen: Object.fromEntries(within(lanes, m.start, m.end).map(l => [l.id, l.items.map(({label, start, end, at, detail, index}) => ({label, start, end, ...(at != null ? {at} : {}), ...(detail ? {detail} : {}), ...(l.id === 'graphics' && index != null ? {overlay: index} : {})}))]))}));
    if (has('--json')) { console.log(JSON.stringify({project, marks: full}, null, 2)); process.exit(0); }
    const open = review.marks.filter(m => m.status !== 'done').length;
    console.log(`${project} · ${open} open mark(s) of ${review.marks.length}${has('--all') ? '' : review.marks.length > open ? ' (--all shows the done ones)' : ''}\n`);
    if (!shown.length) console.log(`Nothing to do. The user adds notes on the storyboard page (npm run link ${project}) and marks on the video's review page (npm run link ${project} review)`);
    for (const m of full) {
      const target = m.sections.length === 1 ? m.sections[0] : `${m.start.toFixed(2)}-${m.end.toFixed(2)}`;
      if (m.stage === 'storyboard') {      // a note on the storyboard page, before the video exists: change storyboard.json, not the video
        console.log(`${m.id} · STORYBOARD NOTE on scene "${m.section}" · ${m.status}\n  "${m.note}"${m.shots?.length ? `\n  screenshots (open each): ${m.shots.map(x => `projects/${project}/${x}`).join('  ')}` : ''}${m.reply ? `\n  reply so far: ${m.reply}` : ''}\n  scene ${secs(m.start)}–${secs(m.end)} s:\n${onScreen(lanes, said, m.start, m.end)}`);
        console.log(`  change the storyboard (its generator if it has one), npm run stills ${project}, look; when done:  npm run review ${project} -- --done ${m.id} "<what you changed>"\n`);
        continue;
      }
      console.log(`${m.id} · ${m.kind} · ${m.status}${m.video && m.video !== 'cut.mp4' ? ` · marked on ${m.video}` : ''}\n  ${m.ref}\n  "${m.note}"${m.shots?.length ? `\n  screenshots (open each): ${m.shots.map(x => `projects/${project}/${x}`).join('  ')}` : ''}${m.reply ? `\n  reply so far: ${m.reply}` : ''}\n  on screen ${secs(m.start)}–${secs(m.end)} s:\n${onScreen(lanes, said, m.start, m.end)}`);
      console.log(`  quick look:  npm run make ${project} -- --section ${target}      when done:  npm run review ${project} -- --done ${m.id} "<what you changed>"\n`);
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }

#!/usr/bin/env node
// Prints the link to a page of this folder's dashboard, starting the dashboard first when it is not running.
//   npm run link                         the dashboard
//   npm run link <project>               the project's storyboard page
//   npm run link <project> review        the finished video's review page (or: storyboard, draft)
// Always take links from here. The dashboard is usually on port 4600, but it moves to the next free port when another
// program has that one, so a remembered port number can open someone else's page.
import {spawn} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './check.mjs';
import {serverNote, whoIsOn} from '../dashboard/serve.mjs';

const PAGES = {storyboard: 'pipeline/storyboard/', review: 'pipeline/review/', draft: 'pipeline/draft/'};
const noted = () => { try { return JSON.parse(readFileSync(serverNote, 'utf8')).port; } catch { return null; } };
async function find() {
  const first = noted();
  for (const port of [first, ...Array.from({length: 20}, (_, i) => 4600 + i)]) if (port && await whoIsOn(port) === 'ours') return port;
  return null;
}

try {
  const [project, page = 'storyboard'] = process.argv.slice(2);
  if (project && !/^[a-z0-9-]+$/.test(project)) throw Error('Usage: npm run link [<project> [storyboard|review|draft]]');
  if (project && !PAGES[page]) throw Error(`No page "${page}". Pages: ${Object.keys(PAGES).join(', ')}.`);
  if (project && !existsSync(join(root, 'projects', project))) throw Error(`No project "${project}" in projects/.`);
  let port = await find();
  if (!port) {
    spawn(process.execPath, [join(root, 'dashboard/serve.mjs')], {cwd: root, detached: true, stdio: 'ignore'}).unref();
    for (let tries = 0; tries < 40 && !port; tries++) { await new Promise(done => setTimeout(done, 250)); port = await find(); }
    if (!port) throw Error('The dashboard did not start. Run it to see why: npm run dashboard');
  }
  console.log(`http://localhost:${port}/` + (project ? `${PAGES[page]}?project=${project}` : 'dashboard/'));
} catch (error) { console.error(error.message); process.exitCode = 1; }

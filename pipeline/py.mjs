#!/usr/bin/env node
// Runs a Python script of this repo with the effects engine's Python (installed by `npm run setup` in .tools/, on any
// OS; CONTENTSKILLS_EFFECTS_PYTHON overrides it), so npm scripts need no hard-coded interpreter path.
//   node pipeline/py.mjs <script.py> [arguments…]
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {effectsPython, root} from './tools.mjs';

const [script, ...args] = process.argv.slice(2);
if (!script) { console.error('Usage: node pipeline/py.mjs <script.py> [arguments…]'); process.exit(2); }
const r = spawnSync(effectsPython(), [join(root, script), ...args], {stdio: 'inherit'});
process.exit(r.status ?? 1);

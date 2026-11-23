#!/usr/bin/env node
// Regenerates a theme's Lottie animations from its generator (library/themes/<theme>/lottie/generate.mjs).
//   npm run lottie -- <theme>      one theme
//   npm run lottie                 lists the themes that have a generator
import {existsSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {root} from './tools.mjs';

const themes = join(root, 'library/themes'), has = t => existsSync(join(themes, t, 'lottie/generate.mjs'));
const theme = process.argv[2];
if (!theme) { console.log('Themes with a Lottie generator: ' + readdirSync(themes).filter(has).join(', ') + '\nUsage: npm run lottie -- <theme>'); process.exit(0); }
if (!/^[a-z0-9-]+$/.test(theme) || !has(theme)) { console.error(`No Lottie generator for theme "${theme}".`); process.exit(1); }
process.exit(spawnSync(process.execPath, [join(themes, theme, 'lottie/generate.mjs')], {stdio: 'inherit'}).status ?? 1);

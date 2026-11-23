// Styles: the user's look, taken from reels they like and from the user's review marks, laid over any theme.
//
//   npm run style -- from <reel file or URL> [--name <name>] [--cookies chrome]
//        Downloads the reel if given a URL (yt-dlp; Instagram usually needs --cookies <browser>, ask the user first;
//        their standing choice is style.cookiesBrowser in settings/user.json),
//        measures it (pipeline/style.py: pace, grade, palette, how much text) and writes
//        style/references/<name>/style.json with what was measured plus a contact sheet (sheet.jpg).
//        The fonts and caption look cannot be measured: look at sheet.jpg and frames/, then fill in "fonts" and
//        "captions" (npm run style -- fonts lists the families bundled here) and delete "todo".
//   npm run style -- use <name>          make a reference style the user's profile (style/profile.json); the user's learnt prefs are kept
//   npm run style -- apply <project> [profile|<name>]   name the style in a project's storyboard ("style")
//   npm run style -- learn "<preference>" [--project <name>]   remember a taste the user showed (from a review mark, say)
//   npm run style -- set <field.path> <json value>     change one field of the profile, e.g. set captions.size 5
//   npm run style -- show [name]         print the profile (or a reference style)
//   npm run style -- fonts               the font families any theme bundles (the only ones a style can use)
//
// A style changes what the theme wears (colours, fonts, captions, grade), never which pieces exist. Only general traits
// are taken from a reference — colours, pace, type feel — never its layouts, graphics or assets.
import {spawnSync} from 'node:child_process';
import {settings} from './settings.mjs';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';
import {root, paths} from './tools.mjs';

const STYLE = join(root, 'style'), PROFILE = join(STYLE, 'profile.json');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const write = (file, data) => { mkdirSync(join(file, '..'), {recursive: true}); writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); };
const refFile = name => join(STYLE, 'references', name, 'style.json');
const clamp = x => Math.round(Math.max(-1, Math.min(1, x)) * 100) / 100;
const python = paths.effectsPython;

function fonts() {
  const out = {};
  for (const theme of read(join(root, 'library/themes/index.json'))) {
    const file = join(root, 'library/themes', theme, 'fonts/catalog.json'); if (!existsSync(file)) continue;
    for (const f of read(file).items ?? []) (out[f.family] ??= []).push(theme);
  }
  return out;
}

/** Measured traits -> a first draft of the style. The grade is a nudge relative to a plain phone video. */
function draft(name, source, a) {
  const g = a.grade, sat = a.accents?.filter(x => x.share > .002) ?? [];
  const dark = a.palette.filter(p => p.value < .35).sort((x, y) => y.share - x.share)[0], light = a.palette.filter(p => p.value > .75).sort((x, y) => y.share - x.share)[0];
  return {
    name, source, made: new Date().toISOString().slice(0, 10),
    todo: 'Look at sheet.jpg and frames/: fill in fonts and captions, check colors (accents are guesses from saturated pixels), then delete this line.',
    colors: {accent: sat[0]?.hex ?? '#3D7BFF', accent2: sat[1]?.hex ?? sat[0]?.hex ?? '#8B7BFF', accent3: sat[2]?.hex ?? sat[0]?.hex ?? '#6FE3C4', ink: dark?.hex ?? '#111111', paper: light?.hex ?? '#F5F5F0'},
    fonts: {display: 'Inter Tight', text: 'Inter Tight'},
    captions: {font: 'Inter Tight', weight: 800, size: 5.4, case: 'none', color: '#FFFFFF', highlight: {mode: 'color', color: sat[0]?.hex ?? '#FFD84D'}, background: {mode: 'none'}, future: 'show', words: 3},
    grade: {warmth: clamp((g.warmth - .02) / .15), saturation: clamp((g.saturation - .38) / .3), contrast: clamp((g.contrast - .22) / .15), brightness: clamp((g.brightness - .45) / .25), fade: clamp(Math.max(0, g.blacks - .05) / .15), grain: 0, vignette: 0},
    pace: {cutsPerSecond: a.pace.cutsPerSecond, medianShot: a.pace.medianShot, textOnScreen: a.text.framesWithText},
    notes: [],
  };
}

function from(input, opts) {
  const url = /^https?:\/\//.test(input), name = opts.name ?? (url ? (/\/(?:p|reel|reels)\/([^/?#]+)/.exec(input)?.[1] ?? 'reference') : basename(input).replace(/\.[^.]+$/, '')).replace(/[^A-Za-z0-9_-]/g, '-');
  const dir = join(STYLE, 'references', name); mkdirSync(dir, {recursive: true});
  let video = url ? join(dir, 'reel.mp4') : resolve(input);
  if (url && !existsSync(video)) {
    const cookies = opts.cookies || settings().style?.cookiesBrowser || '';   // --cookies <browser>, or the user's standing choice in settings (style.cookiesBrowser)
    const args = ['-q', '--no-warnings', '--no-playlist', '-f', 'mp4/best', '-o', join(dir, 'reel.%(ext)s'), ...(cookies ? ['--cookies-from-browser', cookies] : []), input];
    const r = spawnSync('yt-dlp', args, {stdio: 'inherit'});
    if (r.status !== 0 || !existsSync(video)) throw Error(`Could not download ${input}.${cookies ? '' : ' Instagram usually needs a login: ask the user, then add --cookies <their browser> (or set style.cookiesBrowser in settings/user.json).'} Or save the reel yourself and run: npm run style -- from <file> --name ${name}`);
  }
  if (!existsSync(video)) throw Error(`No such file: ${input}`);
  const r = spawnSync(python, [join(root, 'pipeline/style.py'), video, dir], {encoding: 'utf8'});
  if (r.status !== 0) throw Error(r.stderr || 'style.py failed');
  const analysis = read(join(dir, 'analysis.json')), file = refFile(name);
  if (existsSync(file)) console.log(`Kept the existing style/references/${name}/style.json (delete it to start again); the measurements are in analysis.json.`);
  else write(file, draft(name, url ? input : basename(input), analysis));
  console.log(`Measured ${analysis.duration}s: ${analysis.pace.cuts} cuts (${analysis.pace.cutsPerSecond}/s), text on screen in ${Math.round(analysis.text.framesWithText * 100)}% of frames.`);
  console.log(`Now look at style/references/${name}/sheet.jpg (and frames/), fill in fonts and captions in style/references/${name}/style.json, then: npm run style -- use ${name}`);
}

function setPath(obj, path, value) { const keys = path.split('.'); let o = obj; for (const k of keys.slice(0, -1)) o = o[k] ??= {}; o[keys.at(-1)] = value; }

const [cmd, ...rest] = process.argv.slice(2), opts = {}, args = [];
for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[++i]; else args.push(rest[i]); }
try {
  if (cmd === 'from' && args[0]) from(args[0], opts);
  else if (cmd === 'fonts') { for (const [family, themes] of Object.entries(fonts()).sort()) console.log(`${family.padEnd(32)} ${themes.join(', ')}`); }
  else if (cmd === 'use' && args[0]) {
    const ref = read(refFile(args[0])); if (ref.todo) throw Error(`style/references/${args[0]}/style.json still has a "todo": finish it first.`);
    const old = existsSync(PROFILE) ? read(PROFILE) : {};
    write(PROFILE, {...ref, from: args[0], prefs: old.prefs ?? []});
    console.log(`style/profile.json is now "${ref.name}"${old.prefs?.length ? ` (kept ${old.prefs.length} learnt preference(s))` : ''}. New footage projects use it; for an existing one: npm run style -- apply <project>`);
  }
  else if (cmd === 'apply' && args[0]) {
    const file = join(root, 'projects', args[0], 'storyboard.json'), name = args[1] ?? 'profile', sb = read(file);
    if (name !== 'profile' && !existsSync(refFile(name))) throw Error(`No such style: ${name}`);
    if (name === 'profile' && !existsSync(PROFILE)) throw Error('There is no style/profile.json yet: npm run style -- use <name>');
    sb.style = name; write(file, sb);
    console.log(`projects/${args[0]}/storyboard.json now uses style "${name}".` + (existsSync(join(root, 'projects', args[0], 'build-storyboard.py')) ? ` This project has build-storyboard.py: also set 'style': '${name}' there, or the next build drops it.` : ''));
  }
  else if (cmd === 'learn' && args[0]) {
    const p = existsSync(PROFILE) ? read(PROFILE) : {name: 'My style', prefs: []};
    (p.prefs ??= []).push({note: args[0], date: new Date().toISOString().slice(0, 10), ...(opts.project ? {project: opts.project} : {})});
    write(PROFILE, p); console.log(`Remembered (${p.prefs.length}): ${args[0]}`);
  }
  else if (cmd === 'set' && args.length >= 2) {
    const p = existsSync(PROFILE) ? read(PROFILE) : {name: 'My style'}; let v; try { v = JSON.parse(args[1]); } catch { v = args[1]; }
    setPath(p, args[0], v); write(PROFILE, p); console.log(`profile ${args[0]} = ${JSON.stringify(v)}`);
  }
  else if (cmd === 'show') { const file = args[0] ? refFile(args[0]) : PROFILE; console.log(existsSync(file) ? readFileSync(file, 'utf8') : `No ${args[0] ? 'reference style ' + args[0] : 'profile yet'}.`); if (!args[0] && existsSync(join(STYLE, 'references'))) console.log('References: ' + readdirSync(join(STYLE, 'references')).join(', ')); }
  else { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); process.exitCode = cmd ? 1 : 0; }
} catch (error) { console.error(error.message); process.exitCode = 1; }

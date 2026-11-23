#!/usr/bin/env node
// Templates: reusable video STRUCTURES (themes are styles). A template turns a short spec into a project.
//   node pipeline/template.mjs                                   list the templates
//   node pipeline/template.mjs <template> <spec.json> <project>   build projects/<project>/ from the spec
// Then render it like any project: npm run make <project>   (a "direct" template renders the video itself).
// Each template lives in templates/<name>/: template.json (what it is, what it takes), build.mjs (default export
// async build(ctx)), example.json and README.md. See templates/README.md.
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, isAbsolute, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root} from './check.mjs';
import {effectsPython} from './tools.mjs';

const dir = join(root, 'templates');
const list = () => readdirSync(dir).filter(n => existsSync(join(dir, n, 'template.json'))).map(n => JSON.parse(readFileSync(join(dir, n, 'template.json'), 'utf8')));

try {
  const [name, specFile, project] = process.argv.slice(2);
  if (!name) {
    for (const t of list()) console.log(`${t.id.padEnd(18)} ${t.kind.padEnd(10)} ${t.summary}`);
    console.log('\nUsage: npm run template <template> <spec.json> <project>   (copy templates/<template>/example.json to start)');
    process.exit(0);
  }
  if (!existsSync(join(dir, name, 'build.mjs'))) throw Error(`No such template "${name}". Templates: ${list().map(t => t.id).join(', ')}`);
  if (!specFile || !/^[a-z0-9-]+$/.test(project || '')) throw Error('Usage: npm run template <template> <spec.json> <project>  (project: lowercase letters, digits, dashes)');
  const spec = JSON.parse(readFileSync(resolve(specFile), 'utf8')), specDir = dirname(resolve(specFile));
  const out = join(root, 'projects', project); mkdirSync(out, {recursive: true});
  const meta = JSON.parse(readFileSync(join(dir, name, 'template.json'), 'utf8'));
  const ctx = {
    spec, specDir, project, dir: out, root, templateDir: join(dir, name),
    resolve: p => (isAbsolute(p) ? p : resolve(specDir, p)),
    python: () => effectsPython(),
    run(cmd, args, label = cmd) {
      const r = spawnSync(cmd, args, {stdio: 'inherit', cwd: root});
      if (r.status !== 0) throw Error(`${label} failed`);
    },
  };
  const {default: build} = await import(pathToFileURL(join(dir, name, 'build.mjs')).href);
  await build(ctx);
  console.log(meta.kind === 'direct' ? `\nDone: projects/${project}/out/cut.mp4` : `\nBuilt projects/${project}/. Render it: npm run make ${project}`);
} catch (error) {
  console.error(error.message); process.exit(1);
}

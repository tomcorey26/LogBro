#!/usr/bin/env node
// Fails when hard-coded color utility classes or color literals appear
// outside src/app/globals.css. Run via `npm run lint:colors`.

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const ALLOWLIST = new Set([join('src', 'app', 'globals.css')]);

const COLOR_NAMES = [
  'red','orange','amber','yellow','lime','green','emerald','teal','cyan',
  'sky','blue','indigo','violet','purple','fuchsia','pink','rose',
  'slate','gray','zinc','neutral','stone',
];
const PROPS = [
  'bg','text','border','ring','fill','stroke','from','to','via',
  'outline','divide','shadow','placeholder','caret','accent',
];
const utilityRegex = new RegExp(
  String.raw`\b(${PROPS.join('|')})-(${COLOR_NAMES.join('|')})-\d`,
);
const hexRegex = /#[0-9a-fA-F]{6}\b/;
const hslRgbRegex = /\b(hsl|hsla|rgb|rgba)\s*\(/;

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx|css)$/.test(entry.name)) yield path;
  }
}

const violations = [];

for await (const path of walk(SRC)) {
  const rel = relative(ROOT, path).split(sep).join('/');
  const allowKey = ALLOWLIST.has(relative(ROOT, path)) || ALLOWLIST.has(rel.split('/').join(sep));
  if (allowKey) continue;
  const text = await readFile(path, 'utf8');
  text.split('\n').forEach((line, i) => {
    if (utilityRegex.test(line)) {
      violations.push({ path: rel, line: i + 1, kind: 'utility', snippet: line.trim() });
    }
    if (hexRegex.test(line)) {
      violations.push({ path: rel, line: i + 1, kind: 'hex', snippet: line.trim() });
    }
    if (hslRgbRegex.test(line)) {
      violations.push({ path: rel, line: i + 1, kind: 'hsl/rgb', snippet: line.trim() });
    }
  });
}

if (violations.length === 0) {
  console.log('lint:colors — no hard-coded colors found.');
  process.exit(0);
}

console.error(`lint:colors — ${violations.length} violation(s):`);
for (const v of violations) {
  console.error(`  ${v.path}:${v.line} [${v.kind}] ${v.snippet}`);
}
console.error(
  '\nDefine the color in src/app/globals.css (as a token) and use a Tailwind utility derived from it.',
);
process.exit(1);

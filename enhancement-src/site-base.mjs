import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.rsc', '.txt', '.webmanifest', '.xml']);
const TEXT_FILENAMES = new Set(['_headers']);

export function normalizeSiteBasePath(value) {
  const base = String(value ?? '').trim();
  if (!/^\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(base) || base.includes('..')) {
    throw new Error(`Invalid site base path: ${value}`);
  }
  return base;
}

async function collectTextFiles(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectTextFiles(file, output);
    else if (TEXT_FILENAMES.has(entry.name) || TEXT_EXTENSIONS.has(path.extname(entry.name))) output.push(file);
  }
  return output;
}

export async function rewriteSiteBase({ rootDir, fromBase, toBase }) {
  const source = normalizeSiteBasePath(fromBase);
  const target = normalizeSiteBasePath(toBase);
  let filesChanged = 0;
  let replacements = 0;

  if (source === target) return { filesChanged, replacements };
  for (const file of await collectTextFiles(rootDir)) {
    const current = await readFile(file, 'utf8');
    const count = current.split(source).length - 1;
    if (count === 0) continue;
    await writeFile(file, current.split(source).join(target));
    filesChanged += 1;
    replacements += count;
  }
  return { filesChanged, replacements };
}

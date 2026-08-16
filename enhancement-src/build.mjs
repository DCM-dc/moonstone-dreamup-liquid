import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync } from 'fflate';
import { build } from 'esbuild';
import { injectEnhancement } from './build-lib.mjs';

export async function buildSite({ archivePath, outDir, rootDir }) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const entries = unzipSync(new Uint8Array(await readFile(archivePath)));
  for (const [name, bytes] of Object.entries(entries)) {
    const target = path.join(outDir, name);
    if (name.endsWith('/')) { await mkdir(target, { recursive: true }); continue; }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }

  await build({
    entryPoints: [path.join(rootDir, 'enhancement-src/src/main.js')],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['es2022'],
    outfile: path.join(outDir, 'liquid-world.js')
  });
  await cp(path.join(rootDir, 'enhancement-src/styles/moonstone-metal.css'), path.join(outDir, 'moonstone-metal.css'));

  const mirror = path.join(outDir, 'moonstone-dreamup');
  await mkdir(mirror, { recursive: true });
  await cp(path.join(outDir, 'index.html'), path.join(mirror, 'index.html'));

  for (const relative of ['index.html', 'moonstone-dreamup/index.html']) {
    const file = path.join(outDir, relative);
    const html = await readFile(file, 'utf8');
    await writeFile(file, injectEnhancement(html, '/moonstone-dreamup'));
  }

  await cp(path.join(outDir, 'liquid-world.js'), path.join(mirror, 'liquid-world.js'));
  await cp(path.join(outDir, 'moonstone-metal.css'), path.join(mirror, 'moonstone-metal.css'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = process.cwd();
  await buildSite({
    archivePath: path.join(rootDir, 'moonstone-dreamup-github-pages-static.zip'),
    outDir: path.join(rootDir, 'dist'),
    rootDir
  });
}

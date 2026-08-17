import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync } from 'fflate';
import { build } from 'esbuild';
import { injectEnhancement } from './build-lib.mjs';
import { normalizeSiteBasePath, rewriteSiteBase } from './site-base.mjs';

const MOONSTONE_ASSETS = Object.freeze([
  'moonstone-faq-pebbles.webp',
  'moonstone-hero-silver-sprout.webp',
  'moonstone-join-arc.webp',
  'moonstone-liquid-fragments.webp',
  'moonstone-liquid-hero.webp',
  'moonstone-meteor-trail.webp',
  'moonstone-proof-link.webp',
  'moonstone-silver-vein.webp',
  'moonstone-who-slices.webp'
]);

const ORIGINAL_STATIC_ASSETS = Object.freeze([
  'brand-ink-field.png',
  'brand-ink-strip.png',
  'favicon.svg',
  'file.svg',
  'globe.svg',
  'hero-incoming-meteor.png',
  'hero-moonstone-shanghai-sprout.png',
  'hero-moonstone-shanghai.png',
  'manifesto-meteor-realistic.png',
  'moonstone-wordmark.svg',
  'og.png',
  'window.svg'
]);

export async function buildSite({
  archivePath,
  outDir,
  rootDir,
  siteBasePath = '/moonstone-dreamup',
}) {
  const basePath = normalizeSiteBasePath(siteBasePath);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const entries = unzipSync(new Uint8Array(await readFile(archivePath)));
  for (const [name, bytes] of Object.entries(entries)) {
    const target = path.join(outDir, name);
    if (name.endsWith('/')) { await mkdir(target, { recursive: true }); continue; }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }

  await rewriteSiteBase({
    rootDir: outDir,
    fromBase: '/moonstone-dreamup',
    toBase: basePath,
  });

  await build({
    entryPoints: [path.join(rootDir, 'enhancement-src/src/main.js')],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['es2022'],
    outfile: path.join(outDir, 'liquid-world.js')
  });
  await cp(path.join(rootDir, 'enhancement-src/styles/moonstone-metal.css'), path.join(outDir, 'moonstone-metal.css'));

  for (const asset of MOONSTONE_ASSETS) {
    await cp(path.join(rootDir, 'enhancement-src/assets', asset), path.join(outDir, asset));
  }

  const mirror = path.join(outDir, 'moonstone-dreamup');
  await mkdir(mirror, { recursive: true });
  await cp(path.join(outDir, 'index.html'), path.join(mirror, 'index.html'));
  for (const asset of ORIGINAL_STATIC_ASSETS) {
    await cp(path.join(outDir, asset), path.join(mirror, asset));
  }

  for (const relative of ['index.html', 'moonstone-dreamup/index.html']) {
    const file = path.join(outDir, relative);
    const html = await readFile(file, 'utf8');
    await writeFile(file, injectEnhancement(html, basePath));
  }

  await cp(path.join(outDir, 'liquid-world.js'), path.join(mirror, 'liquid-world.js'));
  await cp(path.join(outDir, 'moonstone-metal.css'), path.join(mirror, 'moonstone-metal.css'));
  for (const asset of MOONSTONE_ASSETS) {
    await cp(path.join(outDir, asset), path.join(mirror, asset));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = process.cwd();
  await buildSite({
    archivePath: path.join(rootDir, 'moonstone-dreamup-github-pages-static.zip'),
    outDir: path.join(rootDir, 'dist'),
    rootDir,
    siteBasePath: process.env.SITE_BASE_PATH ?? '/moonstone-dreamup',
  });
}

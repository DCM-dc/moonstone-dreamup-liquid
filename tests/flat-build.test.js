import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSite } from '../enhancement-src/build.mjs';

describe('flat site asset mirroring', () => {
  it('keeps the original Moon surface and brand visuals available under the base path', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'moonstone-flat-build-'));

    try {
      await buildSite({
        archivePath: path.resolve('moonstone-dreamup-github-pages-static.zip'),
        outDir,
        rootDir: path.resolve('.')
      });

      for (const asset of [
        'hero-moonstone-shanghai-sprout.png',
        'manifesto-meteor-realistic.png',
        'moonstone-wordmark.svg'
      ]) {
        const root = await readFile(path.join(outDir, asset));
        const mirrored = await readFile(path.join(outDir, 'moonstone-dreamup', asset));
        expect(mirrored).toEqual(root);
        await access(path.join(outDir, 'moonstone-dreamup', asset));
      }

      for (const asset of [
        'moonstone-faq-pebbles.webp',
        'moonstone-hero-silver-sprout.webp',
        'moonstone-join-arc.webp',
        'moonstone-liquid-fragments.webp',
        'moonstone-liquid-hero.webp',
        'moonstone-meteor-trail.webp',
        'moonstone-proof-link.webp',
        'moonstone-silver-vein.webp',
        'moonstone-who-slices.webp'
      ]) {
        const generatedRoot = await readFile(path.join(outDir, asset));
        const generatedMirror = await readFile(path.join(outDir, 'moonstone-dreamup', asset));
        expect(generatedMirror).toEqual(generatedRoot);
      }
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }, 15_000);
});

import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeSiteBasePath, rewriteSiteBase } from '../enhancement-src/site-base.mjs';

describe('site base rewriting', () => {
  it('accepts one normalized project path and rejects unsafe paths', () => {
    expect(normalizeSiteBasePath('/moonstone-dreamup-liquid')).toBe('/moonstone-dreamup-liquid');
    for (const value of ['', '/', 'moonstone-dreamup-liquid', '/../escape', '/path/']) {
      expect(() => normalizeSiteBasePath(value)).toThrow(/site base path/i);
    }
  });

  it('rewrites only supported text assets and reports the work', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'moonstone-site-base-'));
    try {
      await mkdir(path.join(rootDir, '_next', 'static', 'chunks'), { recursive: true });
      await writeFile(path.join(rootDir, 'index.html'), '<link href="/moonstone-dreamup/app.css">');
      await writeFile(path.join(rootDir, 'index.rsc'), '"/moonstone-dreamup/page"');
      await writeFile(path.join(rootDir, '_headers'), '/moonstone-dreamup/*');
      await writeFile(path.join(rootDir, '_next', 'static', 'chunks', 'app.js'), 'fetch("/moonstone-dreamup/rsc")');
      await writeFile(path.join(rootDir, 'image.png'), Buffer.from('/moonstone-dreamup/binary'));

      const result = await rewriteSiteBase({
        rootDir,
        fromBase: '/moonstone-dreamup',
        toBase: '/moonstone-dreamup-liquid',
      });

      expect(result).toEqual({ filesChanged: 4, replacements: 4 });
      expect(await readFile(path.join(rootDir, 'index.html'), 'utf8'))
        .toBe('<link href="/moonstone-dreamup-liquid/app.css">');
      expect(await readFile(path.join(rootDir, 'image.png'), 'utf8'))
        .toBe('/moonstone-dreamup/binary');
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

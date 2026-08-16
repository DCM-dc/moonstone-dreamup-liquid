import { describe, expect, it } from 'vitest';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { injectEnhancement } from '../enhancement-src/build-lib.mjs';
import { buildSite } from '../enhancement-src/build.mjs';

const execFileAsync = promisify(execFile);

describe('injectEnhancement', () => {
  const html = '<!doctype html><html><head><title>MoonStone</title></head><body><main></main></body></html>';

  it('injects one stylesheet and one deferred module', () => {
    const result = injectEnhancement(html, '/moonstone-dreamup');
    expect(result).toContain('href="/moonstone-dreamup/moonstone-metal.css"');
    expect(result).toContain('src="/moonstone-dreamup/liquid-world.js"');
    expect(result.match(/data-moonstone-enhancement/g)).toHaveLength(2);
  });

  it('is idempotent', () => {
    const once = injectEnhancement(html, '/moonstone-dreamup');
    expect(injectEnhancement(once, '/moonstone-dreamup')).toBe(once);
  });

  it('exports buildSite when imported without a script argument', async () => {
    const { stdout } = await execFileAsync(process.execPath, [
      '--input-type=module',
      '--eval',
      "import('./enhancement-src/build.mjs').then(({ buildSite }) => console.log(typeof buildSite))"
    ], { cwd: process.cwd() });

    expect(stdout.trim()).toBe('function');
  });

  it('builds a liquid-world entry that exists and loads as an ES module', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'moonstone-build-'));

    try {
      await buildSite({
        archivePath: path.resolve('moonstone-dreamup-github-pages-static.zip'),
        outDir,
        rootDir: path.resolve('.')
      });

      const entry = path.join(outDir, 'liquid-world.js');
      await access(entry);
      await import(`${pathToFileURL(entry).href}?test=${Date.now()}`);

      const outputFiles = [
        'index.html',
        'moonstone-dreamup/index.html',
        'liquid-world.js',
        'moonstone-metal.css',
        'moonstone-dreamup/liquid-world.js',
        'moonstone-dreamup/moonstone-metal.css'
      ];
      const firstBuild = await Promise.all(outputFiles.map((file) => readFile(path.join(outDir, file))));
      const [rootHtml, mirroredHtml] = firstBuild.map((content) => content.toString('utf8'));

      for (const html of [rootHtml, mirroredHtml]) {
        expect(html.match(/data-moonstone-enhancement/g)).toHaveLength(2);
        expect(html).toContain('href="/moonstone-dreamup/moonstone-metal.css"');
        expect(html).toContain('src="/moonstone-dreamup/liquid-world.js"');
      }

      await buildSite({
        archivePath: path.resolve('moonstone-dreamup-github-pages-static.zip'),
        outDir,
        rootDir: path.resolve('.')
      });
      const secondBuild = await Promise.all(outputFiles.map((file) => readFile(path.join(outDir, file))));
      expect(secondBuild).toEqual(firstBuild);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});

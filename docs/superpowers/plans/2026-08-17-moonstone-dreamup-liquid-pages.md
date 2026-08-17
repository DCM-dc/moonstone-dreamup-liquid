# MoonStone DreamUP Liquid Independent Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the complete interactive MoonStone liquid-metal site from a new public repository at `https://dcm-dc.github.io/moonstone-dreamup-liquid/` without changing the existing repository or Pages site.

**Architecture:** Add one focused build module that validates and rewrites the archived site's project base path in text assets. Pass that base path through `buildSite`, set it in the new repository's Pages workflow, then push the full source history to a second remote whose `main` branch deploys `dist`.

**Tech Stack:** Node.js 24, ECMAScript modules, Vitest 4, esbuild 0.28, GitHub Actions Pages, Git.

## Global Constraints

- The new public repository is exactly `DCM-dc/moonstone-dreamup-liquid`.
- The final URL is exactly `https://dcm-dc.github.io/moonstone-dreamup-liquid/`.
- Preserve the full Vinext/Next module runtime, intro, navigation, FAQ, visual assets, and 2D liquid-metal enhancement.
- Keep every registration trigger labelled `立即报名` and inert through the existing enhancement runtime.
- Do not generate or publish an `/offline/` page.
- Do not push these release changes to `DCM-dc/moonstone-dreamup`.
- Do not use any access token that appeared in chat; use the signed-in GitHub session and local Git credential helper.
- Run only the base-path, build, and flat-build focused checks plus one production build; do not run the WebGL or full regression matrices.

---

### Task 1: Add a safe site-base rewriter

**Files:**
- Create: `enhancement-src/site-base.mjs`
- Create: `tests/site-base.test.js`

**Interfaces:**
- Consumes: an extracted static site directory and base paths such as `/moonstone-dreamup`.
- Produces: `normalizeSiteBasePath(value: string): string` and `rewriteSiteBase({ rootDir, fromBase, toBase }): Promise<{ filesChanged: number, replacements: number }>`.

- [ ] **Step 1: Write the failing unit tests**

Create `tests/site-base.test.js` with real temporary files:

```js
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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run tests/site-base.test.js
```

Expected: FAIL because `enhancement-src/site-base.mjs` does not exist.

- [ ] **Step 3: Implement the minimal rewriter**

Create `enhancement-src/site-base.mjs` with:

```js
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
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run tests/site-base.test.js
```

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Commit Task 1**

```bash
git add enhancement-src/site-base.mjs tests/site-base.test.js
git commit -m "feat: add configurable Pages base path"
```

---

### Task 2: Integrate the new base path into the complete build and Pages workflow

**Files:**
- Modify: `enhancement-src/build.mjs:1-87`
- Modify: `.github/workflows/deploy-pages.yml:1-41`
- Modify: `tests/site-base.test.js`

**Interfaces:**
- Consumes: `normalizeSiteBasePath` and `rewriteSiteBase` from Task 1.
- Produces: `buildSite({ archivePath, outDir, rootDir, siteBasePath = '/moonstone-dreamup' })` and a workflow that sets `SITE_BASE_PATH=/moonstone-dreamup-liquid`.

- [ ] **Step 1: Add a failing complete-build test**

Append this integration case to `tests/site-base.test.js`:

```js
import { buildSite } from '../enhancement-src/build.mjs';

it('builds the complete interactive site for the liquid repository base', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'moonstone-liquid-pages-'));
  try {
    await buildSite({
      archivePath: path.resolve('moonstone-dreamup-github-pages-static.zip'),
      outDir,
      rootDir: path.resolve('.'),
      siteBasePath: '/moonstone-dreamup-liquid',
    });

    const rootHtml = await readFile(path.join(outDir, 'index.html'), 'utf8');
    expect(rootHtml).toContain('href="/moonstone-dreamup-liquid/moonstone-metal.css"');
    expect(rootHtml).toContain('src="/moonstone-dreamup-liquid/liquid-world.js"');
    expect(rootHtml).toMatch(/<script[^>]+type="module"/);
    expect(rootHtml).toContain('class="impact-intro"');
    expect(rootHtml).not.toContain('moonstone-offline');

    for (const relative of [
      'index.html',
      'index.rsc',
      '_headers',
      '_next/static/chunks/index-Bi_B8iQ9.js',
      '_next/static/chunks/page-2tPo1yud.js',
    ]) {
      const content = await readFile(path.join(outDir, relative), 'utf8');
      expect(content).not.toContain('/moonstone-dreamup/');
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}, 20_000);
```

- [ ] **Step 2: Run the integration case and verify RED**

Run:

```bash
npx vitest run tests/site-base.test.js
```

Expected: the unit tests pass and the integration case fails because `buildSite` ignores `siteBasePath`.

- [ ] **Step 3: Pass the base path through `buildSite`**

Update `enhancement-src/build.mjs` to import the Task 1 functions, normalize the argument, rewrite the extracted archive before bundling, and inject enhancement assets with the same base:

```js
import { normalizeSiteBasePath, rewriteSiteBase } from './site-base.mjs';

export async function buildSite({
  archivePath,
  outDir,
  rootDir,
  siteBasePath = '/moonstone-dreamup',
}) {
  const basePath = normalizeSiteBasePath(siteBasePath);
  // Existing clear, unzip, and write loop stays here.
  await rewriteSiteBase({
    rootDir: outDir,
    fromBase: '/moonstone-dreamup',
    toBase: basePath,
  });
  // Existing esbuild and asset-copy logic stays here.
  // Use injectEnhancement(html, basePath) for both HTML entrypoints.
}
```

Pass the environment value from the CLI entrypoint:

```js
await buildSite({
  archivePath: path.join(rootDir, 'moonstone-dreamup-github-pages-static.zip'),
  outDir: path.join(rootDir, 'dist'),
  rootDir,
  siteBasePath: process.env.SITE_BASE_PATH ?? '/moonstone-dreamup',
});
```

- [ ] **Step 4: Configure the new repository workflow**

Add this job-level environment to `.github/workflows/deploy-pages.yml` and rename the workflow for the new repository:

```yaml
name: Deploy MoonStone DreamUP Liquid

jobs:
  deploy:
    env:
      SITE_BASE_PATH: /moonstone-dreamup-liquid
```

Keep the existing Node 24 install, `npm ci`, `npm run build`, `configure-pages`, artifact upload, and `deploy-pages` steps unchanged.

- [ ] **Step 5: Run the focused test set**

Run:

```bash
npx vitest run tests/site-base.test.js tests/build-lib.test.js tests/flat-build.test.js
```

Expected: all selected tests pass with 0 failures.

- [ ] **Step 6: Build the exact Pages artifact**

Run in PowerShell:

```powershell
$env:SITE_BASE_PATH = '/moonstone-dreamup-liquid'
npm run build
Remove-Item Env:SITE_BASE_PATH
```

Expected: exit code 0. `dist/index.html` retains module scripts and uses `/moonstone-dreamup-liquid/` for CSS, JavaScript, images, and RSC navigation.

- [ ] **Step 7: Verify the production artifact without a full test matrix**

Run:

```powershell
$legacy = @(rg -l '/moonstone-dreamup/' dist/index.html dist/index.rsc dist/_headers dist/_next/static/chunks)
if ($legacy.Count -ne 0) { throw "Legacy base path remains in: $($legacy -join ', ')" }
rg -n '/moonstone-dreamup-liquid/' dist/index.html dist/index.rsc dist/_headers dist/_next/static/chunks
git diff --check
```

Expected: the first check finds zero legacy references; the second finds new-base references; `git diff --check` exits 0.

- [ ] **Step 8: Commit Task 2**

```bash
git add enhancement-src/build.mjs .github/workflows/deploy-pages.yml tests/site-base.test.js
git commit -m "ci: target standalone liquid Pages site"
```

---

### Task 3: Create the public repository, push `main`, and verify Pages

**Files:**
- Verify: `.github/workflows/deploy-pages.yml`
- Verify: `dist/index.html` (generated, not committed)
- No source files are created in this task.

**Interfaces:**
- Consumes: the two committed Tasks 1–2 and the signed-in GitHub browser session.
- Produces: public repository `DCM-dc/moonstone-dreamup-liquid`, Git remote `liquid-pages`, branch `main`, and live Pages URL `https://dcm-dc.github.io/moonstone-dreamup-liquid/`.

- [ ] **Step 1: Re-run the release gate immediately before publishing**

Run:

```powershell
npx vitest run tests/site-base.test.js tests/build-lib.test.js tests/flat-build.test.js
$env:SITE_BASE_PATH = '/moonstone-dreamup-liquid'
npm run build
Remove-Item Env:SITE_BASE_PATH
git diff --check
git status --short
```

Expected: focused tests and build exit 0; diff check is clean; status contains no uncommitted source changes.

- [ ] **Step 2: Create the empty public GitHub repository**

Use the signed-in GitHub browser session to open `https://github.com/new`, enter repository name `moonstone-dreamup-liquid`, select Public, and leave README, `.gitignore`, and license initialization disabled. Immediately before clicking **Create repository**, request the browser-required action confirmation naming `DCM-dc/moonstone-dreamup-liquid` as the public destination.

Expected: GitHub opens the empty repository page at `https://github.com/DCM-dc/moonstone-dreamup-liquid`.

- [ ] **Step 3: Add a second remote without changing `origin`**

```bash
git remote add liquid-pages https://github.com/DCM-dc/moonstone-dreamup-liquid.git
git remote get-url origin
git remote get-url liquid-pages
```

Expected: `origin` still points to `DCM-dc/moonstone-dreamup`; `liquid-pages` points to the new repository.

- [ ] **Step 4: Push the completed branch as the new repository's `main`**

```bash
git push -u liquid-pages HEAD:main
git ls-remote liquid-pages refs/heads/main
```

Expected: push succeeds and the remote `main` hash equals local `HEAD`. Do not push `origin`.

- [ ] **Step 5: Wait for the Pages workflow**

Open `https://github.com/DCM-dc/moonstone-dreamup-liquid/actions`, inspect the `Deploy MoonStone DreamUP Liquid` run, and wait until the deploy job reports success. If it fails, read the failing step before changing anything.

Expected: the workflow's `github-pages` deployment environment links to `https://dcm-dc.github.io/moonstone-dreamup-liquid/`.

- [ ] **Step 6: Verify the live complete site**

Open `https://dcm-dc.github.io/moonstone-dreamup-liquid/` and check:

```text
- HTTP page loads without a 404.
- Hero stylesheet and moonstone image requests return successfully.
- The fixed intro does not permanently block the page.
- The page contains the main sections: top, manifesto, format, outcomes, proof, FAQ, join.
- The enhancement runtime applies moonstone-enhanced and moonstone-2d-ready.
- Registration buttons display 立即报名, are disabled, and do not open the drawer.
- Browser console contains no page, module, or asset-loading errors.
```

Expected: all checks pass at the new URL while `https://dcm-dc.github.io/moonstone-dreamup/` remains unchanged.

- [ ] **Step 7: Record the release result**

Report the new repository URL, Pages URL, pushed commit hash, focused test count, build result, and Pages workflow result. Do not include local paths containing credentials or any access token.

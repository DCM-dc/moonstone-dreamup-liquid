# MoonStone Liquid Chrome WebGL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MoonStone DreamUP’s fluorescent visual layer with an adaptive realtime WebGL gravity archipelago, liquid chrome materials, crisp glass surfaces, and a matching photoreal fallback asset family while preserving the static site and registration flow.

**Architecture:** Keep the exported site DOM-first and inject one independently bundled Three.js enhancement into both copies of the static artifact. Pure modules own quality selection and scroll sampling; one world object owns renderer, scene, camera, procedural rock geometry, liquid materials, droplets, and lifecycle. The build unpacks the tracked archive, injects versioned enhancement files and metadata, mirrors the files into the compatibility subdirectory, and produces a deployable `dist/` directory.

**Tech Stack:** Node.js 24, Three.js 0.185.1, esbuild 0.28.2, Vitest 4.1.10, fflate 0.8.3, Sharp 0.35.3, Playwright 1.62.1, vanilla ES modules, GLSL, CSS.

## Global Constraints

- The page remains a DOM-first static site deployable through GitHub Pages with no server runtime.
- Material direction is liquid chrome; motion density is balanced fluid; hero composition is gravity archipelago; blur language is crisp glass.
- Keep meaningful copy, anchors, registration form, focus order, and submission behavior in the DOM.
- Use one fixed full-viewport renderer and native page scrolling; the canvas must use `pointer-events: none`.
- Use exactly three quality tiers: high DPR 1.5/eight fragments/three SDF groups, medium DPR 1.25/six fragments/one SDF group, low DPR 1.0/four fragments/instanced droplets only.
- High quality updates a 256 px cube reflection every sixth rendered frame; medium and low use a static prefiltered environment.
- Use 12–14 px `backdrop-filter` blur only on selected panels; do not add global blur or dominant fluorescent outer glow.
- Target 55–60 FPS on typical desktop hardware and at least 30 FPS on ordinary mobile hardware.
- Keep compressed enhancement JavaScript below 700 KB and the eager fallback image below 500 KB.
- Unsupported WebGL, shader failure, repeated context loss, reduced motion, and enhancement JavaScript failure must leave the content usable.
- Do not echo, store, or use the compromised GitHub token supplied in chat.

---

### Task 1: Deterministic Static-Site Build and Injection Harness

**Files:**
- Create: `package.json`
- Create: `enhancement-src/build-lib.mjs`
- Create: `enhancement-src/build.mjs`
- Create: `enhancement-src/styles/moonstone-metal.css`
- Create: `tests/build-lib.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: tracked `moonstone-dreamup-github-pages-static.zip`.
- Produces: `injectEnhancement(html: string, basePath: string): string`, `buildSite(options: { archivePath: string, outDir: string, rootDir: string }): Promise<void>`, and a reproducible `dist/` tree.

- [ ] **Step 1: Write failing injection tests**

```js
// tests/build-lib.test.js
import { describe, expect, it } from 'vitest';
import { injectEnhancement } from '../enhancement-src/build-lib.mjs';

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
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- tests/build-lib.test.js`

Expected: FAIL because `package.json` and `enhancement-src/build-lib.mjs` do not exist.

- [ ] **Step 3: Add pinned tooling and the pure injector**

```json
{
  "name": "moonstone-dreamup-enhancement",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "build": "node enhancement-src/build.mjs",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "fflate": "0.8.3",
    "three": "0.185.1"
  },
  "devDependencies": {
    "@playwright/test": "1.62.1",
    "esbuild": "0.28.2",
    "sharp": "0.35.3",
    "vitest": "4.1.10"
  }
}
```

```js
// enhancement-src/build-lib.mjs
const marker = 'data-moonstone-enhancement';

export function injectEnhancement(html, basePath) {
  if (html.includes(marker)) return html;
  const base = basePath.replace(/\/$/, '');
  const css = `<link ${marker} rel="stylesheet" href="${base}/moonstone-metal.css">`;
  const js = `<script ${marker} type="module" src="${base}/liquid-world.js"></script>`;
  return html.replace('</head>', `${css}</head>`).replace('</body>', `${js}</body>`);
}
```

- [ ] **Step 4: Implement archive extraction, bundling, mirroring, and injection**

```js
// enhancement-src/build.mjs
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

  for (const relative of ['index.html', 'moonstone-dreamup/index.html']) {
    const file = path.join(outDir, relative);
    const html = await readFile(file, 'utf8');
    await writeFile(file, injectEnhancement(html, '/moonstone-dreamup'));
  }

  const mirror = path.join(outDir, 'moonstone-dreamup');
  await mkdir(mirror, { recursive: true });
  await cp(path.join(outDir, 'liquid-world.js'), path.join(mirror, 'liquid-world.js'));
  await cp(path.join(outDir, 'moonstone-metal.css'), path.join(mirror, 'moonstone-metal.css'));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = process.cwd();
  await buildSite({
    archivePath: path.join(rootDir, 'moonstone-dreamup-github-pages-static.zip'),
    outDir: path.join(rootDir, 'dist'),
    rootDir
  });
}
```

Add `dist/`, `node_modules/`, `playwright-report/`, and `test-results/` to `.gitignore`. Start `moonstone-metal.css` with a comment so the build has a valid entry before Task 6; do not use a cascade layer because the exported site’s unlayered rules would outrank it:

```css
/* MoonStone enhancement styles are added in Task 6. */
```

- [ ] **Step 5: Install dependencies and verify injection/build tests**

Run: `npm install`

Run: `npm test -- tests/build-lib.test.js`

Expected: 2 tests PASS.

Run: `npm run build`

Expected: `dist/index.html`, `dist/liquid-world.js`, and `dist/moonstone-metal.css` exist; both HTML copies contain two `data-moonstone-enhancement` markers.

- [ ] **Step 6: Commit the build harness**

```bash
git add package.json package-lock.json .gitignore enhancement-src/build-lib.mjs enhancement-src/build.mjs enhancement-src/styles/moonstone-metal.css tests/build-lib.test.js moonstone-dreamup-github-pages-static.zip
git commit -m "build: add deterministic enhancement pipeline"
```

---

### Task 2: Quality Selection, Capability Detection, and Fallback State

**Files:**
- Create: `enhancement-src/src/quality.js`
- Create: `enhancement-src/src/runtime-state.js`
- Create: `tests/quality.test.js`
- Create: `tests/runtime-state.test.js`

**Interfaces:**
- Produces: `chooseQuality(input): 'high' | 'medium' | 'low'`, `QUALITY`, `createRuntimeState(options)`, and `bindContextRecovery(canvas, callbacks): () => void`.
- Consumed by: `world.js` and `main.js` in Tasks 5 and 6.

- [ ] **Step 1: Write failing quality and fallback tests**

```js
// tests/quality.test.js
import { expect, it } from 'vitest';
import { chooseQuality, QUALITY } from '../enhancement-src/src/quality.js';

it('selects exact quality budgets', () => {
  expect(chooseQuality({ width: 1440, webgl2: true, reducedMotion: false, deviceMemory: 16, cores: 12 })).toBe('high');
  expect(chooseQuality({ width: 1024, webgl2: true, reducedMotion: false, deviceMemory: 8, cores: 8 })).toBe('medium');
  expect(chooseQuality({ width: 390, webgl2: true, reducedMotion: false, deviceMemory: 4, cores: 4 })).toBe('low');
  expect(QUALITY.high).toMatchObject({ dpr: 1.5, fragments: 8, sdfGroups: 3, reflectionEvery: 6 });
  expect(QUALITY.medium).toMatchObject({ dpr: 1.25, fragments: 6, sdfGroups: 1, reflectionEvery: 0 });
  expect(QUALITY.low).toMatchObject({ dpr: 1, fragments: 4, sdfGroups: 0, reflectionEvery: 0 });
});
```

```js
// tests/runtime-state.test.js
import { expect, it, vi } from 'vitest';
import { createRuntimeState } from '../enhancement-src/src/runtime-state.js';

it('keeps fallback visible until a valid frame and permanently falls back after repeated loss', () => {
  const state = createRuntimeState({ maxRestores: 1 });
  expect(state.snapshot()).toMatchObject({ phase: 'fallback', restoreCount: 0 });
  state.firstFrame();
  expect(state.snapshot().phase).toBe('ready');
  expect(state.contextLost()).toBe('restore');
  state.contextRestored();
  expect(state.contextLost()).toBe('fallback');
  expect(state.snapshot().phase).toBe('failed');
});
```

- [ ] **Step 2: Run tests and confirm both fail**

Run: `npm test -- tests/quality.test.js tests/runtime-state.test.js`

Expected: FAIL because both source modules are missing.

- [ ] **Step 3: Implement exact tier selection**

```js
// enhancement-src/src/quality.js
export const QUALITY = Object.freeze({
  high: Object.freeze({ dpr: 1.5, fragments: 8, sdfGroups: 3, detail: 5, reflectionEvery: 6 }),
  medium: Object.freeze({ dpr: 1.25, fragments: 6, sdfGroups: 1, detail: 4, reflectionEvery: 0 }),
  low: Object.freeze({ dpr: 1, fragments: 4, sdfGroups: 0, detail: 3, reflectionEvery: 0 })
});

export function chooseQuality({ width, webgl2, reducedMotion, deviceMemory = 4, cores = 4 }) {
  if (!webgl2 || reducedMotion || width < 640 || deviceMemory <= 4 || cores <= 4) return 'low';
  if (width >= 1280 && deviceMemory >= 12 && cores >= 8) return 'high';
  return 'medium';
}
```

- [ ] **Step 4: Implement the runtime state machine and context binding**

```js
// enhancement-src/src/runtime-state.js
export function createRuntimeState({ maxRestores = 1 } = {}) {
  let phase = 'fallback';
  let restoreCount = 0;
  return {
    firstFrame() { if (phase !== 'failed') phase = 'ready'; },
    contextLost() {
      if (restoreCount >= maxRestores) { phase = 'failed'; return 'fallback'; }
      restoreCount += 1;
      phase = 'restoring';
      return 'restore';
    },
    contextRestored() { if (phase === 'restoring') phase = 'fallback'; },
    fail() { phase = 'failed'; },
    snapshot() { return { phase, restoreCount }; }
  };
}

export function bindContextRecovery(canvas, { onLost, onRestore, onPermanentFailure }) {
  let awaitingRestore = false;
  const lost = event => {
    event.preventDefault();
    awaitingRestore = onLost() === 'restore';
    if (!awaitingRestore) onPermanentFailure();
  };
  const restored = () => { if (awaitingRestore) { awaitingRestore = false; onRestore(); } };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  return () => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
  };
}
```

- [ ] **Step 5: Run focused and full tests**

Run: `npm test -- tests/quality.test.js tests/runtime-state.test.js`

Expected: all tests PASS.

Run: `npm test`

Expected: all current tests PASS.

- [ ] **Step 6: Commit runtime policy**

```bash
git add enhancement-src/src/quality.js enhancement-src/src/runtime-state.js tests/quality.test.js tests/runtime-state.test.js
git commit -m "feat: add adaptive WebGL runtime policy"
```

---

### Task 3: Scroll Timeline and Damped Pointer Model

**Files:**
- Create: `enhancement-src/src/timeline.js`
- Create: `enhancement-src/src/pointer.js`
- Create: `tests/timeline.test.js`
- Create: `tests/pointer.test.js`

**Interfaces:**
- Produces: `createScrollModel(sections)`, `sampleScroll(model, y)`, `createDampedPointer(options)`.
- `sampleScroll` returns `{ activeId: string, local: number, page: number, intro: number, gather: number }` with every scalar clamped to `[0, 1]`.
- Consumed by: `world.update(frame)` in Task 5.

- [ ] **Step 1: Write failing deterministic timeline tests**

```js
// tests/timeline.test.js
import { expect, it } from 'vitest';
import { createScrollModel, sampleScroll } from '../enhancement-src/src/timeline.js';

it('maps exact section boundaries and final convergence', () => {
  const model = createScrollModel([
    { id: 'hero', top: 0, height: 1000 },
    { id: 'manifesto', top: 1000, height: 1000 },
    { id: 'faq', top: 2000, height: 1000 },
    { id: 'join', top: 3000, height: 1000 }
  ]);
  expect(sampleScroll(model, 500)).toMatchObject({ activeId: 'hero', local: 0.5, page: 0.125 });
  expect(sampleScroll(model, 2500)).toMatchObject({ activeId: 'faq', local: 0.5, page: 0.625 });
  expect(sampleScroll(model, 4000)).toMatchObject({ activeId: 'join', local: 1, page: 1, gather: 1 });
});
```

```js
// tests/pointer.test.js
import { expect, it } from 'vitest';
import { createDampedPointer } from '../enhancement-src/src/pointer.js';

it('caps parallax at three degrees and converges without overshoot', () => {
  const pointer = createDampedPointer({ damping: 0.2, maxDegrees: 3 });
  pointer.set(5, -5);
  for (let i = 0; i < 60; i += 1) pointer.step(1 / 60);
  const value = pointer.value();
  expect(value.x).toBeLessThanOrEqual(3);
  expect(value.y).toBeGreaterThanOrEqual(-3);
  expect(value.x).toBeGreaterThan(2.9);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/timeline.test.js tests/pointer.test.js`

Expected: FAIL because timeline and pointer modules are absent.

- [ ] **Step 3: Implement clamped scroll sampling**

```js
// enhancement-src/src/timeline.js
const clamp = value => Math.min(1, Math.max(0, value));

export function createScrollModel(sections) {
  const ordered = sections.map(section => ({ ...section, end: section.top + section.height }));
  const end = Math.max(1, ...ordered.map(section => section.end));
  return { sections: ordered, end };
}

export function sampleScroll(model, y) {
  const page = clamp(y / model.end);
  const active = model.sections.find(section => y < section.end) ?? model.sections.at(-1);
  const local = clamp((y - active.top) / active.height);
  const joinIndex = Math.max(0, model.sections.findIndex(section => section.id === 'join'));
  const joinStart = model.sections[joinIndex]?.top ?? model.end * 0.8;
  return {
    activeId: active.id,
    local,
    page,
    intro: clamp(1 - page * 7),
    gather: clamp((y - joinStart) / Math.max(1, model.end - joinStart))
  };
}
```

- [ ] **Step 4: Implement capped exponential damping**

```js
// enhancement-src/src/pointer.js
export function createDampedPointer({ damping = 0.2, maxDegrees = 3 } = {}) {
  let targetX = 0, targetY = 0, x = 0, y = 0;
  const cap = value => Math.min(maxDegrees, Math.max(-maxDegrees, value));
  return {
    set(nx, ny) { targetX = cap(nx); targetY = cap(ny); },
    step(dt) {
      const alpha = 1 - Math.pow(1 - damping, dt * 60);
      x += (targetX - x) * alpha;
      y += (targetY - y) * alpha;
    },
    value() { return { x, y }; }
  };
}
```

- [ ] **Step 5: Run all unit tests and commit**

Run: `npm test`

Expected: all tests PASS.

```bash
git add enhancement-src/src/timeline.js enhancement-src/src/pointer.js tests/timeline.test.js tests/pointer.test.js
git commit -m "feat: map scroll and pointer input to scene state"
```

---

### Task 4: Procedural Cratered Moonstone Geometry

**Files:**
- Create: `enhancement-src/src/random.js`
- Create: `enhancement-src/src/moonstone-geometry.js`
- Create: `enhancement-src/src/rock-material.js`
- Create: `tests/moonstone-geometry.test.js`
- Create: `tests/rock-material.test.js`

**Interfaces:**
- Produces: `mulberry32(seed)`, `createMoonstoneGeometry({ radius, detail, seed, craterCount }): THREE.BufferGeometry`, `createFragmentGeometries({ count, detail, seed }): THREE.BufferGeometry[]`, and `createRockMaterial(): THREE.MeshStandardMaterial`.
- Consumed by: `createMoonstoneWorld` in Task 5.

- [ ] **Step 1: Write failing geometry determinism and bounds tests**

```js
// tests/moonstone-geometry.test.js
import { expect, it } from 'vitest';
import { createMoonstoneGeometry, createFragmentGeometries } from '../enhancement-src/src/moonstone-geometry.js';

it('generates deterministic cratered geometry within its radius budget', () => {
  const a = createMoonstoneGeometry({ radius: 2, detail: 2, seed: 42, craterCount: 9 });
  const b = createMoonstoneGeometry({ radius: 2, detail: 2, seed: 42, craterCount: 9 });
  expect(Array.from(a.attributes.position.array)).toEqual(Array.from(b.attributes.position.array));
  a.computeBoundingSphere();
  expect(a.boundingSphere.radius).toBeGreaterThan(1.55);
  expect(a.boundingSphere.radius).toBeLessThan(2.35);
});

it('creates unique fragments with valid normals', () => {
  const fragments = createFragmentGeometries({ count: 4, detail: 1, seed: 7 });
  expect(fragments).toHaveLength(4);
  expect(fragments.every(item => item.attributes.normal.count === item.attributes.position.count)).toBe(true);
  expect(Array.from(fragments[0].attributes.position.array)).not.toEqual(Array.from(fragments[1].attributes.position.array));
});
```

```js
// tests/rock-material.test.js
import { expect, it } from 'vitest';
import { createRockMaterial } from '../enhancement-src/src/rock-material.js';

it('injects triplanar lunar dust and roughness variation', () => {
  const material = createRockMaterial();
  const shader = { vertexShader: '#include <worldpos_vertex>', fragmentShader: '#include <roughnessmap_fragment>', uniforms: {} };
  material.onBeforeCompile(shader);
  expect(shader.vertexShader).toContain('vRockWorldPosition');
  expect(shader.fragmentShader).toContain('triplanarNoise');
  expect(shader.fragmentShader).toContain('roughnessFactor');
});
```

- [ ] **Step 2: Run the geometry tests and verify failure**

Run: `npm test -- tests/moonstone-geometry.test.js`

Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement seeded displacement and analytic crater dents**

```js
// enhancement-src/src/random.js
export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

```js
// enhancement-src/src/moonstone-geometry.js
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './random.js';

export function createMoonstoneGeometry({ radius = 2, detail = 4, seed = 1, craterCount = 18 }) {
  const sourceGeometry = new THREE.IcosahedronGeometry(radius, detail);
  // Polyhedron geometry is non-indexed and carries normal/UV seams. Remove those
  // attributes before welding so each conceptual vertex is displaced exactly once.
  sourceGeometry.deleteAttribute('normal');
  sourceGeometry.deleteAttribute('uv');
  const geometry = mergeVertices(sourceGeometry);
  const random = mulberry32(seed);
  const craters = Array.from({ length: craterCount }, () => ({
    direction: new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize(),
    width: 0.08 + random() * 0.22,
    depth: 0.025 + random() * 0.09
  }));
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    normal.copy(vertex).normalize();
    const grain = Math.sin(normal.x * 17 + seed) * Math.sin(normal.y * 23 - seed) * 0.035;
    let scale = 1 + grain + (random() - 0.5) * 0.045;
    for (const crater of craters) {
      const angle = Math.acos(THREE.MathUtils.clamp(normal.dot(crater.direction), -1, 1));
      const distance = angle / Math.PI;
      if (distance < crater.width) {
        const normalized = distance / crater.width;
        scale -= Math.pow(1 - normalized, 2) * crater.depth;
        scale += Math.exp(-Math.pow((normalized - 0.86) * 8, 2)) * crater.depth * 0.34;
      }
    }
    vertex.copy(normal).multiplyScalar(radius * scale);
    position.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createFragmentGeometries({ count, detail, seed }) {
  return Array.from({ length: count }, (_, index) => createMoonstoneGeometry({
    radius: 0.28 + index * 0.035,
    detail,
    seed: seed + index * 97,
    craterCount: 3 + (index % 5)
  }));
}
```

Create the rock material with compile-time shader injection so the procedural geometry has lunar dust and roughness detail without texture downloads:

```js
// enhancement-src/src/rock-material.js
import * as THREE from 'three';

export function createRockMaterial() {
  const material = new THREE.MeshStandardMaterial({ color: '#34383d', roughness: .82, metalness: .08 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vRockWorldPosition;\n${shader.vertexShader}`
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRockWorldPosition = worldPosition.xyz;');
    shader.fragmentShader = `
      varying vec3 vRockWorldPosition;
      float rockHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float triplanarNoise(vec3 p){vec3 i=floor(p); return mix(rockHash(i), rockHash(i+vec3(1.0)), fract(p.x));}
      ${shader.fragmentShader}
    `.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= .86 + triplanarNoise(vRockWorldPosition * 9.0) * .18;');
  };
  material.customProgramCacheKey = () => 'moonstone-rock-v1';
  return material;
}
```

- [ ] **Step 4: Run geometry tests and inspect a low-detail fixture**

Run: `npm test -- tests/moonstone-geometry.test.js tests/rock-material.test.js`

Expected: both tests PASS.

Run: `npm test`

Expected: full suite PASS.

- [ ] **Step 5: Commit geometry generation**

```bash
git add enhancement-src/src/random.js enhancement-src/src/moonstone-geometry.js enhancement-src/src/rock-material.js tests/moonstone-geometry.test.js tests/rock-material.test.js
git commit -m "feat: generate deterministic cratered moonstones"
```

---

### Task 5: Liquid Chrome Shaders, Droplets, and Shared WebGL World

**Files:**
- Create: `enhancement-src/src/liquid-chrome.js`
- Create: `enhancement-src/src/droplets.js`
- Create: `enhancement-src/src/composition.js`
- Create: `enhancement-src/src/world.js`
- Create: `tests/liquid-chrome.test.js`
- Create: `tests/composition.test.js`

**Interfaces:**
- Consumes: `QUALITY`, `createMoonstoneGeometry`, `createFragmentGeometries`, `sampleScroll`, and the damped pointer value.
- Produces: `smoothMin(a, b, k)`, `createLiquidChromeMaterial(options)`, `sampleComposition(state)`, `createDropletField(options)`, and `createMoonstoneWorld(options)` returning `{ render, resize, setScrollState, setPointer, pause, resume, dispose }`.

- [ ] **Step 1: Write failing shader and world contract tests**

```js
// tests/liquid-chrome.test.js
import { expect, it } from 'vitest';
import { smoothMin, createLiquidChromeMaterial } from '../enhancement-src/src/liquid-chrome.js';

it('smoothly merges close signed distances', () => {
  expect(smoothMin(0.2, 0.25, 0.3)).toBeLessThan(0.2);
});

it('creates a transparent material with independently mutable flow inputs', () => {
  const material = createLiquidChromeMaterial();
  expect(material.transparent).toBe(true);
  expect(material.depthWrite).toBe(false);
  material.uniforms.uTime.value = 3.5;
  material.uniforms.uPointer.value.set(2, -1);
  expect(material.uniforms.uTime.value).toBe(3.5);
  expect(material.uniforms.uPointer.value.toArray()).toEqual([2, -1]);
  material.dispose();
});
```

```js
// tests/composition.test.js
import { expect, it } from 'vitest';
import { sampleComposition } from '../enhancement-src/src/composition.js';

it('moves from the section pose into the final gathered core', () => {
  expect(sampleComposition({ activeId: 'format', gather: 0 })).toEqual({ position: [-.8, .12, -.7], scale: 1 });
  expect(sampleComposition({ activeId: 'format', gather: 1 })).toEqual({ position: [0, 0, 0], scale: .78 });
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- tests/liquid-chrome.test.js tests/composition.test.js`

Expected: FAIL because the material and world modules are absent.

- [ ] **Step 3: Implement the chrome film shader with moving coverage and Fresnel reflection**

```js
// enhancement-src/src/liquid-chrome.js
import * as THREE from 'three';

export const smoothMin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

export const liquidVertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const liquidFragmentShader = `
  uniform float uTime;
  uniform float uFlow;
  uniform vec2 uPointer;
  uniform vec3 uColdLight;
  uniform vec3 uWarmLight;
  uniform samplerCube uEnvironment;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  void main() {
    vec3 n = normalize(vNormal + (noise(vWorldPosition * 3.2 + uTime * 0.08) - .5) * .15);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    float flowMask = smoothstep(.36, .62, noise(vWorldPosition * 1.45 + vec3(0., -uTime * .06 * uFlow, 0.)));
    vec3 reflected = mix(vec3(.12,.14,.16), textureCube(uEnvironment, reflect(-viewDir,n)).rgb + uColdLight * .28, fresnel);
    reflected += uWarmLight * pow(max(dot(n, normalize(vec3(-.4,.2,.8))), 0.0), 18.0) * .42;
    vec3 color = mix(vec3(.08,.09,.10), reflected + vec3(.58) * pow(max(dot(n, viewDir), 0.0), 38.0), flowMask);
    gl_FragColor = vec4(color, smoothstep(.28,.48,flowMask));
  }
`;

export function createLiquidChromeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uFlow: { value: 1 }, uPointer: { value: new THREE.Vector2() },
      uColdLight: { value: new THREE.Color('#8ddcff') }, uWarmLight: { value: new THREE.Color('#ff8b5d') },
      uEnvironment: { value: new THREE.CubeTexture() }
    },
    vertexShader: liquidVertexShader,
    fragmentShader: liquidFragmentShader
  });
}
```

- [ ] **Step 4: Implement droplet groups and the one-world lifecycle**

Use instanced spheres for the low tier and a ray-marched smooth-min SDF proxy for medium/high. The factory has no per-frame allocations and returns the exact public contract:

```js
// enhancement-src/src/droplets.js
import * as THREE from 'three';

const vertexShader = `varying vec3 vLocal; void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragmentShader = `
  precision highp float;
  uniform float uTime; uniform vec2 uPointer; uniform float uGather;
  varying vec3 vLocal;
  float smin(float a,float b,float k){float h=max(k-abs(a-b),0.0)/k;return min(a,b)-h*h*k*.25;}
  float sceneSdf(vec3 p){
    vec3 a=vec3(sin(uTime*.34)*.18,cos(uTime*.27)*.12,0.0);
    vec3 b=vec3(-.22+uPointer.x*.018,.08+uPointer.y*.018,.06);
    vec3 c=vec3(.24,-.16,mix(.12,0.0,uGather));
    return smin(smin(length(p-a)-.27,length(p-b)-.23,.24),length(p-c)-.20,.22);
  }
  vec3 normalAt(vec3 p){float e=.002;vec2 h=vec2(e,0);return normalize(vec3(sceneSdf(p+h.xyy)-sceneSdf(p-h.xyy),sceneSdf(p+h.yxy)-sceneSdf(p-h.yxy),sceneSdf(p+h.yyx)-sceneSdf(p-h.yyx)));}
  void main(){
    vec3 ro=vec3(0,0,1.3), rd=normalize(vLocal-ro), p=ro; float d=0.0; bool hit=false;
    for(int i=0;i<56;i++){d=sceneSdf(p);if(d<.002){hit=true;break;}p+=rd*d;if(length(p)>2.1)break;}
    if(!hit)discard;
    vec3 n=normalAt(p), v=normalize(ro-p); float f=pow(1.0-max(dot(n,v),0.0),3.0);
    vec3 chrome=mix(vec3(.76,.82,.84),vec3(.24,.58,.82),f)+pow(max(dot(n,normalize(vec3(-.4,.6,.7))),0.0),32.0);
    gl_FragColor=vec4(chrome,1.0);
  }
`;

export function createDropletField({ tier, groups }) {
  const object = new THREE.Group();
  const uniforms = { uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() }, uGather: { value: 0 } };
  if (groups > 0) {
    for (let index = 0; index < groups; index += 1) {
      const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, side: THREE.BackSide });
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), material);
      proxy.position.set(2.5 - index * 1.1, .9 - index * .7, -.3 - index * .2);
      object.add(proxy);
    }
  } else {
    const geometry = new THREE.SphereGeometry(.12, 16, 12);
    const material = new THREE.MeshStandardMaterial({ color: '#dffaff', metalness: 1, roughness: .09 });
    const instances = new THREE.InstancedMesh(geometry, material, 10);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < 10; index += 1) instances.setMatrixAt(index, matrix.makeTranslation(2.2 + index * .12, Math.sin(index) * .8, -index * .08));
    object.add(instances);
  }
  return {
    object,
    update(time, pointer, scroll) { uniforms.uTime.value=time; uniforms.uPointer.value.set(pointer.x,pointer.y); uniforms.uGather.value=scroll.gather; },
    dispose() { object.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); }); }
  };
}
```

Add the pure composition sampler before wiring the public world contract:

```js
// enhancement-src/src/composition.js
const POSES = Object.freeze({
  top: [1.5,0,0], manifesto: [.7,-.15,-.35], format: [-.8,.12,-.7], who: [.95,-.1,-.45],
  outcomes: [-.65,.16,-.8], proof: [.85,-.2,-.55], faq: [-.9,.08,-.9], join: [0,0,0]
});
export function sampleComposition({ activeId, gather }) {
  const start = POSES[activeId] ?? POSES.top;
  const amount = Math.min(1, Math.max(0, gather));
  return { position: start.map(value => Number((value * (1 - amount)).toFixed(4))), scale: Number((1 - amount * .22).toFixed(4)) };
}
```

The public world contract is exact:

```js
// enhancement-src/src/world.js
import * as THREE from 'three';
import { QUALITY } from './quality.js';
import { createMoonstoneGeometry, createFragmentGeometries } from './moonstone-geometry.js';
import { createLiquidChromeMaterial } from './liquid-chrome.js';
import { createDropletField } from './droplets.js';
import { createRockMaterial } from './rock-material.js';
import { sampleComposition } from './composition.js';

export function createMoonstoneWorld({ canvas, tier, onFirstFrame }) {
  const budget = QUALITY[tier];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, budget.dpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(0, 0, 9);
  scene.add(new THREE.HemisphereLight('#dff8ff', '#090604', 1.25));
  const key = new THREE.DirectionalLight('#f5fdff', 4.2); key.position.set(4, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#ff835e', 1.15); rim.position.set(-5, -2, 3); scene.add(rim);
  const root = new THREE.Group();
  scene.add(root);

  const rock = new THREE.Mesh(createMoonstoneGeometry({ radius: 2, detail: budget.detail, seed: 2026, craterCount: 24 }), createRockMaterial());
  const shell = new THREE.Mesh(rock.geometry.clone().scale(1.012, 1.012, 1.012), createLiquidChromeMaterial());
  root.add(rock, shell);
  const fragments = createFragmentGeometries({ count: budget.fragments, detail: Math.max(1, budget.detail - 2), seed: 1608 });
  fragments.forEach((geometry, index) => {
    const mesh = new THREE.Mesh(geometry, rock.material);
    const angle = index / fragments.length * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * (3.2 + index * .08), Math.sin(angle) * 1.6, Math.sin(angle * 1.7) * 1.1);
    root.add(mesh);
  });
  const droplets = createDropletField({ tier, groups: budget.sdfGroups });
  root.add(droplets.object);

  const poseTarget = new THREE.Vector3();
  const reflectionTarget = budget.reflectionEvery ? new THREE.WebGLCubeRenderTarget(256) : null;
  const reflectionCamera = reflectionTarget ? new THREE.CubeCamera(.1, 40, reflectionTarget) : null;
  if (reflectionCamera) scene.add(reflectionCamera);
  let scroll = { activeId: 'top', local: 0, page: 0, gather: 0, intro: 1 }, pointer = { x: 0, y: 0 }, first = true, paused = false, frame = 0;
  return {
    render(time) {
      if (paused) return;
      shell.material.uniforms.uTime.value = time * .001;
      shell.material.uniforms.uPointer.value.set(pointer.x, pointer.y);
      root.rotation.y = time * .000035 + pointer.x * Math.PI / 180;
      root.rotation.x = pointer.y * Math.PI / 180;
      const composition = sampleComposition(scroll);
      poseTarget.fromArray(composition.position);
      root.position.lerp(poseTarget, .045);
      root.scale.setScalar(composition.scale);
      droplets.update(time * .001, pointer, scroll);
      if (reflectionCamera && frame++ % budget.reflectionEvery === 0) {
        shell.visible = false; reflectionCamera.update(renderer, scene); shell.visible = true;
        shell.material.uniforms.uEnvironment.value = reflectionTarget.texture;
      }
      renderer.render(scene, camera);
      if (first) { first = false; onFirstFrame(); }
    },
    resize(width, height) { renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); },
    setScrollState(value) { scroll = value; }, setPointer(value) { pointer = value; },
    pause() { paused = true; }, resume() { paused = false; },
    dispose() { droplets.dispose(); reflectionTarget?.dispose(); renderer.dispose(); root.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); }); }
  };
}
```

`createDropletField` must return `{ object: THREE.Group, update(time, pointer, scroll), dispose() }`; use deterministic seeds and no per-frame geometry allocation.

- [ ] **Step 5: Run contract tests and production build**

Run: `npm test -- tests/liquid-chrome.test.js tests/composition.test.js`

Expected: PASS.

Run: `npm run build`

Expected: esbuild completes without GLSL or Three.js resolution errors and `dist/liquid-world.js` is below 700 KB compressed with `gzip -c dist/liquid-world.js | wc -c` on Unix or the PowerShell compression check used in Task 8.

- [ ] **Step 6: Commit the realtime world**

```bash
git add enhancement-src/src/liquid-chrome.js enhancement-src/src/droplets.js enhancement-src/src/composition.js enhancement-src/src/world.js tests/liquid-chrome.test.js tests/composition.test.js
git commit -m "feat: render liquid chrome gravity archipelago"
```

---

### Task 6: DOM Bootstrap, Crisp-Glass Restyle, and Existing-Behavior Preservation

**Files:**
- Create: `enhancement-src/src/dom-sections.js`
- Create: `enhancement-src/src/main.js`
- Modify: `enhancement-src/styles/moonstone-metal.css`
- Create: `tests/dom-sections.test.js`

**Interfaces:**
- Consumes: quality, runtime state, timeline, pointer, and world modules.
- Produces: `measureSections(documentLike)`, body state classes `moonstone-enhanced`, `moonstone-webgl-ready`, `moonstone-webgl-fallback`, canvas `#moonstone-liquid-world`, and CSS custom properties `--ms-scroll`, `--ms-local`, `--ms-gather`.

- [ ] **Step 1: Write a failing DOM-section behavior test**

```js
// tests/dom-sections.test.js
import { expect, it } from 'vitest';
import { measureSections } from '../enhancement-src/src/dom-sections.js';

it('measures every narrative section in document order', () => {
  const boxes = new Map([
    ['#top',[0,900]], ['#manifesto',[900,1000]], ['#format',[1900,1000]], ['.who',[2900,800]],
    ['.outcomes',[3700,900]], ['#proof',[4600,1000]], ['.faq',[5600,900]], ['#join',[6500,700]]
  ]);
  const documentLike = { querySelector: selector => {
    const [offsetTop, offsetHeight] = boxes.get(selector);
    return { offsetTop, offsetHeight };
  }};
  expect(measureSections(documentLike).map(section => section.id)).toEqual(['top','manifesto','format','who','outcomes','proof','faq','join']);
});

it('fails loudly when an expected section is missing', () => {
  const documentLike = { querySelector: () => null };
  expect(() => measureSections(documentLike)).toThrow('Missing MoonStone section: #top');
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/dom-sections.test.js`

Expected: FAIL because `dom-sections.js` is missing.

- [ ] **Step 3: Implement section measurement, then nonblocking bootstrap and scene lifecycle**

```js
// enhancement-src/src/dom-sections.js
export const SECTION_TARGETS = [
  ['top','#top'], ['manifesto','#manifesto'], ['format','#format'], ['who','.who'],
  ['outcomes','.outcomes'], ['proof','#proof'], ['faq','.faq'], ['join','#join']
];
export function measureSections(documentLike) {
  return SECTION_TARGETS.map(([id, selector]) => {
    const node = documentLike.querySelector(selector);
    if (!node) throw new Error(`Missing MoonStone section: ${selector}`);
    return { id, top: node.offsetTop, height: Math.max(1, node.offsetHeight) };
  });
}
```

```js
// enhancement-src/src/main.js
import { chooseQuality } from './quality.js';
import { createRuntimeState, bindContextRecovery } from './runtime-state.js';
import { createScrollModel, sampleScroll } from './timeline.js';
import { createDampedPointer } from './pointer.js';
import { createMoonstoneWorld } from './world.js';
import { measureSections } from './dom-sections.js';

export const CANVAS_ID = 'moonstone-liquid-world';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const forcedFallback = new URLSearchParams(location.search).has('forceWebglFallback');
const canvas = document.createElement('canvas');
canvas.id = CANVAS_ID;
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);
document.body.classList.add('moonstone-enhanced', 'moonstone-webgl-fallback');

const probe = forcedFallback ? null : canvas.getContext('webgl2');
if (!probe) {
  canvas.remove();
} else {
  const tier = chooseQuality({ width: innerWidth, webgl2: true, reducedMotion, deviceMemory: navigator.deviceMemory, cores: navigator.hardwareConcurrency });
  const runtime = createRuntimeState({ maxRestores: 1 });
  const pointer = createDampedPointer({ damping: .2, maxDegrees: 3 });
  let sectionModel;
  const measure = () => {
    sectionModel = createScrollModel(measureSections(document));
  };
  measure();
  const world = createMoonstoneWorld({ canvas, tier, onFirstFrame() {
    runtime.firstFrame();
    document.body.classList.replace('moonstone-webgl-fallback', 'moonstone-webgl-ready');
  }});
  const resize = () => { measure(); world.resize(innerWidth, innerHeight); };
  resize();
  addEventListener('resize', resize, { passive: true });
  addEventListener('pointermove', event => pointer.set((event.clientX / innerWidth - .5) * 6, (event.clientY / innerHeight - .5) * -6), { passive: true });
  document.addEventListener('visibilitychange', () => document.hidden ? world.pause() : world.resume());
  const restoreKey = 'moonstone-webgl-restore-attempted';
  bindContextRecovery(canvas, {
    onLost: () => sessionStorage.getItem(restoreKey) ? 'fallback' : (sessionStorage.setItem(restoreKey, '1'), runtime.contextLost()),
    onRestore: () => location.reload(),
    onPermanentFailure: () => document.body.classList.replace('moonstone-webgl-ready', 'moonstone-webgl-fallback')
  });
  const frame = time => {
    pointer.step(1 / 60);
    const state = sampleScroll(sectionModel, scrollY);
    world.setScrollState(state); world.setPointer(pointer.value()); world.render(time);
    if (!reducedMotion) requestAnimationFrame(frame);
  };
  reducedMotion ? frame(0) : requestAnimationFrame(frame);
}
```

- [ ] **Step 4: Implement the metallic CSS override**

The file must use these exact state and component rules, with responsive additions for existing grids and the registration drawer:

```css
:root {
    --ms-ink: #030405;
    --ms-graphite: #0a0d10;
    --ms-platinum: #eef4f6;
    --ms-gunmetal: #69747b;
    --ms-cold: #8ddcff;
    --ms-warm: #ff7a4d;
    --ms-glass: rgba(16, 20, 24, .56);
  }
  #moonstone-liquid-world {
    position: fixed; inset: 0; z-index: 0; width: 100%; height: 100%;
    pointer-events: none; opacity: 0; transition: opacity .6s ease;
  }
  .moonstone-webgl-ready #moonstone-liquid-world { opacity: 1; }
  .moonstone-enhanced main, .moonstone-enhanced footer { position: relative; z-index: 1; }
  .moonstone-enhanced .hero,
  .moonstone-enhanced .manifesto,
  .moonstone-enhanced .format,
  .moonstone-enhanced .proof,
  .moonstone-enhanced .outcomes,
  .moonstone-enhanced .faq { background: rgba(3, 4, 5, .42); }
  .moonstone-webgl-ready .hero-image { opacity: 0; transition: opacity .55s ease; }
  .moonstone-enhanced .value-card,
  .moonstone-enhanced .process-grid article,
  .moonstone-enhanced .outcome-card,
  .moonstone-enhanced .register-drawer {
    background: var(--ms-glass);
    backdrop-filter: blur(14px) saturate(125%);
    border-color: rgba(238, 244, 246, .18);
    box-shadow: inset 0 1px rgba(255,255,255,.12), 0 20px 60px rgba(0,0,0,.18);
  }
  .moonstone-enhanced .hero-minimal h1 > span:nth-child(2),
  .moonstone-enhanced .intro-word {
    color: transparent;
    background: linear-gradient(112deg,#15191c 0%,#f7ffff 18%,#616d74 31%,#dffaff 46%,#748cff 59%,#fff 70%,#252a2f 88%);
    background-size: 220% 100%;
    background-clip: text;
    -webkit-background-clip: text;
    text-shadow: none;
    animation: ms-specular 7s ease-in-out infinite;
  }
  .moonstone-enhanced .hero::before,
  .moonstone-enhanced .hero::after,
  .moonstone-enhanced .intro-nebula,
  .moonstone-enhanced .intro-flash { opacity: 0; box-shadow: none; }
  .moonstone-enhanced .impact-intro { background: rgba(1, 2, 4, .76); backdrop-filter: blur(2px); }
  .moonstone-enhanced .who {
    color: #090b0d;
    background: linear-gradient(118deg,#8a9297 0%,#f5f7f7 22%,#aab1b5 47%,#f0f3f3 70%,#777f84 100%);
  }
  @keyframes ms-specular { 0%,100% { background-position: 0 50%; } 50% { background-position: 100% 50%; } }
@media (prefers-reduced-motion: reduce) { .moonstone-enhanced * { animation-duration: .001ms !important; animation-iteration-count: 1 !important; } }
```

- [ ] **Step 5: Verify unit tests, build, and existing DOM hooks**

Run: `npm test -- tests/dom-sections.test.js`

Expected: PASS.

Run: `npm run build`

Run: `rg -n "register-overlay|register-drawer|register-form|impact-intro|hero-image" dist/index.html`

Expected: all five existing hooks remain present and the build exits zero.

- [ ] **Step 6: Commit bootstrap and material styling**

```bash
git add enhancement-src/src/dom-sections.js enhancement-src/src/main.js enhancement-src/styles/moonstone-metal.css tests/dom-sections.test.js
git commit -m "feat: integrate liquid world with MoonStone DOM"
```

---

### Task 7: Generate and Integrate the Photoreal Moonstone Asset Family

**Files:**
- Create: `enhancement-src/assets/moonstone-hero-fallback.webp`
- Create: `enhancement-src/assets/moonstone-fragment-single.webp`
- Create: `enhancement-src/assets/moonstone-fragment-cluster.webp`
- Create: `enhancement-src/assets/moonstone-chrome-crater.webp`
- Create: `enhancement-src/assets/og-liquid-chrome.png`
- Create: `enhancement-src/assets/sources/` image-generation source PNGs
- Create: `enhancement-src/prepare-assets.mjs`
- Create: `tests/assets.test.js`
- Modify: `enhancement-src/build.mjs`
- Modify: `enhancement-src/styles/moonstone-metal.css`

**Interfaces:**
- Consumes: approved prompts and generated source PNGs.
- Produces: hero fallback 1920×1080 WebP below 500 KB, three decoration WebPs, 1672×941 social image, and build-time copies in root and compatibility directories.

- [ ] **Step 1: Write failing asset contract tests**

```js
// tests/assets.test.js
import { access } from 'node:fs/promises';
import sharp from 'sharp';
import { expect, it } from 'vitest';

const assets = [
  ['moonstone-hero-fallback.webp', 1920, 1080],
  ['moonstone-fragment-single.webp', 1200, 1200],
  ['moonstone-fragment-cluster.webp', 1600, 1200],
  ['moonstone-chrome-crater.webp', 1600, 1200],
  ['og-liquid-chrome.png', 1672, 941]
];

it.each(assets)('%s has the exact output dimensions', async (name, width, height) => {
  const file = `enhancement-src/assets/${name}`;
  await access(file);
  expect(await sharp(file).metadata()).toMatchObject({ width, height });
});

it('keeps the eager hero below 500 KB', async () => {
  const metadata = await import('node:fs/promises').then(fs => fs.stat('enhancement-src/assets/moonstone-hero-fallback.webp'));
  expect(metadata.size).toBeLessThan(500_000);
});
```

- [ ] **Step 2: Run the asset test and confirm failure**

Run: `npm test -- tests/assets.test.js`

Expected: FAIL because the five output assets are absent.

- [ ] **Step 3: Generate five coherent source images with the image generation workflow**

Use one shared art direction for every prompt: photoreal cratered lunar geology, partial viscous mirror-chrome coating, obsidian-black studio space, cold rectangular reflections from upper right, a restrained warm edge reflection from lower left, physically based rendering, no text, no neon aura, no jewelry gemstone, no fantasy crystal.

Generate these exact compositions:

1. Hero: one large moonstone on the right, eight orbiting fragments and mercury droplets, empty dark copy space on the left, 16:9.
2. Single fragment: isolated irregular cratered fragment with partial chrome film, centered, dark background, square.
3. Cluster: one medium fragment and five small satellites with droplets, transparent-friendly separation, 4:3.
4. Chrome crater: macro lunar surface where viscous chrome pools inside two craters and a crack, 4:3.
5. Social image: hero composition with extra central safe area for existing HTML-generated title overlay, 1672:941.

Save the uncompressed results under `enhancement-src/assets/sources/` with stable descriptive names.

- [ ] **Step 4: Add deterministic resize and compression**

```js
// enhancement-src/prepare-assets.mjs
import sharp from 'sharp';
import path from 'node:path';

const root = path.resolve('enhancement-src/assets');
const jobs = [
  ['sources/hero.png', 'moonstone-hero-fallback.webp', 1920, 1080, { quality: 78 }],
  ['sources/fragment-single.png', 'moonstone-fragment-single.webp', 1200, 1200, { quality: 80 }],
  ['sources/fragment-cluster.png', 'moonstone-fragment-cluster.webp', 1600, 1200, { quality: 78 }],
  ['sources/chrome-crater.png', 'moonstone-chrome-crater.webp', 1600, 1200, { quality: 78 }]
];
for (const [input, output, width, height, options] of jobs) {
  await sharp(path.join(root, input)).resize(width, height, { fit: 'cover' }).webp(options).toFile(path.join(root, output));
}
await sharp(path.join(root, 'sources/og.png')).resize(1672, 941, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(path.join(root, 'og-liquid-chrome.png'));
```

- [ ] **Step 5: Copy assets during build and reference the new fallback/OG image**

Extend `build.mjs` with this exact asset copy and HTML replacement loop:

```js
const assets = ['moonstone-hero-fallback.webp','moonstone-fragment-single.webp','moonstone-fragment-cluster.webp','moonstone-chrome-crater.webp','og-liquid-chrome.png'];
for (const name of assets) {
  const source = path.join(rootDir, 'enhancement-src/assets', name);
  await cp(source, path.join(outDir, name));
  await cp(source, path.join(outDir, 'moonstone-dreamup', name));
}
for (const relative of ['index.html', 'moonstone-dreamup/index.html']) {
  const file = path.join(outDir, relative);
  let html = await readFile(file, 'utf8');
  html = html.replaceAll('hero-moonstone-shanghai-sprout.png', 'moonstone-hero-fallback.webp');
  html = html.replaceAll('/moonstone-dreamup/og.png', '/moonstone-dreamup/og-liquid-chrome.png');
  await writeFile(file, html);
}
```

Add the three decoration assets through `.manifesto::after`, `.proof::after`, and `.faq::after` backgrounds with `pointer-events:none`, `background-size:contain`, and responsive widths of `min(28vw,420px)`, `min(24vw,360px)`, and `min(22vw,320px)` respectively.

- [ ] **Step 6: Prepare assets and make the contract pass**

Run: `node enhancement-src/prepare-assets.mjs`

Run: `npm test -- tests/assets.test.js`

Expected: all six asset assertions PASS and the hero is below 500 KB.

Run: `npm run build`

Expected: each new asset exists at both root and compatibility paths; both HTML files reference the new hero and social image.

- [ ] **Step 7: Commit generated sources, optimized assets, and integration**

```bash
git add enhancement-src/assets enhancement-src/prepare-assets.mjs enhancement-src/build.mjs enhancement-src/styles/moonstone-metal.css tests/assets.test.js
git commit -m "feat: add photoreal liquid moonstone asset family"
```

---

### Task 8: Deployment Workflow, End-to-End Regression, Visual QA, and Release Package

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`
- Create: `playwright.config.js`
- Create: `tests/e2e/site.spec.js`
- Create: `enhancement-src/serve.mjs`
- Create: `enhancement-src/package-release.mjs`
- Create: `tests/release.test.js`
- Create: `docs/superpowers/qa/2026-08-16-liquid-chrome-webgl-qa.md`

**Interfaces:**
- Consumes: the completed `dist/` build.
- Produces: CI-verified GitHub Pages artifact, local screenshot evidence, QA report, and `release/moonstone-dreamup-liquid-chrome.zip`.

- [ ] **Step 1: Write failing end-to-end and release tests**

```js
// tests/e2e/site.spec.js
import { expect, test } from '@playwright/test';

test('enhancement preserves content and registration behavior', async ({ page }) => {
  await page.goto('/moonstone-dreamup/');
  await expect(page.locator('h1')).toContainText('MoonStone');
  await expect(page.locator('#moonstone-liquid-world')).toHaveCount(1);
  await page.locator('.button-primary').first().click();
  await expect(page.locator('.register-overlay')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('.register-close').click();
  await expect(page.locator('.register-overlay')).toHaveAttribute('aria-hidden', 'true');
});

test('reduced motion and forced fallback keep the page usable', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/moonstone-dreamup/?forceWebglFallback=1');
  await expect(page.locator('body')).toHaveClass(/moonstone-webgl-fallback/);
  await expect(page.locator('.register-fab')).toBeVisible();
  await context.close();
});

test('mobile has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/moonstone-dreamup/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
});
```

```js
// tests/release.test.js
import { access } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('creates a deployable enhanced release archive', async () => {
  const { packageRelease } = await import('../../enhancement-src/package-release.mjs');
  await packageRelease();
  await access('release/moonstone-dreamup-liquid-chrome.zip');
  expect(true).toBe(true);
});
```

- [ ] **Step 2: Run tests and confirm expected failure**

Run: `npm run test:e2e`

Expected: FAIL because the server and Playwright configuration are absent.

Run: `npm test -- tests/release.test.js`

Expected: FAIL because the release archive is absent.

- [ ] **Step 3: Add local serving, Playwright configuration, and explicit fallback query support**

```js
// enhancement-src/serve.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/moonstone-dreamup/, '').replace(/^\/+/, '') || 'index.html';
  let file = path.join(root, pathname);
  try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); } catch { file = path.join(root, 'index.html'); }
  response.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
  response.end(await readFile(file));
}).listen(4173, '127.0.0.1');
```

```js
// playwright.config.js
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node enhancement-src/serve.mjs', port: 4173, reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
```

In `main.js`, read `new URLSearchParams(location.search).has('forceWebglFallback')` before canvas initialization and leave the body in fallback state when present.

- [ ] **Step 4: Update CI to install, test, build, and deploy `dist/`**

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
        with:
          enablement: true
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist
```

Remove the old direct unzip step so CI deploys the tested enhanced build.

- [ ] **Step 5: Add deterministic release packaging**

```js
// enhancement-src/package-release.mjs
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { zipSync } from 'fflate';

async function collect(directory, prefix = '') {
  const entries = {};
  for (const name of await readdir(directory)) {
    const full = path.join(directory, name);
    const relative = path.posix.join(prefix, name);
    if ((await stat(full)).isDirectory()) Object.assign(entries, await collect(full, relative));
    else entries[relative] = new Uint8Array(await readFile(full));
  }
  return entries;
}
export async function packageRelease() {
  await mkdir('release', { recursive: true });
  await writeFile('release/moonstone-dreamup-liquid-chrome.zip', zipSync(await collect('dist'), { level: 9 }));
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) await packageRelease();
```

- [ ] **Step 6: Run the complete automated verification**

Run: `npm test`

Expected: all unit and integration tests PASS.

Run: `npm run build`

Expected: build exits zero.

Run: `npx playwright install chromium`

Run: `npm run test:e2e`

Expected: all three Playwright tests PASS.

Run: `node enhancement-src/package-release.mjs`

Run: `npm test -- tests/release.test.js`

Expected: release test PASS.

Run this PowerShell payload check:

```powershell
$bytes = [IO.File]::ReadAllBytes('dist\liquid-world.js')
$stream = [IO.MemoryStream]::new()
$gzip = [IO.Compression.GzipStream]::new($stream,[IO.Compression.CompressionLevel]::SmallestSize,$true)
$gzip.Write($bytes,0,$bytes.Length); $gzip.Dispose()
if($stream.Length -ge 700000){throw "compressed WebGL bundle exceeds 700 KB"}
```

- [ ] **Step 7: Perform visual QA at exact states and record evidence**

Capture desktop 1440×900 and mobile 390×844 screenshots for:

- Intro before and after liquid impact.
- Hero after the WebGL-ready fade.
- Manifesto, format, audience, outcomes, proof, FAQ, and final CTA.
- Registration drawer open.
- Reduced-motion mode.
- Forced fallback mode.

Inspect the live render for chrome reflection, slow coverage flow, visible droplet merging, crisp 14 px glass, no dominant outer glow, no copy obstruction, and no horizontal overflow. Record each result and any measured FPS in `docs/superpowers/qa/2026-08-16-liquid-chrome-webgl-qa.md`; do not mark a row passed without screenshot or automated evidence.

- [ ] **Step 8: Run final verification and commit release infrastructure**

Run: `git diff --check`

Run: `git status --short`

Run: `npm test && npm run build && npm run test:e2e`

Expected: no diff errors, only intended files changed, and all verification commands PASS.

```bash
git add .github/workflows/deploy-pages.yml playwright.config.js enhancement-src/serve.mjs enhancement-src/package-release.mjs enhancement-src/src/main.js tests/e2e/site.spec.js tests/release.test.js docs/superpowers/qa/2026-08-16-liquid-chrome-webgl-qa.md
git commit -m "test: verify and package liquid chrome experience"
```

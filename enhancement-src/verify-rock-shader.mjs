import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function firstExecutable(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next explicit browser location.
    }
  }
  throw new Error(
    'No Chromium executable found. Install Playwright Chromium or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.'
  );
}

function browserCandidates() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    chromium.executablePath()
  ];

  if (process.platform === 'win32') {
    candidates.push(
      path.join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft/Edge/Application/msedge.exe')
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else {
    candidates.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  }

  return candidates;
}

const browserEntry = `
import * as THREE from 'three';
import { createMoonstoneGeometry } from './enhancement-src/src/moonstone-geometry.js';
import { createRockMaterial } from './enhancement-src/src/rock-material.js';

const geometry = createMoonstoneGeometry({ radius: 1, detail: 1, seed: 42, craterCount: 5 });

function renderVariant(label, createObject) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(64, 64, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
  camera.position.z = 4;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 2));
  const object = createObject();
  scene.add(object);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  const result = {
    label,
    glError: renderer.getContext().getError(),
    programs: renderer.info.programs.length,
    diagnostics: renderer.info.programs.map(program => program.diagnostics ?? null)
  };
  object.material.dispose();
  object.dispose?.();
  renderer.dispose();
  return result;
}

window.__rockShaderResults = [
  renderVariant('Mesh', () => new THREE.Mesh(geometry, createRockMaterial())),
  renderVariant('InstancedMesh', () => {
    const mesh = new THREE.InstancedMesh(geometry, createRockMaterial(), 1);
    mesh.setMatrixAt(0, new THREE.Matrix4());
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }),
  renderVariant('BatchedMesh', () => {
    const mesh = new THREE.BatchedMesh(
      1,
      geometry.attributes.position.count,
      geometry.index.count,
      createRockMaterial()
    );
    const geometryId = mesh.addGeometry(geometry);
    mesh.addInstance(geometryId);
    return mesh;
  })
];

geometry.dispose();
`;

const bundle = await build({
  stdin: {
    contents: browserEntry,
    resolveDir: rootDir,
    sourcefile: 'rock-shader-browser-check.js'
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  write: false
});
const executablePath = await firstExecutable(browserCandidates());
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader']
});
const page = await browser.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', error => pageErrors.push(error.message));

try {
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const variants = await page.evaluate(() => window.__rockShaderResults);
  const result = { executablePath, variants, consoleErrors, pageErrors };
  console.log(JSON.stringify(result, null, 2));

  if (
    variants?.length !== 3 ||
    variants.some(variant => variant.glError !== 0 || variant.programs < 1) ||
    consoleErrors.length > 0 ||
    pageErrors.length > 0
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

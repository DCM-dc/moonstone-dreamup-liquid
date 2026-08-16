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
import { createMoonstoneWorld } from './enhancement-src/src/world.js';

const expectedContract = ['render', 'resize', 'setScrollState', 'setPointer', 'pause', 'resume', 'dispose'];
const originalCubeUpdate = THREE.CubeCamera.prototype.update;
let cubeUpdates = 0;
let cubeMatrixError = 0;

THREE.CubeCamera.prototype.update = function (...args) {
  cubeUpdates += 1;
  const elements = this.matrixWorld.elements;
  cubeMatrixError = Math.max(
    cubeMatrixError,
    Math.abs(this.position.x - elements[12]),
    Math.abs(this.position.y - elements[13]),
    Math.abs(this.position.z - elements[14])
  );
  return originalCubeUpdate.apply(this, args);
};

function instrumentContext(canvas) {
  const gl = canvas.getContext('webgl2');
  let calls = 0;
  const liveResources = new Map();
  const customFragmentSources = [];
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const original = gl[name].bind(gl);
    gl[name] = (...args) => {
      calls += 1;
      return original(...args);
    };
  }
  for (const type of ['Buffer', 'Texture', 'Framebuffer', 'Renderbuffer', 'Program', 'Shader', 'VertexArray']) {
    const createName = 'create' + type;
    const deleteName = 'delete' + type;
    const live = new Set();
    const create = gl[createName].bind(gl);
    const remove = gl[deleteName].bind(gl);
    liveResources.set(type, live);
    gl[createName] = (...args) => {
      const resource = create(...args);
      if (resource) live.add(resource);
      return resource;
    };
    gl[deleteName] = resource => {
      if (resource) live.delete(resource);
      return remove(resource);
    };
  }
  const shaderSource = gl.shaderSource.bind(gl);
  gl.shaderSource = (shader, source) => {
    if (source.includes('#define SHADER_TYPE ShaderMaterial') && source.includes('gl_FragColor')) {
      customFragmentSources.push(source);
    }
    return shaderSource(shader, source);
  };
  return {
    gl,
    calls: () => calls,
    reset: () => { calls = 0; },
    live: () => Object.fromEntries(Array.from(liveResources, ([type, resources]) => [type, resources.size])),
    outputPipeline: () => ({
      customFragments: customFragmentSources.length,
      toneMapped: customFragmentSources.filter(source => source.includes('gl_FragColor.rgb = toneMapping')).length,
      colorConverted: customFragmentSources.filter(source => source.includes('gl_FragColor = linearToOutputTexel')).length
    })
  };
}

function pixelMetrics(gl, canvas) {
  gl.finish();
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let litPixels = 0;
  let maxChannel = 0;
  const lumaBuckets = new Set();
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    maxChannel = Math.max(maxChannel, red, green, blue);
    const luma = Math.round((red * 0.2126 + green * 0.7152 + blue * 0.0722) / 8);
    lumaBuckets.add(luma);
    if (red + green + blue > 24) litPixels += 1;
  }
  return {
    litPixels,
    maxChannel,
    lumaBuckets: lumaBuckets.size,
    pixelCount: canvas.width * canvas.height,
    glError: gl.getError()
  };
}

function renderTier(tier) {
  cubeUpdates = 0;
  cubeMatrixError = 0;
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const instrument = instrumentContext(canvas);
  let firstFrames = 0;
  const world = createMoonstoneWorld({ canvas, tier, onFirstFrame: () => { firstFrames += 1; } });
  const contract = Object.keys(world);
  world.resize(0, 0);
  const zeroResize = canvas.width >= 1 && canvas.height >= 1;
  world.resize(192, 128);
  world.setScrollState({ activeId: 'format', local: 0.5, page: 0.45, gather: 0.35, intro: 0 });
  world.setPointer({ x: 2.25, y: -1.5 });
  const frameCount = tier === 'high' ? 13 : 7;
  for (let frame = 0; frame < frameCount; frame += 1) world.render(frame * 16.6666667);

  instrument.reset();
  world.pause();
  world.render(10_000);
  const paused = instrument.calls() === 0;
  world.resume();
  instrument.reset();
  world.render(10_016.6666667);
  const drawCalls = instrument.calls();
  const resumed = drawCalls > 0;
  const pixels = pixelMetrics(instrument.gl, canvas);
  const dynamicUpdates = cubeUpdates;
  world.dispose();
  world.dispose();
  const liveResources = instrument.live();
  const outputPipeline = instrument.outputPipeline();
  instrument.reset();
  world.resize(0, 0);
  world.render(20_000);
  const inertAfterDispose = instrument.calls() === 0;
  canvas.remove();

  return {
    tier,
    contract,
    contractMatches: JSON.stringify(contract) === JSON.stringify(expectedContract),
    firstFrames,
    zeroResize,
    paused,
    resumed,
    inertAfterDispose,
    drawCalls,
    cubeUpdates: dynamicUpdates,
    cubeMatrixError,
    liveResources,
    outputPipeline,
    pixels
  };
}

function renderCadence(fps) {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const instrument = instrumentContext(canvas);
  const world = createMoonstoneWorld({ canvas, tier: 'low' });
  world.resize(96, 64);
  world.setScrollState({ activeId: 'manifesto', local: 0.5, page: 0.35, gather: 0.42, intro: 0 });
  world.setPointer({ x: 1.75, y: -1.25 });
  world.render(0);
  for (let frame = 1; frame <= fps; frame += 1) world.render(frame * 1000 / fps);
  instrument.gl.finish();
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  instrument.gl.readPixels(
    0,
    0,
    canvas.width,
    canvas.height,
    instrument.gl.RGBA,
    instrument.gl.UNSIGNED_BYTE,
    pixels
  );
  world.dispose();
  canvas.remove();
  return pixels;
}

function compareCadences() {
  const sixty = renderCadence(60);
  const oneTwenty = renderCadence(120);
  let totalDifference = 0;
  let maxDifference = 0;
  for (let index = 0; index < sixty.length; index += 1) {
    const difference = Math.abs(sixty[index] - oneTwenty[index]);
    totalDifference += difference;
    maxDifference = Math.max(maxDifference, difference);
  }
  return {
    meanAbsoluteDifference: totalDifference / sixty.length,
    maxDifference
  };
}

function measureRendererBaseline() {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const instrument = instrumentContext(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(16, 16, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
  camera.position.z = 3;
  const geometry = new THREE.SphereGeometry(0.5, 4, 3);
  const material = new THREE.MeshStandardMaterial();
  scene.add(new THREE.Mesh(geometry, material), new THREE.AmbientLight());
  renderer.render(scene, camera);
  geometry.dispose();
  material.dispose();
  renderer.dispose();
  const resources = instrument.live();
  canvas.remove();
  return resources;
}

window.__liquidWorldBaseline = measureRendererBaseline();
window.__liquidWorldResults = ['high', 'medium', 'low'].map(renderTier);
window.__liquidWorldCadence = compareCadences();
`;

const bundle = await build({
  stdin: {
    contents: browserEntry,
    resolveDir: rootDir,
    sourcefile: 'liquid-world-browser-check.js'
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
  const { baseline, tiers, cadence } = await page.evaluate(() => ({
    baseline: window.__liquidWorldBaseline,
    tiers: window.__liquidWorldResults,
    cadence: window.__liquidWorldCadence
  }));
  const result = { executablePath, baseline, tiers, cadence, consoleErrors, pageErrors };
  console.log(JSON.stringify(result, null, 2));

  const expected = {
    high: { drawCalls: 14, cubeUpdates: 3 },
    medium: { drawCalls: 10, cubeUpdates: 0 },
    low: { drawCalls: 8, cubeUpdates: 0 }
  };
  const invalidTier = tiers?.find(tier => {
    return !tier.contractMatches ||
      tier.firstFrames !== 1 ||
      !tier.zeroResize ||
      !tier.paused ||
      !tier.resumed ||
      !tier.inertAfterDispose ||
      tier.drawCalls !== expected[tier.tier].drawCalls ||
      tier.cubeUpdates !== expected[tier.tier].cubeUpdates ||
      tier.cubeMatrixError > 0.000001 ||
      Object.entries(baseline).some(([type, count]) => tier.liveResources[type] !== count) ||
      tier.outputPipeline.customFragments < 3 ||
      tier.outputPipeline.toneMapped !== tier.outputPipeline.customFragments ||
      tier.outputPipeline.colorConverted !== tier.outputPipeline.customFragments ||
      tier.pixels.glError !== 0 ||
      tier.pixels.litPixels < tier.pixels.pixelCount * 0.2 ||
      tier.pixels.maxChannel < 80 ||
      tier.pixels.lumaBuckets < 6;
  });

  if (
    !Array.isArray(tiers) ||
    tiers.length !== 3 ||
    invalidTier ||
    tiers.some(tier =>
      tier.liveResources.Texture !== tiers[0].liveResources.Texture ||
      tier.liveResources.Framebuffer !== tiers[0].liveResources.Framebuffer
    ) ||
    cadence.meanAbsoluteDifference >= 1 ||
    cadence.maxDifference >= 24 ||
    consoleErrors.length ||
    pageErrors.length
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

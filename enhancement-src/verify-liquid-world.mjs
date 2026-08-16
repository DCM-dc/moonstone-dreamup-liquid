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

function instrumentGl(gl, { drawLimit = Infinity, breakCustomShader = false } = {}) {
  let calls = 0;
  let forwardedCalls = 0;
  let brokenShaderInjected = false;
  const liveResources = new Map();
  const customFragmentSources = [];
  const shaderTypes = new Map();
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const original = gl[name].bind(gl);
    gl[name] = (...args) => {
      calls += 1;
      if (forwardedCalls >= drawLimit) return undefined;
      forwardedCalls += 1;
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
      if (resource) {
        live.add(resource);
        if (type === 'Shader') shaderTypes.set(resource, args[0]);
      }
      return resource;
    };
    gl[deleteName] = resource => {
      if (resource) {
        live.delete(resource);
        if (type === 'Shader') shaderTypes.delete(resource);
      }
      return remove(resource);
    };
  }
  const shaderSource = gl.shaderSource.bind(gl);
  gl.shaderSource = (shader, source) => {
    const customFragment = shaderTypes.get(shader) === gl.FRAGMENT_SHADER &&
      source.includes('#define SHADER_TYPE ShaderMaterial') &&
      source.includes('gl_FragColor');
    if (customFragment) {
      customFragmentSources.push(source);
      if (breakCustomShader && !brokenShaderInjected) {
        brokenShaderInjected = true;
        source = source.replace('void main() {', 'void main() {\\nTHIS_SHADER_MUST_NOT_COMPILE');
      }
    }
    return shaderSource(shader, source);
  };
  return {
    gl,
    calls: () => calls,
    reset: () => {
      calls = 0;
      forwardedCalls = 0;
    },
    live: () => Object.fromEntries(Array.from(liveResources, ([type, resources]) => [type, resources.size])),
    brokenShaderInjected: () => brokenShaderInjected,
    outputPipeline: () => ({
      customFragments: customFragmentSources.length,
      toneMapped: customFragmentSources.filter(source => source.includes('gl_FragColor.rgb = toneMapping')).length,
      colorConverted: customFragmentSources.filter(source => source.includes('gl_FragColor = linearToOutputTexel')).length
    })
  };
}

function interceptRendererContext(canvas, options) {
  const nativeGetContext = canvas.getContext.bind(canvas);
  const requests = [];
  let instrument = null;
  canvas.getContext = (type, attributes) => {
    requests.push({ type, attributes: attributes ? { ...attributes } : null });
    const gl = nativeGetContext(type, attributes);
    if (gl && !instrument) instrument = instrumentGl(gl, options);
    return gl;
  };
  return {
    instrument: () => instrument,
    requested: () => requests.find(request => request.type === 'webgl2')?.attributes ?? null,
    actual: () => instrument?.gl.getContextAttributes() ?? null
  };
}

function readPixels(gl, canvas) {
  gl.finish();
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
}

function pixelMetrics(gl, canvas) {
  const pixels = readPixels(gl, canvas);
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

function comparePixels(left, right, width, height, region = { x: 0, y: 0, width, height }) {
  let totalDifference = 0;
  let maxDifference = 0;
  let changedPixels = 0;
  let comparedChannels = 0;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const pixel = (y * width + x) * 4;
      let pixelDifference = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        const difference = Math.abs(left[pixel + channel] - right[pixel + channel]);
        totalDifference += difference;
        pixelDifference += difference;
        maxDifference = Math.max(maxDifference, difference);
        comparedChannels += 1;
      }
      if (pixelDifference > 12) changedPixels += 1;
    }
  }
  return {
    meanAbsoluteDifference: totalDifference / comparedChannels,
    maxDifference,
    changedPixels,
    comparedPixels: comparedChannels / 3
  };
}

function renderTier(tier) {
  cubeUpdates = 0;
  cubeMatrixError = 0;
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const context = interceptRendererContext(canvas);
  let firstFrames = 0;
  const world = createMoonstoneWorld({ canvas, tier, onFirstFrame: () => { firstFrames += 1; } });
  const instrument = context.instrument();
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
    contextAttributes: {
      requested: context.requested(),
      actual: context.actual()
    },
    pixels
  };
}

function renderCadence(fps) {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const context = interceptRendererContext(canvas);
  const world = createMoonstoneWorld({ canvas, tier: 'low' });
  const instrument = context.instrument();
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
  const context = interceptRendererContext(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  const instrument = context.instrument();
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

function renderSingleFrame(activeId, { drawLimit = Infinity } = {}) {
  const width = 160;
  const height = 112;
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const context = interceptRendererContext(canvas, { drawLimit });
  const world = createMoonstoneWorld({ canvas, tier: 'medium' });
  const instrument = context.instrument();
  world.resize(width, height);
  world.setScrollState({ activeId, local: 0, page: 0, gather: 0, intro: 0 });
  world.render(0);
  const pixels = readPixels(instrument.gl, canvas);
  const glError = instrument.gl.getError();
  world.dispose();
  canvas.remove();
  return { pixels, width, height, glError };
}

function verifyInitialComposition() {
  const top = renderSingleFrame('top');
  const format = renderSingleFrame('format');
  return {
    ...comparePixels(top.pixels, format.pixels, top.width, top.height),
    glErrors: [top.glError, format.glError]
  };
}

function verifyObjectContribution() {
  const full = renderSingleFrame('format');
  const backdrop = renderSingleFrame('format', { drawLimit: 1 });
  const region = {
    x: Math.floor(full.width * 0.14),
    y: Math.floor(full.height * 0.1),
    width: Math.floor(full.width * 0.72),
    height: Math.floor(full.height * 0.8)
  };
  return {
    ...comparePixels(full.pixels, backdrop.pixels, full.width, full.height, region),
    glErrors: [full.glError, backdrop.glError]
  };
}

function verifyLostContextFirstFrame() {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const context = interceptRendererContext(canvas);
  let firstFrames = 0;
  const world = createMoonstoneWorld({
    canvas,
    tier: 'low',
    onFirstFrame: () => { firstFrames += 1; }
  });
  const instrument = context.instrument();
  const extension = instrument.gl.getExtension('WEBGL_lose_context');
  world.resize(64, 64);
  extension?.loseContext();
  world.render(0);
  const result = {
    supported: Boolean(extension),
    contextLost: instrument.gl.isContextLost(),
    firstFrames
  };
  world.dispose();
  canvas.remove();
  return result;
}

function verifyBrokenShaderFirstFrame() {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const context = interceptRendererContext(canvas, { breakCustomShader: true });
  let firstFrames = 0;
  const world = createMoonstoneWorld({
    canvas,
    tier: 'low',
    onFirstFrame: () => { firstFrames += 1; }
  });
  const instrument = context.instrument();
  const diagnostics = [];
  const originalConsoleError = console.error;
  console.error = (...args) => { diagnostics.push(args.map(String).join(' ')); };
  try {
    world.resize(64, 64);
    world.render(0);
  } finally {
    console.error = originalConsoleError;
  }
  const result = {
    injected: instrument.brokenShaderInjected(),
    firstFrames,
    diagnostics: diagnostics.length,
    contextLost: instrument.gl.isContextLost()
  };
  world.dispose();
  canvas.remove();
  return result;
}

window.__liquidWorldBaseline = measureRendererBaseline();
window.__liquidWorldResults = ['high', 'medium', 'low'].map(renderTier);
window.__liquidWorldCadence = compareCadences();
window.__liquidWorldInitialComposition = verifyInitialComposition();
window.__liquidWorldObjectContribution = verifyObjectContribution();
window.__liquidWorldInvalidFirstFrames = {
  lostContext: verifyLostContextFirstFrame(),
  brokenShader: verifyBrokenShaderFirstFrame()
};
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
  const { baseline, tiers, cadence, initialComposition, objectContribution, invalidFirstFrames } = await page.evaluate(() => ({
    baseline: window.__liquidWorldBaseline,
    tiers: window.__liquidWorldResults,
    cadence: window.__liquidWorldCadence,
    initialComposition: window.__liquidWorldInitialComposition,
    objectContribution: window.__liquidWorldObjectContribution,
    invalidFirstFrames: window.__liquidWorldInvalidFirstFrames
  }));
  const result = {
    executablePath,
    baseline,
    tiers,
    cadence,
    initialComposition,
    objectContribution,
    invalidFirstFrames,
    consoleErrors,
    pageErrors
  };
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
      tier.contextAttributes.requested?.antialias !== (tier.tier !== 'low') ||
      tier.contextAttributes.requested?.powerPreference !== 'high-performance' ||
      tier.contextAttributes.actual?.antialias !== (tier.tier !== 'low') ||
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
    initialComposition.changedPixels < 100 ||
    initialComposition.meanAbsoluteDifference < 0.25 ||
    initialComposition.glErrors.some(error => error !== 0) ||
    objectContribution.changedPixels < 100 ||
    objectContribution.meanAbsoluteDifference < 0.5 ||
    objectContribution.glErrors.some(error => error !== 0) ||
    !invalidFirstFrames.lostContext.supported ||
    !invalidFirstFrames.lostContext.contextLost ||
    invalidFirstFrames.lostContext.firstFrames !== 0 ||
    !invalidFirstFrames.brokenShader.injected ||
    invalidFirstFrames.brokenShader.contextLost ||
    invalidFirstFrames.brokenShader.firstFrames !== 0 ||
    invalidFirstFrames.brokenShader.diagnostics < 1 ||
    consoleErrors.length ||
    pageErrors.length
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

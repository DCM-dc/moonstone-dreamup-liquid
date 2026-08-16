import * as THREE from 'three';
import { sampleComposition } from './composition.js';
import { createDropletField } from './droplets.js';
import { createLiquidChromeMaterial } from './liquid-chrome.js';
import {
  createFragmentGeometries,
  createMoonstoneGeometry
} from './moonstone-geometry.js';
import { QUALITY } from './quality.js';
import { createRockMaterial } from './rock-material.js';

const degreesToRadians = Math.PI / 180;
const defaultScroll = Object.freeze({ activeId: 'top', gather: 0 });

const environmentVertexShader = `
  varying vec3 vEnvironmentDirection;

  void main() {
    vEnvironmentDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const environmentFragmentShader = `
  precision highp float;
  varying vec3 vEnvironmentDirection;

  void main() {
    vec3 ray = normalize(vEnvironmentDirection);
    float sky = smoothstep(-0.72, 0.88, ray.y);
    float horizon = pow(max(0.0, 1.0 - abs(ray.y)), 5.0);
    float coolCard = pow(max(dot(ray, normalize(vec3(0.48, 0.72, 0.50))), 0.0), 56.0);
    float warmCard = pow(max(dot(ray, normalize(vec3(-0.62, -0.24, 0.75))), 0.0), 72.0);
    float strip = pow(max(dot(ray, normalize(vec3(-0.18, 0.94, -0.28))), 0.0), 140.0);
    vec3 color = mix(vec3(0.006, 0.008, 0.012), vec3(0.055, 0.076, 0.091), sky);
    color += vec3(0.09, 0.13, 0.15) * horizon;
    color += vec3(0.55, 0.86, 1.0) * coolCard * 1.45;
    color += vec3(1.0, 0.38, 0.22) * warmCard * 0.62;
    color += vec3(0.78, 0.88, 0.92) * strip;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createEnvironmentBackdrop() {
  const geometry = new THREE.SphereGeometry(36, 32, 16);
  const material = new THREE.ShaderMaterial({
    name: 'Moonstone procedural reflection environment',
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    vertexShader: environmentVertexShader,
    fragmentShader: environmentFragmentShader
  });
  const backdrop = new THREE.Mesh(geometry, material);
  backdrop.name = 'Moonstone local procedural environment';
  backdrop.renderOrder = -100;
  backdrop.frustumCulled = false;
  return backdrop;
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function createMoonstoneWorld({ canvas, tier = 'low', onFirstFrame = () => {} }) {
  const budget = QUALITY[tier] ?? QUALITY.low;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: tier !== 'low',
    alpha: true,
    powerPreference: 'high-performance'
  });
  const deviceScale = finiteOr(globalThis.devicePixelRatio, 1);
  renderer.setPixelRatio(Math.min(Math.max(deviceScale, 0.5), budget.dpr));
  renderer.setClearColor(0x030405, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(0, 0, 9);

  const geometries = new Set();
  const materials = new Set();
  const backdrop = createEnvironmentBackdrop();
  geometries.add(backdrop.geometry);
  materials.add(backdrop.material);
  scene.add(backdrop);

  const hemisphere = new THREE.HemisphereLight('#dff8ff', '#090604', 1.25);
  const key = new THREE.DirectionalLight('#f5fdff', 4.2);
  key.position.set(4, 5, 6);
  const rim = new THREE.DirectionalLight('#ff835e', 1.15);
  rim.position.set(-5, -2, 3);
  scene.add(hemisphere, key, rim);

  const root = new THREE.Group();
  root.name = 'Moonstone gravity archipelago';
  scene.add(root);

  const reflectionTarget = budget.reflectionEvery > 0
    ? new THREE.WebGLCubeRenderTarget(256, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    })
    : null;
  const reflectionCamera = reflectionTarget
    ? new THREE.CubeCamera(0.1, 60, reflectionTarget)
    : null;
  if (reflectionTarget) reflectionTarget.texture.name = 'Moonstone dynamic reflection';
  if (reflectionCamera) scene.add(reflectionCamera);

  const heroGeometry = createMoonstoneGeometry({
    radius: 2,
    detail: budget.detail,
    seed: 2026,
    craterCount: 24
  });
  const rockMaterial = createRockMaterial();
  const liquidMaterial = createLiquidChromeMaterial({
    environment: reflectionTarget?.texture ?? null,
    simplified: tier === 'low'
  });
  geometries.add(heroGeometry);
  materials.add(rockMaterial);
  materials.add(liquidMaterial);

  const rock = new THREE.Mesh(heroGeometry, rockMaterial);
  rock.name = 'Moonstone cratered core';
  const shell = new THREE.Mesh(heroGeometry, liquidMaterial);
  shell.name = 'Moonstone liquid chrome film';
  shell.scale.setScalar(1.012);
  shell.renderOrder = 2;
  root.add(rock, shell);

  const fragmentGeometries = createFragmentGeometries({
    count: budget.fragments,
    detail: Math.max(1, budget.detail - 2),
    seed: 1608
  });
  const fragments = fragmentGeometries.map((geometry, index) => {
    const mesh = new THREE.Mesh(geometry, rockMaterial);
    const angle = index / fragmentGeometries.length * Math.PI * 2 + 0.24;
    const orbitRadius = 3.18 + index * 0.085;
    const verticalRadius = 1.34 + (index % 3) * 0.16;
    const depthRadius = 0.82 + (index % 2) * 0.18;
    mesh.name = `Moonstone fragment ${index + 1}`;
    const rotationX = index * 0.37;
    const rotationY = index * 0.61;
    const rotationZ = index * 0.23;
    mesh.rotation.set(rotationX, rotationY, rotationZ);
    mesh.position.set(
      Math.cos(angle) * orbitRadius,
      Math.sin(angle) * verticalRadius,
      Math.sin(angle * 1.7) * depthRadius
    );
    geometries.add(geometry);
    root.add(mesh);
    return {
      mesh,
      angle,
      orbitRadius,
      verticalRadius,
      depthRadius,
      phase: index * 0.83,
      rotationX,
      rotationY,
      rotationZ
    };
  });

  const droplets = createDropletField({ tier, groups: budget.sdfGroups });
  root.add(droplets.object);

  const poseTarget = new THREE.Vector3();
  const composition = { position: [0, 0, 0], scale: 1 };
  sampleComposition(defaultScroll, composition);
  root.position.fromArray(composition.position);

  let scroll = defaultScroll;
  const pointer = { x: 0, y: 0 };
  let firstFrame = true;
  let paused = false;
  let disposed = false;
  let renderedFrames = 0;
  let previousTimestamp = null;
  let animationSeconds = 0;

  function render(time) {
    if (paused || disposed) return;
    const milliseconds = Math.max(0, finiteOr(time, 0));
    const timestamp = milliseconds * 0.001;
    const deltaSeconds = previousTimestamp === null
      ? 0
      : Math.min(0.1, Math.max(0, timestamp - previousTimestamp));
    previousTimestamp = timestamp;
    animationSeconds += deltaSeconds;
    const seconds = animationSeconds;
    const gather = Number.isFinite(scroll?.gather)
      ? Math.min(1, Math.max(0, scroll.gather))
      : 0;
    const rhythm = seconds * 0.78539816339;

    liquidMaterial.uniforms.uTime.value = seconds;
    liquidMaterial.uniforms.uFlow.value = 1 - gather * 0.58;
    liquidMaterial.uniforms.uPointer.value.set(pointer.x, pointer.y);
    root.rotation.y = seconds * 0.035 + pointer.x * degreesToRadians;
    root.rotation.x = pointer.y * degreesToRadians;

    sampleComposition(scroll, composition);
    poseTarget.fromArray(composition.position);
    const compositionAlpha = 1 - Math.pow(1 - 0.045, deltaSeconds * 60);
    root.position.lerp(poseTarget, compositionAlpha);
    root.scale.setScalar(composition.scale);

    const orbitConvergence = 1 - gather * 0.76;
    for (const fragment of fragments) {
      const orbit = fragment.angle + Math.sin(rhythm + fragment.phase) * 0.105;
      fragment.mesh.position.set(
        Math.cos(orbit) * fragment.orbitRadius * orbitConvergence,
        Math.sin(orbit) * fragment.verticalRadius * orbitConvergence,
        Math.sin(orbit * 1.7 + rhythm * 0.18) * fragment.depthRadius * orbitConvergence
      );
      fragment.mesh.rotation.set(
        fragment.rotationX + seconds * 0.039,
        fragment.rotationY + seconds * 0.054,
        fragment.rotationZ + Math.sin(rhythm + fragment.phase) * 0.035
      );
    }

    droplets.update(seconds, pointer, scroll);
    if (reflectionCamera) reflectionCamera.position.copy(root.position);
    scene.updateMatrixWorld(true);

    if (reflectionCamera && renderedFrames % budget.reflectionEvery === 0) {
      shell.visible = false;
      try {
        reflectionCamera.update(renderer, scene);
      } finally {
        shell.visible = true;
      }
    }
    renderedFrames += 1;
    renderer.render(scene, camera);

    if (firstFrame) {
      firstFrame = false;
      onFirstFrame();
    }
  }

  function resize(width, height) {
    if (disposed) return;
    const safeWidth = Math.max(1, Math.round(finiteOr(width, 1)));
    const safeHeight = Math.max(1, Math.round(finiteOr(height, 1)));
    renderer.setSize(safeWidth, safeHeight, false);
    camera.aspect = safeWidth / safeHeight;
    camera.updateProjectionMatrix();
  }

  function setScrollState(value) {
    if (!disposed) scroll = value ?? defaultScroll;
  }

  function setPointer(value) {
    if (disposed) return;
    pointer.x = finiteOr(value?.x, 0);
    pointer.y = finiteOr(value?.y, 0);
  }

  function pause() {
    paused = true;
    previousTimestamp = null;
  }

  function resume() {
    if (!disposed) {
      paused = false;
      previousTimestamp = null;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    paused = true;
    droplets.dispose();
    reflectionTarget?.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    renderer.setAnimationLoop(null);
    renderer.dispose();
    scene.clear();
  }

  return {
    render,
    resize,
    setScrollState,
    setPointer,
    pause,
    resume,
    dispose
  };
}

import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createRockMaterial } from '../enhancement-src/src/rock-material.js';

function compileHook(material) {
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {}
  };
  material.onBeforeCompile(shader);
  return shader;
}

it('creates a lunar MeshStandardMaterial with a stable shader cache key', () => {
  const material = createRockMaterial();

  expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect(material.color.getHexString()).toBe('34383d');
  expect(material.roughness).toBe(0.82);
  expect(material.metalness).toBe(0.08);
  expect(material.customProgramCacheKey()).toBe('moonstone-rock-v1');

  material.dispose();
});

it('injects triplanar lunar dust without relying on feature-gated worldPosition', () => {
  const material = createRockMaterial();
  const shader = compileHook(material);

  expect(shader.vertexShader).toContain('varying vec3 vRockWorldPosition;');
  expect(shader.vertexShader).toContain('vRockWorldPosition =');
  expect(shader.vertexShader).not.toContain('vRockWorldPosition = worldPosition.xyz;');
  expect(shader.fragmentShader).toContain('triplanarNoise');
  expect(shader.fragmentShader).toContain('diffuseColor.rgb *=');
  expect(shader.fragmentShader).toContain('roughnessFactor *=');

  material.dispose();
});

it('preserves the lunar shader when cloned for independent disposal', () => {
  const material = createRockMaterial();
  const clone = material.clone();
  const shader = compileHook(clone);

  expect(clone).not.toBe(material);
  expect(clone).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect(shader.fragmentShader).toContain('triplanarNoise');
  expect(clone.customProgramCacheKey()).toBe(material.customProgramCacheKey());

  material.dispose();
  clone.dispose();
});

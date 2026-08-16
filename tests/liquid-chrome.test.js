import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import {
  createLiquidChromeMaterial,
  smoothMin
} from '../enhancement-src/src/liquid-chrome.js';
import { createDropletField } from '../enhancement-src/src/droplets.js';
import { createMoonstoneWorld } from '../enhancement-src/src/world.js';

it('smoothly merges close distances and becomes a hard minimum at invalid widths', () => {
  expect(smoothMin(0.2, 0.25, 0.3)).toBeLessThan(0.2);
  expect(smoothMin(0.2, 0.8, 0.3)).toBe(0.2);
  expect(smoothMin(-0.4, 0.2, 0)).toBe(-0.4);
  expect(smoothMin(-0.4, 0.2, -1)).toBe(-0.4);
  expect(smoothMin(0.25, 0.2, 0.3)).toBe(smoothMin(0.2, 0.25, 0.3));
});

it('creates transparent chrome materials with independent flow inputs and procedural fallback reflection', () => {
  const first = createLiquidChromeMaterial();
  const second = createLiquidChromeMaterial();

  expect(first).toBeInstanceOf(THREE.ShaderMaterial);
  expect(first.transparent).toBe(true);
  expect(first.depthWrite).toBe(false);
  expect(first.depthTest).toBe(true);
  expect(first.uniforms.uEnvironment.value).toBeNull();
  first.uniforms.uTime.value = 3.5;
  first.uniforms.uPointer.value.set(2, -1);

  expect(first.uniforms.uTime.value).toBe(3.5);
  expect(first.uniforms.uPointer.value.toArray()).toEqual([2, -1]);
  expect(second.uniforms.uTime.value).toBe(0);
  expect(second.uniforms.uPointer.value.toArray()).toEqual([0, 0]);
  expect(second.uniforms.uPointer.value).not.toBe(first.uniforms.uPointer.value);

  first.dispose();
  second.dispose();
});

it.each([
  ['high', 3],
  ['medium', 1]
])('creates exactly the %s SDF proxy budget with independent uniforms', (tier, groups) => {
  const field = createDropletField({ tier, groups });

  expect(field.object).toBeInstanceOf(THREE.Group);
  expect(field.object.children).toHaveLength(groups);
  expect(field.object.children.every(child => child.isMesh && child.material.isShaderMaterial)).toBe(true);
  expect(field.object.children.every(child => child.material.depthWrite && child.material.depthTest)).toBe(true);
  expect(field.object.children.every(child => child.material.side === THREE.FrontSide)).toBe(true);
  expect(new Set(field.object.children.map(child => child.material.uniforms)).size).toBe(groups);

  field.update(2.5, { x: 2, y: -1 }, { gather: 0.75 });
  for (const child of field.object.children) {
    expect(child.material.uniforms.uTime.value).toBe(2.5);
    expect(child.material.uniforms.uPointer.value.toArray()).toEqual([2, -1]);
    expect(child.material.uniforms.uGather.value).toBe(0.75);
  }

  field.dispose();
});

it('uses one deterministic instanced field for the zero-SDF low tier', () => {
  const first = createDropletField({ tier: 'low', groups: 0 });
  const second = createDropletField({ tier: 'low', groups: 0 });
  const firstMesh = first.object.children[0];
  const secondMesh = second.object.children[0];

  expect(first.object.children).toHaveLength(1);
  expect(firstMesh).toBeInstanceOf(THREE.InstancedMesh);
  expect(firstMesh.count).toBeGreaterThan(0);
  expect(Array.from(firstMesh.instanceMatrix.array)).toEqual(Array.from(secondMesh.instanceMatrix.array));
  expect(firstMesh.material.isShaderMaterial).toBe(true);
  expect(firstMesh.material.uniforms.uEnvironment.value).toBeNull();

  const meshDisposed = vi.fn();
  firstMesh.addEventListener('dispose', meshDisposed);
  first.dispose();
  first.dispose();
  second.dispose();
  expect(meshDisposed).toHaveBeenCalledOnce();
});

it('disposes each droplet resource once even when disposal is repeated', () => {
  const field = createDropletField({ tier: 'high', groups: 3 });
  const resources = new Set();
  field.object.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    if (node.material) resources.add(node.material);
  });
  const disposed = vi.fn();
  for (const resource of resources) resource.addEventListener('dispose', disposed);

  field.dispose();
  field.dispose();

  expect(disposed).toHaveBeenCalledTimes(resources.size);
});

it('exports the one-world factory consumed by the DOM bootstrap', () => {
  expect(createMoonstoneWorld).toBeTypeOf('function');
});

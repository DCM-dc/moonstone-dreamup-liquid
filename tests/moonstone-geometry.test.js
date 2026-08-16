import * as THREE from 'three';
import { expect, it } from 'vitest';
import { mulberry32 } from '../enhancement-src/src/random.js';
import {
  createFragmentGeometries,
  createMoonstoneGeometry
} from '../enhancement-src/src/moonstone-geometry.js';

function countNonManifoldEdges(geometry, tolerance = 1e-5) {
  const position = geometry.attributes.position;
  const indices = geometry.index
    ? Array.from(geometry.index.array)
    : Array.from({ length: position.count }, (_, index) => index);
  const vertexKeys = Array.from({ length: position.count }, (_, index) => [
    position.getX(index),
    position.getY(index),
    position.getZ(index)
  ].map(value => Math.round(value / tolerance)).join(','));
  const edgeCounts = new Map();

  for (let index = 0; index < indices.length; index += 3) {
    const triangle = indices.slice(index, index + 3).map(vertexIndex => vertexKeys[vertexIndex]);
    for (const [first, second] of [[0, 1], [1, 2], [2, 0]]) {
      const edge = [triangle[first], triangle[second]].sort().join('|');
      edgeCounts.set(edge, (edgeCounts.get(edge) ?? 0) + 1);
    }
  }

  return Array.from(edgeCounts.values()).filter(count => count !== 2).length;
}

function normalizedSilhouette(geometry) {
  geometry.computeBoundingSphere();
  return Array.from(geometry.attributes.position.array, value =>
    Number((value / geometry.boundingSphere.radius).toFixed(5))
  );
}

it('replays the Mulberry32 sequence for the same seed', () => {
  const first = mulberry32(42);
  const second = mulberry32(42);

  expect([first(), first(), first()]).toEqual([
    0.6011037519201636,
    0.44829055899754167,
    0.8524657934904099
  ]);
  expect([second(), second(), second()]).toEqual([
    0.6011037519201636,
    0.44829055899754167,
    0.8524657934904099
  ]);
});

it('generates deterministic cratered geometry within its radius budget', () => {
  const first = createMoonstoneGeometry({ radius: 2, detail: 2, seed: 42, craterCount: 9 });
  const second = createMoonstoneGeometry({ radius: 2, detail: 2, seed: 42, craterCount: 9 });

  expect(first).toBeInstanceOf(THREE.BufferGeometry);
  expect(Array.from(first.attributes.position.array)).toEqual(Array.from(second.attributes.position.array));
  expect(first.boundingSphere.radius).toBeGreaterThan(1.55);
  expect(first.boundingSphere.radius).toBeLessThan(2.35);

  first.dispose();
  second.dispose();
});

it('produces only finite vertices and normals', () => {
  const geometry = createMoonstoneGeometry({ radius: 1.25, detail: 1, seed: 81, craterCount: 12 });
  const positions = Array.from(geometry.attributes.position.array);
  const normals = Array.from(geometry.attributes.normal.array);

  expect(positions.every(Number.isFinite)).toBe(true);
  expect(normals.every(Number.isFinite)).toBe(true);
  expect(geometry.attributes.normal.count).toBe(geometry.attributes.position.count);

  geometry.dispose();
});

it('emits a closed triangle mesh without torn shared edges', () => {
  const geometry = createMoonstoneGeometry({ radius: 2, detail: 2, seed: 42, craterCount: 9 });

  expect(countNonManifoldEdges(geometry)).toBe(0);

  geometry.dispose();
});

it('creates deterministic fragments with distinct silhouettes', () => {
  const first = createFragmentGeometries({ count: 4, detail: 1, seed: 7 });
  const second = createFragmentGeometries({ count: 4, detail: 1, seed: 7 });

  expect(first).toHaveLength(4);
  expect(first.map(item => Array.from(item.attributes.position.array))).toEqual(
    second.map(item => Array.from(item.attributes.position.array))
  );
  expect(first.every(item => item.attributes.normal.count === item.attributes.position.count)).toBe(true);
  const silhouettes = first.map(normalizedSilhouette);
  for (let left = 0; left < silhouettes.length; left += 1) {
    for (let right = left + 1; right < silhouettes.length; right += 1) {
      expect(silhouettes[left]).not.toEqual(silhouettes[right]);
    }
  }

  [...first, ...second].forEach(item => item.dispose());
});

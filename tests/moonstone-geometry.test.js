import * as THREE from 'three';
import { expect, it } from 'vitest';
import { mulberry32 } from '../enhancement-src/src/random.js';
import {
  createFragmentGeometries,
  createMoonstoneGeometry
} from '../enhancement-src/src/moonstone-geometry.js';

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

it('creates deterministic fragments with distinct silhouettes', () => {
  const first = createFragmentGeometries({ count: 4, detail: 1, seed: 7 });
  const second = createFragmentGeometries({ count: 4, detail: 1, seed: 7 });

  expect(first).toHaveLength(4);
  expect(first.map(item => Array.from(item.attributes.position.array))).toEqual(
    second.map(item => Array.from(item.attributes.position.array))
  );
  expect(first.every(item => item.attributes.normal.count === item.attributes.position.count)).toBe(true);
  expect(Array.from(first[0].attributes.position.array)).not.toEqual(
    Array.from(first[1].attributes.position.array)
  );

  [...first, ...second].forEach(item => item.dispose());
});

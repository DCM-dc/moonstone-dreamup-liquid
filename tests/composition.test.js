import { expect, it } from 'vitest';
import { sampleComposition } from '../enhancement-src/src/composition.js';

it('moves from a section pose into the final gathered core', () => {
  expect(sampleComposition({ activeId: 'format', gather: 0 })).toEqual({
    position: [-0.8, 0.12, -0.7],
    scale: 1
  });
  expect(sampleComposition({ activeId: 'format', gather: 1 })).toEqual({
    position: [0, 0, 0],
    scale: 0.78
  });
});

it('clamps gathering and falls back to the top pose for unknown sections', () => {
  expect(sampleComposition({ activeId: 'missing', gather: -2 })).toEqual({
    position: [1.5, 0, 0],
    scale: 1
  });
  expect(sampleComposition({ activeId: 'missing', gather: 2 })).toEqual({
    position: [0, 0, 0],
    scale: 0.78
  });
});

it('can reuse caller-owned output storage for the render hot path', () => {
  const output = { position: [9, 9, 9], scale: 9 };

  expect(sampleComposition({ activeId: 'manifesto', gather: 0.5 }, output)).toBe(output);
  expect(output).toEqual({ position: [0.35, -0.075, -0.175], scale: 0.89 });
});

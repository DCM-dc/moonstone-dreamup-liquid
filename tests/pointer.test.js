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

it('moves monotonically toward each capped target for each time step', () => {
  const pointer = createDampedPointer({ damping: 0.2, maxDegrees: 3 });
  pointer.set(3, -3);
  let previous = pointer.value();

  for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 15]) {
    pointer.step(dt);
    const next = pointer.value();
    expect(next.x).toBeGreaterThanOrEqual(previous.x);
    expect(next.y).toBeLessThanOrEqual(previous.y);
    expect(next.x).toBeLessThanOrEqual(3);
    expect(next.y).toBeGreaterThanOrEqual(-3);
    previous = next;
  }
});

it('does not move for a zero-length time step and responds faster to a larger step', () => {
  const pointer = createDampedPointer({ damping: 0.2, maxDegrees: 3 });
  pointer.set(3, 0);
  pointer.step(0);
  expect(pointer.value()).toEqual({ x: 0, y: 0 });

  pointer.step(1 / 30);
  expect(pointer.value().x).toBeCloseTo(1.08);
});

import { expect, it } from 'vitest';
import { createScrollModel, sampleScroll } from '../enhancement-src/src/timeline.js';

const sections = [
  { id: 'hero', top: 0, height: 1000 },
  { id: 'manifesto', top: 1000, height: 1000 },
  { id: 'faq', top: 2000, height: 1000 },
  { id: 'join', top: 3000, height: 1000 }
];

it('maps exact section boundaries and final convergence', () => {
  const model = createScrollModel(sections);

  expect(sampleScroll(model, 500)).toMatchObject({ activeId: 'hero', local: 0.5, page: 0.125 });
  expect(sampleScroll(model, 2500)).toMatchObject({ activeId: 'faq', local: 0.5, page: 0.625 });
  expect(sampleScroll(model, 4000)).toMatchObject({ activeId: 'join', local: 1, page: 1, gather: 1 });
});

it('activates the next section at a boundary and clamps every scroll scalar', () => {
  const model = createScrollModel(sections);
  const before = sampleScroll(model, -500);
  const after = sampleScroll(model, 5000);

  expect(sampleScroll(model, 1000).activeId).toBe('manifesto');
  expect(Object.values(before).filter(value => typeof value === 'number').every(value => value >= 0 && value <= 1)).toBe(true);
  expect(Object.values(after).filter(value => typeof value === 'number').every(value => value >= 0 && value <= 1)).toBe(true);
});

it('uses a late-page fallback gather start when no join section exists', () => {
  const model = createScrollModel(sections.slice(0, 3));

  expect(sampleScroll(model, 2700).gather).toBe(0.5);
  expect(sampleScroll(model, 3000).gather).toBe(1);
});

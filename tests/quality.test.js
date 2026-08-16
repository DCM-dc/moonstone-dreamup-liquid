import { expect, it } from 'vitest';
import { chooseQuality, QUALITY } from '../enhancement-src/src/quality.js';

it('selects exact quality budgets', () => {
  expect(chooseQuality({ width: 1440, webgl2: true, reducedMotion: false, deviceMemory: 16, cores: 12 })).toBe('high');
  expect(chooseQuality({ width: 1024, webgl2: true, reducedMotion: false, deviceMemory: 8, cores: 8 })).toBe('medium');
  expect(chooseQuality({ width: 390, webgl2: true, reducedMotion: false, deviceMemory: 4, cores: 4 })).toBe('low');
  expect(QUALITY.high).toMatchObject({ dpr: 1.5, fragments: 8, sdfGroups: 3, reflectionEvery: 6 });
  expect(QUALITY.medium).toMatchObject({ dpr: 1.25, fragments: 6, sdfGroups: 1, reflectionEvery: 0 });
  expect(QUALITY.low).toMatchObject({ dpr: 1, fragments: 4, sdfGroups: 0, reflectionEvery: 0 });
});

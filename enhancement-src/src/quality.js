export const QUALITY = Object.freeze({
  high: Object.freeze({ dpr: 1.5, fragments: 8, sdfGroups: 3, detail: 5, reflectionEvery: 6 }),
  medium: Object.freeze({ dpr: 1.25, fragments: 6, sdfGroups: 1, detail: 4, reflectionEvery: 0 }),
  low: Object.freeze({ dpr: 1, fragments: 4, sdfGroups: 0, detail: 3, reflectionEvery: 0 })
});

export function chooseQuality({ width, webgl2, reducedMotion, deviceMemory = 4, cores = 4 }) {
  if (!webgl2 || reducedMotion || width < 640 || deviceMemory <= 4 || cores <= 4) return 'low';
  if (width >= 1280 && deviceMemory >= 12 && cores >= 8) return 'high';
  return 'medium';
}

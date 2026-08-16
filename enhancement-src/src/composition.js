const POSES = Object.freeze({
  top: Object.freeze([1.5, 0, 0]),
  hero: Object.freeze([1.5, 0, 0]),
  manifesto: Object.freeze([0.7, -0.15, -0.35]),
  format: Object.freeze([-0.8, 0.12, -0.7]),
  who: Object.freeze([0.95, -0.1, -0.45]),
  outcomes: Object.freeze([-0.65, 0.16, -0.8]),
  proof: Object.freeze([0.85, -0.2, -0.55]),
  faq: Object.freeze([-0.9, 0.08, -0.9]),
  join: Object.freeze([0, 0, 0])
});

const clamp = value => Number.isFinite(value)
  ? Math.min(1, Math.max(0, value))
  : 0;

const rounded = value => {
  const result = Math.round(value * 10_000) / 10_000;
  return Object.is(result, -0) ? 0 : result;
};

export function sampleComposition({ activeId, gather } = {}, output) {
  const start = POSES[activeId] ?? POSES.top;
  const amount = clamp(gather);
  const inverse = 1 - amount;
  const result = output ?? { position: [0, 0, 0], scale: 1 };
  const position = result.position ?? (result.position = [0, 0, 0]);

  position[0] = rounded(start[0] * inverse);
  position[1] = rounded(start[1] * inverse);
  position[2] = rounded(start[2] * inverse);
  result.scale = rounded(1 - amount * 0.22);
  return result;
}

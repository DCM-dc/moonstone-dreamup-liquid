const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;

export function createDampedPointer({ damping = 0.2, maxDegrees = 3 } = {}) {
  const decay = Math.min(1, Math.max(0, finiteOr(damping, 0.2)));
  const limit = Math.max(0, finiteOr(maxDegrees, 3));
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;

  const cap = value => Math.min(limit, Math.max(-limit, finiteOr(value, 0)));

  return {
    set(nx, ny) {
      targetX = cap(nx);
      targetY = cap(ny);
    },
    step(dt) {
      const seconds = Math.max(0, finiteOr(dt, 0));
      const alpha = 1 - Math.pow(1 - decay, seconds * 60);
      x = cap(x + (targetX - x) * alpha);
      y = cap(y + (targetY - y) * alpha);
    },
    value() {
      return { x, y };
    }
  };
}

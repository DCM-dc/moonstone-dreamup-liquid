import { describe, expect, it } from 'vitest';
import { bootstrapMoonstone } from '../enhancement-src/src/main.js';

const sectionBoxes = new Map([
  ['#top', [0, 900]],
  ['#manifesto', [900, 1000]],
  ['#format', [1900, 1000]],
  ['.who', [2900, 800]],
  ['.outcomes', [3700, 900]],
  ['#proof', [4600, 1000]],
  ['.faq', [5600, 900]],
  ['#join', [6500, 700]]
]);

function createClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name)
  };
}

function createWindowTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const entries = listeners.get(type) ?? new Set();
      entries.add(listener);
      listeners.set(type, entries);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener();
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    }
  };
}

describe('flat MoonStone runtime', () => {
  it('boots as a canvas-free 2D enhancement and cleans up scroll tracking', () => {
    const classList = createClassList();
    const properties = new Map();
    const windowLike = {
      ...createWindowTarget(),
      scrollY: 4150
    };
    const documentLike = {
      body: { classList },
      documentElement: {
        style: {
          setProperty(name, value) {
            properties.set(name, value);
          }
        }
      },
      createElement() {
        throw new Error('The flat runtime must not create a canvas.');
      },
      querySelector(selector) {
        const box = sectionBoxes.get(selector);
        return box ? { offsetTop: box[0], offsetHeight: box[1] } : null;
      }
    };
    windowLike.document = documentLike;

    const handle = bootstrapMoonstone({ windowLike, documentLike });

    expect(classList.contains('moonstone-enhanced')).toBe(true);
    expect(classList.contains('moonstone-2d-ready')).toBe(true);
    expect(windowLike.listenerCount('scroll')).toBe(1);
    expect(properties.get('--ms-local')).toBe('0.5');

    windowLike.scrollY = 6800;
    windowLike.dispatch('scroll');
    expect(Number(properties.get('--ms-scroll'))).toBeCloseTo(6800 / 7200);
    expect(properties.get('--ms-gather')).toBe(String(300 / 700));

    handle.destroy();
    expect(handle.isActive()).toBe(false);
    expect(windowLike.listenerCount('scroll')).toBe(0);
  });
});

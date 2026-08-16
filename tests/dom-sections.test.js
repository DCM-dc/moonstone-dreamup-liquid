import { describe, expect, it } from 'vitest';
import { measureSections } from '../enhancement-src/src/dom-sections.js';
import {
  bootstrapMoonstone,
  calculateFrameDelta,
  claimContextRestore
} from '../enhancement-src/src/main.js';

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

function documentWithBoxes(boxes = sectionBoxes) {
  return {
    querySelector(selector) {
      const box = boxes.get(selector);
      return box ? { offsetTop: box[0], offsetHeight: box[1] } : null;
    }
  };
}

describe('measureSections', () => {
  it('measures every narrative section in document order', () => {
    expect(measureSections(documentWithBoxes()).map((section) => section.id)).toEqual([
      'top',
      'manifesto',
      'format',
      'who',
      'outcomes',
      'proof',
      'faq',
      'join'
    ]);
  });

  it('returns the measured top and height for each section', () => {
    expect(measureSections(documentWithBoxes())).toEqual([
      { id: 'top', top: 0, height: 900 },
      { id: 'manifesto', top: 900, height: 1000 },
      { id: 'format', top: 1900, height: 1000 },
      { id: 'who', top: 2900, height: 800 },
      { id: 'outcomes', top: 3700, height: 900 },
      { id: 'proof', top: 4600, height: 1000 },
      { id: 'faq', top: 5600, height: 900 },
      { id: 'join', top: 6500, height: 700 }
    ]);
  });

  it('clamps collapsed and invalid section heights to one pixel', () => {
    const boxes = new Map(sectionBoxes);
    boxes.set('#top', [0, 0]);
    boxes.set('#manifesto', [900, Number.NaN]);
    boxes.set('#format', [1900, -20]);

    expect(measureSections(documentWithBoxes(boxes)).slice(0, 3)).toEqual([
      { id: 'top', top: 0, height: 1 },
      { id: 'manifesto', top: 900, height: 1 },
      { id: 'format', top: 1900, height: 1 }
    ]);
  });

  it('fails loudly at the first missing expected section', () => {
    const boxes = new Map(sectionBoxes);
    boxes.delete('#format');

    expect(() => measureSections(documentWithBoxes(boxes))).toThrow(
      'Missing MoonStone section: #format'
    );
  });
});

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  replace(from, to) {
    if (!this.values.delete(from)) return false;
    this.values.add(to);
    return true;
  }

  contains(name) {
    return this.values.has(name);
  }
}

function createEventTarget() {
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
    dispatch(type, event = {}) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    }
  };
}

function createBootstrapHarness({
  reducedMotion = false,
  finePointer = true,
  webgl2 = true,
  search = '',
  scrollY = 4150,
  storageThrows = false,
  renderThrows = false,
  initializeThrows = false,
  matchMediaThrows = false,
  initialHidden = false
} = {}) {
  const windowEvents = createEventTarget();
  const documentEvents = createEventTarget();
  const canvases = [];
  const prepended = [];
  const properties = new Map();
  const animationFrames = new Map();
  const storageValues = new Map();
  let nextFrameId = 1;
  let reloads = 0;
  let worldOptions;
  const pointerCalls = { set: [], step: [] };

  const documentLike = {
    ...documentEvents,
    hidden: initialHidden,
    body: {
      classList: new FakeClassList(),
      prepend(node) {
        prepended.unshift(node);
        node.parentNode = this;
      }
    },
    documentElement: {
      style: {
        setProperty(name, value) {
          properties.set(name, value);
        }
      }
    },
    createElement(tagName) {
      expect(tagName).toBe('canvas');
      const events = createEventTarget();
      const canvas = {
        ...events,
        id: '',
        parentNode: null,
        removed: false,
        contextCalls: [],
        attributes: new Map(),
        getContext(type) {
          this.contextCalls.push(type);
          if (!webgl2) return null;
          return {
            getExtension(name) {
              return name === 'WEBGL_lose_context' ? { loseContext() {} } : null;
            }
          };
        },
        setAttribute(name, value) {
          this.attributes.set(name, value);
        },
        remove() {
          this.removed = true;
          this.parentNode = null;
          const index = prepended.indexOf(this);
          if (index >= 0) prepended.splice(index, 1);
        }
      };
      canvases.push(canvas);
      return canvas;
    },
    querySelector(selector) {
      const box = sectionBoxes.get(selector);
      return box ? { offsetTop: box[0], offsetHeight: box[1] } : null;
    }
  };

  const sessionStorageLike = {
    getItem(key) {
      if (storageThrows) throw new Error('storage denied');
      return storageValues.get(key) ?? null;
    },
    setItem(key, value) {
      if (storageThrows) throw new Error('storage denied');
      storageValues.set(key, value);
    }
  };

  const windowLike = {
    ...windowEvents,
    document: documentLike,
    innerWidth: 1440,
    innerHeight: 900,
    scrollY,
    navigator: { deviceMemory: 16, hardwareConcurrency: 12 },
    location: {
      search,
      reload() {
        reloads += 1;
      }
    },
    sessionStorage: sessionStorageLike,
    performance: { now: () => 240 },
    matchMedia(query) {
      if (matchMediaThrows) throw new Error('media query failed');
      if (query === '(prefers-reduced-motion: reduce)') return { matches: reducedMotion };
      if (query === '(hover: hover) and (pointer: fine)') return { matches: finePointer };
      return { matches: false };
    },
    requestAnimationFrame(callback) {
      const id = nextFrameId;
      nextFrameId += 1;
      animationFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      animationFrames.delete(id);
    }
  };

  const worldCalls = {
    resize: [],
    scroll: [],
    pointer: [],
    render: [],
    pause: 0,
    resume: 0,
    dispose: 0
  };
  const world = {
    resize(width, height) {
      worldCalls.resize.push([width, height]);
    },
    setScrollState(state) {
      worldCalls.scroll.push(state);
    },
    setPointer(value) {
      worldCalls.pointer.push(value);
    },
    render(time) {
      worldCalls.render.push(time);
      if (renderThrows) throw new Error('render failed');
    },
    pause() {
      worldCalls.pause += 1;
    },
    resume() {
      worldCalls.resume += 1;
    },
    dispose() {
      worldCalls.dispose += 1;
    }
  };

  const handle = bootstrapMoonstone({
    windowLike,
    documentLike,
    dependencies: {
      createPointer() {
        let value = { x: 0, y: 0 };
        return {
          set(x, y) {
            pointerCalls.set.push([x, y]);
            value = { x, y };
          },
          step(dt) {
            pointerCalls.step.push(dt);
          },
          value() {
            return value;
          }
        };
      },
      createWorld(options) {
        if (initializeThrows) throw new Error('initialization failed');
        worldOptions = options;
        return world;
      },
      reportError() {}
    }
  });

  return {
    animationFrames,
    canvases,
    documentLike,
    handle,
    prepended,
    properties,
    pointerCalls,
    sessionStorageLike,
    storageValues,
    windowLike,
    world,
    worldCalls,
    get reloads() { return reloads; },
    get worldOptions() { return worldOptions; },
    runNextFrame(time) {
      const entry = animationFrames.entries().next().value;
      if (!entry) throw new Error('No animation frame was scheduled');
      animationFrames.delete(entry[0]);
      entry[1](time);
    }
  };
}

describe('bootstrap policy helpers', () => {
  it('uses elapsed animation-frame time and caps long gaps', () => {
    expect(calculateFrameDelta(null, 1000)).toBe(0);
    expect(calculateFrameDelta(1000, 1016)).toBeCloseTo(0.016);
    expect(calculateFrameDelta(1000, 1400)).toBe(0.1);
    expect(calculateFrameDelta(1100, 1000)).toBe(0);
  });

  it('claims at most one context restore and treats storage denial as permanent fallback', () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    };

    expect(claimContextRestore(storage, 'restore')).toBe(true);
    expect(claimContextRestore(storage, 'restore')).toBe(false);
    expect(claimContextRestore({ getItem() { throw new Error('denied'); } }, 'restore')).toBe(false);
  });
});

describe('bootstrapMoonstone', () => {
  it('probes WebGL2 separately and keeps fallback visible until the world validity callback', () => {
    const harness = createBootstrapHarness();
    const [probeCanvas, targetCanvas] = harness.canvases;

    expect(probeCanvas.contextCalls).toEqual(['webgl2']);
    expect(targetCanvas.contextCalls).toEqual([]);
    expect(targetCanvas.id).toBe('moonstone-liquid-world');
    expect(targetCanvas.attributes.get('aria-hidden')).toBe('true');
    expect(harness.prepended).toEqual([targetCanvas]);
    expect(harness.documentLike.body.classList.contains('moonstone-webgl-fallback')).toBe(true);
    expect(harness.documentLike.body.classList.contains('moonstone-webgl-ready')).toBe(false);

    harness.worldOptions.onFirstFrame();

    expect(harness.documentLike.body.classList.contains('moonstone-webgl-fallback')).toBe(false);
    expect(harness.documentLike.body.classList.contains('moonstone-webgl-ready')).toBe(true);
    harness.handle.destroy();
  });

  it('renders one current-scroll frame without rAF or pointer tracking in reduced motion', () => {
    const harness = createBootstrapHarness({ reducedMotion: true, scrollY: 4150 });

    expect(harness.worldCalls.render).toEqual([240]);
    expect(harness.worldCalls.scroll.at(-1)).toMatchObject({
      activeId: 'outcomes',
      local: 0.5,
      gather: 0
    });
    expect(harness.animationFrames.size).toBe(0);
    expect(harness.windowLike.listenerCount('pointermove')).toBe(0);
    expect(Number(harness.properties.get('--ms-scroll'))).toBeCloseTo(4150 / 7200);
    expect(harness.properties.get('--ms-local')).toBe('0.5');
    expect(harness.properties.get('--ms-gather')).toBe('0');

    harness.windowLike.dispatch('load');
    expect(harness.worldCalls.render).toEqual([240]);
    harness.handle.destroy();
  });

  it('renders the single reduced-motion frame even when the document starts hidden', () => {
    const harness = createBootstrapHarness({ reducedMotion: true, initialHidden: true });

    expect(harness.worldCalls.render).toEqual([240]);
    expect(harness.animationFrames.size).toBe(0);
    harness.handle.destroy();
  });

  it('updates reduced-motion scroll state without rendering another frame', () => {
    const harness = createBootstrapHarness({ reducedMotion: true, scrollY: 4150 });
    harness.windowLike.scrollY = 6800;

    harness.windowLike.dispatch('scroll');

    expect(harness.worldCalls.render).toEqual([240]);
    expect(harness.worldCalls.scroll.at(-1)).toMatchObject({
      activeId: 'join',
      local: 300 / 700,
      gather: 300 / 700
    });
    expect(Number(harness.properties.get('--ms-scroll'))).toBeCloseTo(6800 / 7200);
    expect(harness.animationFrames.size).toBe(0);
    harness.handle.destroy();
  });

  it('passes capped real frame delta to fine-pointer damping', () => {
    const harness = createBootstrapHarness();
    harness.windowLike.dispatch('pointermove', { clientX: 1440, clientY: 0 });

    harness.runNextFrame(1000);
    harness.runNextFrame(1032);
    harness.runNextFrame(1500);

    expect(harness.pointerCalls.set).toEqual([[3, 3]]);
    expect(harness.pointerCalls.step).toEqual([0, 0.032, 0.1]);
    harness.handle.destroy();
  });

  it('stops rendering and returns to fallback after a fatal frame error', () => {
    const harness = createBootstrapHarness({ renderThrows: true });
    const targetCanvas = harness.canvases[1];

    harness.runNextFrame(1000);

    expect(harness.documentLike.body.classList.contains('moonstone-webgl-fallback')).toBe(true);
    expect(harness.documentLike.body.classList.contains('moonstone-webgl-ready')).toBe(false);
    expect(targetCanvas.removed).toBe(true);
    expect(harness.animationFrames.size).toBe(0);
    expect(harness.worldCalls.dispose).toBe(1);
  });

  it('keeps the existing page usable when initialization fails', () => {
    const harness = createBootstrapHarness({ initializeThrows: true });
    const targetCanvas = harness.canvases[1];

    expect(harness.documentLike.body.classList.contains('moonstone-enhanced')).toBe(true);
    expect(harness.documentLike.body.classList.contains('moonstone-webgl-fallback')).toBe(true);
    expect(harness.documentLike.body.classList.contains('moonstone-webgl-ready')).toBe(false);
    expect(targetCanvas.removed).toBe(true);
    expect(harness.animationFrames.size).toBe(0);
  });

  it('keeps the existing page usable when capability detection fails', () => {
    const harness = createBootstrapHarness({ matchMediaThrows: true });
    const targetCanvas = harness.canvases[1];

    expect(harness.documentLike.body.classList.contains('moonstone-enhanced')).toBe(true);
    expect(harness.documentLike.body.classList.contains('moonstone-webgl-fallback')).toBe(true);
    expect(harness.documentLike.body.classList.contains('moonstone-webgl-ready')).toBe(false);
    expect(targetCanvas.removed).toBe(true);
    expect(harness.animationFrames.size).toBe(0);
  });

  it('restores the fallback immediately on context loss and reloads after restoration', () => {
    const harness = createBootstrapHarness();
    const targetCanvas = harness.canvases[1];
    harness.worldOptions.onFirstFrame();
    let prevented = false;

    targetCanvas.dispatch('webglcontextlost', { preventDefault() { prevented = true; } });

    expect(prevented).toBe(true);
    expect(harness.documentLike.body.classList.contains('moonstone-webgl-fallback')).toBe(true);
    expect(harness.documentLike.body.classList.contains('moonstone-webgl-ready')).toBe(false);
    expect(harness.worldCalls.pause).toBe(1);
    expect(harness.animationFrames.size).toBe(0);

    targetCanvas.dispatch('webglcontextrestored');
    expect(harness.reloads).toBe(1);
    harness.handle.destroy();
  });

  it('stays in usable fallback when session storage blocks a restore attempt', () => {
    const harness = createBootstrapHarness({ storageThrows: true });
    const targetCanvas = harness.canvases[1];
    harness.worldOptions.onFirstFrame();

    targetCanvas.dispatch('webglcontextlost', { preventDefault() {} });
    targetCanvas.dispatch('webglcontextrestored');

    expect(harness.documentLike.body.classList.contains('moonstone-webgl-fallback')).toBe(true);
    expect(targetCanvas.removed).toBe(true);
    expect(harness.reloads).toBe(0);
  });
});

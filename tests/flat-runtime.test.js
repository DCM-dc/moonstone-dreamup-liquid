import { describe, expect, it, vi } from 'vitest';
import { bootstrapMoonstone, scheduleMoonstoneBootstrap } from '../enhancement-src/src/main.js';

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
    addEventListener(type, listener, options) {
      const entries = listeners.get(type) ?? new Map();
      entries.set(listener, options === true || options?.capture === true);
      listeners.set(type, entries);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type, event) {
      for (const listener of [...(listeners.get(type)?.keys() ?? [])]) listener(event);
    },
    listenerCount(type, capture) {
      const entries = listeners.get(type);
      if (capture === undefined) return entries?.size ?? 0;
      return [...(entries?.values() ?? [])].filter((value) => value === capture).length;
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

  it('restores ready classes after hydration only while active', () => {
    const classList = createClassList();
    let mutationCallback;
    const body = { classList };
    const windowLike = {
      ...createWindowTarget(),
      scrollY: 0,
      MutationObserver: class {
        constructor(callback) {
          mutationCallback = callback;
        }

        observe() {}
        disconnect() {}
      }
    };
    const documentLike = {
      body,
      documentElement: { style: { setProperty() {} } },
      querySelector() { return null; }
    };
    windowLike.document = documentLike;

    const handle = bootstrapMoonstone({ windowLike, documentLike });

    classList.remove('moonstone-enhanced', 'moonstone-2d-ready');
    mutationCallback([{ type: 'attributes', attributeName: 'class', target: body }]);

    expect(classList.contains('moonstone-enhanced')).toBe(true);
    expect(classList.contains('moonstone-2d-ready')).toBe(true);

    handle.destroy();
    classList.remove('moonstone-enhanced', 'moonstone-2d-ready');
    mutationCallback([{ type: 'attributes', attributeName: 'class', target: body }]);

    expect(classList.contains('moonstone-enhanced')).toBe(false);
    expect(classList.contains('moonstone-2d-ready')).toBe(false);
  });

  it('defers automatic enhancement until load and never restarts after destroy', async () => {
    const autoClasses = createClassList();
    const autoWindow = {
      ...createWindowTarget(),
      scrollY: 0,
      document: {
        readyState: 'loading',
        body: { classList: autoClasses },
        documentElement: { style: { setProperty() {} } },
        querySelector(selector) {
          const box = sectionBoxes.get(selector);
          return box ? { offsetTop: box[0], offsetHeight: box[1] } : null;
        }
      }
    };
    vi.resetModules();
    vi.stubGlobal('window', autoWindow);

    try {
      const { scheduleMoonstoneBootstrap } = await import('../enhancement-src/src/main.js');

      expect(autoClasses.contains('moonstone-enhanced')).toBe(false);
      expect(autoWindow.listenerCount('scroll')).toBe(0);

      autoWindow.dispatch('load');
      expect(autoClasses.contains('moonstone-enhanced')).toBe(true);
      expect(autoWindow.listenerCount('scroll')).toBe(1);

      autoWindow.dispatch('load');
      expect(autoWindow.listenerCount('scroll')).toBe(1);

      const stoppedClasses = createClassList();
      const stoppedWindow = {
        ...createWindowTarget(),
        scrollY: 0,
        document: {
          readyState: 'loading',
          body: { classList: stoppedClasses },
          documentElement: { style: { setProperty() {} } },
          querySelector(selector) {
            const box = sectionBoxes.get(selector);
            return box ? { offsetTop: box[0], offsetHeight: box[1] } : null;
          }
        }
      };
      const scheduler = scheduleMoonstoneBootstrap({
        windowLike: stoppedWindow,
        documentLike: stoppedWindow.document
      });
      scheduler.destroy();
      stoppedWindow.dispatch('load');

      expect(stoppedClasses.contains('moonstone-enhanced')).toBe(false);
      expect(stoppedWindow.listenerCount('scroll')).toBe(0);
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it('blocks registration clicks before load without mutating the page', () => {
    const classList = createClassList();
    let attributeWrites = 0;
    const registration = {
      childNodes: [],
      disabled: false,
      closest(selector) {
        return selector.includes('.register-fab') ? this : null;
      },
      setAttribute() {
        attributeWrites += 1;
      }
    };
    const documentLike = {
      ...createWindowTarget(),
      readyState: 'loading',
      body: { classList },
      documentElement: { style: { setProperty() {} } },
      querySelector(selector) {
        const box = sectionBoxes.get(selector);
        return box ? { offsetTop: box[0], offsetHeight: box[1] } : null;
      },
      querySelectorAll() {
        return [registration];
      },
      dispatchClick(target) {
        const event = {
          target,
          prevented: false,
          propagationStopped: false,
          immediatePropagationStopped: false,
          preventDefault() { this.prevented = true; },
          stopPropagation() { this.propagationStopped = true; },
          stopImmediatePropagation() { this.immediatePropagationStopped = true; }
        };
        this.dispatch('click', event);
        return event;
      }
    };
    const windowLike = { ...createWindowTarget(), scrollY: 0, document: documentLike };

    const scheduler = scheduleMoonstoneBootstrap({ windowLike, documentLike });

    expect(classList.contains('moonstone-enhanced')).toBe(false);
    expect(registration.disabled).toBe(false);
    expect(attributeWrites).toBe(0);
    expect(documentLike.listenerCount('click', true)).toBe(1);

    const registrationClick = documentLike.dispatchClick(registration);
    expect(registrationClick.prevented).toBe(true);
    expect(registrationClick.propagationStopped).toBe(true);
    expect(registrationClick.immediatePropagationStopped).toBe(true);

    const otherClick = documentLike.dispatchClick({ closest() { return null; } });
    expect(otherClick.prevented).toBe(false);

    windowLike.dispatch('load');
    expect(documentLike.listenerCount('click')).toBe(1);
    expect(documentLike.listenerCount('click', true)).toBe(1);
    expect(registration.disabled).toBe(true);

    const loadedRegistrationClick = documentLike.dispatchClick(registration);
    expect(loadedRegistrationClick.prevented).toBe(true);

    const pendingDocument = {
      ...createWindowTarget(),
      readyState: 'loading',
      body: { classList: createClassList() }
    };
    const pendingWindow = { ...createWindowTarget(), document: pendingDocument };
    const pending = scheduleMoonstoneBootstrap({
      windowLike: pendingWindow,
      documentLike: pendingDocument
    });
    expect(pendingDocument.listenerCount('click', true)).toBe(1);
    pending.destroy();
    pendingWindow.dispatch('load');
    expect(pendingDocument.listenerCount('click')).toBe(0);

    scheduler.destroy();
  });
});

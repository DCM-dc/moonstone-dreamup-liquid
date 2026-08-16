import { measureSections } from './dom-sections.js';
import { createDampedPointer } from './pointer.js';
import { chooseQuality } from './quality.js';
import { bindContextRecovery, createRuntimeState } from './runtime-state.js';
import { createScrollModel, sampleScroll } from './timeline.js';
import { createMoonstoneWorld } from './world.js';

export const CANVAS_ID = 'moonstone-liquid-world';
export const RESTORE_KEY = 'moonstone-webgl-restore-attempted';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
const MAX_FRAME_DELTA_SECONDS = 0.1;

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function calculateFrameDelta(previousTime, currentTime) {
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) return 0;
  return Math.min(
    MAX_FRAME_DELTA_SECONDS,
    Math.max(0, (currentTime - previousTime) / 1000)
  );
}

export function claimContextRestore(storage, key = RESTORE_KEY) {
  try {
    if (!storage || storage.getItem(key)) return false;
    storage.setItem(key, '1');
    return true;
  } catch {
    return false;
  }
}

function probeWebGL2(documentLike) {
  let context = null;
  try {
    const probeCanvas = documentLike.createElement('canvas');
    context = probeCanvas.getContext('webgl2');
    return Boolean(context);
  } catch {
    return false;
  } finally {
    try {
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      // The probe is temporary; failing to release it must not hide the fallback.
    }
  }
}

function createInertHandle() {
  return Object.freeze({
    destroy() {},
    isActive() { return false; }
  });
}

function setFallbackState(body) {
  body.classList.add('moonstone-enhanced', 'moonstone-webgl-fallback');
  body.classList.remove('moonstone-webgl-ready');
}

function setReadyState(body) {
  body.classList.add('moonstone-enhanced', 'moonstone-webgl-ready');
  body.classList.remove('moonstone-webgl-fallback');
}

function setInitialScrollVariables(documentLike) {
  const style = documentLike.documentElement?.style;
  style?.setProperty('--ms-scroll', '0');
  style?.setProperty('--ms-local', '0');
  style?.setProperty('--ms-gather', '0');
}

function createTargetCanvas(documentLike) {
  const canvas = documentLike.createElement('canvas');
  canvas.id = CANVAS_ID;
  canvas.setAttribute('aria-hidden', 'true');
  documentLike.body.prepend(canvas);
  return canvas;
}

export function bootstrapMoonstone({
  windowLike = globalThis.window,
  documentLike = windowLike?.document,
  dependencies = {}
} = {}) {
  const body = documentLike?.body;
  if (!windowLike || !documentLike || !body) return createInertHandle();

  const selectQuality = dependencies.selectQuality ?? chooseQuality;
  const createRuntime = dependencies.createRuntime ?? createRuntimeState;
  const createPointer = dependencies.createPointer ?? createDampedPointer;
  const createWorld = dependencies.createWorld ?? createMoonstoneWorld;
  const bindRecovery = dependencies.bindRecovery ?? bindContextRecovery;
  const reportError = dependencies.reportError ?? ((error) => {
    console.error('MoonStone WebGL enhancement returned to its fallback.', error);
  });

  function safelyReportError(error) {
    try {
      reportError(error);
    } catch {
      // Error reporting is never allowed to compromise the DOM fallback.
    }
  }

  setFallbackState(body);
  setInitialScrollVariables(documentLike);

  let forcedFallback = false;
  try {
    forcedFallback = new URLSearchParams(windowLike.location?.search ?? '')
      .has('forceWebglFallback');
  } catch {
    forcedFallback = true;
  }

  if (forcedFallback || !probeWebGL2(documentLike)) return createInertHandle();

  let canvas;
  try {
    canvas = createTargetCanvas(documentLike);
  } catch (error) {
    safelyReportError(error);
    return createInertHandle();
  }

  let active = true;
  let animationFrame = null;
  let previousFrameTime = null;
  let sectionModel = null;
  let world = null;
  let unbindRecovery = null;
  let viewportWidth = null;
  let viewportHeight = null;
  let reducedMotion = false;
  let finePointer = false;
  let pointer = null;
  const removeListeners = [];

  function stopLoop() {
    if (animationFrame !== null) {
      windowLike.cancelAnimationFrame?.(animationFrame);
      animationFrame = null;
    }
    previousFrameTime = null;
  }

  function removeAllListeners() {
    for (const remove of removeListeners.splice(0)) {
      try {
        remove();
      } catch {
        // Listener cleanup is best-effort during a fatal fallback.
      }
    }
    try {
      unbindRecovery?.();
    } catch {
      // Context-loss cleanup must not compromise the DOM fallback.
    }
    unbindRecovery = null;
  }

  function disposeWorld() {
    try {
      world?.dispose();
    } catch {
      // A lost context can make renderer disposal throw; the canvas is removed below.
    }
    world = null;
  }

  function settleIntoFallback(error, { report = true } = {}) {
    if (!active) return;
    active = false;
    setFallbackState(body);
    stopLoop();
    removeAllListeners();
    disposeWorld();
    try {
      canvas.remove();
    } catch {
      // The fallback hero and DOM remain usable even if canvas removal is unavailable.
    }
    if (error && report) safelyReportError(error);
  }

  function listen(target, type, listener, options) {
    target?.addEventListener?.(type, listener, options);
    removeListeners.push(() => target?.removeEventListener?.(type, listener, options));
  }

  function measure() {
    sectionModel = createScrollModel(measureSections(documentLike));
  }

  function updateScrollState() {
    const state = sampleScroll(sectionModel, finiteOr(windowLike.scrollY, 0));
    const style = documentLike.documentElement?.style;
    style?.setProperty('--ms-scroll', String(state.page));
    style?.setProperty('--ms-local', String(state.local));
    style?.setProperty('--ms-gather', String(state.gather));
    world.setScrollState(state);
    return state;
  }

  function resizeWorld() {
    measure();
    const width = Math.max(1, Math.round(finiteOr(windowLike.innerWidth, 1)));
    const height = Math.max(1, Math.round(finiteOr(windowLike.innerHeight, 1)));
    const changed = width !== viewportWidth || height !== viewportHeight;
    if (changed) {
      viewportWidth = width;
      viewportHeight = height;
      world.resize(width, height);
    }
    updateScrollState();
    return changed;
  }

  function scheduleFrame() {
    if (!active || reducedMotion || documentLike.hidden || animationFrame !== null) return;
    if (typeof windowLike.requestAnimationFrame !== 'function') {
      settleIntoFallback(new Error('requestAnimationFrame is unavailable.'));
      return;
    }
    animationFrame = windowLike.requestAnimationFrame(renderFrame);
  }

  function renderFrame(time, reschedule = true, allowHidden = false) {
    animationFrame = null;
    if (!active || (documentLike.hidden && !allowHidden)) return;

    try {
      if (finePointer) {
        pointer.step(calculateFrameDelta(previousFrameTime, time));
        world.setPointer(pointer.value());
      } else {
        world.setPointer({ x: 0, y: 0 });
      }
      previousFrameTime = finiteOr(time, 0);
      updateScrollState();
      world.render(finiteOr(time, 0));
    } catch (error) {
      settleIntoFallback(error);
      return;
    }

    if (reschedule) scheduleFrame();
  }

  function renderStaticFrame() {
    const now = finiteOr(windowLike.performance?.now?.(), 0);
    renderFrame(now, false, true);
  }

  function onLayoutChange() {
    if (!active) return;
    try {
      if (reducedMotion) {
        measure();
        updateScrollState();
      } else {
        resizeWorld();
      }
    } catch (error) {
      settleIntoFallback(error);
    }
  }

  function onReducedMotionScroll() {
    if (!active) return;
    try {
      updateScrollState();
    } catch (error) {
      settleIntoFallback(error);
    }
  }

  function onVisibilityChange() {
    if (!active || reducedMotion) return;
    try {
      if (documentLike.hidden) {
        stopLoop();
        world.pause();
      } else {
        world.resume();
        previousFrameTime = null;
        scheduleFrame();
      }
    } catch (error) {
      settleIntoFallback(error);
    }
  }

  function onPointerMove(event) {
    const width = Math.max(1, finiteOr(windowLike.innerWidth, 1));
    const height = Math.max(1, finiteOr(windowLike.innerHeight, 1));
    const x = (finiteOr(event?.clientX, width / 2) / width - 0.5) * 6;
    const y = (finiteOr(event?.clientY, height / 2) / height - 0.5) * -6;
    pointer.set(x, y);
  }

  function claimRestoreForSession() {
    let storage = null;
    try {
      storage = windowLike.sessionStorage;
    } catch {
      return false;
    }
    return claimContextRestore(storage);
  }

  try {
    reducedMotion = Boolean(windowLike.matchMedia?.(REDUCED_MOTION_QUERY)?.matches);
    finePointer = !reducedMotion
      && Boolean(windowLike.matchMedia?.(FINE_POINTER_QUERY)?.matches);
    pointer = createPointer({ damping: 0.2, maxDegrees: 3 });

    const tier = selectQuality({
      width: finiteOr(windowLike.innerWidth, 1),
      webgl2: true,
      reducedMotion,
      deviceMemory: windowLike.navigator?.deviceMemory,
      cores: windowLike.navigator?.hardwareConcurrency
    });
    const runtime = createRuntime({ maxRestores: 1 });

    measure();
    world = createWorld({
      canvas,
      tier,
      onFirstFrame() {
        if (!active) return;
        runtime.firstFrame();
        setReadyState(body);
      }
    });
    resizeWorld();

    unbindRecovery = bindRecovery(canvas, {
      onLost() {
        if (!active) return 'fallback';
        setFallbackState(body);
        stopLoop();
        try {
          world.pause();
        } catch {
          // The context is already lost; fallback state is the priority.
        }
        if (!claimRestoreForSession()) {
          runtime.fail();
          return 'fallback';
        }
        return runtime.contextLost();
      },
      onRestore() {
        runtime.contextRestored();
        try {
          windowLike.location.reload();
        } catch (error) {
          settleIntoFallback(error);
        }
      },
      onPermanentFailure() {
        runtime.fail();
        settleIntoFallback(null, { report: false });
      }
    });

    listen(windowLike, 'resize', onLayoutChange, { passive: true });
    listen(windowLike, 'load', onLayoutChange, { passive: true });
    listen(documentLike, 'visibilitychange', onVisibilityChange);
    if (finePointer) listen(windowLike, 'pointermove', onPointerMove, { passive: true });
    if (reducedMotion) listen(windowLike, 'scroll', onReducedMotionScroll, { passive: true });

    if (reducedMotion) renderStaticFrame();
    else scheduleFrame();
  } catch (error) {
    settleIntoFallback(error);
  }

  return Object.freeze({
    destroy() {
      settleIntoFallback(null, { report: false });
    },
    isActive() {
      return active;
    }
  });
}

if (typeof window !== 'undefined' && window.document?.body) {
  bootstrapMoonstone({ windowLike: window, documentLike: window.document });
}

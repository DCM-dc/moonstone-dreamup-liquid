import { measureSections } from './dom-sections.js';
import { createScrollModel, sampleScroll } from './timeline.js';

export const RESTORE_KEY = 'moonstone-webgl-restore-attempted';

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

function createInertHandle() {
  return Object.freeze({
    destroy() {},
    isActive() { return false; }
  });
}

function setInitialScrollVariables(documentLike) {
  const style = documentLike.documentElement?.style;
  style?.setProperty('--ms-scroll', '0');
  style?.setProperty('--ms-local', '0');
  style?.setProperty('--ms-gather', '0');
}

function setReadyState(body) {
  body.classList.add('moonstone-enhanced', 'moonstone-2d-ready');
  body.classList.remove('moonstone-webgl-ready', 'moonstone-webgl-fallback');
}

export function bootstrapMoonstone({
  windowLike = globalThis.window,
  documentLike = windowLike?.document
} = {}) {
  const body = documentLike?.body;
  if (!windowLike || !documentLike || !body) return createInertHandle();

  let active = true;
  let sectionModel = null;
  const removeListeners = [];

  function listen(target, type, listener, options) {
    target?.addEventListener?.(type, listener, options);
    removeListeners.push(() => target?.removeEventListener?.(type, listener, options));
  }

  function measure() {
    sectionModel = createScrollModel(measureSections(documentLike));
  }

  function updateScrollState() {
    if (!active || !sectionModel) return;
    const state = sampleScroll(sectionModel, finiteOr(windowLike.scrollY, 0));
    const style = documentLike.documentElement?.style;
    style?.setProperty('--ms-scroll', String(state.page));
    style?.setProperty('--ms-local', String(state.local));
    style?.setProperty('--ms-gather', String(state.gather));
  }

  function refreshLayout() {
    if (!active) return;
    measure();
    updateScrollState();
  }

  setReadyState(body);
  setInitialScrollVariables(documentLike);

  try {
    refreshLayout();
    listen(windowLike, 'scroll', updateScrollState, { passive: true });
    listen(windowLike, 'resize', refreshLayout, { passive: true });
    listen(windowLike, 'load', refreshLayout, { passive: true });
  } catch {
    sectionModel = null;
  }

  return Object.freeze({
    destroy() {
      if (!active) return;
      active = false;
      for (const remove of removeListeners.splice(0)) remove();
    },
    isActive() {
      return active;
    }
  });
}

if (typeof window !== 'undefined' && window.document?.body) {
  bootstrapMoonstone({ windowLike: window, documentLike: window.document });
}

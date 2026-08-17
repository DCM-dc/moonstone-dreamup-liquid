import { measureSections } from './dom-sections.js';
import { createScrollModel, sampleScroll } from './timeline.js';

export const RESTORE_KEY = 'moonstone-webgl-restore-attempted';

const MAX_FRAME_DELTA_SECONDS = 0.1;
const REGISTRATION_BUTTON_SELECTOR = '.register-fab, .hero .button-primary, .join .button-primary';
const REGISTRATION_LABEL = '抢先登记';
const INERT_REGISTRATION_LABEL = '立即报名';

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

function replaceRegistrationLabel(node) {
  for (const child of node?.childNodes ?? []) {
    if (child.nodeType === 3) {
      const nextLabel = child.textContent
        ?.replace(/\s*30\s*秒\s*/g, '')
        .replace(REGISTRATION_LABEL, INERT_REGISTRATION_LABEL);
      if (nextLabel !== child.textContent) child.textContent = nextLabel;
      continue;
    }
    replaceRegistrationLabel(child);
  }
}

function neutralizeRegistrationButtons(documentLike) {
  const buttons = documentLike.querySelectorAll?.(REGISTRATION_BUTTON_SELECTOR) ?? [];
  for (const button of buttons) {
    replaceRegistrationLabel(button);
    if (!button.disabled) button.disabled = true;
    button.setAttribute?.('aria-disabled', 'true');
    button.setAttribute?.('data-moonstone-inert-registration', 'true');
  }
}

function blockRegistration(event) {
  const button = event.target?.closest?.(REGISTRATION_BUTTON_SELECTOR);
  if (!button) return;
  event.preventDefault?.();
  event.stopPropagation?.();
  event.stopImmediatePropagation?.();
}

function installRegistrationBlocker(documentLike) {
  documentLike.addEventListener?.('click', blockRegistration, true);
  return () => documentLike.removeEventListener?.('click', blockRegistration, true);
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

  function restoreReadyState() {
    if (!active) return;
    const classList = body.classList;
    if (
      !classList.contains('moonstone-enhanced') ||
      !classList.contains('moonstone-2d-ready')
    ) {
      setReadyState(body);
    }
  }

  setReadyState(body);
  setInitialScrollVariables(documentLike);
  neutralizeRegistrationButtons(documentLike);

  const MutationObserverLike = windowLike.MutationObserver;
  if (typeof MutationObserverLike === 'function') {
    const observer = new MutationObserverLike((records) => {
      if (!active) return;
      neutralizeRegistrationButtons(documentLike);
      if (records.some((record) => record.type === 'attributes'
        && record.attributeName === 'class'
        && record.target === body)) {
        restoreReadyState();
      }
    });
    observer.observe(body, {
      attributes: true,
      attributeFilter: ['class', 'disabled'],
      childList: true,
      subtree: true,
      characterData: true
    });
    removeListeners.push(() => observer.disconnect());
  }

  try {
    refreshLayout();
    listen(documentLike, 'click', blockRegistration, true);
    listen(windowLike, 'scroll', updateScrollState, { passive: true });
    listen(windowLike, 'resize', refreshLayout, { passive: true });
    listen(windowLike, 'load', refreshLayout, { passive: true });
    listen(windowLike, 'load', () => neutralizeRegistrationButtons(documentLike), { passive: true });
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

export function scheduleMoonstoneBootstrap({
  windowLike = globalThis.window,
  documentLike = windowLike?.document
} = {}) {
  if (!windowLike || !documentLike?.body) return createInertHandle();

  let active = true;
  let handle = null;
  let removeEarlyBlocker = () => {};

  function start() {
    if (!active || handle) return;
    handle = bootstrapMoonstone({ windowLike, documentLike });
  }

  function onLoad() {
    windowLike.removeEventListener?.('load', onLoad);
    removeEarlyBlocker();
    start();
  }

  if (documentLike.readyState === 'complete') {
    start();
  } else {
    removeEarlyBlocker = installRegistrationBlocker(documentLike);
    windowLike.addEventListener?.('load', onLoad, { once: true });
  }

  return Object.freeze({
    destroy() {
      if (!active) return;
      active = false;
      windowLike.removeEventListener?.('load', onLoad);
      removeEarlyBlocker();
      handle?.destroy();
    },
    isActive() {
      return active && Boolean(handle?.isActive());
    }
  });
}

if (typeof window !== 'undefined' && window.document?.body) {
  scheduleMoonstoneBootstrap({ windowLike: window, documentLike: window.document });
}

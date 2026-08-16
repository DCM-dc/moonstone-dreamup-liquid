import { expect, it, vi } from 'vitest';
import { bindContextRecovery, createRuntimeState } from '../enhancement-src/src/runtime-state.js';

it('keeps fallback visible until a valid frame and permanently falls back after repeated loss', () => {
  const state = createRuntimeState({ maxRestores: 1 });
  expect(state.snapshot()).toMatchObject({ phase: 'fallback', restoreCount: 0 });
  state.firstFrame();
  expect(state.snapshot().phase).toBe('ready');
  expect(state.contextLost()).toBe('restore');
  state.contextRestored();
  expect(state.contextLost()).toBe('fallback');
  expect(state.snapshot().phase).toBe('failed');
});

it('binds context loss and restore callbacks and removes listeners on cleanup', () => {
  const canvas = new EventTarget();
  const onLost = vi.fn(() => 'restore');
  const onRestore = vi.fn();
  const onPermanentFailure = vi.fn();
  const unbind = bindContextRecovery(canvas, { onLost, onRestore, onPermanentFailure });

  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  expect(onLost).toHaveBeenCalledTimes(1);
  expect(onRestore).toHaveBeenCalledTimes(1);
  expect(onPermanentFailure).not.toHaveBeenCalled();

  unbind();
  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  expect(onLost).toHaveBeenCalledTimes(1);
});

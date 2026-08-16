export function createRuntimeState({ maxRestores = 1 } = {}) {
  let phase = 'fallback';
  let restoreCount = 0;
  return {
    firstFrame() { if (phase !== 'failed') phase = 'ready'; },
    contextLost() {
      if (restoreCount >= maxRestores) { phase = 'failed'; return 'fallback'; }
      restoreCount += 1;
      phase = 'restoring';
      return 'restore';
    },
    contextRestored() { if (phase === 'restoring') phase = 'fallback'; },
    fail() { phase = 'failed'; },
    snapshot() { return { phase, restoreCount }; }
  };
}

export function bindContextRecovery(canvas, { onLost, onRestore, onPermanentFailure }) {
  let awaitingRestore = false;
  const lost = event => {
    event.preventDefault();
    awaitingRestore = onLost() === 'restore';
    if (!awaitingRestore) onPermanentFailure();
  };
  const restored = () => { if (awaitingRestore) { awaitingRestore = false; onRestore(); } };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  return () => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
  };
}

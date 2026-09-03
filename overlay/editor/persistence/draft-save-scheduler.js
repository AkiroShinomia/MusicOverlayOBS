(function registerDraftSaveScheduler(root) {
  "use strict";

  function create(save, delayMs = 350) {
    let timer = null;
    let pending = null;
    let inFlight = null;
    let stopped = false;

    function schedule(snapshot) {
      if (stopped) return;
      pending = snapshot;
      clearTimeout(timer);
      timer = setTimeout(() => { void flush(); }, delayMs);
    }

    async function drain() {
      while (!stopped && pending != null) {
        const snapshot = pending;
        pending = null;
        await save(snapshot);
      }
    }

    async function flush() {
      clearTimeout(timer);
      timer = null;
      if (stopped) return;
      if (!inFlight) {
        inFlight = drain().finally(() => { inFlight = null; });
      }
      await inFlight;
      if (pending != null && !stopped) await flush();
    }

    function cancel() {
      clearTimeout(timer);
      timer = null;
      pending = null;
    }

    function stop() {
      stopped = true;
      cancel();
    }

    return Object.freeze({ schedule, flush, cancel, stop });
  }

  root.editor.persistence.draftSaveScheduler = Object.freeze({ create });
})(window.MusicOverlay);

(function registerDraftSaveScheduler(root) {
  "use strict";

  function create(save, delayMs = 350) {
    let timer = null;
    let pending = null;
    function schedule(snapshot) {
      pending = snapshot;
      clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    }
    async function flush() {
      clearTimeout(timer);
      timer = null;
      if (pending == null) return;
      const snapshot = pending;
      pending = null;
      await save(snapshot);
    }
    function cancel() { clearTimeout(timer); timer = null; pending = null; }
    return Object.freeze({ schedule, flush, cancel });
  }

  root.editor.persistence.draftSaveScheduler = Object.freeze({ create });
})(window.MusicOverlay);

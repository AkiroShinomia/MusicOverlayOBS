(function registerSnapshotHistory(root) {
  "use strict";

  root.editor ||= {};
  root.editor.history ||= {};

  function create(sceneStore, sessionStore, options = {}) {
    const limit = Math.max(2, Number(options.limit) || 100);
    const coalesceMs = Math.max(0, Number(options.coalesceMs) || 350);
    let undoStack = [];
    let redoStack = [];
    let suspended = false;
    let lastAt = 0;

    const serialize = () => JSON.stringify(sceneStore.getSnapshot());

    function reset() {
      undoStack = [serialize()];
      redoStack = [];
      lastAt = 0;
    }

    function record(force = false) {
      if (suspended) return;
      const snapshot = serialize();
      if (!undoStack.length) {
        reset();
        return;
      }
      if (undoStack.at(-1) === snapshot) return;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (!force && undoStack.length > 1 && now - lastAt < coalesceMs) {
        undoStack[undoStack.length - 1] = snapshot;
      } else {
        undoStack.push(snapshot);
      }
      if (undoStack.length > limit) undoStack.shift();
      redoStack = [];
      lastAt = now;
    }

    function restore(serialized) {
      suspended = true;
      try {
        sceneStore.dispatch({ type: "history.replace", payload: { scene: JSON.parse(serialized) } });
        const scene = sceneStore.getSnapshot();
        sessionStore.ensureValidSelection(scene, root.editor.state.selectors);
      } finally {
        suspended = false;
      }
    }

    function undo() {
      if (undoStack.length < 2) return false;
      redoStack.push(undoStack.pop());
      restore(undoStack.at(-1));
      return true;
    }

    function redo() {
      if (!redoStack.length) return false;
      const snapshot = redoStack.pop();
      undoStack.push(snapshot);
      restore(snapshot);
      return true;
    }

    return Object.freeze({
      reset,
      record,
      undo,
      redo,
      canUndo: () => undoStack.length > 1,
      canRedo: () => redoStack.length > 0
    });
  }

  root.editor.history.snapshotHistory = Object.freeze({ create });
})(window.MusicOverlay);

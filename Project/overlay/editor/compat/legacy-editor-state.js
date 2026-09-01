(function registerLegacyEditorState(root) {
  "use strict";

  let currentConfig = null;
  let revision = 0;
  const listeners = new Set();

  function notify(reason) {
    revision += 1;
    const event = Object.freeze({ revision, reason: reason || "replace" });
    for (const listener of listeners) listener(event);
  }

  const api = {
    initialize(snapshot) {
      currentConfig = snapshot;
      revision = 0;
    },
    getSnapshot() {
      return currentConfig == null ? null : structuredClone(currentConfig);
    },
    replace(snapshot, reason = "replace") {
      currentConfig = snapshot;
      notify(reason);
      return currentConfig;
    },
    mutate(reason, mutation) {
      if (typeof mutation !== "function") throw new TypeError("Mutation must be a function");
      mutation(currentConfig);
      notify(reason || "mutation");
      return currentConfig;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get revision() { return revision; }
  };

  // Temporary Stage 2E bridge for mechanically extracted legacy controllers.
  // Stage 2F removes this property after controllers move to canonical Scene commands.
  Object.defineProperty(api, "value", {
    get() { return currentConfig; },
    set(snapshot) { api.replace(snapshot, "legacy-assignment"); }
  });

  root.compat.legacyEditorState = Object.freeze(api);
})(window.MusicOverlay);

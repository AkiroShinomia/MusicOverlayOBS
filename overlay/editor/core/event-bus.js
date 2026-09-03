(function registerEventBus(root) {
  "use strict";

  function createEventBus() {
    const listeners = new Map();

    function subscribe(type, listener) {
      if (typeof listener !== "function") throw new TypeError("Event listener must be a function");
      const bucket = listeners.get(type) || new Set();
      bucket.add(listener);
      listeners.set(type, bucket);
      return () => bucket.delete(listener);
    }

    function publish(type, payload) {
      for (const listener of listeners.get(type) || []) listener(payload);
    }

    function clear() {
      listeners.clear();
    }

    return Object.freeze({ subscribe, publish, clear });
  }

  root.core.eventBus = Object.freeze({ create: createEventBus });
})(window.MusicOverlay);

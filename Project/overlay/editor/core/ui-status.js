(function registerUiStatus(root) {
  "use strict";

  function create(element) {
    return Object.freeze({
      show(message, type = "") {
        if (!element) return;
        element.textContent = message;
        element.className = `status ${type}`.trim();
      }
    });
  }

  root.core.uiStatus = Object.freeze({ create });
})(window.MusicOverlay);

(function startMusicOverlayEditor(root) {
  "use strict";
  if (!root?.editor?.bootstrap?.start) {
    throw new Error("MusicOverlay editor bootstrap is unavailable");
  }
  root.editor.bootstrap.start();
})(window.MusicOverlay);

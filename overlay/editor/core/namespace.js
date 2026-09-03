(function initializeMusicOverlayNamespace(global) {
  "use strict";

  const root = global.MusicOverlay ||= {};
  root.core ||= {};
  root.compat ||= {};
  root.api ||= {};
  root.editor ||= {};
  root.editor.infrastructure ||= {};
  root.editor.inspector ||= {};
  root.editor.canvas ||= {};
  root.editor.library ||= {};
  root.editor.timeline ||= {};
  root.editor.themes ||= {};
  root.editor.preview ||= {};
  root.editor.persistence ||= {};
  root.editor.history ||= {};
})(window);

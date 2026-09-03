(function registerLegacyFormProjection(root) {
  "use strict";

  root.editor ||= {};
  root.editor.compat ||= {};

  const state = root.compat.legacyEditorState;
  state.initialize(structuredClone(defaultConfig));

  function normalize(config) {
    const next = structuredClone(config || {});
    next.layout = normalizeLayout(next.layout, next);
    return next;
  }

  function fromScene(scene, settings = null) {
    const effectiveSettings = settings || root.editor.context?.getSettings?.() || { audio: { sourceMode: "auto" } };
    const config = normalize(SceneEditorModel.fromScene(scene, effectiveSettings, defaultConfig));
    state.replace(config, "scene-projection");
    return structuredClone(config);
  }

  function getSnapshot() {
    return state.getSnapshot();
  }

  function replace(config, reason = "form-projection") {
    const next = normalize(config);
    state.replace(next, reason);
    return structuredClone(next);
  }

  function setThemePreset(preset) {
    state.mutate("theme-preset", config => {
      if (!config) return;
      config.theme ||= {};
      config.theme.preset = preset || "Custom";
    });
  }

  root.editor.compat.legacyFormProjection = Object.freeze({
    fromScene,
    getSnapshot,
    replace,
    setThemePreset
  });
})(window.MusicOverlay);

(function registerEditorSessionStore(root) {
  "use strict";

  root.editor ||= {};
  root.editor.state ||= {};

  function create(initial = {}) {
    let state = {
      selection: null,
      expandedGroups: new Set(),
      viewport: { zoom: 1, panX: 0, panY: 0 },
      playheadMs: 0,
      playback: { playing: false },
      activePanels: { left: "inspector", right: "library" },
      transientDrag: null,
      persistence: { pending: false, saving: false, error: null },
      ...initial
    };
    const listeners = new Set();

    const snapshot = () => ({
      ...state,
      expandedGroups: new Set(state.expandedGroups || []),
      viewport: { ...(state.viewport || {}) },
      playback: { ...(state.playback || {}) },
      activePanels: { ...(state.activePanels || {}) },
      persistence: { ...(state.persistence || {}) },
      theme: state.theme ? {
        ...state.theme,
        available: [...(state.theme.available || [])],
        loaded: { ...(state.theme.loaded || {}) }
      } : state.theme,
      live: state.live ? {
        ...state.live,
        trackData: state.live.trackData ? {
          ...state.live.trackData,
          audioBins: [...(state.live.trackData.audioBins || [])],
          audioBinsByPreset: { ...(state.live.trackData.audioBinsByPreset || {}) }
        } : state.live.trackData
      } : state.live,
      websocket: state.websocket ? { ...state.websocket } : state.websocket,
      controllers: state.controllers ? { ...state.controllers } : state.controllers,
      customLibraryAssets: [...(state.customLibraryAssets || [])]
    });

    function patch(next) {
      state = { ...state, ...next };
      const value = snapshot();
      listeners.forEach(listener => listener(value));
      return value;
    }

    function ensureValidSelection(scene, selectors) {
      const current = state.selection;
      if (current?.id && selectors.nodeById(scene, current.id)) return current;
      const fallback = selectors.rootNodes(scene)[0] || scene?.nodes?.[0] || null;
      const selection = fallback ? { type: fallback.nodeType, id: fallback.id } : null;
      patch({ selection });
      return selection;
    }

    return Object.freeze({
      getSnapshot: snapshot,
      patch,
      setSelection: selection => patch({ selection }),
      ensureValidSelection,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    });
  }

  root.editor.state.editorSessionStore = Object.freeze({ create });
})(window.MusicOverlay);

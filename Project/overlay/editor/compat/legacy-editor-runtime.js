(function registerLegacyEditorRuntime(root) {
  "use strict";

  // Shared session-only state used by the mechanically extracted Stage 2E controllers.
  // It is intentionally separate from the composition document and is removed/replaced
  // by EditorSessionStore and SceneStore during Stage 2F.
  root.compat.editorRuntime = {
    editorSocket: null,
    editorSocketRetry: null,
    currentDefaultCover: "/assets/default-cover.png",
    currentLiveCover: "",
    availableThemes: [],
    loadedThemes: {},
    activeThemeId: null,
    activeThemeType: null,
    themeDirty: false,
    selection: { type: "group", id: "full-card-group" },
    collapsedGroups: new Set(),
    previewTimeMs: 1500,
    timelineDurationMs: 30000,
    canvasScale: 1,
    canvasController: null,
    timelineController: null,
    workspaceController: null,
    previewSceneRenderer: null,
    previewSceneRevision: 0,
    previewTrackData: null,
    playbackFrame: null,
    playbackStartedAt: 0,
    playbackOffset: 0,
    currentLanguage: "ru",
    customLibraryAssets: [],
    undoStack: [],
    redoStack: [],
    historySuspended: false,
    historyLastRecordedAt: 0
  };
})(window.MusicOverlay);

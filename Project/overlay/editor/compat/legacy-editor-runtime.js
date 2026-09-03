(function registerLegacyEditorRuntime(root) {
  "use strict";

  // Temporary UI/runtime compatibility projection for extracted controllers.
  // Persistent composition state lives exclusively in SceneStore; canonical session
  // state lives in EditorSessionStore. This object contains compatibility handles only.
  root.compat.editorRuntime = {
    editorSocket: null,
    editorSocketRetry: null,
    currentDefaultCover: "/assets/default-cover.png",
    currentLiveCover: "",
    canvasController: null,
    timelineController: null,
    workspaceController: null,
    previewSceneRenderer: null,
    previewSceneRevision: 0,
    previewTrackData: null,
    currentLanguage: "ru"
  };
})(window.MusicOverlay);

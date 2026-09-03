function setWebSocketStatus(connected) {
  const status = $("wsStatus");
  status.classList.toggle("is-online", connected);
  status.classList.toggle("is-offline", !connected);
  status.querySelector("span").textContent = connected
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "WS подключён" : "WS connected")
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "WS отключён" : "WS offline");
}

function connectEditorWebSocket() {
  clearTimeout(MusicOverlay.compat.editorRuntime.editorSocketRetry);
  try {
    MusicOverlay.compat.editorRuntime.editorSocket = MusicOverlay.api.live.connectEvents({
      open: () => setWebSocketStatus(true),
      message: async event => {
        let message = event.data;
        try { message = JSON.parse(event.data)?.type || event.data; } catch {}
        if (message === "themesChanged") await loadThemes();
      },
      close: () => {
        setWebSocketStatus(false);
        MusicOverlay.compat.editorRuntime.editorSocketRetry = setTimeout(connectEditorWebSocket, 2000);
      },
      error: () => MusicOverlay.compat.editorRuntime.editorSocket.close()
    });
  } catch {
    setWebSocketStatus(false);
    MusicOverlay.compat.editorRuntime.editorSocketRetry = setTimeout(connectEditorWebSocket, 2000);
  }
}

async function loadConfig() {
  try {
    const [draftResponse, publishedResponse, settingsResponse] = await Promise.all([
      MusicOverlay.api.scenes.getDraft(),
      MusicOverlay.api.scenes.getPublished(),
      MusicOverlay.api.scenes.getSettings()
    ]);
    if (!draftResponse.ok || !publishedResponse.ok || !settingsResponse.ok) throw new Error("Scene v2 workspace is unavailable");
    const [scene, published, settings] = await Promise.all([
      draftResponse.json(),
      publishedResponse.json(),
      settingsResponse.json()
    ]);
    MusicOverlay.editor.context.initialize(scene, published, settings);
    const legacyProjection = MusicOverlay.editor.compat.legacyFormProjection.fromScene(scene, settings);
    MusicOverlay.compat.editorRuntime.currentDefaultCover = scene.appearance?.albumArt?.defaultCover || DEFAULT_COVER;
    fillGlobalForm(legacyProjection);
    const meta = getCurrentThemeMeta();
    patchThemeSession({
      activeId: meta?.id || scene.metadata?.sourceThemeId || null,
      activeType: meta?.type || scene.metadata?.themeType || null,
      dirty: false
    });
    updateThemeControls();
    updateEditor();
    resetHistory();
    setStatus(
      MusicOverlay.compat.editorRuntime.currentLanguage === "ru"
        ? "Scene v2 загружена"
        : "Scene v2 loaded",
      "success"
    );
  } catch (error) {
    console.error(error);
    setStatus("Не удалось прочитать Scene v2.", "error");
  }
}

async function saveConfig() {
  try {
    const legacy = readGlobalForm();
    const scene = MusicOverlay.editor.context.sceneStore.getSnapshot();
    const appearance = scene.appearance || {};
    MusicOverlay.editor.context.commit({
      type: "scene.appearance",
      payload: {
        patch: {
          colors: { ...(appearance.colors || {}), ...(legacy.colors || {}) },
          font: { ...(appearance.font || {}), ...(legacy.font || {}) },
          albumArt: { ...(appearance.albumArt || {}), ...(legacy.albumArt || {}) },
          ticker: { ...(appearance.ticker || {}), ...(legacy.ticker || {}) },
          fullCard: { ...(appearance.fullCard || {}), ...(legacy.fullCard || {}) },
          vinyl: { ...(appearance.vinyl || {}), ...(legacy.vinyl || {}) },
          particles: { ...(appearance.particles || {}), ...(legacy.particles || {}) },
          equalizer: { ...(appearance.equalizer || {}), ...(legacy.equalizer || {}) }
        }
      }
    }, { forceHistory: true });
    MusicOverlay.editor.context.updateSettings({ audio: legacy.audio || { sourceMode: "auto" } });
    const result = await MusicOverlay.editor.context.apply();

    if (!result.ok) throw new Error("Ошибка сохранения.");
    patchThemeSession({ dirty: false });
    updateThemeControls();
    updateHistoryControls();
    setStatus("Применено · OBS обновлён через WebSocket", "success");
  } catch (error) {
    console.error(error);
    setStatus("Ошибка публикации Scene v2", "error");
  }
}

async function updateAudioStatus() {
  try {
    const [audioResponse, nowPlayingResponse] = await Promise.all([
      MusicOverlay.api.live.getAudioLevel(),
      MusicOverlay.api.live.getNowPlaying()
    ]);
    const [data, nowPlaying] = await Promise.all([audioResponse.json(), nowPlayingResponse.json()]);
    $("captureStatusMode").textContent = data.captureMode || "—";
    $("captureStatusSource").textContent = data.sourceAppId || "—";
    $("captureStatusPid").textContent = data.processId || "—";
    $("captureStatusError").textContent = data.processCaptureError || "none";
    $("liveTrackTitle").textContent = nowPlaying.hasTrack ? nowPlaying.title || t("noActiveTrack") : t("noActiveTrack");
    $("liveTrackArtist").textContent = nowPlaying.hasTrack ? nowPlaying.artist || "—" : "—";
    MusicOverlay.compat.editorRuntime.currentLiveCover = nowPlaying.thumbnail || "";
    MusicOverlay.compat.editorRuntime.previewTrackData = {
      ...MusicOverlay.compat.editorRuntime.previewTrackData,
      title: nowPlaying.hasTrack ? nowPlaying.title || MusicOverlay.compat.editorRuntime.previewTrackData.title : MusicOverlay.compat.editorRuntime.previewTrackData.title,
      artist: nowPlaying.hasTrack ? nowPlaying.artist || MusicOverlay.compat.editorRuntime.previewTrackData.artist : MusicOverlay.compat.editorRuntime.previewTrackData.artist,
      position: Number(nowPlaying.position) || 0,
      duration: Number(nowPlaying.duration) || MusicOverlay.compat.editorRuntime.previewTrackData.duration,
      thumbnail: MusicOverlay.compat.editorRuntime.currentLiveCover || MusicOverlay.compat.editorRuntime.currentDefaultCover || DEFAULT_COVER
    };
    $("liveCoverPreview").src = MusicOverlay.compat.editorRuntime.currentLiveCover || MusicOverlay.compat.editorRuntime.currentDefaultCover || DEFAULT_COVER;
    MusicOverlay.compat.editorRuntime.previewSceneRenderer?.setData(MusicOverlay.compat.editorRuntime.previewTrackData);
  } catch {}
}

function setupEvents() {
  const selectionCard = $("inspectorPane").querySelector(".selection-card");
  if (selectionCard && $("contextualSettings")) selectionCard.after($("contextualSettings"));
  const inspectorIds = [
    "inspectorName", "inspectorVisible", "inspectorLocked", "inspectorGroup", "inspectorMarker", "inspectorX", "inspectorY",
    "inspectorScale", "inspectorStart", "inspectorEnd", "inspectorUntilNext", "inspectorOpacity", "inspectorBlur",
    "inspectorGlow", "inspectorOverrideChildren", "inspectorEnter", "inspectorExit", "inspectorEnterDuration", "inspectorEnterEasing",
    "inspectorExitDuration", "inspectorExitEasing"
  ];
  inspectorIds.forEach(id => $(id).addEventListener("input", updateSelectedFromInspector));

  document.querySelectorAll(".legacy-section input, .legacy-section select").forEach(input => {
    if (["themePreset", "customThemeName", "defaultCoverFile"].includes(input.id)) return;
    input.addEventListener("input", () => {
      if (input.id === "fftPreset") applyFftPresetToForm(input.value);
      if (manualFftFields.has(input.id)) $("fftPreset").value = "custom";
      const legacyProjection = MusicOverlay.editor.compat.legacyFormProjection.replace(readGlobalForm(), "global-form-input");
      MusicOverlay.editor.compat.builtinV2Rules.applyLegacyInput(input.id, legacyProjection);
      markThemeDirty();
      updateThemeControls();
      updateEditor();
      updateHistoryControls();
    });
  });

  $("themePreset").addEventListener("change", applyThemePreset);
  $("saveThemeBtn").addEventListener("click", openThemeSaveDialog);
  $("deleteThemeBtn").addEventListener("click", deleteSelectedTheme);
  $("themeSaveDialog").querySelector("form").addEventListener("submit", confirmThemeSave);
  document.querySelectorAll('[name="themeSaveMode"]').forEach(input => input.addEventListener("change", refreshThemeSaveDialog));
  $("inspectorTab").addEventListener("click", () => activateSidebarPane("inspector"));
  $("globalSettingsTab").addEventListener("click", () => activateSidebarPane("global"));
  $("languageSelect").addEventListener("change", event => setEditorLanguage(event.target.value));
  $("undoBtn").addEventListener("click", undoEditor);
  $("redoBtn").addEventListener("click", redoEditor);
  document.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) redoEditor(); else undoEditor();
    } else if (key === "y") {
      event.preventDefault();
      redoEditor();
    }
  });
  $("uploadLibraryObjectBtn").addEventListener("click", () => $("libraryObjectFile").click());
  $("libraryObjectFile").addEventListener("change", uploadLibraryObject);
  $("saveBtn").addEventListener("click", saveConfig);
  $("resetBtn").addEventListener("click", async () => {
    try {
      const response = await MusicOverlay.api.scenes.getDefault();
      if (!response.ok) throw new Error("Default Scene is unavailable");
      const scene = await response.json();
      MusicOverlay.editor.context.replaceScene(scene, { forceHistory: true, themeDirty: true });
      const settings = MusicOverlay.editor.context.getSettings();
      const legacyProjection = MusicOverlay.editor.compat.legacyFormProjection.fromScene(scene, settings);
      MusicOverlay.compat.editorRuntime.currentDefaultCover = scene.appearance?.albumArt?.defaultCover || DEFAULT_COVER;
      storeCanvasBackground(scene.canvas?.backgroundColor || DEFAULT_CANVAS_BACKGROUND);
      MusicOverlay.editor.context.sessionStore.patch({ playheadMs: Math.min(1500, Number(scene.timeline?.durationMs || 30000)) });
      fillGlobalForm(legacyProjection);
      updateEditor();
      updateHistoryControls();
      setStatus("Defaults восстановлены. Нажмите «Применить».");
    } catch (error) {
      console.error(error);
      setStatus("Не удалось восстановить defaults.", "error");
    }
  });

  $("defaultCoverFile").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    MusicOverlay.compat.editorRuntime.currentDefaultCover = await fileToBase64(file);
    const scene = MusicOverlay.editor.context.sceneStore.getSnapshot();
    const albumArt = { ...(scene.appearance?.albumArt || {}), defaultCover: MusicOverlay.compat.editorRuntime.currentDefaultCover };
    MusicOverlay.editor.context.commit({
      type: "scene.appearance",
      payload: { patch: { albumArt } }
    }, { forceHistory: true });
    $("defaultCoverPreview").src = MusicOverlay.compat.editorRuntime.currentDefaultCover;
    updatePreview(MusicOverlay.editor.context.sceneStore.getSnapshot());
    updateHistoryControls();
  });

  $("playTimelineBtn").addEventListener("click", startTimelinePlayback);
  $("stopTimelineBtn").addEventListener("click", () => stopTimelinePlayback(true));
  $("canvasBackgroundColor").addEventListener("input", event => {
    const color = event.target.value;
    MusicOverlay.editor.context.commit({
      type: "scene.canvas",
      payload: { patch: { backgroundColor: color } }
    });
    $("canvasSurface").style.backgroundColor = color;
    storeCanvasBackground(color);
    applyLayoutToPreview();
    updateHistoryControls();
  });
  $("compositionDurationSec").addEventListener("input", updateCompositionDuration);
  $("compositionDurationSec").addEventListener("change", updateCompositionDuration);
  $("addGroupBtn").addEventListener("click", addGroup);
  $("deleteGroupBtn").addEventListener("click", deleteSelectedGroup);

  document.querySelectorAll("[data-library-layer]").forEach(button => {
    button.addEventListener("click", () => selectItem("layer", button.dataset.libraryLayer));
  });
  document.querySelectorAll("[data-animation-preset]").forEach(button => {
    button.addEventListener("click", () => applyAnimationPreset(button.dataset.animationPreset));
  });

  setupCanvasDragging();
  setupSelectionResizing();
  setupTimelineLibraryDropZone();
  MusicOverlay.compat.editorRuntime.canvasController = MusicOverlay.editor.infrastructure.createCanvasController({
    viewport: $("canvasViewport"), surface: $("canvasSurface"), zoomInput: $("canvasZoom"),
    worldWidth: 1920, worldHeight: 1080,
    onScaleChange: nextScale => {
      MusicOverlay.editor.context.sessionStore.patch({ canvasScale: nextScale });
      updateSelectionBounds();
    }
  });
  MusicOverlay.compat.editorRuntime.canvasController.attach();
  MusicOverlay.compat.editorRuntime.timelineController = MusicOverlay.editor.infrastructure.createTimelineController({
    surface: document.querySelector(".timeline-scroll"), ruler: $("timelineRuler"),
    getDuration: () => MusicOverlay.editor.state.uiAdapters.timelineDurationMs(),
    setTime: setPreviewTime,
    stopPlayback: () => stopTimelinePlayback(false)
  });
  MusicOverlay.compat.editorRuntime.timelineController.attach();
  MusicOverlay.compat.editorRuntime.workspaceController = MusicOverlay.editor.infrastructure.createWorkspaceController({
    root: document.querySelector(".editor-grid"),
    onResize: () => MusicOverlay.compat.editorRuntime.canvasController?.fit()
  });
  MusicOverlay.compat.editorRuntime.workspaceController.attach();
  initializeScenePreviewRenderer();
}


function startEditor() {
  setInterval(() => {
    const sampleTime = Date.now();
    MusicOverlay.compat.editorRuntime.previewTrackData.audioBins = Array.from({ length: 128 }, (_, index) => {
      const slow = (Math.sin(sampleTime / 210 + index * .23) + 1) / 2;
      const fast = (Math.sin(sampleTime / 83 + index * .61) + 1) / 2;
      return .05 + slow * .38 + fast * .34;
    });
    MusicOverlay.compat.editorRuntime.previewTrackData.audioBinsByPreset = Object.fromEntries(
      (FftPresetApi?.options || []).map(option => [option.value, MusicOverlay.compat.editorRuntime.previewTrackData.audioBins])
    );
    MusicOverlay.compat.editorRuntime.previewSceneRenderer?.setData(MusicOverlay.compat.editorRuntime.previewTrackData);
  }, 120);
  
  loadEditorLanguage();
  populateFftPresetSelect($("fftPreset"));
  loadCustomLibraryAssets();
  renderLibrary();
  setupEvents();
  applyEditorLanguage();
  connectEditorWebSocket();
  if (MusicOverlay.editor.context?.isInitialized()) renderInspector();
  fitCanvas();
  setInterval(updateAudioStatus, 1200);
  updateAudioStatus();
  
  (async () => {
    await loadThemes();
    await loadConfig();
    requestAnimationFrame(fitCanvas);
  })();
}

MusicOverlay.editor.bootstrap = Object.freeze({ start: startEditor, loadConfig, saveConfig, updateAudioStatus, connectEditorWebSocket });

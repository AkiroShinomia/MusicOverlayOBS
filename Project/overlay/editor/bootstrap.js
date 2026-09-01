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
    const [sceneResponse, settingsResponse] = await Promise.all([
      MusicOverlay.api.scenes.getDraft(),
      MusicOverlay.api.scenes.getSettings()
    ]);
    if (!sceneResponse.ok || !settingsResponse.ok) throw new Error("Scene v2 workspace is unavailable");
    const [scene, settings] = await Promise.all([sceneResponse.json(), settingsResponse.json()]);
    MusicOverlay.compat.legacyEditorState.value = SceneEditorModel.fromScene(scene, settings, defaultConfig);
    MusicOverlay.compat.legacyEditorState.value.layout = normalizeLayout(MusicOverlay.compat.legacyEditorState.value.layout, MusicOverlay.compat.legacyEditorState.value);
    fillGlobalForm(MusicOverlay.compat.legacyEditorState.value);
    const meta = getCurrentThemeMeta();
    MusicOverlay.compat.editorRuntime.activeThemeId = meta?.id || null;
    MusicOverlay.compat.editorRuntime.activeThemeType = meta?.type || null;
    MusicOverlay.compat.editorRuntime.themeDirty = false;
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
    MusicOverlay.compat.legacyEditorState.value = structuredClone(defaultConfig);
    fillGlobalForm(MusicOverlay.compat.legacyEditorState.value);
    updateEditor();
    resetHistory();
    setStatus("Не удалось прочитать Scene v2 — используются defaults.", "error");
  }
}

async function saveConfig() {
  MusicOverlay.compat.legacyEditorState.value = readGlobalForm();
  MusicOverlay.compat.legacyEditorState.value.layout = normalizeLayout(MusicOverlay.compat.legacyEditorState.value.layout, MusicOverlay.compat.legacyEditorState.value);
  syncLegacyFromLayout();
  try {
    const scene = SceneEditorModel.toScene(MusicOverlay.compat.legacyEditorState.value, {
      id: "workspace-draft",
      name: "Draft",
      themeType: "workspace",
      sourceThemeId: MusicOverlay.compat.legacyEditorState.value.theme?.preset || "Custom"
    });
    const response = await MusicOverlay.api.scenes.publish({ scene, settings: { audio: MusicOverlay.compat.legacyEditorState.value.audio } });
    const result = await response.json();
    if (!result.ok) throw new Error("Ошибка сохранения.");
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
    MusicOverlay.compat.legacyEditorState.value.layout.layers.filter(layer => layer.kind === "image" && !layer.assetData).forEach(layer => {
      const node = getPreviewLayerNode(layer);
      if (node) node.src = MusicOverlay.compat.editorRuntime.currentLiveCover || MusicOverlay.compat.editorRuntime.currentDefaultCover || DEFAULT_COVER;
    });
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
      MusicOverlay.compat.legacyEditorState.value = readGlobalForm();
      syncLayoutFromLegacyInput(input.id);
      markThemeDirty();
      updateEditor();
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
  $("resetBtn").addEventListener("click", () => {
    MusicOverlay.compat.legacyEditorState.value = structuredClone(defaultConfig);
    MusicOverlay.compat.editorRuntime.currentDefaultCover = DEFAULT_COVER;
    storeCanvasBackground(DEFAULT_CANVAS_BACKGROUND);
    MusicOverlay.compat.editorRuntime.selection = { type: "group", id: "full-card-group" };
    MusicOverlay.compat.editorRuntime.previewTimeMs = 1500;
    fillGlobalForm(MusicOverlay.compat.legacyEditorState.value);
    markThemeDirty();
    updateEditor();
    setStatus("Defaults восстановлены. Нажмите «Применить».");
  });

  $("defaultCoverFile").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    MusicOverlay.compat.editorRuntime.currentDefaultCover = await fileToBase64(file);
    MusicOverlay.compat.legacyEditorState.value.albumArt.defaultCover = MusicOverlay.compat.editorRuntime.currentDefaultCover;
    $("defaultCoverPreview").src = MusicOverlay.compat.editorRuntime.currentDefaultCover;
    markThemeDirty();
    updatePreview(MusicOverlay.compat.legacyEditorState.value);
  });

  $("playTimelineBtn").addEventListener("click", startTimelinePlayback);
  $("stopTimelineBtn").addEventListener("click", () => stopTimelinePlayback(true));
  $("canvasBackgroundColor").addEventListener("input", event => {
    const color = event.target.value;
    MusicOverlay.compat.legacyEditorState.value.layout.canvas.backgroundColor = color;
    $("canvasSurface").style.backgroundColor = color;
    storeCanvasBackground(color);
    markThemeDirty();
    applyLayoutToPreview();
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
      MusicOverlay.compat.editorRuntime.canvasScale = nextScale;
      updateSelectionBounds();
    }
  });
  MusicOverlay.compat.editorRuntime.canvasController.attach();
  MusicOverlay.compat.editorRuntime.timelineController = MusicOverlay.editor.infrastructure.createTimelineController({
    surface: document.querySelector(".timeline-scroll"), ruler: $("timelineRuler"),
    getDuration: () => MusicOverlay.compat.editorRuntime.timelineDurationMs,
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
  renderInspector();
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

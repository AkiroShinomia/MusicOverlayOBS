function updateEditor() {
  const scene = MusicOverlay.editor.context.sceneStore.getSnapshot();
  if (!scene) return;
  const durationMs = MusicOverlay.editor.state.uiAdapters.timelineDurationMs();
  const session = MusicOverlay.editor.context.sessionStore.getSnapshot();
  const playheadMs = Math.min(session.playheadMs, durationMs);
  if (playheadMs !== session.playheadMs) MusicOverlay.editor.context.sessionStore.patch({ playheadMs });
  $("compositionDurationSec").value = String(Math.round(durationMs / 1000));
  updatePreview(scene);
  renderTimeline();
  renderInspector();
}

function updatePreview(scene) {
  const canvasBackground = getStoredCanvasBackground() || scene.canvas?.backgroundColor || DEFAULT_CANVAS_BACKGROUND;
  $("canvasSurface").style.backgroundColor = canvasBackground;
  $("canvasBackgroundColor").value = canvasBackground;
  $("defaultCoverPreview").src = scene.appearance?.albumArt?.defaultCover || DEFAULT_COVER;
  applyLayoutToPreview();
  updatePreviewTimeLabel();
}

function getPreviewLayerNode(layerOrId) {
  const id = typeof layerOrId === "string" ? layerOrId : layerOrId?.id;
  return $("scenePreviewMount")?.querySelector(`[data-layer-id="${CSS.escape(id || "")}"]`) || null;
}

function getPreviewGroupNode(groupOrId) {
  const id = typeof groupOrId === "string" ? groupOrId : groupOrId?.id;
  return $("scenePreviewMount")?.querySelector(`[data-group-id="${CSS.escape(id || "")}"]`) || null;
}

function initializeScenePreviewRenderer() {
  if (MusicOverlay.compat.editorRuntime.previewSceneRenderer) return true;
  const mount = $("scenePreviewMount");
  if (!mount || !SceneRendererApi?.SceneRenderer) return false;
  MusicOverlay.compat.editorRuntime.previewSceneRenderer = new SceneRendererApi.SceneRenderer(mount, { mode: "editor" });
  $("canvasSurface").classList.add("is-scene-renderer-active");
  return true;
}

function renderScenePreview() {
  if (!initializeScenePreviewRenderer()) return false;
  const scene = MusicOverlay.editor.context.sceneStore.getSnapshot();
  if (!scene) return false;
  MusicOverlay.compat.editorRuntime.previewSceneRenderer.updateScene(scene);
  MusicOverlay.compat.editorRuntime.previewSceneRenderer.setData({
    ...MusicOverlay.compat.editorRuntime.previewTrackData,
    thumbnail: MusicOverlay.compat.editorRuntime.currentLiveCover || MusicOverlay.compat.editorRuntime.currentDefaultCover || scene.appearance?.albumArt?.defaultCover || DEFAULT_COVER
  });
  MusicOverlay.compat.editorRuntime.previewSceneRenderer.setTime(MusicOverlay.editor.context.sessionStore.getSnapshot().playheadMs);

  const selection = MusicOverlay.editor.state.uiAdapters.selection();
  $("scenePreviewMount").querySelectorAll("[data-layer-id], [data-group-id]").forEach(element => {
    const id = element.dataset.layerId || element.dataset.groupId;
    const node = MusicOverlay.editor.context.selectors.nodeById(scene, id);
    if (!node) return;
    element.classList.toggle("is-selected", selection.id === id);
    element.classList.toggle("is-locked", MusicOverlay.editor.context.selectors.effectiveLock(scene, id));
    element.classList.toggle("is-outside-time", element.dataset.sceneVisible === "false");
  });
  return true;
}

function applyLayoutToPreview() {
  if (!MusicOverlay.editor.context.sceneStore.getSnapshot()) return;
  if (!renderScenePreview()) throw new Error("Scene v2 Preview renderer is unavailable");
  updateSelectionBounds();
}

function updateSelectionBounds() {
  const bounds = $("selectionBounds");
  const selection = MusicOverlay.editor.state.uiAdapters.selection();
  const scene = MusicOverlay.editor.context.sceneStore.getSnapshot();
  if (!scene || !selection?.id || !MusicOverlay.editor.state.uiAdapters.canvasScale()) {
    bounds.classList.remove("is-visible");
    return;
  }

  const selected = MusicOverlay.editor.context.selectors.nodeById(scene, selection.id);
  if (!selected) {
    bounds.classList.remove("is-visible");
    return;
  }

  const ids = selected.nodeType === "group"
    ? [selected.id, ...MusicOverlay.editor.context.selectors.descendantsOf(scene, selected.id).map(node => node.id)]
    : [selected.id];
  const rects = ids
    .map(id => getPreviewLayerNode(id) || getPreviewGroupNode(id))
    .filter(node => node && !node.classList.contains("is-editor-hidden") && !node.classList.contains("is-outside-time"))
    .map(node => node.getBoundingClientRect())
    .filter(rect => rect.width && rect.height);

  if (!rects.length) {
    bounds.classList.remove("is-visible");
    return;
  }

  const nodeRect = {
    left: Math.min(...rects.map(rect => rect.left)),
    top: Math.min(...rects.map(rect => rect.top)),
    right: Math.max(...rects.map(rect => rect.right)),
    bottom: Math.max(...rects.map(rect => rect.bottom))
  };
  nodeRect.width = nodeRect.right - nodeRect.left;
  nodeRect.height = nodeRect.bottom - nodeRect.top;
  const surfaceRect = $("canvasSurface").getBoundingClientRect();
  bounds.style.left = `${(nodeRect.left - surfaceRect.left) / MusicOverlay.editor.state.uiAdapters.canvasScale()}px`;
  bounds.style.top = `${(nodeRect.top - surfaceRect.top) / MusicOverlay.editor.state.uiAdapters.canvasScale()}px`;
  bounds.style.width = `${nodeRect.width / MusicOverlay.editor.state.uiAdapters.canvasScale()}px`;
  bounds.style.height = `${nodeRect.height / MusicOverlay.editor.state.uiAdapters.canvasScale()}px`;
  bounds.style.setProperty("--selection-handle-size", `${16 / MusicOverlay.editor.state.uiAdapters.canvasScale()}px`);
  bounds.classList.add("is-visible");
}

MusicOverlay.editor.preview = Object.freeze({
  update: updatePreview,
  renderScene: renderScenePreview,
  applyLayout: applyLayoutToPreview,
  updateSelectionBounds
});

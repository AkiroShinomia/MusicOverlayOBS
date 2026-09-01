function updateEditor() {
  MusicOverlay.compat.editorRuntime.timelineDurationMs = calculateTimelineDuration();
  MusicOverlay.compat.editorRuntime.previewTimeMs = Math.min(MusicOverlay.compat.editorRuntime.previewTimeMs, MusicOverlay.compat.editorRuntime.timelineDurationMs);
  $("compositionDurationSec").value = String(Math.round(MusicOverlay.compat.editorRuntime.timelineDurationMs / 1000));
  updatePreview(MusicOverlay.compat.legacyEditorState.value);
  renderTimeline();
  renderInspector();
}

function updatePreview(config) {
  const canvasBackground = getStoredCanvasBackground() || config.layout?.canvas?.backgroundColor || DEFAULT_CANVAS_BACKGROUND;

  config.layout.canvas.backgroundColor = canvasBackground;
  $("canvasSurface").style.backgroundColor = canvasBackground;
  $("canvasBackgroundColor").value = canvasBackground;
  $("defaultCoverPreview").src = config.albumArt.defaultCover || DEFAULT_COVER;
  applyLayoutToPreview();
  updatePreviewTimeLabel();
}

function isVisibleAt(item, timeMs) {
  if (item.visible === false) return false;
  const timing = item.timing || makeTiming(0, 10000);
  if (timeMs < Number(timing.startMs || 0)) return false;
  if (timing.untilNextTrack) return true;
  return timeMs < Number(timing.endMs || 0);
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
  const root = $("scenePreviewMount");
  if (!root || !SceneRendererApi?.SceneRenderer || !SceneEditorModel?.toScene) return false;
  MusicOverlay.compat.editorRuntime.previewSceneRenderer = new SceneRendererApi.SceneRenderer(root, { mode: "editor" });
  $("canvasSurface").classList.add("is-scene-renderer-active");
  return true;
}

function renderScenePreview() {
  if (!initializeScenePreviewRenderer()) return false;
  const scene = SceneEditorModel.toScene(MusicOverlay.compat.legacyEditorState.value, {
    id: "editor-draft-preview",
    name: MusicOverlay.compat.legacyEditorState.value.theme?.preset || "Editor draft",
    revision: ++MusicOverlay.compat.editorRuntime.previewSceneRevision
  });
  MusicOverlay.compat.editorRuntime.previewSceneRenderer.updateScene(scene);
  MusicOverlay.compat.editorRuntime.previewSceneRenderer.setData({
    ...MusicOverlay.compat.editorRuntime.previewTrackData,
    thumbnail: MusicOverlay.compat.editorRuntime.currentLiveCover || MusicOverlay.compat.editorRuntime.currentDefaultCover || MusicOverlay.compat.legacyEditorState.value.albumArt?.defaultCover || DEFAULT_COVER
  });
  MusicOverlay.compat.editorRuntime.previewSceneRenderer.setTime(MusicOverlay.compat.editorRuntime.previewTimeMs);

  const groupsById = new Map(MusicOverlay.compat.legacyEditorState.value.layout.groups.map(group => [group.id, group]));
  $("scenePreviewMount").querySelectorAll("[data-layer-id], [data-group-id]").forEach(element => {
    const layerId = element.dataset.layerId;
    const groupId = element.dataset.groupId;
    const item = layerId
      ? MusicOverlay.compat.legacyEditorState.value.layout.layers.find(layer => layer.id === layerId)
      : groupsById.get(groupId);
    const parent = layerId ? groupsById.get(item?.groupId) : null;
    element.classList.toggle("is-selected", MusicOverlay.compat.editorRuntime.selection.type === (layerId ? "layer" : "group") && MusicOverlay.compat.editorRuntime.selection.id === (layerId || groupId));
    element.classList.toggle("is-locked", item?.locked === true || parent?.locked === true);
    element.classList.toggle("is-outside-time", element.dataset.sceneVisible === "false");
  });
  return true;
}

function applyLayoutToPreview() {
  if (!MusicOverlay.compat.legacyEditorState.value.layout) return;
  if (!renderScenePreview()) throw new Error("Scene v2 Preview renderer is unavailable");
  updateSelectionBounds();
}
function updateSelectionBounds() {
  const bounds = $("selectionBounds");
  const node = MusicOverlay.compat.editorRuntime.selection.type === "group"
    ? getPreviewGroupNode(MusicOverlay.compat.editorRuntime.selection.id)
    : getPreviewLayerNode(MusicOverlay.compat.editorRuntime.selection.id);
  if (!MusicOverlay.compat.editorRuntime.canvasScale) {
    bounds.classList.remove("is-visible");
    return;
  }
  let rects = [];
  if (MusicOverlay.compat.editorRuntime.selection.type === "layer" && node && !node.classList.contains("is-editor-hidden") && !node.classList.contains("is-outside-time")) {
    rects = [node.getBoundingClientRect()];
  } else if (MusicOverlay.compat.editorRuntime.selection.type === "group") {
    const group = getGroup(MusicOverlay.compat.editorRuntime.selection.id);
    if (group && group.visible !== false && isVisibleAt(group, MusicOverlay.compat.editorRuntime.previewTimeMs)) {
      const groupRect = node && !node.classList.contains("is-editor-hidden") && !node.classList.contains("is-outside-time")
        ? node.getBoundingClientRect()
        : null;
      rects = MusicOverlay.compat.legacyEditorState.value.layout.layers
        .filter(layer => layer.groupId === group.id && layer.visible !== false && isVisibleAt(layer, MusicOverlay.compat.editorRuntime.previewTimeMs))
        .map(layer => getPreviewLayerNode(layer)?.getBoundingClientRect())
        .filter(rect => rect && rect.width && rect.height);
      if (groupRect?.width && groupRect?.height) rects.push(groupRect);
    }
  }
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
  if (!nodeRect.width || !nodeRect.height) {
    bounds.classList.remove("is-visible");
    return;
  }

  bounds.style.left = `${(nodeRect.left - surfaceRect.left) / MusicOverlay.compat.editorRuntime.canvasScale}px`;
  bounds.style.top = `${(nodeRect.top - surfaceRect.top) / MusicOverlay.compat.editorRuntime.canvasScale}px`;
  bounds.style.width = `${nodeRect.width / MusicOverlay.compat.editorRuntime.canvasScale}px`;
  bounds.style.height = `${nodeRect.height / MusicOverlay.compat.editorRuntime.canvasScale}px`;
  bounds.style.setProperty("--MusicOverlay.compat.editorRuntime.selection-handle-size", `${16 / MusicOverlay.compat.editorRuntime.canvasScale}px`);
  bounds.classList.add("is-visible");
}


MusicOverlay.editor.preview = Object.freeze({ update: updatePreview, renderScene: renderScenePreview, applyLayout: applyLayoutToPreview, updateSelectionBounds });

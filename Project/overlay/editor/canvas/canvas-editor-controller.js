function setupCanvasDragging() {
  const surface = $("canvasSurface");
  let drag = null;

  surface.addEventListener("pointerdown", event => {
    const layerNode = event.target.closest("[data-layer-id]");
    const groupNode = event.target.closest("[data-group-id]");
    if (!layerNode && !groupNode) return;

    const clickedLayer = layerNode
      ? MusicOverlay.compat.legacyEditorState.value.layout.layers.find(item => item.id === layerNode.dataset.layerId)
      : null;
    const keepSelectedGroup = MusicOverlay.compat.editorRuntime.selection.type === "group" && clickedLayer?.groupId === MusicOverlay.compat.editorRuntime.selection.id;
    const type = keepSelectedGroup || !layerNode ? "group" : "layer";
    const id = keepSelectedGroup ? MusicOverlay.compat.editorRuntime.selection.id : layerNode?.dataset.layerId || groupNode.dataset.groupId;
    selectItem(type, id);
    const layer = type === "layer" ? clickedLayer : null;
    const group = type === "group" ? getGroup(id) : getGroup(layer?.groupId);
    const target = type === "layer" ? layer : group;
    if (!target || target.locked || group?.locked) return;

    drag = {
      target,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: target.x || 0,
      startY: target.y || 0,
      pointerId: event.pointerId
    };
    surface.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  surface.addEventListener("pointermove", event => {
    if (!drag) return;
    const rawX = drag.startX + (event.clientX - drag.startClientX) / MusicOverlay.compat.editorRuntime.canvasScale;
    const rawY = drag.startY + (event.clientY - drag.startClientY) / MusicOverlay.compat.editorRuntime.canvasScale;
    const snap = event.shiftKey ? 1 : 5;
    drag.target.x = Math.round(rawX / snap) * snap;
    drag.target.y = Math.round(rawY / snap) * snap;
    markThemeDirty();
    renderInspector();
    applyLayoutToPreview();
  });

  const endDrag = event => {
    if (!drag) return;
    try { surface.releasePointerCapture(drag.pointerId); } catch {}
    drag = null;
    renderTimeline();
  };
  surface.addEventListener("pointerup", endDrag);
  surface.addEventListener("pointercancel", endDrag);
}

function setupSelectionResizing() {
  const handle = $("selectionResizeHandle");
  let resize = null;

  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const item = getSelectedItem();
    const group = MusicOverlay.compat.editorRuntime.selection.type === "layer" ? getGroup(item?.groupId) : item;
    if (!item || item.locked || group?.locked) return;

    const boundsRect = $("selectionBounds").getBoundingClientRect();
    resize = {
      item,
      pointerId: event.pointerId,
      originX: boundsRect.left,
      originY: boundsRect.top,
      startDistance: Math.max(1, Math.hypot(event.clientX - boundsRect.left, event.clientY - boundsRect.top)),
      startScale: Number(item.scale || 100)
    };
    handle.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  });

  handle.addEventListener("pointermove", event => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    const distance = Math.max(1, Math.hypot(event.clientX - resize.originX, event.clientY - resize.originY));
    resize.item.scale = Math.round(clampNumber(resize.startScale * distance / resize.startDistance, 10, 400, resize.startScale));
    $("inspectorScale").value = resize.item.scale;
    markThemeDirty();
    applyLayoutToPreview();
  });

  const endResize = event => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    try { handle.releasePointerCapture(resize.pointerId); } catch {}
    resize = null;
    renderInspector();
    renderTimeline();
  };
  handle.addEventListener("pointerup", endResize);
  handle.addEventListener("pointercancel", endResize);
}

function addGroup() {
  const index = MusicOverlay.compat.legacyEditorState.value.layout.groups.length + 1;
  const id = `group-${Date.now().toString(36)}`;
  MusicOverlay.compat.legacyEditorState.value.layout.groups.push(normalizeItem(null, {
    id, name: `Group ${index}`, runtimeTarget: null, visible: true, locked: false,
    marker: markerPalette[(index - 1) % markerPalette.length], x: 0, y: 0, scale: 100,
    effects: makeEffects(), animation: makeGroupAnimation("fade", "fade", 500, false), timing: makeTiming(0, 10000)
  }));
  markThemeDirty();
  selectItem("group", id);
}

function deleteSelectedGroup() {
  if (MusicOverlay.compat.editorRuntime.selection.type !== "group") return;
  deleteTimelineItem("group", MusicOverlay.compat.editorRuntime.selection.id);
}

function applyAnimationPreset(preset, direction = "in") {
  const selected = getSelectedItem();
  if (!selected) return;
  const inheritedFrom = getAnimationOverrideGroup(selected);
  if (inheritedFrom || (MusicOverlay.compat.editorRuntime.selection.type === "group" && selected.animation?.overrideChildren !== true)) {
    setStatus(inheritedFrom
      ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? `Анимацией управляет группа «${inheritedFrom.name}».` : `Animation is controlled by “${inheritedFrom.name}”.`)
      : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Сначала включите затирание анимаций объектов в группе." : "Enable child animation override on the group first."), "error");
    return;
  }
  selected.animation[direction === "out" ? "exit" : "enter"] = preset;
  if (!selected.animation.enterDurationMs) selected.animation.enterDurationMs = 600;
  if (!selected.animation.exitDurationMs) selected.animation.exitDurationMs = 600;
  markThemeDirty(true);
  updateEditor();
  const duration = direction === "out" ? selected.animation.exitDurationMs : selected.animation.enterDurationMs;
  setPreviewTime(direction === "out" && !selected.timing.untilNextTrack
    ? Math.max(selected.timing.startMs, selected.timing.endMs - Math.min(250, duration / 2))
    : selected.timing.startMs + Math.min(250, duration / 2));
}


MusicOverlay.editor.canvas = Object.freeze({ setupDragging: setupCanvasDragging, setupSelectionResizing, fit: fitCanvas, addGroup, deleteSelectedGroup, applyAnimationPreset });

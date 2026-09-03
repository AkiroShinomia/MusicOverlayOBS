function setupCanvasDragging() {
  const surface = $("canvasSurface");
  let drag = null;

  surface.addEventListener("pointerdown", event => {
    const layerNode = event.target.closest("[data-layer-id]");
    const groupNode = event.target.closest("[data-group-id]");
    if (!layerNode && !groupNode) return;

    const scene = MusicOverlay.editor.context.sceneStore.getSnapshot();
    const clickedId = layerNode?.dataset.layerId || groupNode?.dataset.groupId;
    const clicked = MusicOverlay.editor.context.selectors.nodeById(scene, clickedId);
    if (!clicked) return;

    const selected = MusicOverlay.editor.state.uiAdapters.selection();
    const keepSelectedGroup = selected.type === "group" && clicked.parentId === selected.id;
    const targetId = keepSelectedGroup ? selected.id : clicked.id;
    const target = MusicOverlay.editor.context.selectors.nodeById(scene, targetId);
    const type = target?.nodeType === "group" ? "group" : "layer";
    selectItem(type, targetId);

    if (!target || MusicOverlay.editor.context.selectors.effectiveLock(scene, targetId)) return;
    drag = {
      id: targetId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: Number(target.transform?.x || 0),
      startY: Number(target.transform?.y || 0),
      pointerId: event.pointerId
    };
    surface.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  surface.addEventListener("pointermove", event => {
    if (!drag) return;
    const rawX = drag.startX + (event.clientX - drag.startClientX) / MusicOverlay.editor.state.uiAdapters.canvasScale();
    const rawY = drag.startY + (event.clientY - drag.startClientY) / MusicOverlay.editor.state.uiAdapters.canvasScale();
    const snap = event.shiftKey ? 1 : 5;
    const x = Math.round(rawX / snap) * snap;
    const y = Math.round(rawY / snap) * snap;
    MusicOverlay.editor.context.commit({
      type: "node.transform",
      payload: { id: drag.id, patch: { x, y } }
    });
    renderInspector();
    applyLayoutToPreview();
    updateHistoryControls();
  });

  const endDrag = event => {
    if (!drag) return;
    try { surface.releasePointerCapture(drag.pointerId); } catch {}
    drag = null;
    MusicOverlay.editor.context.history.record(true);
    updateHistoryControls();
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
    const scene = MusicOverlay.editor.context.sceneStore.getSnapshot();
    const id = MusicOverlay.editor.state.uiAdapters.selection().id;
    const item = MusicOverlay.editor.context.selectors.nodeById(scene, id);
    if (!item || MusicOverlay.editor.context.selectors.effectiveLock(scene, id)) return;

    const boundsRect = $("selectionBounds").getBoundingClientRect();
    resize = {
      id,
      pointerId: event.pointerId,
      originX: boundsRect.left,
      originY: boundsRect.top,
      startDistance: Math.max(1, Math.hypot(event.clientX - boundsRect.left, event.clientY - boundsRect.top)),
      startScaleX: Number(item.transform?.scaleX ?? 1),
      startScaleY: Number(item.transform?.scaleY ?? 1)
    };
    handle.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  });

  handle.addEventListener("pointermove", event => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    const distance = Math.max(1, Math.hypot(event.clientX - resize.originX, event.clientY - resize.originY));
    const factor = clampNumber(distance / resize.startDistance, .1, 4, 1);
    const scaleX = clampNumber(resize.startScaleX * factor, .1, 4, resize.startScaleX);
    const scaleY = clampNumber(resize.startScaleY * factor, .1, 4, resize.startScaleY);
    MusicOverlay.editor.context.commit({
      type: "node.transform",
      payload: { id: resize.id, patch: { scaleX, scaleY } }
    });
    $("inspectorScale").value = Math.round(scaleX * 100);
    applyLayoutToPreview();
    updateHistoryControls();
  });

  const endResize = event => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    try { handle.releasePointerCapture(resize.pointerId); } catch {}
    resize = null;
    MusicOverlay.editor.context.history.record(true);
    updateHistoryControls();
    renderInspector();
    renderTimeline();
  };
  handle.addEventListener("pointerup", endResize);
  handle.addEventListener("pointercancel", endResize);
}

function createGroupNode(index) {
  return {
    id: `group-${Date.now().toString(36)}`,
    nodeType: "group",
    name: `Group ${index}`,
    parentId: null,
    order: MusicOverlay.editor.context.selectors.rootNodes(MusicOverlay.editor.context.sceneStore.getSnapshot()).length,
    visible: true,
    locked: false,
    marker: markerPalette[(index - 1) % markerPalette.length],
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: .5, anchorY: .5 },
    timing: { startMs: 0, endMode: "fixed", durationMs: 10000 },
    effects: [
      { type: "opacity", enabled: true, value: 100 },
      { type: "blur", enabled: false, value: 0 },
      { type: "glow", enabled: false, value: 0 }
    ],
    animations: {
      in: { type: "fade", durationMs: 500, easing: "ease-out" },
      out: { type: "fade", durationMs: 500, easing: "ease-out" },
      overrideChildren: false
    },
    component: { kind: "group", templateId: null, runtimeTarget: null, properties: {} }
  };
}

function addGroup() {
  const scene = MusicOverlay.editor.context.sceneStore.getSnapshot();
  const index = scene.nodes.filter(node => node.nodeType === "group").length + 1;
  const node = createGroupNode(index);
  MusicOverlay.editor.context.commit({ type: "node.add", payload: { node } }, { forceHistory: true });
  selectItem("group", node.id);
  updateHistoryControls();
}

function deleteSelectedGroup() {
  if (MusicOverlay.editor.state.uiAdapters.selection().type !== "group") return;
  deleteTimelineItem("group", MusicOverlay.editor.state.uiAdapters.selection().id);
}

function applyAnimationPreset(preset, direction = "in") {
  const scene = MusicOverlay.editor.context.sceneStore.getSnapshot();
  const selectedId = MusicOverlay.editor.state.uiAdapters.selection().id;
  const selected = MusicOverlay.editor.context.selectors.nodeById(scene, selectedId);
  if (!selected) return;

  const inheritedFrom = MusicOverlay.editor.context.selectors.ancestorsOf(scene, selectedId)
    .find(parent => parent.animations?.overrideChildren === true) || null;
  if (inheritedFrom || (selected.nodeType === "group" && selected.animations?.overrideChildren !== true)) {
    setStatus(
      inheritedFrom
        ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? `Анимацией управляет группа «${inheritedFrom.name}».` : `Animation is controlled by “${inheritedFrom.name}”.`)
        : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Сначала включите затирание анимаций объектов в группе." : "Enable child animation override on the group first."),
      "error"
    );
    return;
  }

  const key = direction === "out" ? "out" : "in";
  const current = selected.animations?.[key] || {};
  MusicOverlay.editor.context.commit({
    type: "node.animations",
    payload: {
      id: selectedId,
      patch: {
        [key]: {
          ...current,
          type: preset,
          durationMs: Number(current.durationMs || 600),
          easing: current.easing || "ease-out"
        }
      }
    }
  }, { forceHistory: true });
  updateEditor();

  const timing = MusicOverlay.editor.context.selectors.effectiveTiming(
    MusicOverlay.editor.context.sceneStore.getSnapshot(),
    selectedId
  );
  const duration = Number(current.durationMs || 600);
  setPreviewTime(
    direction === "out" && Number.isFinite(timing?.endMs)
      ? Math.max(timing.startMs, timing.endMs - Math.min(250, duration / 2))
      : Number(timing?.startMs || 0) + Math.min(250, duration / 2)
  );
  updateHistoryControls();
}

MusicOverlay.editor.canvas = Object.freeze({
  setupDragging: setupCanvasDragging,
  setupSelectionResizing,
  fit: fitCanvas,
  addGroup,
  deleteSelectedGroup,
  applyAnimationPreset
});

function timelineContext() {
  return MusicOverlay.editor.context;
}

function timelineScene() {
  return timelineContext().sceneStore.getSnapshot();
}

function timelineNode(id) {
  return timelineContext().selectors.nodeById(timelineScene(), id);
}

function timelineItem(id) {
  return MusicOverlay.editor.state.uiAdapters.get(id);
}

function calculateTimelineDuration() {
  return clampNumber(timelineScene()?.timeline?.durationMs, 1000, 180000, 30000);
}

function getCompositionDuration() {
  return calculateTimelineDuration();
}

function getExpandedTimelineGroups(scene) {
  const expanded = timelineContext().sessionStore.getSnapshot().expandedGroups;
  const validGroups = new Set(scene.nodes.filter(node => node.nodeType === "group").map(node => node.id));
  return new Set([...expanded].filter(id => validGroups.has(id)));
}

function setTimelineGroupExpanded(id, expanded) {
  const current = new Set(timelineContext().sessionStore.getSnapshot().expandedGroups);
  if (expanded) current.add(id); else current.delete(id);
  timelineContext().sessionStore.patch({ expandedGroups: current });
}

function syncTimelineExpandedSession(scene) {
  timelineContext().sessionStore.patch({ expandedGroups: getExpandedTimelineGroups(scene) });
}

function renderTimeline() {
  const context = timelineContext();
  const scene = context.sceneStore.getSnapshot();
  renderRuler();

  const body = $("timelineBody");
  body.innerHTML = "";
  if (!scene) {
    updatePlayhead();
    return;
  }
  const rows = context.selectors.flattenedLayerRows(scene, getExpandedTimelineGroups(scene));
  rows.forEach(({ node, depth }) => {
    const item = timelineItem(node.id);
    if (item) body.appendChild(createTimelineRow(item, node.nodeType === "group" ? "group" : "layer", depth));
  });
  body.appendChild(createFreeTimelineZone());
  updatePlayhead();
}

function renderRuler() {
  const ruler = $("timelineRuler");
  ruler.innerHTML = `<div class="ruler-label">${t("layersControls")}</div><div class="ruler-track"></div>`;
  const track = ruler.querySelector(".ruler-track");
  const steps = Math.max(4, Math.round(calculateTimelineDuration() / 5000));
  for (let index = 0; index <= steps; index++) {
    const tick = document.createElement("div");
    tick.className = "ruler-tick";
    tick.style.left = `${(index / steps) * 100}%`;
    const label = document.createElement("span");
    label.textContent = `${Math.round((calculateTimelineDuration() / steps * index) / 1000)}s`;
    tick.appendChild(label);
    track.appendChild(tick);
  }
}

function getTimelineWindow(id, scene = timelineScene()) {
  return timelineContext().selectors.effectiveTiming(scene, id);
}

function getTimelineParentWindow(node, scene = timelineScene()) {
  return node?.parentId ? getTimelineWindow(node.parentId, scene) : null;
}

function absoluteTimingMutation(scene, node, patch = {}) {
  const window = getTimelineWindow(node.id, scene);
  const parentWindow = getTimelineParentWindow(node, scene);
  const parentStart = Number(parentWindow?.startMs || 0);
  const currentStart = Number(window?.startMs || parentStart);
  const currentEnd = Number.isFinite(Number(window?.endMs)) ? Number(window.endMs) : null;
  const startMs = patch.startMs === undefined ? currentStart : Number(patch.startMs);
  const endMode = patch.endMode || node.timing?.endMode || "fixed";
  const endMs = patch.endMs === undefined ? currentEnd : patch.endMs;
  return {
    type: "node.timing",
    payload: {
      id: node.id,
      patch: {
        startMs: Math.max(0, startMs - parentStart),
        endMode,
        durationMs: endMode === "fixed"
          ? Math.max(50, Number(endMs ?? (startMs + Number(node.timing?.durationMs || 1000))) - startMs)
          : null
      }
    }
  };
}

function applyTimelineBarStyle(bar, item) {
  const scene = timelineScene();
  const node = timelineContext().selectors.nodeById(scene, item.id);
  if (!node) return;
  const window = getTimelineWindow(node.id, scene);
  const parentWindow = getTimelineParentWindow(node, scene);
  const start = Number(window?.startMs || 0);
  const rawEnd = Number(window?.endMs);
  const infinite = node.timing?.endMode === "trackEnd";
  const end = Number.isFinite(rawEnd) ? rawEnd : calculateTimelineDuration();
  const displayEnd = Math.min(calculateTimelineDuration(), Math.max(start + 50, end));
  const duration = Math.max(1, calculateTimelineDuration());
  bar.style.left = `${Math.min(100, Math.max(0, start / duration * 100))}%`;
  bar.style.width = `${Math.max(.4, (displayEnd - start) / duration * 100)}%`;
  bar.classList.toggle("is-infinite", infinite);
  if (!infinite) bar.querySelector(".bar-infinity")?.remove();
  const offset = Number(parentWindow?.startMs || 0);
  const label = bar.querySelector(".bar-range");
  if (label) {
    label.textContent = `${((start - offset) / 1000).toFixed(1)}–${infinite ? "∞" : ((displayEnd - offset) / 1000).toFixed(1)}s`;
  }
}

function refreshTimelineBar(item) {
  const row = [...document.querySelectorAll(".timeline-row")]
    .find(element => element.dataset.itemId === item.id);
  const bar = row?.querySelector(".track-bar");
  if (bar) applyTimelineBarStyle(bar, item);
}

function getTimelineSnapTargets(scene, excludedIds = new Set()) {
  return scene.nodes
    .filter(node => !excludedIds.has(node.id))
    .flatMap(node => {
      const window = getTimelineWindow(node.id, scene);
      if (!window) return [];
      const points = [Number(window.startMs || 0)];
      if (Number.isFinite(Number(window.endMs))) points.push(Number(window.endMs));
      return points;
    });
}

function setTimelineSelection(type, id) {
  const node = timelineNode(id);
  if (!node) return;
  timelineContext().sessionStore.setSelection({ type: node.nodeType, id });
  activateSidebarPane("inspector");
  document.querySelectorAll(".timeline-row").forEach(row => {
    row.classList.toggle("is-selected", row.dataset.itemId === id);
  });
  renderInspector();
}

function setupTimingDrag(bar, item, type) {
  bar.title = type === "group" ? "Перетащить группу по timeline" : "Перетащить слой по timeline";
  bar.addEventListener("pointerdown", event => {
    if (event.target.closest(".timing-resize-handle")) return;
    const context = timelineContext();
    const scene = context.sceneStore.getSnapshot();
    const node = context.selectors.nodeById(scene, item.id);
    if (!node || event.button !== 0 || context.selectors.effectiveLock(scene, node.id)) return;
    event.stopPropagation();
    event.preventDefault();
    setTimelineSelection(type, node.id);

    const window = getTimelineWindow(node.id, scene);
    const parentWindow = getTimelineParentWindow(node, scene);
    const originalStart = Number(window?.startMs || 0);
    const originalEnd = Number.isFinite(Number(window?.endMs)) ? Number(window.endMs) : null;
    const parentStart = Number(parentWindow?.startMs || 0);
    const parentEnd = Number.isFinite(Number(parentWindow?.endMs))
      ? Number(parentWindow.endMs)
      : calculateTimelineDuration();
    const fixed = node.timing?.endMode === "fixed" && originalEnd !== null;
    const minDelta = parentStart - originalStart;
    const maxDelta = fixed
      ? Math.max(minDelta, parentEnd - originalEnd)
      : Math.max(minDelta, parentEnd - originalStart - 50);
    const trackWidth = bar.parentElement.getBoundingClientRect().width || 1;
    const snapThresholdMs = Math.max(80, calculateTimelineDuration() / trackWidth * 10);
    const snapTargets = getTimelineSnapTargets(scene, new Set([node.id, ...context.selectors.descendantsOf(scene, node.id).map(child => child.id)]));
    const startClientX = event.clientX;
    const pointerId = event.pointerId;
    let moved = false;

    bar.setPointerCapture(pointerId);
    const move = moveEvent => {
      if (moveEvent.pointerId !== pointerId) return;
      const rawDelta = (moveEvent.clientX - startClientX) / trackWidth * calculateTimelineDuration();
      let delta = Math.min(maxDelta, Math.max(minDelta, Math.round(rawDelta / 50) * 50));
      let snapEdge = null;
      let snapDistance = Infinity;
      snapTargets.forEach(targetEdge => {
        const candidates = [targetEdge - originalStart];
        if (fixed && originalEnd !== null) candidates.push(targetEdge - originalEnd);
        candidates.forEach(candidate => {
          if (candidate < minDelta || candidate > maxDelta) return;
          const distance = Math.abs(candidate - delta);
          if (distance <= snapThresholdMs && distance < snapDistance) {
            snapDistance = distance;
            delta = candidate;
            snapEdge = targetEdge;
          }
        });
      });
      moved = moved || Math.abs(delta) > .001;
      const currentScene = context.sceneStore.getSnapshot();
      const currentNode = context.selectors.nodeById(currentScene, node.id);
      if (!currentNode) return;
      context.commit(absoluteTimingMutation(currentScene, currentNode, {
        startMs: originalStart + delta,
        ...(fixed ? { endMs: originalEnd + delta } : {})
      }), { themeDirty: true });
      refreshTimelineBar(item);
      applyLayoutToPreview();
      renderInspector();
      const guide = $("timelineSnapGuide");
      guide.classList.toggle("is-visible", snapEdge !== null);
      if (snapEdge !== null) guide.style.setProperty("--snap-pct", String(snapEdge / calculateTimelineDuration()));
    };

    const end = endEvent => {
      if (endEvent.pointerId !== pointerId) return;
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", end);
      bar.removeEventListener("pointercancel", end);
      try { bar.releasePointerCapture(pointerId); } catch {}
      $("timelineSnapGuide").classList.remove("is-visible");
      if (moved) context.history.record(true);
      renderTimeline();
      renderInspector();
      updateHistoryControls();
    };

    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", end);
  });
}

function setupTimingResize(handle, item, type, edge) {
  handle.title = edge === "start"
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Изменить начало тайминга" : "Trim timing start")
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Изменить конец тайминга" : "Trim timing end");
  handle.addEventListener("pointerdown", event => {
    const context = timelineContext();
    const scene = context.sceneStore.getSnapshot();
    const node = context.selectors.nodeById(scene, item.id);
    if (!node || event.button !== 0 || context.selectors.effectiveLock(scene, node.id)) return;
    event.stopPropagation();
    event.preventDefault();
    setTimelineSelection(type, node.id);

    const track = handle.closest(".track-cell");
    const rect = track?.getBoundingClientRect();
    if (!rect?.width) return;
    const pointerId = event.pointerId;
    const window = getTimelineWindow(node.id, scene);
    const parentWindow = getTimelineParentWindow(node, scene);
    const originalStart = Number(window?.startMs || 0);
    const originalEnd = Number.isFinite(Number(window?.endMs))
      ? Number(window.endMs)
      : calculateTimelineDuration();
    const parentStart = Number(parentWindow?.startMs || 0);
    const parentEnd = Number.isFinite(Number(parentWindow?.endMs))
      ? Number(parentWindow.endMs)
      : calculateTimelineDuration();
    const minTime = edge === "start" ? parentStart : originalStart + 50;
    const maxTime = edge === "start" ? originalEnd - 50 : parentEnd;
    const excluded = new Set([node.id, ...context.selectors.descendantsOf(scene, node.id).map(child => child.id)]);
    const snapTargets = getTimelineSnapTargets(scene, excluded);
    const snapThresholdMs = Math.max(80, calculateTimelineDuration() / rect.width * 10);
    let moved = false;

    handle.setPointerCapture(pointerId);
    const move = moveEvent => {
      if (moveEvent.pointerId !== pointerId) return;
      const ratio = Math.min(1, Math.max(0, (moveEvent.clientX - rect.left) / rect.width));
      let nextTime = Math.round((ratio * calculateTimelineDuration()) / 50) * 50;
      nextTime = Math.min(maxTime, Math.max(minTime, nextTime));
      let snapTime = null;
      let snapDistance = Infinity;
      snapTargets.forEach(target => {
        const distance = Math.abs(target - nextTime);
        if (target >= minTime && target <= maxTime && distance <= snapThresholdMs && distance < snapDistance) {
          nextTime = target;
          snapTime = target;
          snapDistance = distance;
        }
      });

      moved = moved || Math.abs(nextTime - (edge === "start" ? originalStart : originalEnd)) > .001;
      const currentScene = context.sceneStore.getSnapshot();
      const currentNode = context.selectors.nodeById(currentScene, node.id);
      if (!currentNode) return;
      const mutation = edge === "start"
        ? absoluteTimingMutation(currentScene, currentNode, {
            startMs: nextTime,
            endMs: currentNode.timing?.endMode === "fixed" ? originalEnd : undefined,
            endMode: currentNode.timing?.endMode || "fixed"
          })
        : absoluteTimingMutation(currentScene, currentNode, {
            startMs: originalStart,
            endMs: nextTime,
            endMode: "fixed"
          });
      if (edge === "end" && currentNode.nodeType === "group") {
        const childMutations = context.selectors.childrenOf(currentScene, currentNode.id)
          .filter(child => child.timing?.endMode === "trackEnd")
          .map(child => ({
            type: "node.timing",
            payload: {
              id: child.id,
              patch: { endMode: "parentEnd", durationMs: null }
            }
          }));
        context.commit({ type: "batch", payload: { mutations: [mutation, ...childMutations] } }, { themeDirty: true });
      } else {
        context.commit(mutation, { themeDirty: true });
      }
      refreshTimelineBar(item);
      applyLayoutToPreview();
      renderInspector();
      const guide = $("timelineSnapGuide");
      guide.classList.toggle("is-visible", snapTime !== null);
      if (snapTime !== null) guide.style.setProperty("--snap-pct", String(snapTime / calculateTimelineDuration()));
    };

    const end = endEvent => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      try { handle.releasePointerCapture(pointerId); } catch {}
      $("timelineSnapGuide").classList.remove("is-visible");
      if (moved) context.history.record(true);
      renderTimeline();
      renderInspector();
      updateHistoryControls();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  });
}

function createTimelineRow(item, type, depth = 0) {
  const context = timelineContext();
  const scene = context.sceneStore.getSnapshot();
  const node = context.selectors.nodeById(scene, item.id);
  const row = document.createElement("div");
  row.className = `timeline-row ${type === "group" ? "is-group" : "layer-row-child"}`;
  row.classList.toggle("is-selected", MusicOverlay.editor.state.uiAdapters.selection().id === item.id);
  row.dataset.itemType = type;
  row.dataset.itemId = item.id;
  row.dataset.depth = String(depth);

  const cell = document.createElement("div");
  cell.className = "layer-cell";
  cell.style.paddingLeft = `${Math.max(0, depth) * 16}px`;

  let collapseButton = null;
  if (type === "group") {
    collapseButton = document.createElement("button");
    collapseButton.className = "row-icon-button group-collapse-button";
    const collapsed = !timelineContext().sessionStore.getSnapshot().expandedGroups.has(item.id);
    collapseButton.textContent = collapsed ? "▸" : "▾";
    collapseButton.title = collapsed ? "Развернуть группу" : "Свернуть группу";
    collapseButton.addEventListener("click", event => {
      event.stopPropagation();
      setTimelineGroupExpanded(item.id, collapsed);
      renderTimeline();
    });
  }

  const structureHandle = document.createElement("button");
  structureHandle.className = "drag-handle";
  structureHandle.textContent = "⠿";
  structureHandle.title = type === "group" ? "Перетащить группу между слоями" : "Перетащить для изменения Z-order";
  setupTimelineStructureDrag(structureHandle, row, item, type);

  const visibleButton = document.createElement("button");
  visibleButton.className = `row-icon-button ${node?.visible === false ? "is-off" : ""}`;
  visibleButton.textContent = node?.visible === false ? "○" : "◉";
  visibleButton.title = "Видимость";
  visibleButton.addEventListener("click", event => {
    event.stopPropagation();
    context.commit({ type: "node.visibility", payload: { id: item.id, visible: node?.visible === false } }, { forceHistory: true });
    updateEditor();
    updateHistoryControls();
  });

  const lockButton = document.createElement("button");
  lockButton.className = `row-icon-button ${node?.locked ? "" : "is-off"}`;
  lockButton.textContent = node?.locked ? "▣" : "□";
  lockButton.title = "Lock";
  lockButton.addEventListener("click", event => {
    event.stopPropagation();
    context.commit({ type: "node.lock", payload: { id: item.id, locked: node?.locked !== true } }, { forceHistory: true });
    updateEditor();
    updateHistoryControls();
  });

  const marker = document.createElement("span");
  marker.className = "color-marker";
  marker.style.background = node?.marker || item.marker;

  const name = document.createElement("span");
  name.className = "layer-name";
  name.textContent = node?.name || item.name;
  name.title = node?.name || item.name;
  name.dataset.kindLabel = type === "group"
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "ГРУППА · " : "GROUP · ")
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "ОБЪЕКТ · " : "OBJ · ");

  const zIndex = document.createElement("span");
  zIndex.className = "z-index-label";
  if (type === "layer") {
    const siblings = context.selectors.orderedSiblings(scene, item.id);
    zIndex.textContent = `#${Math.max(0, siblings.findIndex(candidate => candidate.id === item.id)) + 1}`;
  } else {
    const descendants = context.selectors.descendantsOf(scene, item.id).filter(candidate => candidate.nodeType !== "group");
    zIndex.textContent = `${descendants.length}${MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "О" : "L"}`;
  }

  const deleteButton = document.createElement("button");
  deleteButton.className = "row-icon-button row-delete-button";
  deleteButton.textContent = "🗑";
  deleteButton.title = type === "group" ? t("deleteGroup") : t("deleteLayer");
  deleteButton.addEventListener("click", event => {
    event.stopPropagation();
    deleteTimelineItem(type, item.id);
  });

  if (collapseButton) cell.append(collapseButton);
  cell.append(structureHandle, visibleButton, lockButton, marker, name, zIndex, deleteButton);
  cell.addEventListener("click", () => selectItem(type, item.id));

  const track = document.createElement("div");
  track.className = "track-cell";
  const bar = document.createElement("div");
  bar.className = `track-bar ${node?.timing?.endMode === "trackEnd" ? "is-infinite" : ""}`;
  bar.style.setProperty("--marker", node?.marker || item.marker);
  const range = document.createElement("span");
  range.className = "bar-range";
  const startResize = document.createElement("span");
  startResize.className = "timing-resize-handle is-start";
  const endResize = document.createElement("span");
  endResize.className = "timing-resize-handle is-end";
  bar.append(startResize, range, endResize);
  setupTimingResize(startResize, item, type, "start");
  setupTimingResize(endResize, item, type, "end");
  applyTimelineBarStyle(bar, item);
  if (node?.timing?.endMode === "trackEnd") {
    const infinity = document.createElement("span");
    infinity.className = "bar-infinity";
    infinity.textContent = "∞";
    bar.appendChild(infinity);
  }
  bar.addEventListener("click", event => {
    event.stopPropagation();
    selectItem(type, item.id);
  });
  setupTimingDrag(bar, item, type);
  track.appendChild(bar);
  row.append(cell, track);
  setupLibraryDropOnTimelineRow(row, item, type);
  return row;
}

function createFreeTimelineZone() {
  const row = document.createElement("div");
  row.className = "timeline-row timeline-free-zone";
  row.dataset.itemType = "free";
  row.innerHTML = `<div class="free-zone-label"><span>↳</span>${t("freeTimeline")}</div><div class="track-cell"></div>`;
  return row;
}

function setupTimelineStructureDrag(handle, sourceRow, item, type) {
  let drag = null;
  const dropClasses = ["is-structure-drop", "is-structure-drop-before", "is-structure-drop-after"];
  const clearTargets = () => document.querySelectorAll(".is-structure-drop, .is-structure-drop-before, .is-structure-drop-after")
    .forEach(node => node.classList.remove(...dropClasses));
  const resolvePlacement = (row, clientY) => {
    if (!row || row.dataset.itemType === "free") return "inside";
    const rect = row.getBoundingClientRect();
    if (row.dataset.itemType === "group") {
      const third = rect.height / 3;
      if (clientY < rect.top + third) return "before";
      if (clientY > rect.bottom - third) return "after";
      return "inside";
    }
    return clientY < rect.top + rect.height / 2 ? "before" : "after";
  };
  const move = event => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7) {
      drag.moved = true;
      drag.ghost = document.createElement("div");
      drag.ghost.className = "timeline-structure-ghost";
      drag.ghost.textContent = `${type === "group" ? "▣" : "⠿"} ${item.name}`;
      document.body.appendChild(drag.ghost);
      handle.dataset.dragMoved = "1";
      sourceRow.classList.add("is-structure-source");
    }
    if (!drag.moved) return;
    drag.ghost.style.left = `${event.clientX + 12}px`;
    drag.ghost.style.top = `${event.clientY + 12}px`;
    clearTargets();
    drag.targetRow = document.elementFromPoint(event.clientX, event.clientY)?.closest(".timeline-row") || null;
    drag.placement = resolvePlacement(drag.targetRow, event.clientY);
    if (drag.targetRow) {
      drag.targetRow.classList.add("is-structure-drop");
      if (drag.placement !== "inside") drag.targetRow.classList.add(`is-structure-drop-${drag.placement}`);
    }
    event.preventDefault();
  };
  const finish = event => {
    if (!drag) return;
    if (drag.moved) {
      moveTimelineStructureItem(type, item.id, drag.targetRow, drag.placement);
      event.preventDefault();
    }
    drag.ghost?.remove();
    sourceRow.classList.remove("is-structure-source");
    clearTargets();
    document.removeEventListener("mousemove", move, true);
    document.removeEventListener("mouseup", finish, true);
    const moved = drag.moved;
    drag = null;
    if (moved) setTimeout(() => { handle.dataset.dragMoved = "0"; }, 80);
  };
  handle.addEventListener("mousedown", event => {
    if (event.button !== 0) return;
    drag = { startX: event.clientX, startY: event.clientY, moved: false, ghost: null, targetRow: null, placement: "inside" };
    document.addEventListener("mousemove", move, true);
    document.addEventListener("mouseup", finish, true);
  });
}

function moveTimelineStructureItem(type, sourceId, targetRow, placement = "before") {
  if (!targetRow || targetRow.dataset.itemId === sourceId) return;
  const context = timelineContext();
  const scene = context.sceneStore.getSnapshot();
  const source = context.selectors.nodeById(scene, sourceId);
  if (!source) return;

  const targetType = targetRow.dataset.itemType;
  const target = targetRow.dataset.itemId ? context.selectors.nodeById(scene, targetRow.dataset.itemId) : null;
  if (target && context.selectors.descendantsOf(scene, sourceId).some(node => node.id === target.id)) return;

  let parentId = source.parentId || null;
  let order = 0;
  if (targetType === "free" || !target) {
    parentId = null;
    order = context.selectors.childrenOf(scene, null).filter(node => node.id !== sourceId).length;
  } else if (target.nodeType === "group" && placement === "inside") {
    parentId = target.id;
    order = context.selectors.childrenOf(scene, target.id).filter(node => node.id !== sourceId).length;
  } else {
    parentId = target.parentId || null;
    const siblings = context.selectors.childrenOf(scene, parentId).filter(node => node.id !== sourceId);
    const targetIndex = siblings.findIndex(node => node.id === target.id);
    order = targetIndex < 0 ? siblings.length : targetIndex + (placement === "after" ? 1 : 0);
  }

  if (parentId) {
    const parent = context.selectors.nodeById(scene, parentId);
    if (!parent || parent.nodeType !== "group") return;
  }

  if ((source.parentId || null) === parentId) {
    context.commit({ type: "node.reorder", payload: { id: sourceId, order } }, { forceHistory: true });
  } else {
    context.commit({ type: "node.reparent", payload: { id: sourceId, parentId, order } }, { forceHistory: true });
  }
  syncTimelineExpandedSession(context.sceneStore.getSnapshot());
  selectItem(type, sourceId);
  updateEditor();
  updateHistoryControls();
}

function deleteTimelineItem(type, id) {
  const context = timelineContext();
  const scene = context.sceneStore.getSnapshot();
  const node = context.selectors.nodeById(scene, id);
  if (!node) return;
  const descendants = context.selectors.descendantsOf(scene, id);
  if (node.nodeType === "group" && descendants.length) {
    const objectCount = descendants.filter(child => child.nodeType !== "group").length;
    const groupCount = descendants.filter(child => child.nodeType === "group").length;
    const details = groupCount ? `${objectCount} / ${groupCount}` : String(objectCount);
    const question = MusicOverlay.compat.editorRuntime.currentLanguage === "ru"
      ? `Удалить группу «${node.name}» и всё поддерево (${details})? Ctrl+Z восстановит его.`
      : `Delete “${node.name}” and its subtree (${details})? Ctrl+Z can restore it.`;
    if (!window.confirm(question)) return;
  }

  context.commit({ type: "node.removeSubtree", payload: { id } }, { forceHistory: true });
  const expandedGroups = new Set(context.sessionStore.getSnapshot().expandedGroups);
  expandedGroups.delete(id);
  descendants.filter(child => child.nodeType === "group")
    .forEach(child => expandedGroups.delete(child.id));
  context.sessionStore.patch({ expandedGroups });

  const nextScene = context.sceneStore.getSnapshot();
  const fallback = context.selectors.flattenedLayerRows(nextScene, getExpandedTimelineGroups(nextScene))[0]?.node || null;
  if (fallback) selectItem(fallback.nodeType === "group" ? "group" : "layer", fallback.id);
  else {
    context.sessionStore.setSelection(null);
    updateEditor();
  }
  syncTimelineExpandedSession(nextScene);
  updateHistoryControls();
}

function formatTimelineTime(milliseconds) {
  const total = Math.max(0, Math.round(milliseconds));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const ms = total % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function updatePreviewTimeLabel() {
  $("previewTimeLabel").textContent = formatTimelineTime(timelineContext().sessionStore.getSnapshot().playheadMs);
}

function updatePlayhead() {
  const durationMs = Math.max(1, calculateTimelineDuration());
  const playheadMs = timelineContext().sessionStore.getSnapshot().playheadMs;
  const pct = playheadMs / durationMs;
  $("timelinePlayhead").style.setProperty("--timeline-pct", String(Math.max(0, Math.min(1, pct))));
}

function setPreviewTime(timeMs) {
  const playheadMs = clampNumber(timeMs, 0, calculateTimelineDuration(), 0);
  timelineContext().sessionStore.patch({ playheadMs });
  applyLayoutToPreview();
  updatePreviewTimeLabel();
  updatePlayhead();
}

function startTimelinePlayback() {
  stopTimelinePlayback(false);
  const context = timelineContext();
  const session = context.sessionStore.getSnapshot();
  const offsetMs = session.playheadMs >= calculateTimelineDuration() ? 0 : session.playheadMs;
  const startedAt = performance.now();
  context.sessionStore.patch({ playback: { ...session.playback, playing: true, frame: null, startedAt, offsetMs } });
  const tick = now => {
    const next = offsetMs + (now - startedAt);
    if (next >= calculateTimelineDuration()) {
      setPreviewTime(calculateTimelineDuration());
      stopTimelinePlayback(false);
      return;
    }
    setPreviewTime(next);
    const frame = requestAnimationFrame(tick);
    const current = context.sessionStore.getSnapshot();
    context.sessionStore.patch({ playback: { ...current.playback, frame } });
  };
  const frame = requestAnimationFrame(tick);
  const current = context.sessionStore.getSnapshot();
  context.sessionStore.patch({ playback: { ...current.playback, frame } });
}

function stopTimelinePlayback(reset = false) {
  const context = timelineContext();
  const session = context.sessionStore.getSnapshot();
  if (session.playback?.frame) cancelAnimationFrame(session.playback.frame);
  context.sessionStore.patch({ playback: { ...session.playback, playing: false, frame: null } });
  if (reset) setPreviewTime(0);
}

function fitCanvas() {
  if (MusicOverlay.compat.editorRuntime.canvasController) {
    const canvasScale = MusicOverlay.compat.editorRuntime.canvasController.fit();
    timelineContext().sessionStore.patch({ canvasScale });
  }
}

function updateCompositionDuration(event) {
  if (event.type === "input" && event.target.value === "") return;
  const rawSeconds = Number(event.target.value);
  if (event.type === "input" && !Number.isFinite(rawSeconds)) return;
  const seconds = clampNumber(rawSeconds, 1, 180, 30);
  const durationMs = Math.round(seconds * 1000);
  const context = timelineContext();
  const scene = context.sceneStore.getSnapshot();
  const mutations = [{ type: "scene.timeline", payload: { patch: { durationMs } } }];

  context.selectors.rootNodes(scene).forEach(node => {
    if (node.timing?.endMode !== "fixed") return;
    const window = context.selectors.effectiveTiming(scene, node.id);
    const start = Math.min(Number(window?.startMs || 0), Math.max(0, durationMs - 50));
    const end = Math.min(Number(window?.endMs || start + 50), durationMs);
    mutations.push(absoluteTimingMutation(scene, node, {
      startMs: start,
      endMs: Math.max(start + 50, end),
      endMode: "fixed"
    }));
  });

  context.commit({ type: "batch", payload: { mutations } }, { forceHistory: event.type === "change" });
  const playheadMs = Math.min(context.sessionStore.getSnapshot().playheadMs, durationMs);
  context.sessionStore.patch({ playheadMs });
  event.target.value = String(Math.round(seconds));
  updateEditor();
  updateHistoryControls();
}

MusicOverlay.editor.timeline = Object.freeze({
  render: renderTimeline,
  setTime: setPreviewTime,
  play: startTimelinePlayback,
  stop: stopTimelinePlayback,
  calculateDuration: calculateTimelineDuration
});

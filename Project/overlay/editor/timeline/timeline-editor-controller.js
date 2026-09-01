function calculateTimelineDuration() {
  return clampNumber(MusicOverlay.compat.legacyEditorState.value.layout?.compositionDurationMs, 1000, 180000, 30000);
}

function getCompositionDuration() {
  return calculateTimelineDuration();
}

function renderTimeline() {
  MusicOverlay.compat.editorRuntime.timelineDurationMs = calculateTimelineDuration();
  renderRuler();
  const body = $("timelineBody");
  body.innerHTML = "";

  MusicOverlay.compat.legacyEditorState.value.layout.groups.forEach(group => {
    body.appendChild(createTimelineRow(group, "group"));
    if (MusicOverlay.compat.editorRuntime.collapsedGroups.has(group.id)) return;
    MusicOverlay.compat.legacyEditorState.value.layout.layers.filter(layer => layer.groupId === group.id).forEach(layer => {
      body.appendChild(createTimelineRow(layer, "layer"));
    });
  });

  body.appendChild(createFreeTimelineZone());
  const ungrouped = MusicOverlay.compat.legacyEditorState.value.layout.layers.filter(layer => !layer.groupId);
  ungrouped.forEach(layer => body.appendChild(createTimelineRow(layer, "layer")));
  updatePlayhead();
}

function renderRuler() {
  const ruler = $("timelineRuler");
  ruler.innerHTML = `<div class="ruler-label">${t("layersControls")}</div><div class="ruler-track"></div>`;
  const track = ruler.querySelector(".ruler-track");
  const steps = Math.max(4, MusicOverlay.compat.editorRuntime.timelineDurationMs / 5000);
  for (let index = 0; index <= steps; index++) {
    const tick = document.createElement("div");
    tick.className = "ruler-tick";
    tick.style.left = `${(index / steps) * 100}%`;
    const label = document.createElement("span");
    label.textContent = `${Math.round((MusicOverlay.compat.editorRuntime.timelineDurationMs / steps * index) / 1000)}s`;
    tick.appendChild(label);
    track.appendChild(tick);
  }
}

function applyTimelineBarStyle(bar, item) {
  const start = Number(item.timing?.startMs || 0);
  const end = item.timing?.untilNextTrack ? MusicOverlay.compat.editorRuntime.timelineDurationMs : Number(item.timing?.endMs || start + 1000);
  bar.style.left = `${Math.min(100, start / MusicOverlay.compat.editorRuntime.timelineDurationMs * 100)}%`;
  bar.style.width = `${Math.max(.4, (end - start) / MusicOverlay.compat.editorRuntime.timelineDurationMs * 100)}%`;
  bar.classList.toggle("is-infinite", item.timing?.untilNextTrack === true);
  if (!item.timing?.untilNextTrack) bar.querySelector(".bar-infinity")?.remove();
  const group = MusicOverlay.compat.legacyEditorState.value.layout.groups.find(candidate => candidate.id === item.groupId);
  const offset = Number(group?.timing?.startMs || 0);
  const label = bar.querySelector(".bar-range");
  if (label) label.textContent = `${((start - offset) / 1000).toFixed(1)}–${item.timing?.untilNextTrack ? "∞" : ((end - offset) / 1000).toFixed(1)}s`;
}

function refreshTimelineBar(item) {
  const row = [...document.querySelectorAll(".timeline-row")].find(element => element.dataset.itemId === item.id);
  const bar = row?.querySelector(".track-bar");
  if (bar) applyTimelineBarStyle(bar, item);
}

function setupTimingDrag(bar, item, type) {
  bar.title = type === "group" ? "Перетащить группу по timeline" : "Перетащить слой по timeline";
  bar.addEventListener("pointerdown", event => {
    if (event.target.closest(".timing-resize-handle")) return;
    const itemGroup = type === "layer" ? getGroup(item.groupId) : item;
    if (event.button !== 0 || item.locked || itemGroup?.locked) return;
    event.stopPropagation();
    event.preventDefault();

    MusicOverlay.compat.editorRuntime.selection = { type, id: item.id };
    activateSidebarPane("inspector");
    document.querySelectorAll(".timeline-row").forEach(row => {
      row.classList.toggle("is-selected", row.dataset.itemType === type && row.dataset.itemId === item.id);
    });
    renderInspector();

    const affected = type === "group"
      ? [item, ...MusicOverlay.compat.legacyEditorState.value.layout.layers.filter(layer => layer.groupId === item.id)]
      : [item];
    const affectedIds = new Set(affected.map(affectedItem => affectedItem.id));
    const snapshots = affected.map(item => ({
      item,
      startMs: Number(item.timing?.startMs || 0),
      endMs: item.timing?.untilNextTrack ? null : Number(item.timing?.endMs || 0),
      untilNextTrack: item.timing?.untilNextTrack === true,
      untilGroupEnd: item.timing?.untilGroupEnd === true
    }));
    const earliestStart = Math.min(...snapshots.map(snapshot => snapshot.startMs));
    const latestBoundary = Math.max(...snapshots.map(snapshot => snapshot.untilNextTrack ? snapshot.startMs + 50 : snapshot.endMs));
    const anchoredToGroupEnd = type === "layer" && itemGroup && !itemGroup.timing.untilNextTrack && item.timing.untilGroupEnd;
    const allowedStart = type === "layer" && itemGroup ? Number(itemGroup.timing.startMs || 0) : 0;
    const allowedEnd = type === "layer" && itemGroup ? getTimingEnd(itemGroup) : MusicOverlay.compat.editorRuntime.timelineDurationMs;
    const minDelta = allowedStart - earliestStart;
    const maxDelta = anchoredToGroupEnd
      ? Math.max(minDelta, allowedEnd - earliestStart - 50)
      : Math.max(minDelta, allowedEnd - latestBoundary);
    const trackWidth = bar.parentElement.getBoundingClientRect().width || 1;
    const snapThresholdMs = Math.max(80, MusicOverlay.compat.editorRuntime.timelineDurationMs / trackWidth * 10);
    const snapTargets = [...MusicOverlay.compat.legacyEditorState.value.layout.groups, ...MusicOverlay.compat.legacyEditorState.value.layout.layers]
      .filter(target => !affectedIds.has(target.id))
      .flatMap(target => {
        const edges = [Number(target.timing?.startMs || 0)];
        if (!target.timing?.untilNextTrack) edges.push(Number(target.timing?.endMs || 0));
        return edges;
      });
    const startClientX = event.clientX;
    const pointerId = event.pointerId;
    let moved = false;

    bar.setPointerCapture(pointerId);

    const move = moveEvent => {
      if (moveEvent.pointerId !== pointerId) return;
      const rawDelta = (moveEvent.clientX - startClientX) / trackWidth * MusicOverlay.compat.editorRuntime.timelineDurationMs;
      let delta = Math.min(maxDelta, Math.max(minDelta, Math.round(rawDelta / 50) * 50));
      let snapEdge = null;
      let snapDistance = Infinity;
      snapTargets.forEach(targetEdge => {
        [targetEdge - earliestStart, ...(anchoredToGroupEnd ? [] : [targetEdge - latestBoundary])].forEach(candidate => {
          if (candidate < minDelta || candidate > maxDelta) return;
          const distance = Math.abs(candidate - delta);
          if (distance <= snapThresholdMs && distance < snapDistance) {
            snapDistance = distance;
            delta = candidate;
            snapEdge = targetEdge;
          }
        });
      });
      if (Math.abs(delta) > 0.001) moved = true;
      snapshots.forEach(snapshot => {
        snapshot.item.timing.startMs = snapshot.startMs + delta;
        snapshot.item.timing.endMs = snapshot.untilNextTrack ? null : anchoredToGroupEnd ? snapshot.endMs : snapshot.endMs + delta;
        refreshTimelineBar(snapshot.item);
      });
      applyLayoutToPreview();
      renderInspector();
      const guide = $("timelineSnapGuide");
      guide.classList.toggle("is-visible", snapEdge !== null);
      if (snapEdge !== null) guide.style.setProperty("--snap-pct", String(snapEdge / MusicOverlay.compat.editorRuntime.timelineDurationMs));
    };

    const end = endEvent => {
      if (endEvent.pointerId !== pointerId) return;
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", end);
      bar.removeEventListener("pointercancel", end);
      try { bar.releasePointerCapture(pointerId); } catch {}
      $("timelineSnapGuide").classList.remove("is-visible");
      if (moved) {
        constrainAllTimings();
        syncLegacyFromLayout();
        markThemeDirty();
      }
      renderTimeline();
      renderInspector();
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
    const parentGroup = type === "layer" ? getGroup(item.groupId) : null;
    if (event.button !== 0 || item.locked || parentGroup?.locked) return;
    event.stopPropagation();
    event.preventDefault();

    MusicOverlay.compat.editorRuntime.selection = { type, id: item.id };
    activateSidebarPane("inspector");
    renderInspector();

    const track = handle.closest(".track-cell");
    const rect = track?.getBoundingClientRect();
    if (!rect?.width) return;
    const pointerId = event.pointerId;
    const originalStart = Number(item.timing?.startMs || 0);
    const originalEnd = item.timing?.untilNextTrack ? MusicOverlay.compat.editorRuntime.timelineDurationMs : Number(item.timing?.endMs || originalStart + 1000);
    const groupStart = Number(parentGroup?.timing?.startMs || 0);
    const groupEnd = parentGroup ? getTimingEnd(parentGroup) : MusicOverlay.compat.editorRuntime.timelineDurationMs;
    const minTime = edge === "start" ? groupStart : originalStart + 50;
    const maxTime = edge === "start" ? originalEnd - 50 : groupEnd;
    const affected = type === "group"
      ? [item, ...MusicOverlay.compat.legacyEditorState.value.layout.layers.filter(layer => layer.groupId === item.id)]
      : [item];
    const affectedIds = new Set(affected.map(candidate => candidate.id));
    const snapTargets = [...MusicOverlay.compat.legacyEditorState.value.layout.groups, ...MusicOverlay.compat.legacyEditorState.value.layout.layers]
      .filter(candidate => !affectedIds.has(candidate.id))
      .flatMap(candidate => {
        const points = [Number(candidate.timing?.startMs || 0)];
        if (!candidate.timing?.untilNextTrack) points.push(Number(candidate.timing?.endMs || 0));
        return points;
      });
    const snapThresholdMs = Math.max(80, MusicOverlay.compat.editorRuntime.timelineDurationMs / rect.width * 10);
    let moved = false;

    handle.setPointerCapture(pointerId);

    const move = moveEvent => {
      if (moveEvent.pointerId !== pointerId) return;
      const ratio = Math.min(1, Math.max(0, (moveEvent.clientX - rect.left) / rect.width));
      let nextTime = Math.round((ratio * MusicOverlay.compat.editorRuntime.timelineDurationMs) / 50) * 50;
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

      if (edge === "start") {
        item.timing.startMs = nextTime;
      } else {
        item.timing.untilNextTrack = false;
        item.timing.untilGroupEnd = false;
        item.timing.endMs = nextTime;
        item.timing.finiteEndMs = nextTime;
      }

      if (type === "group") {
        if (edge === "end") {
          MusicOverlay.compat.legacyEditorState.value.layout.layers.filter(layer => layer.groupId === item.id).forEach(layer => {
            if (layer.timing.untilNextTrack) {
              layer.timing.untilNextTrack = false;
              layer.timing.untilGroupEnd = true;
              layer.timing.endMs = nextTime;
            }
          });
        }
        constrainGroupTiming(item, MusicOverlay.compat.editorRuntime.timelineDurationMs);
        MusicOverlay.compat.legacyEditorState.value.layout.layers.filter(layer => layer.groupId === item.id).forEach(layer => constrainLayerTiming(layer));
      } else {
        constrainLayerTiming(item);
      }

      affected.forEach(refreshTimelineBar);
      applyLayoutToPreview();
      renderInspector();
      const guide = $("timelineSnapGuide");
      guide.classList.toggle("is-visible", snapTime !== null);
      if (snapTime !== null) guide.style.setProperty("--snap-pct", String(snapTime / MusicOverlay.compat.editorRuntime.timelineDurationMs));
      moved = moved || Math.abs(nextTime - (edge === "start" ? originalStart : originalEnd)) > 0.001;
    };

    const end = endEvent => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      try { handle.releasePointerCapture(pointerId); } catch {}
      $("timelineSnapGuide").classList.remove("is-visible");
      if (moved) {
        constrainAllTimings();
        syncLegacyFromLayout();
        markThemeDirty();
      }
      renderTimeline();
      renderInspector();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  });
}

function createTimelineRow(item, type) {
  const row = document.createElement("div");
  row.className = `timeline-row ${type === "group" ? "is-group" : "layer-row-child"}`;
  row.classList.toggle("is-selected", MusicOverlay.compat.editorRuntime.selection.type === type && MusicOverlay.compat.editorRuntime.selection.id === item.id);
  row.dataset.itemType = type;
  row.dataset.itemId = item.id;

  const cell = document.createElement("div");
  cell.className = "layer-cell";

  let collapseButton = null;
  if (type === "group") {
    collapseButton = document.createElement("button");
    collapseButton.className = "row-icon-button group-collapse-button";
    collapseButton.textContent = MusicOverlay.compat.editorRuntime.collapsedGroups.has(item.id) ? "▸" : "▾";
    collapseButton.title = MusicOverlay.compat.editorRuntime.collapsedGroups.has(item.id) ? "Развернуть группу" : "Свернуть группу";
    collapseButton.addEventListener("click", event => {
      event.stopPropagation();
      if (MusicOverlay.compat.editorRuntime.collapsedGroups.has(item.id)) MusicOverlay.compat.editorRuntime.collapsedGroups.delete(item.id); else MusicOverlay.compat.editorRuntime.collapsedGroups.add(item.id);
      renderTimeline();
    });
  }

  const handle = document.createElement("button");
  handle.className = "drag-handle";
  handle.textContent = "⠿";
  handle.title = type === "group" ? "Перетащить группу между слоями" : "Перетащить для изменения Z-order";
  setupTimelineStructureDrag(handle, row, item, type);

  const visibleButton = document.createElement("button");
  visibleButton.className = `row-icon-button ${item.visible === false ? "is-off" : ""}`;
  visibleButton.textContent = item.visible === false ? "○" : "◉";
  visibleButton.title = "Видимость";
  visibleButton.addEventListener("click", event => {
    event.stopPropagation();
    item.visible = item.visible === false;
    markThemeDirty();
    updateEditor();
  });

  const lockButton = document.createElement("button");
  lockButton.className = `row-icon-button ${item.locked ? "" : "is-off"}`;
  lockButton.textContent = item.locked ? "▣" : "□";
  lockButton.title = "Lock";
  lockButton.addEventListener("click", event => {
    event.stopPropagation();
    item.locked = !item.locked;
    markThemeDirty();
    updateEditor();
  });

  const marker = document.createElement("span");
  marker.className = "color-marker";
  marker.style.background = item.marker;

  const name = document.createElement("span");
  name.className = "layer-name";
  name.textContent = item.name;
  name.title = item.name;
  name.dataset.kindLabel = type === "group"
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "ГРУППА · " : "GROUP · ")
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "ОБЪЕКТ · " : "OBJ · ");

  const zIndex = document.createElement("span");
  zIndex.className = "z-index-label";
  if (type === "layer") zIndex.textContent = `#${SceneOrder.getLocalIndex(MusicOverlay.compat.legacyEditorState.value.layout.layers, item) + 1}`;
  else zIndex.textContent = `${MusicOverlay.compat.legacyEditorState.value.layout.layers.filter(layer => layer.groupId === item.id).length}${MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "О" : "L"}`;

  const deleteButton = document.createElement("button");
  deleteButton.className = "row-icon-button row-delete-button";
  deleteButton.textContent = "🗑";
  deleteButton.title = type === "group" ? t("deleteGroup") : t("deleteLayer");
  deleteButton.addEventListener("click", event => {
    event.stopPropagation();
    deleteTimelineItem(type, item.id);
  });

  if (collapseButton) cell.append(collapseButton);
  cell.append(handle, visibleButton, lockButton, marker, name, zIndex, deleteButton);
  cell.addEventListener("click", () => selectItem(type, item.id));

  const track = document.createElement("div");
  track.className = "track-cell";
  const bar = document.createElement("div");
  bar.className = `track-bar ${item.timing?.untilNextTrack ? "is-infinite" : ""}`;
  bar.style.setProperty("--marker", item.marker);
  applyTimelineBarStyle(bar, item);
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
  if (item.timing?.untilNextTrack) {
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
  const targetType = targetRow.dataset.itemType;
  if (type === "group") {
    const groups = MusicOverlay.compat.legacyEditorState.value.layout.groups;
    const sourceIndex = groups.findIndex(group => group.id === sourceId);
    if (sourceIndex < 0) return;
    const targetGroupId = targetType === "group"
      ? targetRow.dataset.itemId
      : targetType === "layer"
        ? MusicOverlay.compat.legacyEditorState.value.layout.layers.find(layer => layer.id === targetRow.dataset.itemId)?.groupId
        : null;
    if (targetGroupId === sourceId) return;
    const [source] = groups.splice(sourceIndex, 1);
    let targetIndex = targetGroupId ? groups.findIndex(group => group.id === targetGroupId) : groups.length;
    if (targetIndex >= 0 && placement === "after") targetIndex += 1;
    groups.splice(targetIndex < 0 ? groups.length : targetIndex, 0, source);
  } else {
    const layers = MusicOverlay.compat.legacyEditorState.value.layout.layers;
    const sourceIndex = layers.findIndex(layer => layer.id === sourceId);
    if (sourceIndex < 0) return;
    const [source] = layers.splice(sourceIndex, 1);
    let targetIndex = layers.length;
    if (targetType === "group") {
      source.groupId = targetRow.dataset.itemId;
      const siblingIndexes = layers
        .map((layer, index) => layer.groupId === source.groupId ? index : -1)
        .filter(index => index >= 0);
      targetIndex = siblingIndexes.length
        ? (placement === "before" ? siblingIndexes[0] : siblingIndexes[siblingIndexes.length - 1] + 1)
        : layers.length;
    }
    else if (targetType === "layer") {
      const targetLayer = layers.find(layer => layer.id === targetRow.dataset.itemId);
      source.groupId = targetLayer?.groupId || null;
      targetIndex = targetLayer ? layers.indexOf(targetLayer) + (placement === "after" ? 1 : 0) : layers.length;
    } else source.groupId = null;
    layers.splice(targetIndex < 0 ? layers.length : targetIndex, 0, source);
    constrainLayerTiming(source);
  }
  markThemeDirty(true);
  updateEditor();
}

function deleteTimelineItem(type, id) {
  if (type === "layer") {
    const index = MusicOverlay.compat.legacyEditorState.value.layout.layers.findIndex(layer => layer.id === id);
    if (index < 0) return;
    MusicOverlay.compat.legacyEditorState.value.layout.layers.splice(index, 1);
  } else {
    const group = getGroup(id);
    if (!group) return;
    const childCount = MusicOverlay.compat.legacyEditorState.value.layout.layers.filter(layer => layer.groupId === id).length;
    if (childCount) {
      const question = MusicOverlay.compat.editorRuntime.currentLanguage === "ru"
        ? `Удалить группу «${group.name}» и объектов внутри: ${childCount}? Ctrl+Z восстановит их.`
        : `Delete “${group.name}” and its ${childCount} object(s)? Ctrl+Z can restore them.`;
      if (!window.confirm(question)) return;
    }
    MusicOverlay.compat.legacyEditorState.value.layout.groups = MusicOverlay.compat.legacyEditorState.value.layout.groups.filter(candidate => candidate.id !== id);
    MusicOverlay.compat.legacyEditorState.value.layout.layers = MusicOverlay.compat.legacyEditorState.value.layout.layers.filter(layer => layer.groupId !== id);
    MusicOverlay.compat.editorRuntime.collapsedGroups.delete(id);
  }
  const fallbackGroup = MusicOverlay.compat.legacyEditorState.value.layout.groups[0];
  const fallbackLayer = MusicOverlay.compat.legacyEditorState.value.layout.layers[0];
  MusicOverlay.compat.editorRuntime.selection = fallbackGroup
    ? { type: "group", id: fallbackGroup.id }
    : { type: "layer", id: fallbackLayer?.id || "" };
  markThemeDirty(true);
  updateEditor();
}

function formatTimelineTime(milliseconds) {
  const total = Math.max(0, Math.round(milliseconds));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const ms = total % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function updatePreviewTimeLabel() {
  $("previewTimeLabel").textContent = formatTimelineTime(MusicOverlay.compat.editorRuntime.previewTimeMs);
}

function updatePlayhead() {
  const pct = MusicOverlay.compat.editorRuntime.timelineDurationMs > 0 ? MusicOverlay.compat.editorRuntime.previewTimeMs / MusicOverlay.compat.editorRuntime.timelineDurationMs : 0;
  $("timelinePlayhead").style.setProperty("--timeline-pct", String(Math.max(0, Math.min(1, pct))));
}

function setPreviewTime(timeMs) {
  MusicOverlay.compat.editorRuntime.previewTimeMs = clampNumber(timeMs, 0, MusicOverlay.compat.editorRuntime.timelineDurationMs, 0);
  applyLayoutToPreview();
  updatePreviewTimeLabel();
  updatePlayhead();
}

function startTimelinePlayback() {
  stopTimelinePlayback(false);
  MusicOverlay.compat.editorRuntime.playbackOffset = MusicOverlay.compat.editorRuntime.previewTimeMs >= MusicOverlay.compat.editorRuntime.timelineDurationMs ? 0 : MusicOverlay.compat.editorRuntime.previewTimeMs;
  MusicOverlay.compat.editorRuntime.playbackStartedAt = performance.now();
  const tick = now => {
    const next = MusicOverlay.compat.editorRuntime.playbackOffset + (now - MusicOverlay.compat.editorRuntime.playbackStartedAt);
    if (next >= MusicOverlay.compat.editorRuntime.timelineDurationMs) {
      setPreviewTime(MusicOverlay.compat.editorRuntime.timelineDurationMs);
      stopTimelinePlayback(false);
      return;
    }
    setPreviewTime(next);
    MusicOverlay.compat.editorRuntime.playbackFrame = requestAnimationFrame(tick);
  };
  MusicOverlay.compat.editorRuntime.playbackFrame = requestAnimationFrame(tick);
}

function stopTimelinePlayback(reset = false) {
  if (MusicOverlay.compat.editorRuntime.playbackFrame) cancelAnimationFrame(MusicOverlay.compat.editorRuntime.playbackFrame);
  MusicOverlay.compat.editorRuntime.playbackFrame = null;
  if (reset) setPreviewTime(0);
}

function fitCanvas() {
  if (MusicOverlay.compat.editorRuntime.canvasController) MusicOverlay.compat.editorRuntime.canvasScale = MusicOverlay.compat.editorRuntime.canvasController.fit();
}

function updateCompositionDuration(event) {
  if (event.type === "input" && event.target.value === "") return;
  const rawSeconds = Number(event.target.value);
  if (event.type === "input" && !Number.isFinite(rawSeconds)) return;
  const seconds = clampNumber(rawSeconds, 1, 180, 30);
  MusicOverlay.compat.legacyEditorState.value.layout.compositionDurationMs = Math.round(seconds * 1000);
  MusicOverlay.compat.editorRuntime.timelineDurationMs = MusicOverlay.compat.legacyEditorState.value.layout.compositionDurationMs;
  constrainAllTimings();
  event.target.value = String(Math.round(seconds));
  markThemeDirty();
  updateEditor();
}


MusicOverlay.editor.timeline = Object.freeze({ render: renderTimeline, setTime: setPreviewTime, play: startTimelinePlayback, stop: stopTimelinePlayback, calculateDuration: calculateTimelineDuration });

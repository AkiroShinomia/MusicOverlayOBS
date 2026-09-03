function getLibraryCategories() {
  return LIBRARY_CATEGORIES.map(category => ({
    ...category,
    items: category.id === "artwork" ? [...category.items, ...MusicOverlay.editor.state.uiAdapters.customLibraryAssets()] : [...category.items]
  }));
}

function findLibraryItem(id) {
  return getLibraryCategories().flatMap(category => category.items).find(item => item.id === id) || null;
}

function localized(value) {
  return typeof value === "string" ? value : value?.[MusicOverlay.compat.editorRuntime.currentLanguage] || value?.ru || value?.en || "";
}

function renderLibrary() {
  const root = $("objectLibrary");
  if (!root) return;
  root.innerHTML = "";
  getLibraryCategories().forEach(category => {
    const details = document.createElement("details");
    details.className = "library-category";
    details.dataset.categoryId = category.id;
    const summary = document.createElement("summary");
    summary.innerHTML = `<span>${category.icon}</span><b>${localized(category.name)}</b><span class="library-category-count">${category.items.length}</span>`;
    const items = document.createElement("div");
    items.className = "library-items";
    if (!category.items.length) {
      items.innerHTML = `<div class="library-empty">${t("inDevelopment")}</div>`;
    }
    let activeSection = null;
    category.items.forEach(item => {
      if (item.section && item.section !== activeSection) {
        activeSection = item.section;
        const heading = document.createElement("div");
        heading.className = "library-subheading";
        heading.textContent = item.section === "in" ? "IN" : "OUT";
        items.appendChild(heading);
      }
      const card = document.createElement("button");
      card.type = "button";
      card.className = "library-object";
      card.draggable = false;
      card.dataset.libraryItem = item.id;
      const icon = item.assetData ? `<img src="${item.assetData}" alt="" />` : item.icon;
      card.innerHTML = `<span class="object-icon">${icon}</span><span>${localized(item.name)}</span><small>${localized(item.desc)}</small>`;
      card.addEventListener("click", () => previewLibraryItem(item, card));
      card.addEventListener("dragstart", event => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-music-library", JSON.stringify({ id: item.id, payloadType: item.payloadType }));
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
      setupPointerLibraryDrag(card, item);
      setupMouseLibraryDrag(card, item);
      items.appendChild(card);
    });
    details.append(summary, items);
    root.appendChild(details);
  });
}

function previewLibraryItem(item, card) {
  document.querySelectorAll(".library-object.is-previewed").forEach(node => node.classList.remove("is-previewed"));
  card?.classList.add("is-previewed");
  const preview = $("libraryPreview");
  const icon = item.assetData ? `<img src="${item.assetData}" alt="" />` : item.icon;
  preview.innerHTML = `<span class="library-preview-icon">${icon}</span><div><b>${localized(item.name)}</b><small>${localized(item.desc)} · ${MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Drag на объект, группу или Timeline" : "Drag to an object, group or Timeline"}</small></div>`;
}

function readLibraryPayload(event) {
  try {
    const raw = event.dataTransfer?.getData("application/x-music-library");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function isLibraryDrag(event) {
  return [...(event.dataTransfer?.types || [])].includes("application/x-music-library");
}

function getDropTime(event, row = null) {
  const track = row?.querySelector(".track-cell") || $("timelineRuler").querySelector(".ruler-track");
  if (!track) return 0;
  const rect = track.getBoundingClientRect();
  return clampNumber((event.clientX - rect.left) / Math.max(1, rect.width) * MusicOverlay.editor.state.uiAdapters.timelineDurationMs(), 0, MusicOverlay.editor.state.uiAdapters.timelineDurationMs(), 0);
}

function getDropTimeFromPoint(clientX, row = null) {
  const track = row?.querySelector(".track-cell") || $("timelineRuler").querySelector(".ruler-track");
  if (!track) return 0;
  const rect = track.getBoundingClientRect();
  return clampNumber((clientX - rect.left) / Math.max(1, rect.width) * MusicOverlay.editor.state.uiAdapters.timelineDurationMs(), 0, MusicOverlay.editor.state.uiAdapters.timelineDurationMs(), 0);
}

function setupPointerLibraryDrag(card, libraryItem) {
  let drag = null;
  card.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.pointerType === "mouse") return;
    drag?.ghost?.remove();
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, ghost: null, targetRow: null };
    card.setPointerCapture(event.pointerId);
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
  });
  card.addEventListener("pointermove", event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7) {
      drag.moved = true;
      drag.ghost = document.createElement("div");
      drag.ghost.className = "library-drag-ghost";
      drag.ghost.innerHTML = `<span>${libraryItem.icon}</span>${localized(libraryItem.name)}`;
      document.body.appendChild(drag.ghost);
      card.classList.add("is-dragging");
    }
    if (drag.moved) {
      drag.ghost.style.left = `${event.clientX + 12}px`;
      drag.ghost.style.top = `${event.clientY + 12}px`;
      document.querySelectorAll(".timeline-row.is-drop-target").forEach(row => row.classList.remove("is-drop-target"));
      drag.targetRow = document.elementFromPoint(event.clientX, event.clientY)?.closest(".timeline-row") || drag.targetRow;
      drag.targetRow?.classList.add("is-drop-target");
      event.preventDefault();
    }
  });
  const finish = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      dropLibraryItemAt(libraryItem, event.clientX, event.clientY, drag.targetRow);
      event.preventDefault();
    }
    try { card.releasePointerCapture(drag.pointerId); } catch {}
    drag.ghost?.remove();
    card.classList.remove("is-dragging");
    document.querySelectorAll(".timeline-row.is-drop-target").forEach(row => row.classList.remove("is-drop-target"));
    document.removeEventListener("pointerup", finish, true);
    document.removeEventListener("pointercancel", finish, true);
    drag = null;
  };
  card.addEventListener("pointerup", finish);
  card.addEventListener("pointercancel", finish);
}

function setupMouseLibraryDrag(card, libraryItem) {
  let drag = null;
  const move = event => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7) {
      drag.moved = true;
      drag.ghost = document.createElement("div");
      drag.ghost.className = "library-drag-ghost";
      drag.ghost.innerHTML = `<span>${libraryItem.icon}</span>${localized(libraryItem.name)}`;
      document.body.appendChild(drag.ghost);
      card.classList.add("is-dragging");
    }
    if (!drag.moved) return;
    drag.ghost.style.left = `${event.clientX + 12}px`;
    drag.ghost.style.top = `${event.clientY + 12}px`;
    document.querySelectorAll(".timeline-row.is-drop-target").forEach(row => row.classList.remove("is-drop-target"));
    drag.targetRow = document.elementFromPoint(event.clientX, event.clientY)?.closest(".timeline-row") || drag.targetRow;
    drag.targetRow?.classList.add("is-drop-target");
    event.preventDefault();
  };
  const finish = event => {
    if (!drag) return;
    if (drag.moved) {
      dropLibraryItemAt(libraryItem, event.clientX, event.clientY, drag.targetRow);
      event.preventDefault();
    }
    drag.ghost?.remove();
    card.classList.remove("is-dragging");
    document.querySelectorAll(".timeline-row.is-drop-target").forEach(row => row.classList.remove("is-drop-target"));
    document.removeEventListener("mousemove", move, true);
    document.removeEventListener("mouseup", finish, true);
    drag = null;
  };
  card.addEventListener("mousedown", event => {
    if (event.button !== 0) return;
    drag = { startX: event.clientX, startY: event.clientY, moved: false, ghost: null, targetRow: null };
    document.addEventListener("mousemove", move, true);
    document.addEventListener("mouseup", finish, true);
  });
}

function dropLibraryItemAt(libraryItem, clientX, clientY, preferredRow = null) {
  const target = document.elementFromPoint(clientX, clientY);
  const row = preferredRow || target?.closest(".timeline-row") || null;
  const targetType = row?.dataset.itemType;
  const targetItem = row?.dataset.itemId
    ? MusicOverlay.editor.state.uiAdapters.get(row.dataset.itemId)
    : null;
  const groupId = targetType === "group" ? targetItem?.id : targetItem?.groupId || null;
  if (row || target?.closest(".timeline-scroll")) {
    applyLibraryItemDrop(libraryItem, groupId, targetItem, getDropTimeFromPoint(clientX, row));
  }
}

function setupLibraryDropOnTimelineRow(row, item, type) {
  row.addEventListener("dragover", event => {
    if (!isLibraryDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    row.classList.add("is-drop-target");
  });
  row.addEventListener("dragleave", event => {
    if (!row.contains(event.relatedTarget)) row.classList.remove("is-drop-target");
  });
  row.addEventListener("drop", event => {
    if (!isLibraryDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    row.classList.remove("is-drop-target");
    const groupId = type === "group" ? item.id : item.groupId || item.parentId || null;
    handleLibraryDrop(event, groupId, item);
  });
}

function setupTimelineLibraryDropZone() {
  const timeline = document.querySelector(".timeline-scroll");
  timeline.addEventListener("dragover", event => {
    if (!isLibraryDrag(event)) return;
    event.preventDefault();
    timeline.classList.add("is-library-drop");
  });
  timeline.addEventListener("dragleave", event => {
    if (!timeline.contains(event.relatedTarget)) timeline.classList.remove("is-library-drop");
  });
  timeline.addEventListener("drop", event => {
    timeline.classList.remove("is-library-drop");
    const row = event.target.closest(".timeline-row");
    if (!isLibraryDrag(event) || (row && row.dataset.itemType !== "free")) return;
    event.preventDefault();
    handleLibraryDrop(event, null, null);
  });
}

function handleLibraryDrop(event, groupId, targetItem) {
  const payload = readLibraryPayload(event);
  const libraryItem = findLibraryItem(payload?.id);
  if (!libraryItem) return;
  applyLibraryItemDrop(libraryItem, groupId, targetItem, getDropTime(event, event.target.closest(".timeline-row")));
}

function applyLibraryItemDrop(libraryItem, groupId, targetItem, requestedStart) {
  if (libraryItem.payloadType === "object") {
    addLibraryObject(libraryItem, groupId, requestedStart);
    return;
  }
  if (!targetItem) {
    setStatus(MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Анимацию или эффект нужно бросить на объект или группу." : "Drop animations and effects on an object or group.", "error");
    return;
  }

  const context = MusicOverlay.editor.context;
  const node = context.selectors.nodeById(context.sceneStore.getSnapshot(), targetItem.id);
  if (!node) return;
  const targetType = node.nodeType === "group" ? "group" : "layer";

  if (libraryItem.payloadType.startsWith("animation")) {
    const inheritedFrom = getAnimationOverrideGroup(targetItem, targetType);
    if (inheritedFrom) {
      setStatus(MusicOverlay.compat.editorRuntime.currentLanguage === "ru"
        ? `Анимацией управляет группа «${inheritedFrom.name}».`
        : `Animation is controlled by “${inheritedFrom.name}”.`, "error");
      return;
    }
    if (targetType === "group" && node.animations?.overrideChildren !== true) {
      setStatus(MusicOverlay.compat.editorRuntime.currentLanguage === "ru"
        ? "Сначала включите «Затирать анимации объектов» в настройках группы."
        : "Enable “Override child animations” on the group first.", "error");
      return;
    }
  }

  if (libraryItem.payloadType === "animation-in") {
    context.commit({
      type: "node.animations",
      payload: {
        id: node.id,
        patch: { in: { ...(node.animations?.in || {}), type: libraryItem.value } }
      }
    }, { forceHistory: true });
  } else if (libraryItem.payloadType === "animation-out") {
    context.commit({
      type: "node.animations",
      payload: {
        id: node.id,
        patch: { out: { ...(node.animations?.out || {}), type: libraryItem.value } }
      }
    }, { forceHistory: true });
  } else if (libraryItem.payloadType === "effect") {
    const current = MusicOverlay.editor.state.uiAdapters.effectsObject(node);
    const next = { ...current, ...(libraryItem.value || {}) };
    context.commit({
      type: "node.effects",
      payload: {
        id: node.id,
        effects: [
          { type: "opacity", enabled: true, value: Number(next.opacity ?? 100) },
          { type: "blur", enabled: Number(next.blur || 0) > 0, value: Number(next.blur || 0) },
          { type: "glow", enabled: Number(next.glow || 0) > 0, value: Number(next.glow || 0) }
        ]
      }
    }, { forceHistory: true });
  }

  selectItem(targetType, node.id);
  updateHistoryControls();
  setStatus(`${localized(libraryItem.name)} → ${node.name}`, "success");
}

function addLibraryObject(template, groupId, requestedStart) {
  const context = MusicOverlay.editor.context;
  const scene = context.sceneStore.getSnapshot();
  const group = groupId ? context.selectors.nodeById(scene, groupId) : null;
  const groupTiming = group ? context.selectors.effectiveTiming(scene, group.id) : null;
  const boundaryStart = Number(groupTiming?.startMs || 0);
  const boundaryEnd = Number.isFinite(Number(groupTiming?.endMs))
    ? Number(groupTiming.endMs)
    : Number(scene.timeline?.durationMs || 30000);
  const absoluteStart = clampNumber(
    Math.round(requestedStart / 50) * 50,
    boundaryStart,
    Math.max(boundaryStart, boundaryEnd - 50),
    boundaryStart
  );
  const absoluteEnd = Math.min(boundaryEnd, absoluteStart + 5000);
  const id = `lib-${template.id}-${Date.now().toString(36)}`;
  const componentCount = scene.nodes.filter(node => node.nodeType !== "group").length;
  const properties = structuredClone(template.properties || {});
  if (template.assetData) properties.assetData = template.assetData;

  const node = {
    id,
    nodeType: "component",
    name: localized(template.name),
    parentId: group?.id || null,
    order: 0,
    visible: true,
    locked: false,
    marker: markerPalette[componentCount % markerPalette.length],
    transform: {
      x: 720 + (componentCount % 6) * 24,
      y: 410 + (componentCount % 5) * 24,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchorX: .5,
      anchorY: .5
    },
    timing: {
      startMs: Math.max(0, absoluteStart - boundaryStart),
      endMode: "fixed",
      durationMs: Math.max(50, absoluteEnd - absoluteStart)
    },
    effects: [
      { type: "opacity", enabled: true, value: 100 },
      { type: "blur", enabled: false, value: 0 },
      { type: "glow", enabled: false, value: 0 }
    ],
    animations: {
      in: { type: "fade", durationMs: 500, easing: "ease-out" },
      out: { type: "fade", durationMs: 500, easing: "ease-out" }
    },
    component: {
      kind: template.kind || "unknown",
      templateId: template.id,
      properties
    }
  };

  context.commit({ type: "node.add", payload: { node } }, { forceHistory: true });
  context.sessionStore.patch({
    playheadMs: Math.min(Number(scene.timeline?.durationMs || 30000), absoluteStart + 100)
  });
  selectItem("layer", id);
  updateHistoryControls();
  setStatus(`${localized(template.name)} ${MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "добавлен" : "added"}`, "success");
}

async function uploadLibraryObject(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const assetData = await fileToBase64(file);
  const asset = {
    id: `custom-art-${Date.now().toString(36)}`,
    payloadType: "object",
    kind: "image",
    icon: "▧",
    name: { ru: file.name.replace(/\.[^.]+$/, ""), en: file.name.replace(/\.[^.]+$/, "") },
    desc: { ru: "Свой объект", en: "Custom asset" },
    properties: { width: 160, height: 160, borderRadius: 12, source: "asset" },
    assetData
  };
  const customLibraryAssets = MusicOverlay.editor.state.uiAdapters.customLibraryAssets();
  customLibraryAssets.push(asset);
  MusicOverlay.editor.context.sessionStore.patch({ customLibraryAssets });
  saveCustomLibraryAssets();
  renderLibrary();
  const category = document.querySelector('[data-category-id="artwork"]');
  if (category) category.open = true;
  previewLibraryItem(asset, document.querySelector(`[data-library-item="${asset.id}"]`));
  event.target.value = "";
}


MusicOverlay.editor.library = Object.freeze({ render: renderLibrary, addObject: addLibraryObject, uploadObject: uploadLibraryObject, categories: getLibraryCategories });

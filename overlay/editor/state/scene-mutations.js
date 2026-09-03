(function registerSceneMutations(root) {
  "use strict";

  root.editor ||= {};
  root.editor.state ||= {};

  const clone = value => structuredClone(value);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const parentKey = value => value ?? null;

  function find(scene, id) {
    return scene.nodes.find(node => node.id === id) || null;
  }

  function orderedSiblings(scene, parentId, excludeId = null) {
    const targetParent = parentKey(parentId);
    return scene.nodes
      .map((node, index) => ({ node, index }))
      .filter(entry => entry.node.id !== excludeId && parentKey(entry.node.parentId) === targetParent)
      .sort((left, right) => {
        const a = finite(left.node.order, Number.MAX_SAFE_INTEGER);
        const b = finite(right.node.order, Number.MAX_SAFE_INTEGER);
        return a !== b ? a - b : left.index - right.index;
      })
      .map(entry => entry.node);
  }

  function normalizeOrders(scene, parentId) {
    orderedSiblings(scene, parentId).forEach((node, index) => { node.order = index; });
  }

  function normalizeScene(sceneInput) {
    const scene = clone(sceneInput);
    if (!Array.isArray(scene?.nodes)) return scene;
    const parents = new Set([null]);
    scene.nodes.forEach(node => parents.add(parentKey(node.parentId)));
    parents.forEach(parentId => normalizeOrders(scene, parentId));
    return scene;
  }

  function ensureParentGroup(scene, parentId) {
    if (!parentId) return null;
    const parent = find(scene, parentId);
    if (!parent) throw new Error(`Missing parent '${parentId}'`);
    if (parent.nodeType !== "group") throw new Error(`Parent '${parentId}' must be a group`);
    return parent;
  }

  function ensureNoCycle(scene, id, parentId) {
    if (!parentId) return;
    if (id === parentId) throw new Error("Node cannot be its own parent");
    const visited = new Set([id]);
    let cursor = find(scene, parentId);
    while (cursor) {
      if (!visited.add(cursor.id)) throw new Error(`Scene node cycle detected at '${cursor.id}'`);
      cursor = cursor.parentId ? find(scene, cursor.parentId) : null;
    }
  }

  function collectSubtree(scene, id) {
    const ids = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of scene.nodes) {
        if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
          ids.add(node.id);
          changed = true;
        }
      }
    }
    return scene.nodes.filter(node => ids.has(node.id));
  }

  function removeSubtree(scene, id) {
    const ids = new Set(collectSubtree(scene, id).map(node => node.id));
    scene.nodes = scene.nodes.filter(node => !ids.has(node.id));
  }

  function uniqueId(scene, requestedBase, reserved = new Set()) {
    const base = String(requestedBase || "node-copy");
    const occupied = new Set(scene.nodes.map(node => node.id));
    reserved.forEach(id => occupied.add(id));
    if (!occupied.has(base)) return base;
    let index = 2;
    while (occupied.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
  }

  function placeAtOrder(scene, id, parentId, requestedOrder) {
    const node = find(scene, id);
    if (!node) return;
    const siblings = orderedSiblings(scene, parentId, id);
    const index = Math.max(0, Math.min(siblings.length, Math.round(finite(requestedOrder, siblings.length))));
    siblings.splice(index, 0, node);
    siblings.forEach((item, order) => { item.order = order; });
  }

  function duplicateSubtree(scene, payload) {
    const source = find(scene, payload.id);
    if (!source) return false;

    const subtree = collectSubtree(scene, source.id);
    const explicitRootId = payload.newId == null ? null : String(payload.newId);
    if (explicitRootId && find(scene, explicitRootId)) throw new Error(`Duplicate node id '${explicitRootId}'`);

    const idMap = new Map();
    const reserved = new Set();
    for (const original of subtree) {
      const requested = original.id === source.id && explicitRootId
        ? explicitRootId
        : `${original.id}-copy`;
      const nextId = original.id === source.id && explicitRootId
        ? explicitRootId
        : uniqueId(scene, requested, reserved);
      idMap.set(original.id, nextId);
      reserved.add(nextId);
    }

    const hasParentOverride = Object.prototype.hasOwnProperty.call(payload, "parentId");
    const rootParentId = hasParentOverride ? parentKey(payload.parentId) : parentKey(source.parentId);
    ensureParentGroup(scene, rootParentId);

    const sourceSiblings = orderedSiblings(scene, source.parentId);
    const sourceIndex = sourceSiblings.findIndex(node => node.id === source.id);
    const defaultOrder = rootParentId === parentKey(source.parentId) && sourceIndex >= 0
      ? sourceIndex + 1
      : orderedSiblings(scene, rootParentId).length;

    for (const original of subtree) {
      const copy = clone(original);
      copy.id = idMap.get(original.id);
      copy.parentId = original.id === source.id
        ? rootParentId
        : idMap.get(original.parentId) || null;
      if (original.id === source.id && payload.name != null) copy.name = String(payload.name);
      scene.nodes.push(copy);
    }

    const duplicatedParentIds = new Set(
      subtree
        .filter(node => node.nodeType === "group")
        .map(node => idMap.get(node.id))
    );
    duplicatedParentIds.forEach(parentId => normalizeOrders(scene, parentId));
    placeAtOrder(scene, idMap.get(source.id), rootParentId, payload.order ?? defaultOrder);
    return true;
  }

  function apply(sceneInput, mutation) {
    const type = mutation?.type;
    const payload = mutation?.payload || {};
    if (type === "batch") {
      return (payload.mutations || []).reduce((scene, item) => apply(scene, item), sceneInput);
    }

    const scene = clone(sceneInput);
    const node = payload.id ? find(scene, payload.id) : null;

    switch (type) {
      case "node.add": {
        const next = clone(payload.node);
        if (!next?.id) throw new Error("node.add requires node.id");
        if (find(scene, next.id)) throw new Error(`Duplicate node id '${next.id}'`);
        ensureParentGroup(scene, next.parentId);
        next.parentId = parentKey(next.parentId);
        next.order = finite(next.order, orderedSiblings(scene, next.parentId).length);
        scene.nodes.push(next);
        placeAtOrder(scene, next.id, next.parentId, next.order);
        break;
      }
      case "node.removeSubtree": {
        if (!node) return sceneInput;
        const parentId = parentKey(node.parentId);
        removeSubtree(scene, node.id);
        normalizeOrders(scene, parentId);
        break;
      }
      case "node.duplicate": {
        if (!duplicateSubtree(scene, payload)) return sceneInput;
        break;
      }
      case "node.rename":
        if (!node) return sceneInput;
        node.name = String(payload.name || node.id);
        break;
      case "node.visibility":
        if (!node) return sceneInput;
        node.visible = payload.visible !== false;
        break;
      case "node.lock":
        if (!node) return sceneInput;
        node.locked = payload.locked === true;
        break;
      case "node.marker":
        if (!node) return sceneInput;
        node.marker = String(payload.marker || "#8b5cf6");
        break;
      case "node.transform":
        if (!node) return sceneInput;
        node.transform = { ...(node.transform || {}), ...clone(payload.patch || {}) };
        break;
      case "node.timing":
        if (!node) return sceneInput;
        node.timing = { ...(node.timing || {}), ...clone(payload.patch || {}) };
        break;
      case "node.effects":
        if (!node) return sceneInput;
        node.effects = clone(payload.effects || []);
        break;
      case "node.animations":
        if (!node) return sceneInput;
        node.animations = { ...(node.animations || {}), ...clone(payload.patch || {}) };
        break;
      case "node.componentProperties":
        if (!node) return sceneInput;
        node.component ||= { kind: "unknown", properties: {} };
        node.component.properties = { ...(node.component.properties || {}), ...clone(payload.patch || {}) };
        break;
      case "node.reparent": {
        if (!node) return sceneInput;
        const oldParent = parentKey(node.parentId);
        const parentId = parentKey(payload.parentId);
        ensureParentGroup(scene, parentId);
        ensureNoCycle(scene, node.id, parentId);
        if (oldParent === parentId && payload.order == null) return sceneInput;
        node.parentId = parentId;
        const targetOrder = payload.order ?? orderedSiblings(scene, parentId, node.id).length;
        normalizeOrders(scene, oldParent);
        placeAtOrder(scene, node.id, parentId, targetOrder);
        break;
      }
      case "node.reorder": {
        if (!node) return sceneInput;
        const siblings = orderedSiblings(scene, node.parentId, node.id);
        const current = orderedSiblings(scene, node.parentId).findIndex(item => item.id === node.id);
        const index = Math.max(0, Math.min(siblings.length, Math.round(finite(payload.order, 0))));
        if (current === index) return sceneInput;
        siblings.splice(index, 0, node);
        siblings.forEach((item, order) => { item.order = order; });
        break;
      }
      case "scene.canvas":
        scene.canvas = { ...(scene.canvas || {}), ...clone(payload.patch || {}) };
        break;
      case "scene.timeline":
        scene.timeline = { ...(scene.timeline || {}), ...clone(payload.patch || {}) };
        break;
      case "scene.appearance":
        scene.appearance = { ...(scene.appearance || {}), ...clone(payload.patch || {}) };
        break;
      case "scene.metadata":
        scene.metadata = { ...(scene.metadata || {}), ...clone(payload.patch || {}) };
        break;
      case "scene.replace":
      case "history.replace":
        return normalizeScene(payload.scene);
      default:
        throw new Error(`Unsupported Scene mutation '${type}'`);
    }

    return scene;
  }

  root.editor.state.mutations = Object.freeze({ apply, normalize: normalizeScene });
})(window.MusicOverlay);

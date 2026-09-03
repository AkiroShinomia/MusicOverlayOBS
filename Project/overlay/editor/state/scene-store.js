(function registerSceneStore(root) {
  "use strict";

  root.editor ||= {};
  root.editor.state ||= {};

  const clone = value => structuredClone(value);

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }

  function stableJson(value) {
    return JSON.stringify(canonicalize(value));
  }

  function hash(value) {
    const text = stableJson(value);
    let result = 2166136261;
    for (let index = 0; index < text.length; index++) {
      result ^= text.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(16).padStart(8, "0");
  }

  function validate(scene) {
    const errors = [];
    if (scene?.documentType !== "music-overlay.scene") errors.push("Unsupported documentType");
    if (Number(scene?.schemaVersion) !== 2) errors.push("Unsupported schemaVersion");
    if (!scene?.canvas || !scene?.timeline || !scene?.appearance || !Array.isArray(scene?.nodes)) {
      errors.push("Missing required top-level section");
    }
    if (!Number.isFinite(Number(scene?.timeline?.durationMs)) || Number(scene?.timeline?.durationMs) <= 0) {
      errors.push("Invalid timeline.durationMs");
    }

    const ids = new Set();
    const byId = new Map();
    for (const node of scene?.nodes || []) {
      if (!node?.id || ids.has(node.id)) errors.push(`Duplicate or empty node id '${node?.id || ""}'`);
      ids.add(node?.id);
      byId.set(node?.id, node);
      if (!["group", "component"].includes(node?.nodeType)) errors.push(`Invalid nodeType '${node?.nodeType}' on '${node?.id}'`);
      if (!Number.isInteger(Number(node?.order)) || Number(node.order) < 0) errors.push(`Invalid order on '${node?.id}'`);
      if (node?.nodeType === "component") {
        if (!node?.component || typeof node.component !== "object") errors.push(`Missing component on '${node?.id}'`);
        else if (!node.component.kind) errors.push(`Missing component kind on '${node?.id}'`);
      }
      for (const [key, value] of Object.entries(node?.transform || {})) {
        if (["x", "y", "scaleX", "scaleY", "rotation", "anchorX", "anchorY"].includes(key) && !Number.isFinite(Number(value))) {
          errors.push(`Invalid transform.${key} on '${node?.id}'`);
        }
      }
      const timing = node?.timing || {};
      if (!Number.isFinite(Number(timing.startMs)) || Number(timing.startMs) < 0) errors.push(`Invalid timing.startMs on '${node?.id}'`);
      if (!["fixed", "parentEnd", "trackEnd"].includes(timing.endMode)) errors.push(`Invalid timing.endMode on '${node?.id}'`);
      if (timing.endMode === "fixed" && (!Number.isFinite(Number(timing.durationMs)) || Number(timing.durationMs) < 0)) {
        errors.push(`Invalid timing.durationMs on '${node?.id}'`);
      }
    }

    for (const node of scene?.nodes || []) {
      if (node.parentId) {
        const parent = byId.get(node.parentId);
        if (!parent) errors.push(`Missing parent '${node.parentId}' for '${node.id}'`);
        else if (parent.nodeType !== "group") errors.push(`Parent '${node.parentId}' for '${node.id}' must be a group`);
      }
      const visited = new Set([node.id]);
      let cursor = node.parentId ? byId.get(node.parentId) : null;
      let depth = 0;
      while (cursor) {
        depth += 1;
        if (!visited.add(cursor.id)) {
          errors.push(`Cycle detected at '${cursor.id}'`);
          break;
        }
        if (depth > 64) {
          errors.push(`Tree depth exceeds 64 at '${node.id}'`);
          break;
        }
        cursor = cursor.parentId ? byId.get(cursor.parentId) : null;
      }
    }

    const siblingOrders = new Map();
    for (const node of scene?.nodes || []) {
      const key = node.parentId ?? null;
      if (!siblingOrders.has(key)) siblingOrders.set(key, []);
      siblingOrders.get(key).push(Number(node.order));
    }
    siblingOrders.forEach((orders, parentId) => {
      const sorted = [...orders].sort((a, b) => a - b);
      sorted.forEach((order, index) => {
        if (order !== index) errors.push(`Non-normalized order under '${parentId || "root"}'`);
      });
    });

    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  }

  function create() {
    let document = null;
    let localRevision = 0;
    let savedDraftRevision = 0;
    let publishedHash = null;
    let validation = Object.freeze({ valid: false, errors: Object.freeze(["Scene not loaded"]) });
    let currentHash = null;
    let source = null;
    const listeners = new Set();

    function state() {
      return Object.freeze({ document, localRevision, savedDraftRevision, publishedHash, validation, currentHash, source });
    }

    function emit(mutation) {
      const snapshot = state();
      listeners.forEach(listener => listener(snapshot, mutation));
    }

    function normalize(scene) {
      return root.editor.state.mutations.normalize(scene);
    }

    function load(scene, nextSource = "unknown") {
      const candidate = normalize(scene);
      const result = validate(candidate);
      if (!result.valid) throw new Error(result.errors.join("; "));
      document = deepFreeze(candidate);
      localRevision = 0;
      savedDraftRevision = 0;
      validation = result;
      currentHash = hash(document);
      source = nextSource;
      emit({ type: "scene.load", payload: { source: nextSource } });
      return getSnapshot();
    }

    function getSnapshot() {
      return document == null ? null : clone(document);
    }

    function dispatch(mutation) {
      if (!document) throw new Error("Scene Store is not loaded");
      const next = root.editor.state.mutations.apply(document, mutation);
      if (next === document || stableJson(next) === stableJson(document)) return state();
      const result = validate(next);
      if (!result.valid) throw new Error(result.errors.join("; "));
      document = deepFreeze(next);
      localRevision += 1;
      validation = result;
      currentHash = hash(document);
      emit(mutation);
      return state();
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    function markDraftSaved(revision) {
      const numeric = Number(revision);
      if (Number.isFinite(numeric) && numeric >= savedDraftRevision && numeric <= localRevision) {
        savedDraftRevision = numeric;
      }
      return state();
    }

    function markPublished(nextHash) {
      publishedHash = nextHash || currentHash;
      return state();
    }

    return Object.freeze({
      load,
      getSnapshot,
      getRevision: () => localRevision,
      getState: state,
      dispatch,
      subscribe,
      validate: () => validation,
      markDraftSaved,
      markPublished,
      hashSnapshot: value => hash(value ?? document)
    });
  }

  root.editor.state.sceneStore = Object.freeze({ create, validate });
})(window.MusicOverlay);

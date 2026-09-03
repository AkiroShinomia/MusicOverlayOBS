(() => {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  function ease(name, progress) {
    const t = clamp(progress, 0, 1);
    switch (String(name || "ease-out").toLowerCase()) {
      case "linear": return t;
      case "ease-in": return t * t * t;
      case "ease-in-out": return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      case "spring": return clamp(1 - Math.exp(-6 * t) * Math.cos(10 * t), 0, 1);
      default: return 1 - Math.pow(1 - t, 3);
    }
  }

  function resolveWindow(node, parentWindow, timelineDurationMs) {
    const timing = node?.timing || {};
    const parentStart = parentWindow?.startMs || 0;
    const parentEnd = parentWindow?.endMs ?? Number.POSITIVE_INFINITY;
    const startMs = parentStart + Math.max(0, Number(timing.startMs) || 0);
    const endMode = timing.endMode || "fixed";
    let endMs;
    if (endMode === "trackEnd") endMs = Number.POSITIVE_INFINITY;
    else if (endMode === "parentEnd") endMs = parentEnd;
    else endMs = startMs + Math.max(0, Number(timing.durationMs) || 0);
    endMs = Math.min(endMs, parentEnd);
    if (!parentWindow && endMode === "parentEnd") endMs = Math.max(startMs, Number(timelineDurationMs) || 0);
    return { startMs, endMs, endMode };
  }

  function animationVector(type, phase, progress, distance = 180) {
    const p = clamp(progress, 0, 1);
    const entering = phase === "in";
    switch (type) {
      case "slideRight": return { x: entering ? -distance * (1 - p) : distance * p, y: 0, scale: 1, rotate: 0, opacity: 1 };
      case "slideLeft": return { x: entering ? distance * (1 - p) : -distance * p, y: 0, scale: 1, rotate: 0, opacity: 1 };
      case "slideUp": return { x: 0, y: entering ? distance * (1 - p) : -distance * p, scale: 1, rotate: 0, opacity: 1 };
      case "slideDown": return { x: 0, y: entering ? -distance * (1 - p) : distance * p, scale: 1, rotate: 0, opacity: 1 };
      case "scale": return { x: 0, y: 0, scale: entering ? 0.72 + 0.28 * p : 1 - 0.28 * p, rotate: 0, opacity: entering ? p : 1 - p };
      case "fade": return { x: 0, y: 0, scale: 1, rotate: 0, opacity: entering ? p : 1 - p };
      case "rollRight": return {
        x: entering ? -distance * (1 - p) : distance * p,
        y: 0,
        scale: 1,
        rotate: entering ? -360 * (1 - p) : 360 * p,
        opacity: 1
      };
      default: return { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 };
    }
  }

  function groupOverridesChildren(node) {
    if (node?.nodeType !== "group") return false;
    if (typeof node.animations?.overrideChildren === "boolean") return node.animations.overrideChildren;
    return false;
  }

  function findOverridingAncestor(node, byId) {
    const visited = new Set();
    let parentId = node?.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId?.get(parentId);
      if (!parent) return null;
      if (groupOverridesChildren(parent)) return parent;
      parentId = parent.parentId;
    }
    return null;
  }

  function resolveAnimations(node, byId) {
    // Groups define animation policy, but do not animate their DOM container.
    // Their tracks are evaluated for every descendant against that descendant's
    // own timing window. This preserves delayed starts and avoids double transforms.
    if (node?.nodeType === "group") return null;
    const owner = findOverridingAncestor(node, byId);
    return owner?.animations || node?.animations || null;
  }

  function isAnimationEnabled(node, byId) {
    return resolveAnimations(node, byId) !== null;
  }

  function getFrame(node, window, timeMs, animations = node?.animations) {
    const input = animations?.in || {};
    const output = animations?.out || {};
    const localTime = timeMs - window.startMs;
    const inDuration = Math.max(0, Number(input.durationMs) || 0);
    const outDuration = Math.max(0, Number(output.durationMs) || 0);
    if (localTime < 0 || timeMs >= window.endMs) return { visible: false, x: 0, y: 0, scale: 1, rotate: 0, opacity: 0 };
    if (!animations) return { visible: true, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 };

    if (inDuration > 0 && localTime < inDuration && input.type !== "none") {
      const progress = ease(input.easing, localTime / inDuration);
      return { visible: true, ...animationVector(input.type, "in", progress, Number(input.distance) || 180) };
    }

    if (Number.isFinite(window.endMs) && outDuration > 0 && timeMs >= window.endMs - outDuration && output.type !== "none") {
      const progress = ease(output.easing, (timeMs - (window.endMs - outDuration)) / outDuration);
      return { visible: true, ...animationVector(output.type, "out", progress, Number(output.distance) || 180) };
    }

    return { visible: true, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 };
  }

  function resolveWindows(nodes, timelineDurationMs) {
    const byId = new Map((nodes || []).map(node => [node.id, node]));
    const windows = new Map();
    const resolving = new Set();
    const resolve = node => {
      if (windows.has(node.id)) return windows.get(node.id);
      if (resolving.has(node.id)) throw new Error(`Scene timing cycle detected at '${node.id}'`);
      resolving.add(node.id);
      const parent = node.parentId ? byId.get(node.parentId) : null;
      const parentWindow = parent ? resolve(parent) : null;
      const value = resolveWindow(node, parentWindow, timelineDurationMs);
      resolving.delete(node.id);
      windows.set(node.id, value);
      return value;
    };
    (nodes || []).forEach(resolve);
    return windows;
  }

  window.MusicOverlaySceneTimeline = Object.freeze({
    ease,
    resolveWindow,
    resolveWindows,
    getFrame,
    groupOverridesChildren,
    findOverridingAncestor,
    resolveAnimations,
    isAnimationEnabled
  });
})();

(function registerSceneSelectors(root, global) {
  "use strict";

  root.editor ||= {};
  root.editor.state ||= {};

  const SceneOrder = global.MusicOverlaySceneOrder;
  const SceneTimeline = global.MusicOverlaySceneTimeline;

  function nodes(scene) {
    return Array.isArray(scene?.nodes) ? scene.nodes : [];
  }

  function nodeById(scene, id) {
    return nodes(scene).find(node => node?.id === id) || null;
  }

  function childrenOf(scene, parentId) {
    const targetParent = parentId ?? null;
    return nodes(scene)
      .map((item, index) => ({ item, index }))
      .filter(entry => (entry.item?.parentId ?? null) === targetParent)
      .sort((left, right) => {
        const a = Number(left.item?.order);
        const b = Number(right.item?.order);
        if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a - b;
        if (Number.isFinite(a) !== Number.isFinite(b)) return Number.isFinite(a) ? -1 : 1;
        return left.index - right.index;
      })
      .map(entry => entry.item);
  }

  function rootNodes(scene) {
    return childrenOf(scene, null);
  }

  function ancestorsOf(scene, id) {
    const result = [];
    const visited = new Set();
    let current = nodeById(scene, id);
    while (current?.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      current = nodeById(scene, current.parentId);
      if (!current) break;
      result.push(current);
    }
    return result;
  }

  function descendantsOf(scene, id) {
    const result = [];
    const visit = parentId => {
      for (const child of childrenOf(scene, parentId)) {
        result.push(child);
        visit(child.id);
      }
    };
    visit(id);
    return result;
  }

  function orderedSiblings(scene, id) {
    const node = nodeById(scene, id);
    return node ? childrenOf(scene, node.parentId ?? null) : [];
  }

  function flattenedLayerRows(scene, expandedIds = new Set()) {
    const expanded = expandedIds instanceof Set ? expandedIds : new Set(expandedIds || []);
    const rows = [];
    const visit = (node, depth) => {
      rows.push({ node, depth });
      if (node.nodeType === "group" && expanded.has(node.id)) {
        childrenOf(scene, node.id).forEach(child => visit(child, depth + 1));
      }
    };
    rootNodes(scene).forEach(node => visit(node, 0));
    return rows;
  }

  function isEffectivelyVisible(scene, id) {
    const node = nodeById(scene, id);
    if (!node || node.visible === false) return false;
    return ancestorsOf(scene, id).every(parent => parent.visible !== false);
  }

  function effectiveLock(scene, id) {
    const node = nodeById(scene, id);
    if (!node) return true;
    return node.locked === true || ancestorsOf(scene, id).some(parent => parent.locked === true);
  }

  function worldTransform(scene, id) {
    const node = nodeById(scene, id);
    if (!node) return null;

    const multiply = (left, right) => ({
      a: left.a * right.a + left.c * right.b,
      b: left.b * right.a + left.d * right.b,
      c: left.a * right.c + left.c * right.d,
      d: left.b * right.c + left.d * right.d,
      e: left.a * right.e + left.c * right.f + left.e,
      f: left.b * right.e + left.d * right.f + left.f
    });
    const matrixOf = current => {
      const transform = current?.transform || {};
      const rotation = Number(transform.rotation || 0) * Math.PI / 180;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const scaleX = Number(transform.scaleX ?? 1);
      const scaleY = Number(transform.scaleY ?? 1);
      return {
        a: cos * scaleX,
        b: sin * scaleX,
        c: -sin * scaleY,
        d: cos * scaleY,
        e: Number(transform.x || 0),
        f: Number(transform.y || 0)
      };
    };

    const chain = [...ancestorsOf(scene, id)].reverse();
    chain.push(node);
    const matrix = chain.reduce(
      (result, current) => multiply(result, matrixOf(current)),
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    );
    const scaleX = Math.hypot(matrix.a, matrix.b);
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    const scaleY = scaleX > 1e-9 ? determinant / scaleX : Math.hypot(matrix.c, matrix.d);
    const transform = node.transform || {};
    return {
      x: matrix.e,
      y: matrix.f,
      scaleX,
      scaleY,
      rotation: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
      anchorX: Number(transform.anchorX ?? .5),
      anchorY: Number(transform.anchorY ?? .5),
      matrix
    };
  }

  function effectiveTiming(scene, id) {
    const windows = SceneTimeline.resolveWindows(nodes(scene), Number(scene?.timeline?.durationMs || 30000));
    return windows.get(id) || null;
  }

  function selectedNodeViewModel(scene, selection) {
    const node = nodeById(scene, selection?.id);
    if (!node) return null;
    return {
      node,
      ancestors: ancestorsOf(scene, node.id),
      children: childrenOf(scene, node.id),
      visible: isEffectivelyVisible(scene, node.id),
      locked: effectiveLock(scene, node.id),
      worldTransform: worldTransform(scene, node.id),
      timing: effectiveTiming(scene, node.id)
    };
  }

  function draftDirty(storeState) {
    return Number(storeState?.localRevision || 0) !== Number(storeState?.savedDraftRevision || 0);
  }

  function notApplied(storeState) {
    return Boolean(storeState?.publishedHash) && storeState.publishedHash !== storeState.currentHash;
  }

  root.editor.state.selectors = Object.freeze({
    nodeById,
    childrenOf,
    ancestorsOf,
    descendantsOf,
    rootNodes,
    orderedSiblings,
    flattenedLayerRows,
    isEffectivelyVisible,
    effectiveLock,
    worldTransform,
    effectiveTiming,
    selectedNodeViewModel,
    draftDirty,
    notApplied
  });
})(window.MusicOverlay, window);

(() => {
  "use strict";

  function getParentId(item) {
    return item?.parentId ?? item?.groupId ?? null;
  }

  function compareByOrder(left, right) {
    const leftOrder = Number(left.item?.order);
    const rightOrder = Number(right.item?.order);
    const leftHasOrder = Number.isFinite(leftOrder);
    const rightHasOrder = Number.isFinite(rightOrder);
    if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
    if (leftHasOrder !== rightHasOrder) return leftHasOrder ? -1 : 1;
    return left.index - right.index;
  }

  function getSiblings(items, item) {
    const parentId = getParentId(item);
    return (items || [])
      .map((candidate, index) => ({ item: candidate, index }))
      .filter(entry => getParentId(entry.item) === parentId)
      .sort(compareByOrder)
      .map(entry => entry.item);
  }

  function getLocalIndex(items, item) {
    return getSiblings(items, item).findIndex(candidate => candidate.id === item?.id);
  }

  function getStackIndex(items, item, base = 10) {
    const siblings = getSiblings(items, item);
    const localIndex = siblings.findIndex(candidate => candidate.id === item?.id);
    return Number(base) + siblings.length - Math.max(0, localIndex);
  }

  function buildTree(items) {
    const nodes = items || [];
    const children = new Map();
    children.set(null, []);
    nodes.forEach(node => {
      const parentId = getParentId(node);
      if (!children.has(parentId)) children.set(parentId, []);
      children.get(parentId).push(node);
      if (!children.has(node.id)) children.set(node.id, []);
    });
    children.forEach((siblings, parentId) => {
      const sorted = siblings
        .map((item, index) => ({ item, index }))
        .sort(compareByOrder)
        .map(entry => entry.item);
      children.set(parentId, sorted);
    });
    return children;
  }

  window.MusicOverlaySceneOrder = Object.freeze({
    getParentId,
    getSiblings,
    getLocalIndex,
    getStackIndex,
    buildTree
  });
})();

(() => {
  "use strict";

  const SceneOrder = window.MusicOverlaySceneOrder;
  if (!SceneOrder) throw new Error("MusicOverlaySceneOrder must load before MusicOverlayLayerRenderer");

  function applyStacking(node, items, item, base = 10) {
    node.style.zIndex = String(SceneOrder.getStackIndex(items, item, base));
    if (getComputedStyle(node).position === "static") node.style.position = "relative";
  }

  window.MusicOverlayLayerRenderer = Object.freeze({ applyStacking });
})();

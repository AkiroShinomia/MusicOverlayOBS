(function initialiseCanvasController(global) {
  "use strict";

  const editor = global.MusicOverlayEditor ||= {};

  editor.createCanvasController = function createCanvasController(options) {
    const { viewport, surface, zoomInput, worldWidth, worldHeight, onScaleChange } = options;
    let zoomPercent = Number(zoomInput.value || 100);
    let scale = 1;
    let left = 0;
    let top = 0;
    let initialised = false;
    let resizeObserver = null;
    let pan = null;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function getFitScale() {
      const rect = viewport.getBoundingClientRect();
      return Math.max(0.0001, Math.min((rect.width - 24) / worldWidth, (rect.height - 24) / worldHeight));
    }

    function apply(nextScale) {
      scale = nextScale;
      surface.style.left = `${left}px`;
      surface.style.top = `${top}px`;
      surface.style.transform = `scale(${scale})`;
      onScaleChange?.(scale);
      return scale;
    }

    function centre(nextScale) {
      const rect = viewport.getBoundingClientRect();
      left = (rect.width - worldWidth * nextScale) / 2;
      top = (rect.height - worldHeight * nextScale) / 2;
      initialised = true;
      return apply(nextScale);
    }

    function fit() {
      const rect = viewport.getBoundingClientRect();
      if (!rect.width || !rect.height) return scale;
      const nextScale = getFitScale() * zoomPercent / 100;
      if (!initialised) return centre(nextScale);

      const anchorX = rect.width / 2;
      const anchorY = rect.height / 2;
      const worldX = (anchorX - left) / scale;
      const worldY = (anchorY - top) / scale;
      left = anchorX - worldX * nextScale;
      top = anchorY - worldY * nextScale;
      return apply(nextScale);
    }

    function zoomAt(nextPercent, clientX, clientY) {
      const min = Number(zoomInput.min || 25);
      const max = Number(zoomInput.max || 300);
      nextPercent = clamp(nextPercent, min, max);

      const rect = viewport.getBoundingClientRect();
      if (!rect.width || !rect.height) return scale;
      if (!initialised) centre(getFitScale() * zoomPercent / 100);

      const anchorX = clientX == null ? rect.width / 2 : clientX - rect.left;
      const anchorY = clientY == null ? rect.height / 2 : clientY - rect.top;
      const worldX = (anchorX - left) / scale;
      const worldY = (anchorY - top) / scale;
      const nextScale = getFitScale() * nextPercent / 100;

      zoomPercent = nextPercent;
      zoomInput.value = String(Math.round(zoomPercent));
      left = anchorX - worldX * nextScale;
      top = anchorY - worldY * nextScale;
      return apply(nextScale);
    }

    function onWheel(event) {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomAt(zoomPercent * factor, event.clientX, event.clientY);
    }

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (event.target.closest("[data-layer-id], [data-group-id], button, input, select, label")) return;
      pan = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startLeft: left,
        startTop: top
      };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-panning");
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (!pan || event.pointerId !== pan.pointerId) return;
      left = pan.startLeft + event.clientX - pan.startClientX;
      top = pan.startTop + event.clientY - pan.startClientY;
      apply(scale);
    }

    function endPan(event) {
      if (!pan || event.pointerId !== pan.pointerId) return;
      try { viewport.releasePointerCapture(pan.pointerId); } catch {}
      pan = null;
      viewport.classList.remove("is-panning");
    }

    function attach() {
      viewport.addEventListener("wheel", onWheel, { passive: false });
      viewport.addEventListener("pointerdown", onPointerDown);
      viewport.addEventListener("pointermove", onPointerMove);
      viewport.addEventListener("pointerup", endPan);
      viewport.addEventListener("pointercancel", endPan);
      zoomInput.addEventListener("input", () => zoomAt(Number(zoomInput.value || 100)));
      resizeObserver = new ResizeObserver(fit);
      resizeObserver.observe(viewport);
      fit();
    }

    function destroy() {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", endPan);
      viewport.removeEventListener("pointercancel", endPan);
      resizeObserver?.disconnect();
    }

    return { attach, destroy, fit, zoomAt, getScale: () => scale };
  };
})(window);

(function initialiseWorkspaceController(global) {
  "use strict";

  const editor = global.MusicOverlay.editor.infrastructure;
  const STORAGE_KEY = "musicOverlay.editor.workspace.v1";

  editor.createWorkspaceController = function createWorkspaceController(options) {
    const { root, onResize } = options;
    const defaults = { inspectorWidth: 300, libraryWidth: 278, timelineHeight: 292 };
    let state = { ...defaults };
    let drag = null;

    try {
      state = { ...state, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {}

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function constrain(next) {
      const rect = root.getBoundingClientRect();
      const maxTimeline = Math.max(180, rect.height - 260);
      next.timelineHeight = clamp(Number(next.timelineHeight), 160, maxTimeline);
      next.inspectorWidth = clamp(Number(next.inspectorWidth), 220, 520);
      next.libraryWidth = clamp(Number(next.libraryWidth), 220, 520);

      const availableSideWidth = Math.max(440, rect.width - 440);
      const overflow = next.inspectorWidth + next.libraryWidth - availableSideWidth;
      if (overflow > 0) {
        if (drag?.mode === "inspector" || drag?.mode === "corner-left") next.inspectorWidth -= overflow;
        else next.libraryWidth -= overflow;
      }
      return next;
    }

    function apply() {
      constrain(state);
      root.style.setProperty("--inspector-width", `${Math.round(state.inspectorWidth)}px`);
      root.style.setProperty("--library-width", `${Math.round(state.libraryWidth)}px`);
      root.style.setProperty("--timeline-height", `${Math.round(state.timelineHeight)}px`);
      onResize?.();
    }

    function persist() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    }

    function begin(event) {
      if (event.button !== 0) return;
      drag = {
        mode: event.currentTarget.dataset.resize,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        start: { ...state },
        target: event.currentTarget
      };
      drag.target.setPointerCapture(event.pointerId);
      document.body.classList.add("is-resizing-workspace");
      event.preventDefault();
    }

    function move(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const next = { ...drag.start };
      if (drag.mode === "inspector" || drag.mode === "corner-left") next.inspectorWidth += dx;
      if (drag.mode === "library" || drag.mode === "corner-right") next.libraryWidth -= dx;
      if (drag.mode === "timeline" || drag.mode.startsWith("corner")) next.timelineHeight -= dy;
      state = next;
      apply();
    }

    function end(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      try { drag.target.releasePointerCapture(drag.pointerId); } catch {}
      drag = null;
      document.body.classList.remove("is-resizing-workspace");
      persist();
      onResize?.();
    }

    function reset() {
      state = { ...defaults };
      apply();
      persist();
    }

    function attach() {
      root.querySelectorAll("[data-resize]").forEach(handle => {
        handle.addEventListener("pointerdown", begin);
        handle.addEventListener("dblclick", reset);
      });
      global.addEventListener("pointermove", move);
      global.addEventListener("pointerup", end);
      global.addEventListener("pointercancel", end);
      apply();
    }

    return { attach, apply, reset };
  };
})(window);

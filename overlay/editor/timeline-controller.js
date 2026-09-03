(function initialiseTimelineController(global) {
  "use strict";

  const editor = global.MusicOverlay.editor.infrastructure;

  editor.createTimelineController = function createTimelineController(options) {
    const { surface, ruler, getDuration, setTime, stopPlayback } = options;
    let dragging = false;
    let pointerId = null;

    function timeFromClientX(clientX) {
      const track = ruler.querySelector(".ruler-track");
      const rect = track?.getBoundingClientRect();
      if (!rect?.width) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * getDuration();
    }

    function seek(clientX) {
      stopPlayback?.();
      setTime(timeFromClientX(clientX));
    }

    function onSurfacePointerDown(event) {
      if (event.button !== 0) return;
      if (event.target.closest(".track-bar")) return;
      if (!event.target.closest(".ruler-track, .track-cell, #timelinePlayhead")) return;
      dragging = true;
      pointerId = event.pointerId;
      surface.setPointerCapture(pointerId);
      seek(event.clientX);
      event.preventDefault();
    }

    function onPlayheadPointerMove(event) {
      if (!dragging || event.pointerId !== pointerId) return;
      seek(event.clientX);
    }

    function onMouseMove(event) {
      if (!dragging) return;
      seek(event.clientX);
    }

    function endDrag(event) {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      try { surface.releasePointerCapture(pointerId); } catch {}
      pointerId = null;
    }

    function attach() {
      surface.addEventListener("pointerdown", onSurfacePointerDown);
      global.addEventListener("pointermove", onPlayheadPointerMove);
      global.addEventListener("mousemove", onMouseMove);
      global.addEventListener("pointerup", endDrag);
      global.addEventListener("pointercancel", endDrag);
    }

    return { attach };
  };
})(window);

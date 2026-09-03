(function registerBuiltinV2Rules(root) {
  "use strict";

  root.editor ||= {};
  root.editor.compat ||= {};

  const IDS = Object.freeze({
    fullGroup: "full-card-group",
    tickerGroup: "ticker-group",
    fullShell: "full-card-shell",
    fullCover: "full-cover",
    fullVinyl: "full-vinyl",
    fullTitle: "full-title",
    fullArtist: "full-artist",
    fullTime: "full-time",
    fullProgress: "full-progress",
    fullParticles: "full-particles",
    tickerTitle: "ticker-title",
    tickerTime: "ticker-time",
    tickerProgress: "ticker-progress",
    tickerEqualizer: "ticker-equalizer",
    tickerBackground: "ticker-group-background"
  });

  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function find(scene, id) {
    return scene?.nodes?.find(node => node.id === id) || null;
  }

  function properties(scene, id) {
    return find(scene, id)?.component?.properties || {};
  }

  function pushIfNode(scene, mutations, id, type, payload) {
    if (!find(scene, id)) return;
    mutations.push({ type, payload: { id, ...payload } });
  }

  function componentPatch(scene, mutations, id, patch) {
    pushIfNode(scene, mutations, id, "node.componentProperties", { patch });
  }

  function transformPatch(scene, mutations, id, patch) {
    pushIfNode(scene, mutations, id, "node.transform", { patch });
  }

  function timingPatch(scene, mutations, id, patch) {
    pushIfNode(scene, mutations, id, "node.timing", { patch });
  }

  function animationPatch(scene, mutations, id, patch) {
    pushIfNode(scene, mutations, id, "node.animations", { patch });
  }

  function effectiveStart(scene, id) {
    return numberOr(root.editor.context.selectors.effectiveTiming(scene, id)?.startMs, 0);
  }

  function parentStart(scene, node) {
    return node?.parentId ? effectiveStart(scene, node.parentId) : 0;
  }

  function buildAppearancePatch(scene, legacy) {
    const current = scene.appearance || {};
    return {
      colors: { ...(current.colors || {}), ...(legacy.colors || {}) },
      font: { ...(current.font || {}), ...(legacy.font || {}) },
      albumArt: { ...(current.albumArt || {}), ...(legacy.albumArt || {}) },
      ticker: { ...(current.ticker || {}), ...(legacy.ticker || {}) },
      fullCard: { ...(current.fullCard || {}), ...(legacy.fullCard || {}) },
      vinyl: { ...(current.vinyl || {}), ...(legacy.vinyl || {}) },
      particles: { ...(current.particles || {}), ...(legacy.particles || {}) },
      equalizer: { ...(current.equalizer || {}), ...(legacy.equalizer || {}) }
    };
  }

  function applyLegacyInput(id, legacy) {
    const context = root.editor.context;
    if (!context?.isInitialized()) return false;
    const scene = context.sceneStore.getSnapshot();
    const mutations = [{
      type: "scene.appearance",
      payload: { patch: buildAppearancePatch(scene, legacy) }
    }];

    context.updateSettings({ audio: legacy.audio || { sourceMode: "auto" } });

    const full = find(scene, IDS.fullGroup);
    const ticker = find(scene, IDS.tickerGroup);

    if (id === "left") {
      const left = numberOr(legacy.position?.left, 70);
      transformPatch(scene, mutations, IDS.fullGroup, { x: left });
      transformPatch(scene, mutations, IDS.tickerGroup, { x: left });
    }

    if (id === "fullBottom" && full) {
      const height = numberOr(properties(scene, IDS.fullGroup).height, 0);
      const y = numberOr(scene.canvas?.height, 1080) - numberOr(legacy.position?.fullBottom, 60) - height;
      transformPatch(scene, mutations, IDS.fullGroup, { y });
    }

    if (id === "tickerBottom" && ticker) {
      const height = numberOr(properties(scene, IDS.tickerGroup).height, numberOr(legacy.sizes?.tickerHeight, 42));
      const y = numberOr(scene.canvas?.height, 1080) - numberOr(legacy.position?.tickerBottom, 60) - height;
      transformPatch(scene, mutations, IDS.tickerGroup, { y });
    }

    if (id === "fullVisibleMs" && full) {
      const previousTiming = context.selectors.effectiveTiming(scene, IDS.fullGroup);
      const previousEnd = numberOr(previousTiming?.endMs, numberOr(legacy.timings?.fullVisibleMs, 10000));
      const nextEnd = Math.max(100, numberOr(legacy.timings?.fullVisibleMs, 10000));
      const fullStart = numberOr(previousTiming?.startMs, effectiveStart(scene, IDS.fullGroup));
      timingPatch(scene, mutations, IDS.fullGroup, {
        endMode: "fixed",
        durationMs: Math.max(50, nextEnd - fullStart)
      });

      if (ticker) {
        timingPatch(scene, mutations, IDS.tickerGroup, {
          startMs: Math.max(0, nextEnd - parentStart(scene, ticker))
        });
      }

      scene.nodes
        .filter(node => node.parentId === IDS.fullGroup && node.timing?.endMode === "fixed")
        .forEach(node => {
          const timing = context.selectors.effectiveTiming(scene, node.id);
          if (Math.abs(numberOr(timing?.endMs, -1) - previousEnd) > 0.5) return;
          timingPatch(scene, mutations, node.id, {
            durationMs: Math.max(50, nextEnd - numberOr(timing?.startMs, fullStart))
          });
        });
    }

    if (id === "fullEnterAnimation" && full) {
      animationPatch(scene, mutations, IDS.fullGroup, {
        in: { ...(full.animations?.in || {}), type: legacy.animations?.fullEnter || "fade" }
      });
    }
    if (id === "fullExitAnimation" && full) {
      animationPatch(scene, mutations, IDS.fullGroup, {
        out: { ...(full.animations?.out || {}), type: legacy.animations?.fullExit || "fade" }
      });
    }
    if (id === "tickerEnterAnimation" && ticker) {
      animationPatch(scene, mutations, IDS.tickerGroup, {
        in: { ...(ticker.animations?.in || {}), type: legacy.animations?.tickerEnter || "fade" }
      });
    }
    if (id === "exitMs") {
      const durationMs = Math.max(0, numberOr(legacy.timings?.exitMs, 600));
      if (full) animationPatch(scene, mutations, IDS.fullGroup, { out: { ...(full.animations?.out || {}), durationMs } });
      if (ticker) animationPatch(scene, mutations, IDS.tickerGroup, { out: { ...(ticker.animations?.out || {}), durationMs } });
    }

    if (id === "fullCardWidth") {
      componentPatch(scene, mutations, IDS.fullShell, { width: numberOr(legacy.sizes?.fullCardWidth, 430) });
    }
    if (id === "coverSize") {
      const size = numberOr(legacy.sizes?.coverSize, 92);
      componentPatch(scene, mutations, IDS.fullCover, { width: size, height: size });
    }
    if (id === "vinylSize") {
      componentPatch(scene, mutations, IDS.fullVinyl, { size: numberOr(legacy.sizes?.vinylSize, 108) });
    }
    if (id === "tickerWidth") {
      const width = numberOr(legacy.sizes?.tickerWidth, 500);
      componentPatch(scene, mutations, IDS.tickerGroup, { width });
      componentPatch(scene, mutations, IDS.tickerBackground, { width });
      componentPatch(scene, mutations, IDS.tickerTitle, { width: Math.max(40, width - 150) });
      componentPatch(scene, mutations, IDS.tickerProgress, { width: Math.max(20, width - 32) });
      componentPatch(scene, mutations, IDS.tickerEqualizer, {
        width: Math.max(20, width - numberOr(legacy.equalizer?.sidePadding, 14) * 2)
      });
      transformPatch(scene, mutations, IDS.tickerTime, { x: Math.max(16, width - 116) });
    }
    if (id === "tickerHeight") {
      const height = numberOr(legacy.sizes?.tickerHeight, 42);
      componentPatch(scene, mutations, IDS.tickerGroup, { height });
      componentPatch(scene, mutations, IDS.tickerBackground, { height });
      transformPatch(scene, mutations, IDS.tickerProgress, { y: Math.max(0, height - 10) });
    }

    if (id === "titleSize") componentPatch(scene, mutations, IDS.fullTitle, { fontSize: numberOr(legacy.font?.titleSize, 28) });
    if (id === "artistSize") componentPatch(scene, mutations, IDS.fullArtist, { fontSize: numberOr(legacy.font?.artistSize, 18) });
    if (id === "tickerSize") {
      const size = numberOr(legacy.font?.tickerSize, 14);
      componentPatch(scene, mutations, IDS.tickerTitle, { fontSize: size });
      componentPatch(scene, mutations, IDS.tickerTime, { fontSize: Math.min(12, size) });
    }

    if (["backgroundColor", "backgroundOpacity", "fullCardStyle"].includes(id)) {
      componentPatch(scene, mutations, IDS.fullShell, {
        color: legacy.fullCard?.style === "minimal" ? "transparent" : legacy.colors?.background,
        style: legacy.fullCard?.style
      });
    }
    if (["backgroundColor", "backgroundOpacity", "tickerStyle"].includes(id)) {
      const style = legacy.ticker?.style;
      componentPatch(scene, mutations, IDS.tickerBackground, {
        color: legacy.colors?.background,
        style,
        borderRadius: ["thin", "compact"].includes(style) ? 8 : style === "glass" ? 18 : 999
      });
    }
    if (id === "text") {
      [IDS.fullTitle, IDS.fullArtist, IDS.fullTime, IDS.tickerTitle, IDS.tickerTime]
        .forEach(nodeId => componentPatch(scene, mutations, nodeId, { color: legacy.colors?.text }));
    }
    if (id === "progress") {
      [IDS.fullProgress, IDS.tickerProgress]
        .forEach(nodeId => componentPatch(scene, mutations, nodeId, { color: legacy.colors?.progress }));
    }
    if (["progressBackgroundColor", "progressBackgroundOpacity"].includes(id)) {
      [IDS.fullProgress, IDS.tickerProgress]
        .forEach(nodeId => componentPatch(scene, mutations, nodeId, { background: legacy.colors?.progressBackground }));
    }
    if (id === "vinylStyle") componentPatch(scene, mutations, IDS.fullVinyl, { style: legacy.vinyl?.style });

    if (id.startsWith("particles")) {
      componentPatch(scene, mutations, IDS.fullParticles, {
        style: legacy.particles?.style,
        color: legacy.particles?.color,
        count: legacy.particles?.count,
        size: legacy.particles?.size,
        durationMs: legacy.particles?.durationMs
      });
      pushIfNode(scene, mutations, IDS.fullParticles, "node.visibility", { visible: legacy.particles?.enabled === true });
    }

    if (id.startsWith("equalizer") || id === "fftPreset") {
      componentPatch(scene, mutations, IDS.tickerEqualizer, {
        style: legacy.equalizer?.style,
        color: legacy.equalizer?.colorMode === "custom" ? legacy.equalizer?.color : legacy.colors?.progress,
        barCount: legacy.equalizer?.barCount,
        barWidth: legacy.equalizer?.barWidth,
        gap: legacy.equalizer?.gap,
        height: legacy.equalizer?.height,
        offsetY: legacy.equalizer?.offsetY,
        sidePadding: legacy.equalizer?.sidePadding,
        sensitivity: legacy.equalizer?.sensitivity,
        smoothing: legacy.equalizer?.smoothing,
        outputGain: legacy.equalizer?.outputGain,
        spectralContrast: legacy.equalizer?.spectralContrast,
        visualCurvePower: legacy.equalizer?.visualCurvePower,
        autoGain: legacy.equalizer?.autoGain,
        glow: legacy.equalizer?.glow,
        glowPower: legacy.equalizer?.glowPower,
        fftPreset: legacy.equalizer?.preset || "balanced"
      });
      pushIfNode(scene, mutations, IDS.tickerEqualizer, "node.visibility", { visible: legacy.equalizer?.enabled === true });
    }

    context.commit({ type: "batch", payload: { mutations } });
    return true;
  }

  function syncLegacyFromScene(legacy) {
    const context = root.editor.context;
    if (!context?.isInitialized()) return legacy;
    const scene = context.sceneStore.getSnapshot();
    const full = find(scene, IDS.fullGroup);
    const ticker = find(scene, IDS.tickerGroup);
    legacy.timings ||= {};
    legacy.animations ||= {};

    if (full) {
      const timing = context.selectors.effectiveTiming(scene, IDS.fullGroup);
      if (full.timing?.endMode !== "trackEnd" && Number.isFinite(Number(timing?.endMs))) {
        legacy.timings.fullVisibleMs = Number(timing.endMs);
      }
      legacy.animations.fullEnter = full.animations?.in?.type || "fade";
      legacy.animations.fullExit = full.animations?.out?.type || "fade";
      legacy.timings.exitMs = numberOr(full.animations?.out?.durationMs, legacy.timings.exitMs || 600);
    }
    if (ticker) {
      legacy.animations.tickerEnter = ticker.animations?.in?.type || "fade";
      legacy.animations.tickerExit = ticker.animations?.out?.type || "none";
    }
    return legacy;
  }

  root.editor.compat.builtinV2Rules = Object.freeze({ IDS, applyLegacyInput, syncLegacyFromScene });
})(window.MusicOverlay);

(() => {
  "use strict";

  const clone = value => structuredClone(value ?? {});
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const BUILTIN_IDS = window.MusicOverlay.editor.compat.builtinV2Rules.IDS;

  function effectsToScene(value) {
    return [
      { type: "opacity", enabled: true, value: numberOr(value?.opacity, 100) },
      { type: "blur", enabled: numberOr(value?.blur, 0) > 0, value: numberOr(value?.blur, 0) },
      { type: "glow", enabled: numberOr(value?.glow, 0) > 0, value: numberOr(value?.glow, 0) }
    ];
  }

  function effectsFromScene(values) {
    const find = (type, fallback) => numberOr(values?.find(effect => effect?.type === type)?.value, fallback);
    return { opacity: find("opacity", 100), blur: find("blur", 0), glow: find("glow", 0) };
  }

  function animationsToScene(value, isGroup = false) {
    const duration = numberOr(value?.durationMs, 600);
    const easing = value?.easing || "ease-out";
    const enterType = value?.enter || "fade";
    const exitType = value?.exit || "fade";
    const enterDuration = numberOr(value?.enterDurationMs, duration);
    const exitDuration = numberOr(value?.exitDurationMs, duration);
    const animations = {
      in: {
        type: enterType,
        durationMs: enterType !== "none" && enterDuration <= 0 ? 600 : Math.max(0, enterDuration),
        easing: value?.enterEasing || easing
      },
      out: {
        type: exitType,
        durationMs: exitType !== "none" && exitDuration <= 0 ? 600 : Math.max(0, exitDuration),
        easing: value?.exitEasing || easing
      }
    };
    if (isGroup) animations.overrideChildren = value?.overrideChildren === true;
    return animations;
  }

  function animationsFromScene(value, isGroup = false) {
    const enterDuration = numberOr(value?.in?.durationMs, 600);
    const exitDuration = numberOr(value?.out?.durationMs, 600);
    const animation = {
      enter: value?.in?.type || "fade",
      exit: value?.out?.type || "fade",
      enterDurationMs: enterDuration,
      enterEasing: value?.in?.easing || "ease-out",
      exitDurationMs: exitDuration,
      exitEasing: value?.out?.easing || "ease-out",
      durationMs: enterDuration,
      easing: value?.in?.easing || "ease-out"
    };
    if (isGroup) {
      animation.overrideChildren = value?.overrideChildren === true;
    }
    return animation;
  }

  function transformToScene(item) {
    const scale = numberOr(item?.scale, 100) / 100;
    return {
      x: numberOr(item?.x, 0), y: numberOr(item?.y, 0),
      scaleX: scale, scaleY: scale,
      rotation: numberOr(item?.rotation, 0),
      anchorX: numberOr(item?.anchorX, .5), anchorY: numberOr(item?.anchorY, .5)
    };
  }

  function timingToScene(value, parentStart = 0) {
    const absoluteStart = Math.max(parentStart, numberOr(value?.startMs, parentStart));
    const absoluteEnd = value?.endMs == null ? null : numberOr(value.endMs, absoluteStart + 1000);
    const endMode = value?.untilNextTrack === true
      ? "trackEnd"
      : value?.untilGroupEnd === true
        ? "parentEnd"
        : "fixed";
    return {
      startMs: Math.max(0, absoluteStart - parentStart),
      endMode,
      durationMs: endMode === "fixed" ? Math.max(50, (absoluteEnd ?? absoluteStart + 1000) - absoluteStart) : null
    };
  }

  function semanticKind(layer) {
    const kind = String(layer?.kind || "block").toLowerCase();
    if (kind === "data") return layer?.properties?.binding === "progress" || String(layer?.id).includes("progress") ? "progress" : "time";
    if (kind === "effect") return String(layer?.id).includes("equalizer") ? "equalizer" : "particles";
    return kind;
  }

  function toScene(config, options = {}) {
    if (!config?.layout) throw new Error("Editor scene model requires layout");
    const groups = config.layout.groups || [];
    const layers = config.layout.layers || [];
    const groupsById = new Map(groups.map(group => [group.id, group]));
    const childOrders = new Map();
    const nextOrder = parentId => {
      const key = parentId || "__root__";
      const value = childOrders.get(key) || 0;
      childOrders.set(key, value + 1);
      return value;
    };
    const absoluteGroupStart = group => {
      if (!group) return 0;
      const parent = groupsById.get(group.parentId);
      return numberOr(group.timing?.startMs, absoluteGroupStart(parent));
    };

    const nodes = groups.map(group => ({
      id: group.id,
      nodeType: "group",
      name: group.name || group.id,
      parentId: group.parentId || null,
      order: nextOrder(group.parentId),
      visible: group.visible !== false,
      locked: group.locked === true,
      marker: group.marker || "#8b5cf6",
      transform: transformToScene(group),
      timing: timingToScene(group.timing, absoluteGroupStart(groupsById.get(group.parentId))),
      effects: effectsToScene(group.effects),
      animations: animationsToScene(group.animation, true),
      component: {
        kind: "group",
        runtimeTarget: group.runtimeTarget || null,
        properties: clone(group.properties)
      }
    }));

    layers.forEach(layer => {
      const parent = groupsById.get(layer.groupId);
      const properties = clone(layer.properties);
      if (layer.assetData) properties.assetData = layer.assetData;
      nodes.push({
        id: layer.id,
        nodeType: "component",
        name: layer.name || layer.id,
        parentId: parent?.id || null,
        order: nextOrder(parent?.id),
        visible: layer.visible !== false,
        locked: layer.locked === true,
        marker: layer.marker || "#8b5cf6",
        transform: transformToScene(layer),
        timing: timingToScene(layer.timing, absoluteGroupStart(parent)),
        effects: effectsToScene(layer.effects),
        animations: animationsToScene(layer.animation),
        component: { kind: semanticKind(layer), templateId: layer.templateId || null, properties }
      });
    });

    const canvas = config.layout.canvas || {};
    return {
      $schema: "/schemas/scene-v2.schema.json",
      schemaVersion: 2,
      documentType: "music-overlay.scene",
      id: options.id || "workspace-draft",
      revision: numberOr(options.revision, 0),
      metadata: {
        name: options.name || config.theme?.preset || "Editor draft",
        themeType: options.themeType || "workspace",
        sourceThemeId: options.sourceThemeId ?? config.theme?.preset ?? "Custom",
        authoredBy: "overlay-editor"
      },
      canvas: {
        width: Math.max(1, numberOr(canvas.width, 1920)),
        height: Math.max(1, numberOr(canvas.height, 1080)),
        backgroundColor: canvas.backgroundColor || "#00a84f",
        frameRate: Math.max(1, numberOr(canvas.frameRate, 60)),
        scaleMode: canvas.scaleMode || "contain"
      },
      timeline: {
        durationMs: Math.max(1000, numberOr(config.layout.compositionDurationMs, 30000)),
        restartOnPublish: true
      },
      appearance: {
        colors: clone(config.colors), font: clone(config.font), albumArt: clone(config.albumArt),
        ticker: clone(config.ticker), fullCard: clone(config.fullCard), vinyl: clone(config.vinyl),
        particles: clone(config.particles), equalizer: clone(config.equalizer)
      },
      nodes,
      extensions: { "musicOverlay.editor": { modelVersion: 2 } }
    };
  }

  function fromScene(scene, settings = {}, defaults = {}) {
    if (scene?.documentType !== "music-overlay.scene" || Number(scene?.schemaVersion) !== 2) {
      throw new Error("Unsupported editor scene document");
    }
    const config = clone(defaults);
    const appearance = scene.appearance || {};
    ["colors", "font", "albumArt", "ticker", "fullCard", "vinyl", "particles", "equalizer"].forEach(section => {
      config[section] = { ...(config[section] || {}), ...clone(appearance[section]) };
    });
    config.audio = { ...(config.audio || {}), ...clone(settings.audio) };
    config.theme = { preset: scene.metadata?.sourceThemeId || "Custom" };

    const nodes = Array.isArray(scene.nodes) ? scene.nodes : [];
    const nodesById = new Map(nodes.map(node => [node.id, node]));
    const absoluteStarts = new Map();
    const absoluteStart = node => {
      if (!node) return 0;
      if (absoluteStarts.has(node.id)) return absoluteStarts.get(node.id);
      const value = absoluteStart(nodesById.get(node.parentId)) + numberOr(node.timing?.startMs, 0);
      absoluteStarts.set(node.id, value);
      return value;
    };
    const absoluteEnd = node => {
      const mode = node?.timing?.endMode || "fixed";
      if (mode === "fixed") return absoluteStart(node) + numberOr(node?.timing?.durationMs, 1000);
      if (mode === "parentEnd") return absoluteEnd(nodesById.get(node?.parentId));
      return null;
    };
    const itemFromNode = node => {
      const startMs = absoluteStart(node);
      const endMs = absoluteEnd(node);
      const properties = clone(node.component?.properties);
      const assetData = properties.assetData || properties.legacyAssetData || null;
      delete properties.assetData;
      delete properties.legacyAssetData;
      return {
        id: node.id,
        name: node.name || node.id,
        visible: node.visible !== false,
        locked: node.locked === true,
        marker: node.marker || "#8b5cf6",
        x: numberOr(node.transform?.x, 0),
        y: numberOr(node.transform?.y, 0),
        scale: numberOr(node.transform?.scaleX, 1) * 100,
        rotation: numberOr(node.transform?.rotation, 0),
        anchorX: numberOr(node.transform?.anchorX, .5),
        anchorY: numberOr(node.transform?.anchorY, .5),
        effects: effectsFromScene(node.effects),
        animation: animationsFromScene(node.animations, node.nodeType === "group"),
        timing: {
          startMs,
          endMs,
          untilNextTrack: node.timing?.endMode === "trackEnd",
          untilGroupEnd: node.timing?.endMode === "parentEnd"
        },
        properties,
        ...(assetData ? { assetData } : {})
      };
    };
    const sortNodes = values => values.sort((left, right) => numberOr(left.order, 0) - numberOr(right.order, 0));
    const groupNodes = sortNodes(nodes.filter(node => node.nodeType === "group"));
    const layerNodes = sortNodes(nodes.filter(node => node.nodeType !== "group"));
    const groups = groupNodes.map(node => ({
      ...itemFromNode(node),
      parentId: node.parentId || null,
      runtimeTarget: node.component?.runtimeTarget || null
    }));
    const layers = layerNodes.map(node => ({
      ...itemFromNode(node),
      kind: node.component?.kind || "block",
      groupId: node.parentId || null,
      templateId: node.component?.templateId || null
    }));
    config.layout = {
      version: 2,
      replaceDefaults: true,
      canvas: clone(scene.canvas),
      compositionDurationMs: numberOr(scene.timeline?.durationMs, 30000),
      groups,
      layers
    };

    const byId = id => nodesById.get(id)?.component?.properties || {};
    const fullGroup = groups.find(group => group.id === BUILTIN_IDS.fullGroup);
    const tickerGroup = groups.find(group => group.id === BUILTIN_IDS.tickerGroup);
    config.position = {
      ...(config.position || {}),
      left: numberOr(fullGroup?.x ?? tickerGroup?.x, config.position?.left || 70),
      fullBottom: Math.max(0, numberOr(scene.canvas?.height, 1080) - numberOr(fullGroup?.y, 0) - numberOr(byId(BUILTIN_IDS.fullGroup).height, 0)),
      tickerBottom: Math.max(0, numberOr(scene.canvas?.height, 1080) - numberOr(tickerGroup?.y, 0) - numberOr(byId(BUILTIN_IDS.tickerGroup).height, 0))
    };
    config.sizes = {
      ...(config.sizes || {}),
      fullCardWidth: numberOr(byId(BUILTIN_IDS.fullShell).width, config.sizes?.fullCardWidth || 430),
      tickerWidth: numberOr(byId(BUILTIN_IDS.tickerGroup).width, config.sizes?.tickerWidth || 500),
      tickerHeight: numberOr(byId(BUILTIN_IDS.tickerGroup).height, config.sizes?.tickerHeight || 42),
      coverSize: numberOr(byId(BUILTIN_IDS.fullCover).width, config.sizes?.coverSize || 92),
      vinylSize: numberOr(byId(BUILTIN_IDS.fullVinyl).size, config.sizes?.vinylSize || 108)
    };
    return config;
  }

  window.MusicOverlaySceneEditorModel = Object.freeze({ fromScene, toScene });
})();

(function registerSceneUiAdapters(root) {
  "use strict";

  const context = () => root.editor.context;
  const selectors = () => root.editor.state.selectors;
  const clone = value => structuredClone(value);

  function scene() {
    return context().sceneStore.getSnapshot();
  }

  function node(id) {
    return selectors().nodeById(scene(), id);
  }

  function parentStartMs(currentScene, currentNode) {
    if (!currentNode?.parentId) return 0;
    return selectors().effectiveTiming(currentScene, currentNode.parentId)?.startMs || 0;
  }

  function effectsObject(currentNode) {
    const values = currentNode?.effects || [];
    const get = (type, fallback) => Number(values.find(effect => effect?.type === type)?.value ?? fallback);
    return { opacity: get("opacity", 100), blur: get("blur", 0), glow: get("glow", 0) };
  }

  function patchEffects(id, patch) {
    const current = node(id);
    if (!current) return;
    const next = { ...effectsObject(current), ...patch };
    context().commit({
      type: "node.effects",
      payload: {
        id,
        effects: [
          { type: "opacity", enabled: true, value: Number(next.opacity ?? 100) },
          { type: "blur", enabled: Number(next.blur || 0) > 0, value: Number(next.blur || 0) },
          { type: "glow", enabled: Number(next.glow || 0) > 0, value: Number(next.glow || 0) }
        ]
      }
    });
  }

  function timingObject(currentScene, currentNode) {
    const window = selectors().effectiveTiming(currentScene, currentNode.id);
    return {
      startMs: window?.startMs || 0,
      endMs: Number.isFinite(window?.endMs) ? window.endMs : null,
      untilNextTrack: currentNode.timing?.endMode === "trackEnd",
      untilGroupEnd: currentNode.timing?.endMode === "parentEnd"
    };
  }

  function patchTiming(id, legacyPatch) {
    const currentScene = scene();
    const currentNode = selectors().nodeById(currentScene, id);
    if (!currentNode) return;
    const current = timingObject(currentScene, currentNode);
    const next = { ...current, ...legacyPatch };
    const parentStart = parentStartMs(currentScene, currentNode);
    const absoluteStart = Math.max(parentStart, Number(next.startMs || 0));
    let endMode = currentNode.timing?.endMode || "fixed";
    if (next.untilNextTrack === true) endMode = "trackEnd";
    else if (next.untilGroupEnd === true) endMode = "parentEnd";
    else if (legacyPatch.untilNextTrack === false || legacyPatch.untilGroupEnd === false || legacyPatch.endMs !== undefined) endMode = "fixed";
    const absoluteEnd = next.endMs == null ? absoluteStart + 1000 : Number(next.endMs);
    context().commit({
      type: "node.timing",
      payload: {
        id,
        patch: {
          startMs: Math.max(0, absoluteStart - parentStart),
          endMode,
          durationMs: endMode === "fixed" ? Math.max(50, absoluteEnd - absoluteStart) : null
        }
      }
    });
  }

  function animationObject(currentNode) {
    const animations = currentNode?.animations || {};
    return {
      enter: animations.in?.type || "fade",
      exit: animations.out?.type || "fade",
      enterDurationMs: Number(animations.in?.durationMs ?? 600),
      exitDurationMs: Number(animations.out?.durationMs ?? 600),
      enterEasing: animations.in?.easing || "ease-out",
      exitEasing: animations.out?.easing || "ease-out",
      durationMs: Number(animations.in?.durationMs ?? 600),
      easing: animations.in?.easing || "ease-out",
      overrideChildren: animations.overrideChildren === true
    };
  }

  function patchAnimation(id, patch) {
    const current = node(id);
    if (!current) return;
    const value = { ...animationObject(current), ...patch };
    context().commit({
      type: "node.animations",
      payload: {
        id,
        patch: {
          in: {
            ...(current.animations?.in || {}),
            type: value.enter,
            durationMs: Number(value.enterDurationMs ?? value.durationMs ?? 600),
            easing: value.enterEasing || value.easing || "ease-out"
          },
          out: {
            ...(current.animations?.out || {}),
            type: value.exit,
            durationMs: Number(value.exitDurationMs ?? value.durationMs ?? 600),
            easing: value.exitEasing || value.easing || "ease-out"
          },
          ...(current.nodeType === "group" ? { overrideChildren: value.overrideChildren === true } : {})
        }
      }
    });
  }

  function nestedProxy(getter, setter) {
    return new Proxy({}, {
      get(_target, property) {
        if (property === "toJSON") return () => clone(getter());
        return getter()?.[property];
      },
      set(_target, property, value) {
        setter({ [property]: value });
        return true;
      },
      ownKeys() { return Reflect.ownKeys(getter() || {}); },
      getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; }
    });
  }

  function adapt(id) {
    return new Proxy({}, {
      get(_target, property) {
        const currentScene = scene();
        const current = selectors().nodeById(currentScene, id);
        if (!current) return undefined;
        if (property === "__sceneNode") return current;
        if (property === "id") return current.id;
        if (property === "name") return current.name;
        if (property === "visible") return current.visible !== false;
        if (property === "locked") return current.locked === true;
        if (property === "marker") return current.marker || "#8b5cf6";
        if (property === "x") return Number(current.transform?.x || 0);
        if (property === "y") return Number(current.transform?.y || 0);
        if (property === "scale") return Number(current.transform?.scaleX ?? 1) * 100;
        if (property === "rotation") return Number(current.transform?.rotation || 0);
        if (property === "anchorX") return Number(current.transform?.anchorX ?? .5);
        if (property === "anchorY") return Number(current.transform?.anchorY ?? .5);
        if (property === "groupId" || property === "parentId") return current.parentId || null;
        if (property === "kind") return current.nodeType === "group" ? "group" : current.component?.kind || "unknown";
        if (property === "templateId") return current.component?.templateId || null;
        if (property === "runtimeTarget") return current.component?.runtimeTarget || null;
        if (property === "properties") return nestedProxy(
          () => node(id)?.component?.properties || {},
          patch => context().commit({ type: "node.componentProperties", payload: { id, patch } })
        );
        if (property === "assetData") return current.component?.properties?.assetData || current.component?.properties?.legacyAssetData || null;
        if (property === "effects") return nestedProxy(
          () => effectsObject(node(id)),
          patch => patchEffects(id, patch)
        );
        if (property === "timing") return nestedProxy(
          () => timingObject(scene(), node(id)),
          patch => patchTiming(id, patch)
        );
        if (property === "animation") return nestedProxy(
          () => animationObject(node(id)),
          patch => patchAnimation(id, patch)
        );
        if (property === "toJSON") return () => clone(current);
        return current[property];
      },
      set(_target, property, value) {
        if (property === "name") context().commit({ type: "node.rename", payload: { id, name: value } });
        else if (property === "visible") context().commit({ type: "node.visibility", payload: { id, visible: value } });
        else if (property === "locked") context().commit({ type: "node.lock", payload: { id, locked: value } });
        else if (property === "marker") context().commit({ type: "node.marker", payload: { id, marker: value } });
        else if (["x", "y", "rotation", "anchorX", "anchorY"].includes(property)) context().commit({ type: "node.transform", payload: { id, patch: { [property]: value } } });
        else if (property === "scale") context().commit({ type: "node.transform", payload: { id, patch: { scaleX: Number(value) / 100, scaleY: Number(value) / 100 } } });
        else if (property === "groupId" || property === "parentId") context().commit({ type: "node.reparent", payload: { id, parentId: value || null } });
        else if (property === "assetData") context().commit({ type: "node.componentProperties", payload: { id, patch: { assetData: value } } });
        else return false;
        return true;
      },
      ownKeys() { return Reflect.ownKeys(node(id) || {}); },
      getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; }
    });
  }

  function groups() {
    return scene().nodes.filter(item => item.nodeType === "group").map(item => adapt(item.id));
  }

  function layers() {
    return scene().nodes.filter(item => item.nodeType !== "group").map(item => adapt(item.id));
  }

  function get(id) {
    return node(id) ? adapt(id) : null;
  }

  function selection() {
    const current = context().sessionStore.getSnapshot().selection;
    if (!current?.id) return { type: "layer", id: "" };
    return { type: current.type === "group" ? "group" : "layer", id: current.id };
  }

  function timelineDurationMs() {
    return Math.max(1, Number(scene()?.timeline?.durationMs || 30000));
  }

  function canvasScale() {
    return Math.max(.01, Number(context().sessionStore.getSnapshot().canvasScale || 1));
  }

  function customLibraryAssets() {
    return context().sessionStore.getSnapshot().customLibraryAssets || [];
  }

  root.editor.state.uiAdapters = Object.freeze({ scene, node, get, groups, layers, selection, timelineDurationMs, canvasScale, customLibraryAssets, effectsObject, timingObject, animationObject });
})(window.MusicOverlay);

(() => {
  "use strict";

  const SceneOrder = window.MusicOverlaySceneOrder;
  const LayerRenderer = window.MusicOverlayLayerRenderer;
  const Timeline = window.MusicOverlaySceneTimeline;
  const RegistryApi = window.MusicOverlayComponentRegistry;
  if (!SceneOrder || !LayerRenderer || !Timeline || !RegistryApi) {
    throw new Error("Scene renderer dependencies were not loaded");
  }

  class SceneRendererError extends Error {
    constructor(code, message, details = null) {
      super(message);
      this.name = "SceneRendererError";
      this.code = code;
      this.details = details;
    }
  }

  function validateScene(scene) {
    const errors = [];
    if (!scene || scene.documentType !== "music-overlay.scene" || Number(scene.schemaVersion) !== 2) {
      errors.push("Only music-overlay.scene schemaVersion 2 is supported");
    }
    if (!Array.isArray(scene?.nodes)) errors.push("Scene nodes must be an array");
    const nodes = Array.isArray(scene?.nodes) ? scene.nodes : [];
    const byId = new Map();
    nodes.forEach((node, index) => {
      if (!node?.id || typeof node.id !== "string") errors.push(`nodes[${index}] has no id`);
      else if (byId.has(node.id)) errors.push(`Duplicate node id '${node.id}'`);
      else byId.set(node.id, node);
      if (!['group', 'component'].includes(node?.nodeType)) errors.push(`Node '${node?.id || index}' has unsupported nodeType`);
      if (node?.nodeType === "component" && !node.component?.kind) errors.push(`Component '${node?.id || index}' has no kind`);
    });
    nodes.forEach(node => {
      if (node.parentId && !byId.has(node.parentId)) errors.push(`Node '${node.id}' refers to missing parent '${node.parentId}'`);
      const visited = new Set([node.id]);
      let cursor = node.parentId;
      while (cursor) {
        if (visited.has(cursor)) {
          errors.push(`Scene node cycle detected at '${cursor}'`);
          break;
        }
        visited.add(cursor);
        cursor = byId.get(cursor)?.parentId || null;
      }
    });
    if (errors.length) throw new SceneRendererError("INVALID_SCENE", errors[0], errors);
    return { nodes, byId };
  }

  function effectValue(node, type, fallback) {
    const effect = (node.effects || []).find(candidate => candidate?.type === type && candidate.enabled !== false);
    if (!effect) return fallback;
    const value = Number(effect.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function structureSignature(scene) {
    return (scene?.nodes || []).map(node => [
      node.id,
      node.nodeType,
      node.parentId || "",
      node.component?.kind || "",
      Number(node.order) || 0
    ].join("|")).join("\n");
  }

  class SceneRenderer {
    constructor(root, options = {}) {
      if (!(root instanceof Element)) throw new SceneRendererError("INVALID_ROOT", "SceneRenderer requires a DOM element");
      this.root = root;
      this.mode = options.mode || "preview";
      this.registry = options.registry || RegistryApi.createDefaultComponentRegistry();
      this.scene = null;
      this.records = new Map();
      this.nodesById = new Map();
      this.orderedRecords = [];
      this.windows = new Map();
      this.timeMs = 0;
      this.data = {
        title: "Track title",
        artist: "Artist",
        position: 0,
        duration: 180,
        thumbnail: "/assets/default-cover.png",
        audioBins: []
      };
      this.diagnostics = { errors: [], warnings: [], unsupportedKinds: [] };
      root.classList.add("mo-scene-root");
      root.dataset.rendererMode = this.mode;
    }

    setScene(scene) {
      const contract = validateScene(scene);
      this.destroyRecords();
      this.scene = structuredClone(scene);
      this.nodesById = new Map(this.scene.nodes.map(node => [node.id, node]));
      this.applySceneEnvelope();
      this.windows = Timeline.resolveWindows(this.scene.nodes, Number(this.scene.timeline?.durationMs) || 30000);
      this.diagnostics = { errors: [], warnings: [], unsupportedKinds: [] };

      const tree = SceneOrder.buildTree(this.scene.nodes);
      const appendChildren = (parentId, parentElement, depth) => {
        for (const node of tree.get(parentId) || []) {
          const record = this.createRecord(node, depth);
          parentElement.appendChild(record.element);
          this.records.set(node.id, record);
          this.orderedRecords.push(record);
          if (node.nodeType === "group") appendChildren(node.id, record.element, depth + 1);
        }
      };
      appendChildren(null, this.root, 0);
      if (this.records.size !== contract.nodes.length) {
        throw new SceneRendererError("TREE_BUILD_FAILED", "Not every scene node was mounted");
      }
      this.render();
      return this;
    }

    updateScene(scene) {
      validateScene(scene);
      if (!this.scene || structureSignature(this.scene) !== structureSignature(scene)) return this.setScene(scene);
      this.scene = structuredClone(scene);
      this.nodesById = new Map(this.scene.nodes.map(node => [node.id, node]));
      this.applySceneEnvelope();
      this.windows = Timeline.resolveWindows(this.scene.nodes, Number(this.scene.timeline?.durationMs) || 30000);
      this.diagnostics.errors = [];
      this.scene.nodes.forEach(node => {
        const record = this.records.get(node.id);
        if (!record) return;
        record.node = node;
        LayerRenderer.applyStacking(record.element, this.scene.nodes, node);
      });
      this.render();
      return this;
    }

    applySceneEnvelope() {
      this.root.dataset.sceneId = this.scene.id || "scene";
      this.root.style.width = `${Math.max(1, Number(this.scene.canvas?.width) || 1920)}px`;
      this.root.style.height = `${Math.max(1, Number(this.scene.canvas?.height) || 1080)}px`;
      this.root.style.setProperty("--mo-canvas-background", this.scene.canvas?.backgroundColor || "transparent");
    }

    createRecord(node, depth) {
      let element;
      let definition = null;
      if (node.nodeType === "group") {
        element = document.createElement("div");
        element.className = "mo-scene-node mo-scene-group";
        element.dataset.sceneNodeId = node.id;
        element.dataset.sceneKind = "group";
      } else {
        const created = this.registry.create(node, { renderer: this, mode: this.mode });
        element = created.element;
        definition = created.definition;
        element.classList.add("mo-scene-node");
        if (!this.registry.supports(node.component?.kind)) this.diagnostics.unsupportedKinds.push(node.component?.kind || "unknown");
      }
      element.dataset.sceneDepth = String(depth);
      if (this.mode === "editor") {
        if (node.nodeType === "group") element.dataset.groupId = node.id;
        else element.dataset.layerId = node.id;
      }
      LayerRenderer.applyStacking(element, this.scene.nodes, node);
      return { node, element, definition, depth, visible: false };
    }

    setData(data) {
      this.data = { ...this.data, ...(data || {}) };
      this.render();
      return this;
    }

    setTime(timeMs) {
      this.timeMs = Math.max(0, Number(timeMs) || 0);
      this.render();
      return this;
    }

    setFrame({ data, timeMs } = {}) {
      if (data) this.data = { ...this.data, ...data };
      if (timeMs !== undefined) this.timeMs = Math.max(0, Number(timeMs) || 0);
      this.render();
      return this;
    }

    render() {
      if (!this.scene) return;
      const appearance = this.scene.appearance || {};
      for (const record of this.orderedRecords) {
        const { node, element, definition } = record;
        const window = this.windows.get(node.id);
        const parentVisible = !node.parentId || this.records.get(node.parentId)?.visible === true;
        const effectiveAnimations = Timeline.resolveAnimations(node, this.nodesById);
        const frame = Timeline.getFrame(node, window, this.timeMs, effectiveAnimations);
        const visible = parentVisible && node.visible !== false && frame.visible;
        record.visible = visible;
        element.classList.toggle("mo-node-hidden", !visible);
        element.dataset.sceneVisible = visible ? "true" : "false";

        const transform = node.transform || {};
        const scaleX = numberOr(transform.scaleX, 1) * frame.scale;
        const scaleY = numberOr(transform.scaleY, 1) * frame.scale;
        element.style.translate = `${numberOr(transform.x, 0) + frame.x}px ${numberOr(transform.y, 0) + frame.y}px`;
        element.style.scale = `${scaleX} ${scaleY}`;
        element.style.rotate = `${numberOr(transform.rotation, 0) + frame.rotate}deg`;
        element.style.transformOrigin = `${numberOr(transform.anchorX, .5) * 100}% ${numberOr(transform.anchorY, .5) * 100}%`;

        const opacity = Math.max(0, effectValue(node, "opacity", 100) / 100) * frame.opacity;
        element.style.opacity = String(opacity);
        const blur = Math.max(0, effectValue(node, "blur", 0));
        const glow = Math.max(0, effectValue(node, "glow", 0));
        const filters = [];
        if (blur > 0) filters.push(`blur(${blur}px)`);
        if (glow > 0) filters.push(`drop-shadow(0 0 ${glow}px currentColor)`);
        element.style.filter = filters.join(" ");

        if (node.nodeType === "group") {
          const properties = node.component?.properties || {};
          const width = Math.max(0, numberOr(properties.width, 0));
          const height = Math.max(0, numberOr(properties.height, 0));
          element.style.width = width > 0 ? `${width}px` : "0px";
          element.style.height = height > 0 ? `${height}px` : "0px";
          element.style.background = "transparent";
          element.style.borderRadius = "0";
        }

        if (definition?.update) {
          try {
            definition.update(element, node, { data: this.data, appearance, timeMs: this.timeMs, window, mode: this.mode });
          } catch (error) {
            this.diagnostics.errors.push({ nodeId: node.id, message: error?.message || String(error) });
            element.classList.add("mo-node-error");
          }
        }
      }
    }

    getDiagnostics() {
      return structuredClone({
        ...this.diagnostics,
        unsupportedKinds: [...new Set(this.diagnostics.unsupportedKinds)],
        mountedNodes: this.records.size,
        visibleNodes: this.orderedRecords.filter(record => record.visible).length,
        sceneId: this.scene?.id || null,
        revision: this.scene?.revision ?? null
      });
    }

    inspect() {
      return this.orderedRecords.map(record => ({
        id: record.node.id,
        parentId: record.node.parentId || null,
        kind: record.node.nodeType === "group" ? "group" : record.node.component?.kind,
        depth: record.depth,
        order: Number(record.node.order) || 0,
        zIndex: Number(record.element.style.zIndex) || 0,
        visible: record.visible,
        window: this.windows.get(record.node.id)
      }));
    }

    destroyRecords() {
      for (const record of this.orderedRecords) {
        try { record.definition?.destroy?.(record.element, record.node); } catch {}
      }
      this.records.clear();
      this.orderedRecords = [];
      this.windows.clear();
      this.nodesById.clear();
      this.root.replaceChildren();
    }

    destroy() {
      this.destroyRecords();
      this.scene = null;
      this.root.classList.remove("mo-scene-root");
      delete this.root.dataset.rendererMode;
      delete this.root.dataset.sceneId;
    }
  }

  window.MusicOverlaySceneRenderer = Object.freeze({
    SceneRenderer,
    SceneRendererError,
    validateScene
  });
})();

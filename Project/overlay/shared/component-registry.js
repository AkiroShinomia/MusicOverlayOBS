(() => {
  "use strict";

  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };

  function renderAccentText(element, value, properties) {
    const text = String(value ?? "");
    const accent = String(properties.accentWord || "").trim();
    element.textContent = "";
    if (!accent) {
      element.textContent = text;
      return;
    }
    const index = text.toLocaleLowerCase().indexOf(accent.toLocaleLowerCase());
    if (index < 0) {
      element.textContent = text;
      return;
    }
    element.append(document.createTextNode(text.slice(0, index)));
    const span = document.createElement("span");
    span.className = "mo-text-accent";
    span.style.color = properties.accentColor || "#74ff70";
    span.textContent = text.slice(index, index + accent.length);
    element.append(span, document.createTextNode(text.slice(index + accent.length)));
  }

  function boundText(properties, data) {
    switch (properties.binding) {
      case "artist": return data.artist || properties.text || "Artist";
      case "custom": return properties.text || "Text";
      case "ticker": return `${data.title || "Track title"} · ${data.artist || "Artist"}`;
      case "title": return data.title || properties.text || "Track title";
      default: return properties.text || data.title || "Text";
    }
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
  }

  class ComponentRegistry {
    constructor() {
      this.definitions = new Map();
      this.aliases = new Map();
    }

    register(kind, definition) {
      if (!kind || typeof definition?.create !== "function") throw new Error("Component definition requires kind and create()");
      this.definitions.set(String(kind).toLowerCase(), definition);
      return this;
    }

    alias(alias, kind) {
      this.aliases.set(String(alias).toLowerCase(), String(kind).toLowerCase());
      return this;
    }

    resolve(kind) {
      let key = String(kind || "unknown").toLowerCase();
      const visited = new Set();
      while (this.aliases.has(key) && !visited.has(key)) {
        visited.add(key);
        key = this.aliases.get(key);
      }
      return this.definitions.get(key) || this.definitions.get("unknown");
    }

    supports(kind) {
      let key = String(kind || "unknown").toLowerCase();
      const visited = new Set();
      while (this.aliases.has(key) && !visited.has(key)) {
        visited.add(key);
        key = this.aliases.get(key);
      }
      return this.definitions.has(key) && key !== "unknown";
    }

    create(node, context) {
      const kind = node?.component?.kind || "unknown";
      const definition = this.resolve(kind);
      const element = definition.create(node, context);
      element.classList.add("mo-scene-component", `mo-kind-${String(kind).toLowerCase()}`);
      element.dataset.sceneNodeId = node.id;
      element.dataset.sceneKind = kind;
      if (node.component?.templateId) element.dataset.sceneTemplate = node.component.templateId;
      return { element, definition };
    }

    kinds() {
      return [...this.definitions.keys()].sort();
    }
  }

  function sizedElement(tagName = "div") {
    return document.createElement(tagName);
  }

  function applyBoxProperties(element, properties, defaults = {}) {
    const width = clamp(properties.width, 1, 4000, defaults.width || 260);
    const height = clamp(properties.height, 1, 4000, defaults.height || 100);
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.borderRadius = `${clamp(properties.borderRadius, 0, 2000, defaults.borderRadius || 0)}px`;
    element.style.color = properties.color || defaults.color || "#ffffff";
    if (Number(properties.outline) > 0) {
      element.style.border = `${clamp(properties.outline, 0, 40, 0)}px solid ${properties.outlineColor || "#ffffff"}`;
    } else {
      element.style.removeProperty("border");
    }
  }

  function createDefaultComponentRegistry() {
    const registry = new ComponentRegistry();

    registry.register("block", {
      create: () => sizedElement(),
      update: (element, node, state) => {
        const properties = node.component?.properties || {};
        applyBoxProperties(element, properties, { width: 260, height: 110, borderRadius: 12, color: "rgba(12,16,24,.82)" });
        element.style.background = properties.color || state.appearance?.colors?.background || "rgba(12,16,24,.82)";
        element.dataset.blockStyle = String(properties.style || node.component?.templateId || "default").toLowerCase();
      }
    });

    registry.register("image", {
      create: () => sizedElement("img"),
      update: (element, node, state) => {
        const properties = node.component?.properties || {};
        applyBoxProperties(element, properties, { width: 120, height: 120, borderRadius: 12 });
        const source = properties.source === "track" ? state.data.thumbnail : null;
        element.src = source || properties.src || properties.assetData || properties.legacyAssetData || state.data.thumbnail || state.appearance?.albumArt?.defaultCover || "/assets/default-cover.png";
        element.alt = node.name || "image";
      }
    });

    registry.register("disc", {
      create: () => {
        const element = sizedElement();
        element.appendChild(document.createElement("i"));
        return element;
      },
      update: (element, node) => {
        const properties = node.component?.properties || {};
        const size = clamp(properties.size ?? properties.width, 10, 2000, 120);
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
        element.style.setProperty("--mo-disc-speed", `${clamp(properties.speedSec, .2, 60, 3)}s`);
        element.dataset.discStyle = String(properties.style || node.component?.templateId || "classic").toLowerCase();
      }
    });

    registry.register("text", {
      create: () => sizedElement(),
      update: (element, node, state) => {
        const properties = node.component?.properties || {};
        element.style.width = `${clamp(properties.width, 10, 4000, 320)}px`;
        element.style.fontFamily = properties.fontFamily || state.appearance?.font?.family || "Arial, sans-serif";
        element.style.fontSize = `${clamp(properties.fontSize, 6, 400, 24)}px`;
        element.style.fontWeight = String(clamp(properties.fontWeight, 100, 1000, 700));
        element.style.letterSpacing = `${clamp(properties.letterSpacing, -20, 100, 0)}px`;
        element.style.color = properties.color || state.appearance?.colors?.text || "#ffffff";
        renderAccentText(element, boundText(properties, state.data), properties);
      }
    });

    registry.register("time", {
      create: () => {
        const element = sizedElement();
        element.innerHTML = '<span class="mo-time-current"></span><span class="mo-time-total"></span>';
        return element;
      },
      update: (element, node, state) => {
        const properties = node.component?.properties || {};
        element.style.width = `${clamp(properties.width, 20, 4000, 180)}px`;
        element.style.fontSize = `${clamp(properties.fontSize, 6, 400, 16)}px`;
        element.style.color = properties.color || state.appearance?.colors?.text || "#ffffff";
        element.querySelector(".mo-time-current").textContent = formatTime(state.data.position);
        element.querySelector(".mo-time-total").textContent = formatTime(state.data.duration);
      }
    });

    registry.register("progress", {
      create: () => {
        const element = sizedElement();
        element.appendChild(document.createElement("i"));
        return element;
      },
      update: (element, node, state) => {
        const properties = node.component?.properties || {};
        applyBoxProperties(element, properties, { width: 280, height: 8, borderRadius: 999 });
        element.style.background = properties.background || state.appearance?.colors?.progressBackground || "rgba(255,255,255,.18)";
        const ratio = state.data.duration > 0 ? clamp(state.data.position / state.data.duration, 0, 1, 0) : 0;
        element.firstElementChild.style.width = `${ratio * 100}%`;
        element.firstElementChild.style.background = properties.color || state.appearance?.colors?.progress || "#ffffff";
      }
    });

    registry.register("equalizer", {
      create: () => sizedElement(),
      update: (element, node, state) => {
        const properties = node.component?.properties || {};
        const count = Math.round(clamp(properties.barCount, 4, 240, 32));
        while (element.children.length < count) element.appendChild(document.createElement("i"));
        while (element.children.length > count) element.lastElementChild.remove();
        element.style.width = `${clamp(properties.width, 20, 4000, 280)}px`;
        element.style.height = `${clamp(properties.height, 4, 2000, 90)}px`;
        element.style.gap = `${clamp(properties.gap, 0, 40, 3)}px`;
        element.style.color = properties.color || state.appearance?.colors?.progress || "#ffffff";
        element.dataset.equalizerStyle = String(properties.style || "bars").toLowerCase();
        element.classList.toggle("mo-equalizer-glow", properties.glow === true || Number(properties.glow) > 0);
        element.style.setProperty("--mo-equalizer-glow", `${clamp(properties.glowPower ?? properties.glow, 0, 100, 14)}px`);
        const preset = properties.fftPreset || state.appearance?.equalizer?.preset || "balanced";
        const bins = state.data.audioBinsByPreset?.[preset] || state.data.audioBins || [];
        element.dataset.fftPreset = preset;
        [...element.children].forEach((bar, index) => {
          const sourceIndex = bins.length ? Math.min(bins.length - 1, Math.floor(index / count * bins.length)) : -1;
          const sample = sourceIndex >= 0 ? clamp(bins[sourceIndex], 0, 1, 0) : (0.12 + Math.abs(Math.sin(index * .73)) * .18);
          bar.style.height = `${Math.max(3, sample * 100)}%`;
        });
      }
    });

    registry.register("particles", {
      create: () => sizedElement(),
      update: (element, node, state) => {
        const properties = node.component?.properties || {};
        const count = Math.round(clamp(properties.count, 1, 120, state.appearance?.particles?.count || 12));
        const glyphSets = {
          notes: ["♪", "♫", "♬"], stars: ["★", "✦", "✧"], hearts: ["♥", "♡"],
          sparkles: ["✦", "❇", "✧"], pixels: ["■", "▪", "□"], crosses: ["✝", "✞", "✟"],
          invertedcrosses: ["⸸"]
        };
        const glyphs = properties.glyphs || glyphSets[String(properties.style || "").toLowerCase()] || ["✦", "♪", "·", "✧"];
        if (element.children.length !== count) {
          element.textContent = "";
          for (let index = 0; index < count; index++) {
            const particle = document.createElement("i");
            particle.style.setProperty("--mo-particle-index", String(index));
            element.appendChild(particle);
          }
        }
        element.style.color = properties.color || state.appearance?.particles?.color || "#ffffff";
        [...element.children].forEach((particle, index) => {
          particle.textContent = glyphs[index % glyphs.length];
          particle.style.fontSize = `${clamp(properties.size, 4, 200, 18)}px`;
          particle.style.animationDuration = `${clamp(properties.durationMs, 200, 30000, 2200)}ms`;
          particle.style.animationDelay = `${-index * 137}ms`;
        });
      }
    });

    registry.register("ticker", {
      create: () => sizedElement(),
      update: (element, node, state) => {
        const properties = node.component?.properties || {};
        applyBoxProperties(element, properties, { width: 420, height: 44, borderRadius: 999 });
        element.textContent = `${state.data.title || "Track title"} · ${state.data.artist || "Artist"}`;
        element.style.color = properties.color || state.appearance?.colors?.text || "#ffffff";
        element.style.background = properties.background || state.appearance?.colors?.background || "rgba(10,13,18,.82)";
      }
    });

    registry.register("unknown", {
      create: () => sizedElement(),
      update: (element, node) => {
        element.textContent = `${node.name || node.id} [${node.component?.kind || "unknown"}]`;
      }
    });

    registry.alias("container", "block");
    return registry;
  }

  window.MusicOverlayComponentRegistry = Object.freeze({
    ComponentRegistry,
    createDefaultComponentRegistry
  });
})();

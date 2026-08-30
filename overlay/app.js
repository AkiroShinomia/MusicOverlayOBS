const fullOverlay = document.getElementById("fullOverlay");
const tickerOverlay = document.getElementById("tickerOverlay");
const fullGroup = document.getElementById("fullGroup");
const tickerGroup = document.getElementById("tickerGroup");
const titleEl = document.getElementById("title");
const artistEl = document.getElementById("artist");
const titleTextEl = document.getElementById("titleText");
const artistTextEl = document.getElementById("artistText");
const tickerTitleEl = document.querySelector(".ticker-title");
const tickerTitleTextEl = document.getElementById("tickerTitleText");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const progressBar = document.getElementById("progressBar");
const tickerCurrentTimeEl = document.getElementById("tickerCurrentTime");
const tickerDurationEl = document.getElementById("tickerDuration");
const tickerProgressBar = document.getElementById("tickerProgressBar");
const coverEl = document.getElementById("cover");
const vinylEl = document.querySelector(".vinyl");
const particleContainer = document.getElementById("particleContainer");
const equalizerEl = document.getElementById("equalizer");
const DEFAULT_COVER = "/assets/default-cover.png";
const eqBars = [];

const defaultConfig = {
  position: {
    left: 70,
    fullBottom: 80,
    tickerBottom: 44
  },
  sizes: {
    fullCardWidth: 430,
    tickerWidth: 500,
    tickerHeight: 42,
    coverSize: 92,
    vinylSize: 108
  },
  colors: {
    background: "rgba(10, 10, 14, 0.80)",
    text: "#ffffff",
    progress: "#ffffff",
    progressBackground: "rgba(255, 255, 255, 0.18)"
  },
  timings: {
    fullVisibleMs: 10000,
    coverDelayMs: 500,
    cardDelayMs: 850,
    exitMs: 600,
    marqueeDelayMs: 2000,
    marqueeSpeedSec: 10
  },
  animations: {
    fullEnter: "slideRight",
    fullExit: "slideDown",
    tickerEnter: "slideUp",
    tickerExit: "none"
  },
  albumArt: {
    useWindowsThumbnail: false,
    defaultCover: DEFAULT_COVER
  },
  theme: {
    preset: "Custom"
  },
  font: {
    family: "Arial",
    titleSize: 25,
    artistSize: 16,
    tickerSize: 14
  },
  ticker: {
    style: "pill"
  },
  fullCard: {
    style: "glass"
  },
  vinyl: {
    style: "classic"
  },
  particles: {
    enabled: true,
    style: "notes",
    count: 20,
    size: 18,
    durationMs: 2200,
    color: "#ffffff"
  },
  equalizer: {
    enabled: true,
    style: "solid",
    barCount: 64,
    barWidth: 5,
    gap: 3,
    height: 86,
    offsetY: 0,
    sidePadding: 14,
    preset: "dynamicBars",
    sensitivity: 1.12,
    smoothing: 0.28,
    outputGain: 1.0,
    spectralContrast: 1.0,
    visualCurvePower: 1.0,
    glow: true,
    glowPower: 18,
    colorMode: "progress",
    color: "#ffffff"
  }
};

let config = defaultConfig;
let lastTrackKey = "";
let fullTimer = null;
let animationTimer1 = null;
let animationTimer2 = null;
let exitTimer = null;
let titleScrollTimer = null;
let artistScrollTimer = null;
let tickerScrollTimer = null;
let lastThumbnail = "";
let previousThumbnail = "";
let ignoreOldThumbnailUntil = 0;
let particleInterval = null;
let layoutEnabled = false;
let layoutTimers = [];

let state = {
  hasTrack: false,
  title: "",
  artist: "",
  duration: 0,
  position: 0,
  isPlaying: false,
  lastLocalUpdate: Date.now()
};

async function init() {
  await loadConfig();
  connectConfigSocket();
  applyConfig();
  createEqualizer();
  setDefaultCover();
  setInterval(updateNowPlayingFromApi, 1000);
  setInterval(renderProgress, 250);
  updateNowPlayingFromApi();
}

async function loadConfig() {
  try {
    const response = await fetch(`/api/config?t=${Date.now()}`, { cache: "no-store" });
    const loadedConfig = await response.json();
    layoutEnabled = Boolean(
      loadedConfig.layout &&
      Array.isArray(loadedConfig.layout.groups) &&
      Array.isArray(loadedConfig.layout.layers)
    );
    config = mergeConfig(defaultConfig, loadedConfig);
  } catch (e) {
    console.error("Config load error:", e);
    layoutEnabled = false;
    config = defaultConfig;
  }
}

function mergeConfig(base, incoming) {
  return {
    position: { ...base.position, ...(incoming.position || {}) },
    sizes: { ...base.sizes, ...(incoming.sizes || {}) },
    colors: { ...base.colors, ...(incoming.colors || {}) },
    timings: { ...base.timings, ...(incoming.timings || {}) },
    animations: { ...base.animations, ...(incoming.animations || {}) },
    albumArt: { ...base.albumArt, ...(incoming.albumArt || {}) },
    theme: { ...base.theme, ...(incoming.theme || {}) },
    font: { ...base.font, ...(incoming.font || {}) },
    ticker: { ...base.ticker, ...(incoming.ticker || {}) },
    fullCard: { ...base.fullCard, ...(incoming.fullCard || {}) },
    vinyl: { ...base.vinyl, ...(incoming.vinyl || {}) },
    particles: { ...base.particles, ...(incoming.particles || {}) },
    equalizer: { ...base.equalizer, ...(incoming.equalizer || {}) },
    audio: { ...(base.audio || {}), ...(incoming.audio || {}) },
    layout: normalizeRuntimeLayout(incoming.layout)
  };
}

function normalizeRuntimeLayout(layout) {
  if (!layout || !Array.isArray(layout.groups) || !Array.isArray(layout.layers)) {
    return null;
  }

  const normalizeEffects = value => ({
    opacity: clampRuntimeNumber(value?.opacity, 0, 100, 100),
    blur: clampRuntimeNumber(value?.blur, 0, 80, 0),
    glow: clampRuntimeNumber(value?.glow, 0, 100, 0)
  });

  const normalizeAnimation = value => {
    const durationMs = clampRuntimeNumber(value?.durationMs, 0, 10000, 600);
    const easing = ["linear", "ease-out", "ease-in-out", "spring"].includes(value?.easing) ? value.easing : "ease-out";
    const enterEasing = ["linear", "ease-out", "ease-in-out", "spring"].includes(value?.enterEasing) ? value.enterEasing : easing;
    const exitEasing = ["linear", "ease-out", "ease-in-out", "spring"].includes(value?.exitEasing) ? value.exitEasing : easing;
    return {
      enter: sanitizeAnimation(value?.enter, "fade"),
      exit: sanitizeAnimation(value?.exit, "fade"),
      enterDurationMs: clampRuntimeNumber(value?.enterDurationMs, 0, 10000, durationMs),
      enterEasing,
      exitDurationMs: clampRuntimeNumber(value?.exitDurationMs, 0, 10000, durationMs),
      exitEasing,
      durationMs,
      easing
    };
  };

  const normalizeTiming = value => {
    const startMs = clampRuntimeNumber(value?.startMs, 0, 3600000, 0);
    const untilNextTrack = value?.untilNextTrack === true;
    return {
      startMs,
      untilNextTrack,
      endMs: untilNextTrack ? null : Math.max(startMs + 50, clampRuntimeNumber(value?.endMs, 0, 3600000, startMs + 1000))
    };
  };

  const normalizeItem = item => ({
    id: typeof item?.id === "string" ? item.id : "",
    name: typeof item?.name === "string" ? item.name : "",
    kind: typeof item?.kind === "string" ? item.kind : null,
    templateId: typeof item?.templateId === "string" ? item.templateId : null,
    properties: item?.properties && typeof item.properties === "object" ? { ...item.properties } : {},
    assetData: typeof item?.assetData === "string" ? item.assetData : null,
    groupId: typeof item?.groupId === "string" ? item.groupId : null,
    runtimeTarget: item?.runtimeTarget === "full" || item?.runtimeTarget === "ticker" ? item.runtimeTarget : null,
    visible: item?.visible !== false,
    locked: item?.locked === true,
    x: clampRuntimeNumber(item?.x, -10000, 10000, 0),
    y: clampRuntimeNumber(item?.y, -10000, 10000, 0),
    scale: clampRuntimeNumber(item?.scale, 10, 400, 100),
    effects: normalizeEffects(item?.effects),
    animation: normalizeAnimation(item?.animation),
    timing: normalizeTiming(item?.timing)
  });

  return {
    version: 1,
    groups: layout.groups.map(normalizeItem).filter(item => item.id),
    layers: layout.layers.map(normalizeItem).filter(item => item.id)
  };
}

function clampRuntimeNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function sanitizeAnimation(value, fallback) {
  const allowed = ["slideLeft", "slideRight", "slideUp", "slideDown", "rollRight", "fade", "scale", "none"];
  return allowed.includes(value) ? value : fallback;
}

function getEqualizerConfig() {
  const base = { ...defaultConfig.equalizer, ...(config.equalizer || {}) };
  const tickerStyle = config.ticker?.style || "pill";
  const autoByTicker = {
    pill: {
      sidePadding: Math.round((config.sizes.tickerHeight || 42) * 0.65),
      offsetY: 0
    },
    glass: { sidePadding: 8, offsetY: 1 },
    thin: { sidePadding: 6, offsetY: 0, height: 64 },
    compact: { sidePadding: 8, offsetY: 0, height: 70 },
    textonly: { sidePadding: 0, offsetY: 2, height: 56 }
  };
  return { ...base, ...(autoByTicker[tickerStyle] || {}) };
}

function applyConfig() {
  const root = document.documentElement;
  root.style.setProperty("--overlay-left", `${config.position.left}px`);
  root.style.setProperty("--full-bottom", `${config.position.fullBottom}px`);
  root.style.setProperty("--ticker-bottom", `${config.position.tickerBottom}px`);
  root.style.setProperty("--full-card-width", `${config.sizes.fullCardWidth}px`);
  root.style.setProperty("--ticker-width", `${config.sizes.tickerWidth}px`);
  root.style.setProperty("--ticker-height", `${config.sizes.tickerHeight}px`);
  root.style.setProperty("--cover-size", `${config.sizes.coverSize}px`);
  root.style.setProperty("--vinyl-size", `${config.sizes.vinylSize}px`);
  root.style.setProperty("--overlay-bg", config.colors.background);
  root.style.setProperty("--overlay-text", config.colors.text);
  root.style.setProperty("--progress-color", config.colors.progress);
  root.style.setProperty("--progress-bg", config.colors.progressBackground);
  root.style.setProperty("--exit-ms", `${config.timings.exitMs}ms`);
  root.style.setProperty("--cover-delay-ms", `${config.timings.coverDelayMs}ms`);
  root.style.setProperty("--card-delay-ms", `${config.timings.cardDelayMs}ms`);
  root.style.setProperty("--marquee-speed-sec", `${config.timings.marqueeSpeedSec}s`);
  root.style.setProperty("--font-family", `"${config.font.family}"`);
  root.style.setProperty("--title-size", `${config.font.titleSize}px`);
  root.style.setProperty("--artist-size", `${config.font.artistSize}px`);
  root.style.setProperty("--ticker-size", `${config.font.tickerSize}px`);

  const eq = getEqualizerConfig();
  root.style.setProperty("--eq-side-padding", `${eq.sidePadding}px`);
  root.style.setProperty("--eq-offset-y", `${eq.offsetY}px`);
  root.style.setProperty("--eq-height", `${eq.height}px`);
  root.style.setProperty("--eq-gap", `${eq.gap}px`);
  root.style.setProperty("--eq-bar-width", `${eq.barWidth}px`);
  root.style.setProperty("--eq-glow-power", `${eq.glowPower}px`);
  const eqColor = eq.colorMode === "custom" ? eq.color : config.colors.progress;
  root.style.setProperty("--eq-color", eqColor);

  if (equalizerEl) {
    equalizerEl.className = `equalizer equalizer-style-${eq.style}`;
    equalizerEl.classList.toggle("equalizer-glow", Boolean(eq.glow));
  }

  const tickerStyles = [
    "ticker-style-pill",
    "ticker-style-glass",
    "ticker-style-thin",
    "ticker-style-compact",
    "ticker-style-textonly"
  ];
  tickerOverlay.classList.remove(...tickerStyles);
  tickerOverlay.classList.add(`ticker-style-${config.ticker.style}`);

  const fullCard = document.querySelector(".full-card");
  if (fullCard) {
    const cardStyles = [
      "full-card-style-glass",
      "full-card-style-solid",
      "full-card-style-minimal",
      "full-card-style-neon",
      "full-card-style-spotify"
    ];
    fullCard.classList.remove(...cardStyles);
    fullCard.classList.add(`full-card-style-${config.fullCard.style}`);
  }

  if (vinylEl) {
    const vinylStyles = [
      "vinyl-style-classic",
      "vinyl-style-black",
      "vinyl-style-white",
      "vinyl-style-gold",
      "vinyl-style-transparent",
      "vinyl-style-cd",
      "vinyl-style-bloodMoon"
    ];
    vinylEl.classList.remove(...vinylStyles);
    vinylEl.classList.add(`vinyl-style-${config.vinyl?.style || "classic"}`);
  }

  applyRuntimeLayout();
}

function getRuntimeGroup(id) {
  return config.layout?.groups?.find(group => group.id === id) || null;
}

function getRuntimeLayerNode(id) {
  const nodes = {
    "full-particles": particleContainer,
    "full-cover": coverEl,
    "full-vinyl": vinylEl,
    "full-title": titleEl,
    "full-artist": artistEl,
    "full-time": document.querySelector(".time-row"),
    "full-progress": document.querySelector(".progress"),
    "full-card-shell": document.querySelector(".full-card"),
    "ticker-equalizer": equalizerEl,
    "ticker-title": tickerTitleEl,
    "ticker-time": document.querySelector(".ticker-time"),
    "ticker-progress": document.querySelector(".ticker-progress")
  };
  return nodes[id] || document.querySelector(`[data-dynamic-runtime-layer="${CSS.escape(id || "")}"]`) || null;
}

function syncDynamicRuntimeNodes() {
  const root = document.getElementById("dynamicLayoutRoot");
  if (!root || !config.layout) return;
  const dynamicLayers = config.layout.layers.filter(layer => !document.querySelector(`[data-layout-layer="${CSS.escape(layer.id)}"]`));
  const ids = new Set(dynamicLayers.map(layer => layer.id));
  root.querySelectorAll("[data-dynamic-runtime-layer]").forEach(node => {
    if (!ids.has(node.dataset.dynamicRuntimeLayer)) node.remove();
  });

  dynamicLayers.forEach(layer => {
    let node = root.querySelector(`[data-dynamic-runtime-layer="${CSS.escape(layer.id)}"]`);
    const tag = layer.kind === "image" ? "img" : "div";
    if (!node || node.tagName.toLowerCase() !== tag) {
      node?.remove();
      node = document.createElement(tag);
      node.dataset.dynamicRuntimeLayer = layer.id;
      node.className = `dynamic-runtime-object kind-${layer.kind || "block"}`;
      root.appendChild(node);
    }
    updateDynamicRuntimeNode(node, layer);
  });
}

function updateDynamicRuntimeNode(node, layer) {
  const props = layer.properties || {};
  const runtimeStateClasses = ["layout-layer-hidden", "layout-timeline-hidden", "layout-custom-group-hidden"]
    .filter(className => node.classList.contains(className));
  node.className = `dynamic-runtime-object kind-${layer.kind || "block"} style-${String(props.style || "default").toLowerCase()}`;
  node.classList.add(...runtimeStateClasses);
  if (layer.kind === "image") {
    node.src = layer.assetData || lastThumbnail || config.albumArt.defaultCover || DEFAULT_COVER;
  } else if (layer.kind === "text") {
    const text = props.binding === "artist" ? state.artist : props.binding === "custom" ? props.text || "" : state.title;
    renderRuntimeText(node, text, props);
  } else if (layer.kind === "time") {
    node.innerHTML = `<span class="time-current">${formatTime(state.position)}</span><span class="time-total">${formatTime(state.duration)}</span>`;
  } else if (layer.kind === "ticker") {
    node.textContent = `${state.title || "Track title"} · ${state.artist || "Artist"}`;
  } else if (layer.kind === "progress") {
    if (!node.firstElementChild) node.innerHTML = "<i></i>";
    const progress = state.duration > 0 ? Math.min(state.position / state.duration * 100, 100) : 0;
    node.firstElementChild.style.width = `${progress}%`;
  } else if (layer.kind === "equalizer") {
    const count = clampRuntimeNumber(props.barCount, 4, 120, 32);
    if (node.children.length !== count) {
      node.innerHTML = "";
      for (let index = 0; index < count; index++) node.appendChild(document.createElement("i"));
    }
    if (lastAudioData) renderDynamicRuntimeEqualizerNode(node, layer, lastAudioData, getEqualizerConfig());
    else [...node.children].forEach(bar => bar.style.height = "4px");
  }
  node.style.setProperty("--object-width", `${clampRuntimeNumber(props.width, 10, 2000, 260)}px`);
  node.style.setProperty("--object-height", `${clampRuntimeNumber(props.height, 2, 1200, 100)}px`);
  node.style.setProperty("--object-size", `${clampRuntimeNumber(props.size, 10, 1200, 120)}px`);
  node.style.setProperty("--object-font-size", `${clampRuntimeNumber(props.fontSize, 6, 300, 20)}px`);
  node.style.setProperty("--object-color", props.color || "#ffffff");
  node.style.setProperty("--object-gap", `${clampRuntimeNumber(props.gap, 0, 20, 3)}px`);
  node.style.fontWeight = String(clampRuntimeNumber(props.fontWeight, 100, 1000, 800));
  node.style.letterSpacing = `${clampRuntimeNumber(props.letterSpacing, -10, 40, 0)}px`;
  node.style.borderRadius = `${clampRuntimeNumber(props.borderRadius, 0, 500, layer.kind === "image" ? 12 : 0)}px`;
  node.style.border = Number(props.outline) > 0 ? `${clampRuntimeNumber(props.outline, 0, 30, 0)}px solid ${props.outlineColor || "#ffffff"}` : "";
}

function renderRuntimeText(node, text, props) {
  const value = String(text || "");
  const accent = String(props.accentWord || "").trim();
  node.textContent = "";
  if (!accent) {
    node.textContent = value;
    return;
  }
  const index = value.toLocaleLowerCase().indexOf(accent.toLocaleLowerCase());
  if (index < 0) {
    node.textContent = value;
    return;
  }
  node.append(document.createTextNode(value.slice(0, index)));
  const span = document.createElement("span");
  span.className = "text-accent";
  span.style.color = props.accentColor || "#74ff70";
  span.textContent = value.slice(index, index + accent.length);
  node.append(span, document.createTextNode(value.slice(index + accent.length)));
}

function buildRuntimeFilter(effects) {
  const filters = [];
  if (Number(effects?.blur) > 0) filters.push(`blur(${effects.blur}px)`);
  if (Number(effects?.glow) > 0) filters.push(`drop-shadow(0 0 ${effects.glow}px currentColor)`);
  return filters.join(" ");
}

function applyRuntimeLayout() {
  if (!layoutEnabled || !config.layout) {
    resetRuntimeLayoutStyles();
    return;
  }

  syncDynamicRuntimeNodes();
  const groupNodes = {
    "full-card-group": fullGroup,
    "ticker-group": tickerGroup
  };
  const activeGroupIds = new Set(config.layout.groups.map(group => group.id));
  Object.entries(groupNodes).forEach(([id, node]) => {
    node?.classList.toggle("layout-group-hidden", !activeGroupIds.has(id));
  });

  config.layout.groups.forEach((group, index) => {
    const node = groupNodes[group.id];
    if (!node) return;
    node.style.translate = `${group.x}px ${group.y}px`;
    node.style.scale = `${group.scale / 100}`;
    node.style.opacity = `${group.effects.opacity / 100}`;
    node.style.filter = buildRuntimeFilter(group.effects);
    node.style.zIndex = String(config.layout.groups.length - index + 100);
    node.classList.toggle("layout-group-hidden", group.visible === false);
  });

  config.layout.layers.forEach((layer, index) => {
    const node = getRuntimeLayerNode(layer.id);
    if (!node) return;
    const group = getRuntimeGroup(layer.groupId);
    const isDynamic = Boolean(node.dataset.dynamicRuntimeLayer);
    const isCustomGroup = group && (isDynamic || !groupNodes[group.id]);
    const groupX = isCustomGroup ? group.x : 0;
    const groupY = isCustomGroup ? group.y : 0;
    const groupScale = isCustomGroup ? group.scale / 100 : 1;
    const groupOpacity = isCustomGroup ? group.effects.opacity / 100 : 1;
    const filters = [isCustomGroup ? buildRuntimeFilter(group.effects) : "", buildRuntimeFilter(layer.effects)].filter(Boolean);

    node.style.translate = `${layer.x + groupX}px ${layer.y + groupY}px`;
    node.style.scale = `${(layer.scale / 100) * groupScale}`;
    if (layer.effects.opacity < 100 || groupOpacity < 1) {
      node.style.opacity = `${(layer.effects.opacity / 100) * groupOpacity}`;
    } else {
      node.style.removeProperty("opacity");
    }
    node.style.filter = filters.join(" ");
    node.style.zIndex = String(config.layout.layers.length - index + 10);
    if (getComputedStyle(node).position === "static") node.style.position = "relative";
    node.classList.toggle("layout-layer-hidden", layer.visible === false || group?.visible === false);
  });
}

function resetRuntimeLayoutStyles() {
  [fullGroup, tickerGroup].forEach(node => {
    if (!node) return;
    node.style.removeProperty("translate");
    node.style.removeProperty("scale");
    node.style.removeProperty("opacity");
    node.style.removeProperty("filter");
    node.style.removeProperty("z-index");
    node.classList.remove("layout-group-hidden");
  });
  document.querySelectorAll("[data-layout-layer], [data-dynamic-runtime-layer]").forEach(node => {
    node.style.removeProperty("translate");
    node.style.removeProperty("scale");
    node.style.removeProperty("opacity");
    node.style.removeProperty("filter");
    node.style.removeProperty("z-index");
    node.classList.remove("layout-layer-hidden", "layout-timeline-hidden", "layout-custom-group-hidden");
  });
}

async function updateNowPlayingFromApi() {
  try {
    const response = await fetch(`/api/nowplaying?t=${Date.now()}`, { cache: "no-store" });
    const data = await response.json();
    if (!data.hasTrack || !data.title) {
      hideAll();
      state.hasTrack = false;
      return;
    }

    const title = data.title || "Unknown track";
    const artist = data.artist || "Unknown artist";
    const duration = Number(data.duration || 0);
    const apiPosition = Number(data.position || 0);
    const isPlaying = Boolean(data.isPlaying);
    const thumbnail = typeof data.thumbnail === "string" ? data.thumbnail : "";
    const trackKey = `${title.trim().toLocaleLowerCase()}__${artist.trim().toLocaleLowerCase()}`;
    // Some Chromium media sessions briefly report position=0 while the same
    // track keeps playing. Treat a same-title reset as a replay only when the
    // previous position was genuinely at the end of a known-duration track.
    const wasNearTrackEnd = state.duration > 0 &&
      state.position >= Math.max(8, state.duration - 5);
    const restartedSameTrack = trackKey === lastTrackKey &&
      isPlaying && apiPosition >= 0 && apiPosition < 2.5 && wasNearTrackEnd;
    const isNewTrack = trackKey !== lastTrackKey || restartedSameTrack;

    if (isNewTrack) {
      lastTrackKey = trackKey;
      previousThumbnail = lastThumbnail;
      lastThumbnail = "";
      ignoreOldThumbnailUntil = Date.now() + 3000;

      state = {
        hasTrack: true,
        title,
        artist,
        duration,
        position: apiPosition > 0 ? apiPosition : 0,
        isPlaying,
        lastLocalUpdate: Date.now()
      };

      setScrollingText(titleEl, titleTextEl, title, "title");
      setScrollingText(artistEl, artistTextEl, artist, "artist");
      setScrollingText(tickerTitleEl, tickerTitleTextEl, `${title} - ${artist}`, "ticker");
      setDefaultCover();

      if (isValidNewThumbnail(thumbnail)) {
        setCover(thumbnail);
        lastThumbnail = thumbnail;
      }
      showFullThenTicker();
      startParticles();
    } else {
      state.duration = duration || state.duration;
      state.isPlaying = isPlaying;
      syncPositionFromWindows(apiPosition);
      if (canUpdateThumbnail(thumbnail)) {
        setCover(thumbnail);
        lastThumbnail = thumbnail;
      }
      state.lastLocalUpdate = Date.now();
    }
    renderProgress();
  } catch (e) {
    console.error(e);
  }
}

function isValidNewThumbnail(thumbnail) {
  if (!config.albumArt.useWindowsThumbnail) return false;
  if (!thumbnail || thumbnail.length <= 100) return false;
  if (thumbnail === previousThumbnail) return false;
  return true;
}

function canUpdateThumbnail(thumbnail) {
  if (!config.albumArt.useWindowsThumbnail) return false;
  if (!thumbnail || thumbnail.length <= 100) return false;
  const waitingFreshCover = Date.now() < ignoreOldThumbnailUntil;
  if (waitingFreshCover && thumbnail === previousThumbnail) return false;
  if (thumbnail === lastThumbnail) return false;
  return true;
}

function syncPositionFromWindows(apiPosition) {
  if (!apiPosition || apiPosition <= 0) return;
  const current = state.position;
  const diff = apiPosition - current;
  if (apiPosition < 3 && current > 5) return;
  if (diff > 1.5) {
    state.position = apiPosition;
    return;
  }
  if (diff < -8 && apiPosition > 3) {
    state.position = apiPosition;
  }
}

function renderProgress() {
  if (!state.hasTrack) return;
  if (state.isPlaying) {
    const now = Date.now();
    const delta = (now - state.lastLocalUpdate) / 1000;
    if (delta > 0 && delta < 1) {
      state.position += delta;
    }
    state.lastLocalUpdate = now;
  }
  if (state.duration > 0) {
    state.position = Math.min(state.position, state.duration);
  }

  const current = formatTime(state.position);
  const total = formatTime(state.duration);
  currentTimeEl.textContent = current;
  durationEl.textContent = total;
  tickerCurrentTimeEl.textContent = current;
  tickerDurationEl.textContent = total;

  const progress = state.duration > 0 ? Math.min((state.position / state.duration) * 100, 100) : 0;
  progressBar.style.width = `${progress}%`;
  tickerProgressBar.style.width = `${progress}%`;
  if (layoutEnabled) {
    config.layout?.layers?.filter(layer => layer.templateId).forEach(layer => {
      const node = getRuntimeLayerNode(layer.id);
      if (node) updateDynamicRuntimeNode(node, layer);
    });
  }

  if (state.isPlaying) {
    fullOverlay.classList.remove("paused");
    tickerOverlay.classList.remove("paused");
  } else {
    fullOverlay.classList.add("paused");
    tickerOverlay.classList.add("paused");
  }
}

function showFullThenTicker() {
  if (layoutEnabled && config.layout) {
    showLayoutSequence();
    return;
  }

  clearTimers();

  const fullEnterClass = `anim-enter-${config.animations?.fullEnter || "slideRight"}`;
  const fullExitClass = `anim-exit-${config.animations?.fullExit || "slideDown"}`;
  const tickerEnterClass = `anim-enter-${config.animations?.tickerEnter || "slideUp"}`;

  clearAnimationClasses(fullOverlay);
  clearAnimationClasses(tickerOverlay);
  tickerOverlay.classList.add("hidden");

  fullOverlay.classList.remove("show-cover", "show-card", "hidden");
  fullOverlay.classList.add(fullEnterClass);
  setTimeout(() => fullOverlay.classList.remove(fullEnterClass), 40);

  animationTimer1 = setTimeout(() => {
    fullOverlay.classList.add("show-cover");
  }, config.timings.coverDelayMs);

  animationTimer2 = setTimeout(() => {
    fullOverlay.classList.add("show-card");
  }, config.timings.cardDelayMs);

  fullTimer = setTimeout(() => {
    stopParticles();
    clearAnimationClasses(fullOverlay);
    fullOverlay.classList.add(fullExitClass);

    exitTimer = setTimeout(() => {
      fullOverlay.classList.add("hidden");
      fullOverlay.classList.remove("show-cover", "show-card", fullExitClass);
      clearAnimationClasses(tickerOverlay);
      tickerOverlay.classList.remove("hidden");
      tickerOverlay.classList.add(tickerEnterClass);
      setTimeout(() => tickerOverlay.classList.remove(tickerEnterClass), 40);
    }, config.timings.exitMs);
  }, config.timings.fullVisibleMs);
}

function showLayoutSequence() {
  clearTimers();
  clearAnimationClasses(fullOverlay);
  clearAnimationClasses(tickerOverlay);
  fullOverlay.classList.add("hidden");
  fullOverlay.classList.remove("show-cover", "show-card");
  tickerOverlay.classList.add("hidden");
  setLayoutLayerTimelineState();

  const groupTargets = {
    "full-card-group": { wrapper: fullGroup, overlay: fullOverlay, kind: "full" },
    "ticker-group": { wrapper: tickerGroup, overlay: tickerOverlay, kind: "ticker" }
  };

  config.layout.groups.forEach(group => {
    const target = groupTargets[group.id];
    if (group.visible === false) return;
    const startMs = Number(group.timing?.startMs || 0);
    if (target) {
      queueLayoutTimer(() => showLayoutGroup(group, target), startMs);
    } else {
      setCustomLayoutGroupHidden(group, true);
      queueLayoutTimer(() => showCustomLayoutGroup(group), startMs);
    }
    if (!group.timing?.untilNextTrack) {
      const endMs = Number(group.timing?.endMs || startMs + 1000);
      const exitName = group.animation?.exit || "none";
      const exitDuration = exitName === "none"
        ? 0
        : Number(group.animation?.exitDurationMs ?? group.animation?.durationMs ?? 600);
      const exitStartMs = Math.max(startMs, endMs - exitDuration);
      if (target) queueLayoutTimer(() => hideLayoutGroup(group, target), exitStartMs);
      else queueLayoutTimer(() => hideCustomLayoutGroup(group), exitStartMs);
    }
  });

  config.layout.layers.forEach(layer => {
    const node = getRuntimeLayerNode(layer.id);
    if (!node || layer.visible === false) return;
    const group = getRuntimeGroup(layer.groupId);
    if (group?.visible === false) return;
    const startMs = Number(layer.timing?.startMs || 0);
    queueLayoutTimer(() => showRuntimeLayer(layer, node), startMs);
    if (!layer.timing?.untilNextTrack) {
      const layerEnd = Number(layer.timing?.endMs || startMs + 1000);
      const followsGroupExit = group && !group.timing?.untilNextTrack && Number(group.timing?.endMs) === layerEnd;
      if (followsGroupExit) {
        queueLayoutTimer(() => node.classList.add("layout-timeline-hidden"), layerEnd);
      } else {
        const layerExitDuration = Number(layer.animation?.exitDurationMs ?? layer.animation?.durationMs ?? 600);
        queueLayoutTimer(() => hideRuntimeLayer(layer, node), Math.max(startMs, layerEnd - layerExitDuration));
      }
    }
  });
}

function showLayoutGroup(group, target) {
  clearAnimationClasses(target.overlay);
  const enterClass = `anim-enter-${group.animation?.enter || "fade"}`;
  target.overlay.style.transitionDuration = `${Number(group.animation?.enterDurationMs ?? group.animation?.durationMs ?? 600)}ms`;
  target.overlay.style.transitionTimingFunction = resolveRuntimeEasing(group.animation?.enterEasing || group.animation?.easing);
  target.overlay.classList.remove("hidden");
  target.overlay.classList.add(enterClass);

  if (target.kind === "full") {
    const groupStart = Number(group.timing?.startMs || 0);
    const coverStart = Number(config.layout.layers.find(layer => layer.id === "full-cover")?.timing?.startMs ?? groupStart);
    const cardStart = Number(config.layout.layers.find(layer => layer.id === "full-card-shell")?.timing?.startMs ?? groupStart);
    queueLayoutTimer(() => target.overlay.classList.add("show-cover"), Math.max(0, coverStart - groupStart));
    queueLayoutTimer(() => target.overlay.classList.add("show-card"), Math.max(0, cardStart - groupStart));
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => target.overlay.classList.remove(enterClass));
  });
}

function hideLayoutGroup(group, target) {
  clearAnimationClasses(target.overlay);
  if (target.kind === "full") stopParticles();
  const exitClass = `anim-exit-${group.animation?.exit || "fade"}`;
  const duration = Number(group.animation?.exitDurationMs ?? group.animation?.durationMs ?? 600);
  target.overlay.style.transitionDuration = `${duration}ms`;
  target.overlay.style.transitionTimingFunction = resolveRuntimeEasing(group.animation?.exitEasing || group.animation?.easing);
  target.overlay.classList.add(exitClass);
  queueLayoutTimer(() => {
    target.overlay.classList.add("hidden");
    target.overlay.classList.remove("show-cover", "show-card", exitClass);
  }, duration);
}

function setLayoutLayerTimelineState() {
  config.layout.layers.forEach(layer => {
    const node = getRuntimeLayerNode(layer.id);
    if (!node) return;
    node.classList.add("layout-timeline-hidden");
  });
}

function setCustomLayoutGroupHidden(group, hidden) {
  config.layout.layers
    .filter(layer => layer.groupId === group.id)
    .forEach(layer => getRuntimeLayerNode(layer.id)?.classList.toggle("layout-custom-group-hidden", hidden));
}

function showCustomLayoutGroup(group) {
  setCustomLayoutGroupHidden(group, false);
  animateCustomLayoutGroup(group, true);
}

function hideCustomLayoutGroup(group) {
  animateCustomLayoutGroup(group, false);
  queueLayoutTimer(() => setCustomLayoutGroupHidden(group, true), Number(group.animation?.exitDurationMs ?? group.animation?.durationMs ?? 600));
}

function animateCustomLayoutGroup(group, entering) {
  const name = entering ? group.animation?.enter : group.animation?.exit;
  if (!name || name === "none") return;
  const distance = 140;
  const hiddenFrame = { opacity: 0, transform: "translate(0, 0) scale(1)" };
  if (name === "slideLeft") hiddenFrame.transform = `translateX(${entering ? distance : -distance}px)`;
  if (name === "slideRight") hiddenFrame.transform = `translateX(${entering ? -distance : distance}px)`;
  if (name === "slideUp") hiddenFrame.transform = `translateY(${entering ? distance : -distance}px)`;
  if (name === "slideDown") hiddenFrame.transform = `translateY(${entering ? -distance : distance}px)`;
  if (name === "rollRight") hiddenFrame.transform = entering
    ? "translateX(-220px) rotate(-360deg)"
    : "translateX(220px) rotate(360deg)";
  if (name === "scale") hiddenFrame.transform = "scale(.8)";
  const visibleFrame = { opacity: 1, transform: "translate(0, 0) scale(1)" };
  const keyframes = entering ? [hiddenFrame, visibleFrame] : [visibleFrame, hiddenFrame];
  const easingName = entering ? group.animation?.enterEasing : group.animation?.exitEasing;
  const easing = resolveRuntimeEasing(easingName || group.animation?.easing);
  const duration = entering
    ? Number(group.animation?.enterDurationMs ?? group.animation?.durationMs ?? 600)
    : Number(group.animation?.exitDurationMs ?? group.animation?.durationMs ?? 600);

  config.layout.layers
    .filter(layer => layer.groupId === group.id)
    .forEach(layer => {
      const node = getRuntimeLayerNode(layer.id);
      if (!node?.animate) return;
      node.animate(keyframes, {
        duration,
        easing,
        fill: "none"
      });
    });
}

function showRuntimeLayer(layer, node) {
  node.classList.remove("layout-timeline-hidden");
  animateRuntimeLayer(layer, node, true);
}

function hideRuntimeLayer(layer, node) {
  animateRuntimeLayer(layer, node, false);
  const duration = Number(layer.animation?.exitDurationMs ?? layer.animation?.durationMs ?? 600);
  queueLayoutTimer(() => node.classList.add("layout-timeline-hidden"), duration);
}

function animateRuntimeLayer(layer, node, entering) {
  if (!node?.animate) return;
  const name = entering ? layer.animation?.enter : layer.animation?.exit;
  if (!name || name === "none") return;
  const distance = 90;
  const hiddenFrame = { opacity: 0, transform: "translate(0, 0) scale(1)" };
  if (name === "slideLeft") hiddenFrame.transform = `translateX(${entering ? distance : -distance}px)`;
  if (name === "slideRight") hiddenFrame.transform = `translateX(${entering ? -distance : distance}px)`;
  if (name === "slideUp") hiddenFrame.transform = `translateY(${entering ? distance : -distance}px)`;
  if (name === "slideDown") hiddenFrame.transform = `translateY(${entering ? -distance : distance}px)`;
  if (name === "rollRight") hiddenFrame.transform = entering
    ? "translateX(-220px) rotate(-360deg)"
    : "translateX(220px) rotate(360deg)";
  if (name === "scale") hiddenFrame.transform = "scale(.8)";
  const visibleFrame = { opacity: 1, transform: "translate(0, 0) scale(1)" };
  const easingName = entering ? layer.animation?.enterEasing : layer.animation?.exitEasing;
  const easing = resolveRuntimeEasing(easingName);
  const duration = entering
    ? Number(layer.animation?.enterDurationMs ?? layer.animation?.durationMs ?? 600)
    : Number(layer.animation?.exitDurationMs ?? layer.animation?.durationMs ?? 600);
  node.animate(entering ? [hiddenFrame, visibleFrame] : [visibleFrame, hiddenFrame], { duration, easing, fill: "none" });
}

function resolveRuntimeEasing(value) {
  return value === "spring" ? "cubic-bezier(.18,.89,.32,1.18)" : value || "ease-out";
}

function queueLayoutTimer(callback, delayMs) {
  const timer = setTimeout(callback, Math.max(0, Number(delayMs || 0)));
  layoutTimers.push(timer);
  return timer;
}

function clearAnimationClasses(element) {
  const toRemove = [];
  for (const cls of element.classList) {
    if (cls.startsWith("anim-enter-") || cls.startsWith("anim-exit-")) {
      toRemove.push(cls);
    }
  }
  element.classList.remove(...toRemove);
}

function hideAll() {
  stopParticles();
  clearTimers();
  clearAnimationClasses(fullOverlay);
  clearAnimationClasses(tickerOverlay);
  fullOverlay.classList.add("hidden");
  fullOverlay.classList.remove("show-cover", "show-card");
  tickerOverlay.classList.add("hidden");
  document.querySelectorAll("[data-dynamic-runtime-layer]").forEach(node => node.classList.add("layout-timeline-hidden"));
}

function clearTimers() {
  if (fullTimer) clearTimeout(fullTimer);
  if (animationTimer1) clearTimeout(animationTimer1);
  if (animationTimer2) clearTimeout(animationTimer2);
  if (exitTimer) clearTimeout(exitTimer);
  fullTimer = null;
  animationTimer1 = null;
  animationTimer2 = null;
  exitTimer = null;
  layoutTimers.forEach(timer => clearTimeout(timer));
  layoutTimers = [];
}

function setDefaultCover() {
  const cover = config.albumArt.defaultCover || DEFAULT_COVER;
  coverEl.onerror = null;
  coverEl.src = cover;
}

function setCover(src) {
  coverEl.onerror = () => setDefaultCover();
  coverEl.src = src;
}

function setScrollingText(box, textEl, text, type) {
  textEl.classList.remove("scrolling");
  textEl.style.removeProperty("--scroll-distance");
  textEl.textContent = text;

  const timerMap = {
    title: titleScrollTimer,
    artist: artistScrollTimer,
    ticker: tickerScrollTimer
  };
  const existingTimer = timerMap[type];
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    requestAnimationFrame(() => {
      textEl.classList.remove("scrolling");
      const overflow = textEl.scrollWidth > box.clientWidth;
      if (overflow) {
        const distance = textEl.scrollWidth - box.clientWidth + 50;
        textEl.style.setProperty("--scroll-distance", `-${distance}px`);
        textEl.classList.add("scrolling");
      }
    });
  }, config.timings.marqueeDelayMs);

  if (type === "title") titleScrollTimer = timer;
  if (type === "artist") artistScrollTimer = timer;
  if (type === "ticker") tickerScrollTimer = timer;
}

function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function startParticles() {
  stopParticles();
  if (!config.particles?.enabled || !particleContainer) return;
  spawnParticles();
  particleInterval = setInterval(spawnParticles, 420);
}

function stopParticles() {
  if (particleInterval) {
    clearInterval(particleInterval);
    particleInterval = null;
  }
}

function spawnParticles() {
  if (!config.particles?.enabled || !particleContainer) return;

  const styles = {
    notes: ["♪", "♫", "♬"],
    stars: ["★", "✦", "✧"],
    hearts: ["♥", "♡"],
    sparkles: ["✦", "❇", "✧"],
    pixels: ["■", "▪", "□"],
    crosses: ["✝", "✞", "✟"],
    invertedCrosses: ["⸸", "⸸", "⸸"]
  };
  const symbols = styles[config.particles.style] || styles.notes;
  const count = Math.max(1, Number(config.particles.count || 2));

  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    particle.style.color = config.particles.color || "#ffffff";
    particle.style.fontSize = `${config.particles.size || 18}px`;
    particle.style.animationDuration = `${config.particles.durationMs || 2200}ms`;
    particle.style.setProperty("--particle-x", `${(Math.random() - 0.5) * 180}px`);
    particle.style.setProperty("--particle-y", `${-80 - Math.random() * 130}px`);
    particleContainer.appendChild(particle);
    particle.addEventListener("animationend", () => particle.remove());
  }
}

async function updateAudioLevel() {
  try {
    const response = await fetch(`/api/audiolevel?t=${Date.now()}`, { cache: "no-store" });
    const data = await response.json();
    renderEqualizer(data);
  } catch {
    // ignore
  }
}

let lastEqLevel = 0;
let lastEqBands = [];
let lastEnergyBands = [];
let lastDynamicBarBands = [];
let lastAudioData = null;
const dynamicEqualizerStates = new WeakMap();

function renderEqualizer(audioData) {
  if (!equalizerEl) return;

  const eq = getEqualizerConfig();
  lastAudioData = audioData || null;
  renderDynamicEqualizers(audioData, eq);
  if (!eq.enabled) {
    equalizerEl.style.display = "none";
    return;
  }
  equalizerEl.style.display = "";

  const maxHeight = Number(eq.height || 86);
  const smoothing = Number(eq.smoothing || 0.65);
  const sensitivity = Number(eq.sensitivity || 1);
  const bands = Array.isArray(audioData?.bands) ? audioData.bands : null;
  const energyBands = Array.isArray(audioData?.energyBands) && audioData.energyBands.length
    ? audioData.energyBands
    : bands?.map(value => Math.min(1, Math.pow(Math.max(0, Number(value) || 0), 0.72) * 1.18));
  const dynamicBarBands = Array.isArray(audioData?.dynamicBarBands) && audioData.dynamicBarBands.length
    ? audioData.dynamicBarBands
    : null;

  if (eq.preset === "dynamicBars" && dynamicBarBands) {
    lastDynamicBarBands = renderDynamicBarSet(eqBars, dynamicBarBands, maxHeight, smoothing, sensitivity, lastDynamicBarBands);
  } else if (eq.preset === "energy" && energyBands && energyBands.length > 0) {
    lastEnergyBands = renderEnergyBarSet(eqBars, energyBands, maxHeight, smoothing, sensitivity, lastEnergyBands);
  } else if (bands && bands.length > 0) {
    renderEqualizerBands(bands, maxHeight, smoothing, sensitivity);
  } else {
    renderEqualizerLevel(audioData?.level || 0, maxHeight, smoothing, sensitivity);
  }
}

function renderDynamicBarSet(bars, bands, maxHeight, smoothing, sensitivity, previous) {
  if (!Array.isArray(previous) || previous.length !== bars.length) previous = new Array(bars.length).fill(0);
  const smooth = Math.max(0, Math.min(0.95, Number(smoothing || 0)));
  const attackMix = 0.78 + (1 - smooth) * 0.18;
  const releaseMix = 0.12 + (1 - smooth) * 0.16;
  const usableHeight = Math.max(1, maxHeight - 4);

  for (let i = 0; i < bars.length; i++) {
    const position = (i / Math.max(1, bars.length - 1)) * (bands.length - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(bands.length - 1, leftIndex + 1);
    const fraction = position - leftIndex;
    const interpolated = Number(bands[leftIndex] || 0) * (1 - fraction) + Number(bands[rightIndex] || 0) * fraction;
    const aboveFloor = Math.max(0, (interpolated - 0.025) / 0.975);
    const target = Math.min(1, Math.pow(aboveFloor, 1.08) * sensitivity);
    const mix = target > previous[i] ? attackMix : releaseMix;
    previous[i] += (target - previous[i]) * mix;
    if (previous[i] < 0.004) previous[i] = 0;
    const height = 4 + previous[i] * usableHeight;
    bars[i].style.height = `${Math.max(4, Math.min(maxHeight, height)).toFixed(1)}px`;
  }

  return previous;
}

function renderEnergyBarSet(bars, bands, maxHeight, smoothing, sensitivity, previous) {
  if (!Array.isArray(previous) || previous.length !== bars.length) previous = new Array(bars.length).fill(0);
  const smooth = Math.max(0, Math.min(0.95, Number(smoothing || 0)));
  const attackMix = 0.78 + (1 - smooth) * 0.18;
  const releaseMix = 0.18 + (1 - smooth) * 0.28;
  const usableHeight = Math.max(1, maxHeight - 4);

  for (let i = 0; i < bars.length; i++) {
    const position = (i / Math.max(1, bars.length - 1)) * (bands.length - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(bands.length - 1, leftIndex + 1);
    const fraction = position - leftIndex;
    const interpolated = Number(bands[leftIndex] || 0) * (1 - fraction) + Number(bands[rightIndex] || 0) * fraction;
    const target = Math.min(1, Math.pow(Math.max(0, interpolated), 0.86) * sensitivity * 0.92);
    const mix = target > previous[i] ? attackMix : releaseMix;
    previous[i] += (target - previous[i]) * mix;
    const height = 4 + previous[i] * usableHeight;
    bars[i].style.height = `${Math.max(4, Math.min(maxHeight, height)).toFixed(1)}px`;
  }

  return previous;
}

function renderDynamicEqualizers(audioData, equalizerConfig = getEqualizerConfig()) {
  const sourceBands = equalizerConfig.preset === "dynamicBars" && Array.isArray(audioData?.dynamicBarBands) && audioData.dynamicBarBands.length
    ? audioData.dynamicBarBands
    : equalizerConfig.preset === "energy" && Array.isArray(audioData?.energyBands) && audioData.energyBands.length
      ? audioData.energyBands
      : Array.isArray(audioData?.bands) ? audioData.bands : null;
  if (!sourceBands?.length) return;

  document.querySelectorAll(".dynamic-runtime-object.kind-equalizer").forEach(node => {
    const layer = config.layout?.layers?.find(item => item.id === node.dataset.dynamicRuntimeLayer);
    if (layer) renderDynamicRuntimeEqualizerNode(node, layer, audioData, equalizerConfig);
  });
}

function renderDynamicRuntimeEqualizerNode(node, layer, audioData, equalizerConfig = getEqualizerConfig()) {
  const usesEnergyPreset = equalizerConfig.preset === "energy";
  const usesDynamicBarsPreset = equalizerConfig.preset === "dynamicBars";
  const sourceBands = usesDynamicBarsPreset && Array.isArray(audioData?.dynamicBarBands) && audioData.dynamicBarBands.length
    ? audioData.dynamicBarBands
    : usesEnergyPreset && Array.isArray(audioData?.energyBands) && audioData.energyBands.length
      ? audioData.energyBands
      : Array.isArray(audioData?.bands) ? audioData.bands : null;
  if (!sourceBands?.length) return;

  const props = layer?.properties || {};
  const maxHeight = clampRuntimeNumber(props.height, 12, 1200, 110);
  const sensitivity = clampRuntimeNumber(equalizerConfig.sensitivity, 0.25, 4, 1.15);
  const smoothing = clampRuntimeNumber(equalizerConfig.smoothing, 0, 0.95, 0.55);
  const renderBars = usesDynamicBarsPreset ? renderDynamicBarSet : renderEnergyBarSet;
  const state = renderBars(
    [...node.children],
    sourceBands,
    maxHeight,
    smoothing,
    sensitivity,
    dynamicEqualizerStates.get(node)
  );
  dynamicEqualizerStates.set(node, state);
}

function renderEqualizerBands(bands, maxHeight, smoothing, sensitivity) {
  if (!lastEqBands.length || lastEqBands.length !== eqBars.length) {
    lastEqBands = new Array(eqBars.length).fill(0);
  }

  for (let i = 0; i < eqBars.length; i++) {
    const bar = eqBars[i];
    const position = (i / Math.max(1, eqBars.length - 1)) * (bands.length - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(bands.length - 1, leftIndex + 1);
    const t = position - leftIndex;
    const leftValue = Number(bands[leftIndex] || 0);
    const rightValue = Number(bands[rightIndex] || 0);
    const interpolated = leftValue * (1 - t) + rightValue * t;
    const rawBand = Math.max(0, interpolated - 0.008);
    const boosted = Math.min(1, rawBand * sensitivity);

    lastEqBands[i] = lastEqBands[i] * smoothing + boosted * (1 - smoothing);

    const height = 4 + lastEqBands[i] * maxHeight;
    bar.style.height = `${Math.max(4, Math.min(maxHeight, height))}px`;
  }
}

function renderEqualizerLevel(level, maxHeight, smoothing, sensitivity) {
  const raw = Math.max(0, Number(level || 0) - 0.012);
  const boosted = Math.min(1, raw * sensitivity);
  lastEqLevel = lastEqLevel * smoothing + boosted * (1 - smoothing);

  for (const bar of eqBars) {
    const multiplier = Number(bar.dataset.multiplier || 1);
    const randomBoost = 0.88 + Math.random() * 0.24;
    const height = 4 + lastEqLevel * maxHeight * multiplier * randomBoost;
    bar.style.height = `${Math.max(4, Math.min(maxHeight, height))}px`;
  }
}

setInterval(updateAudioLevel, 50);

function createEqualizer() {
  if (!equalizerEl) return;

  const eq = getEqualizerConfig();
  equalizerEl.innerHTML = "";
  eqBars.length = 0;
  lastEqBands = [];
  lastEnergyBands = [];
  lastDynamicBarBands = [];

  const barCount = Math.max(8, Math.min(120, Number(eq.barCount || 64)));
  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement("div");
    bar.className = "eq-bar";
    bar.style.setProperty("--bar-index", i);
    bar.style.animationDelay = `${i * -0.08}s`;

    const center = Math.abs(i - barCount / 2) / (barCount / 2);
    const centerBoost = 1.35 - center * 0.65;
    bar.dataset.multiplier = (centerBoost * (0.72 + Math.random() * 0.55)).toFixed(2);

    equalizerEl.appendChild(bar);
    eqBars.push(bar);
  }
}

let configSocket = null;
let configReloadTimer = null;

function connectConfigSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}/ws`;

  configSocket = new WebSocket(url);

  configSocket.onopen = () => {
    console.log("[MusicOverlay] WebSocket connected");
  };

  configSocket.onmessage = async event => {
    let message = null;

    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === "configChanged") {
      scheduleConfigReload();
    }
  };

  configSocket.onclose = () => {
    console.log("[MusicOverlay] WebSocket disconnected, reconnecting...");
    setTimeout(connectConfigSocket, 1500);
  };

  configSocket.onerror = () => {
    try {
      configSocket.close();
    } catch {}
  };
}

function scheduleConfigReload() {
  clearTimeout(configReloadTimer);

  configReloadTimer = setTimeout(async () => {
    try {
      clearTimers();
      await loadConfig();
      applyConfig();
      createEqualizer();

      lastEqBands = [];
      lastEnergyBands = [];
      lastDynamicBarBands = [];

      if (state.hasTrack) {
        renderProgress();
        showFullThenTicker();
        startParticles();
      } else {
        hideAll();
      }

      console.log("[MusicOverlay] Config reloaded by WebSocket; timeline restarted");
    } catch (e) {
      console.error("[MusicOverlay] Config reload failed:", e);
    }
  }, 120);
}

init();

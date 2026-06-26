const fullOverlay = document.getElementById("fullOverlay");
const tickerOverlay = document.getElementById("tickerOverlay");
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
    fullEnter: "slideLeft",
    fullExit: "slideDown",
    tickerEnter: "slideUp"
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
    preset: "balanced",
    sensitivity: 1.15,
    smoothing: 0.65,
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
    config = mergeConfig(defaultConfig, loadedConfig);
  } catch (e) {
    console.error("Config load error:", e);
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
    equalizer: { ...base.equalizer, ...(incoming.equalizer || {}) }
  };
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
    const trackKey = `${title}__${artist}__${duration}`;
    const isNewTrack = trackKey !== lastTrackKey;

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

  if (state.isPlaying) {
    fullOverlay.classList.remove("paused");
    tickerOverlay.classList.remove("paused");
  } else {
    fullOverlay.classList.add("paused");
    tickerOverlay.classList.add("paused");
  }
}

function showFullThenTicker() {
  clearTimers();

  const fullEnterClass = `anim-enter-${config.animations?.fullEnter || "slideLeft"}`;
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

function renderEqualizer(audioData) {
  if (!equalizerEl) return;

  const eq = getEqualizerConfig();
  if (!eq.enabled) {
    equalizerEl.style.display = "none";
    return;
  }
  equalizerEl.style.display = "";

  const maxHeight = Number(eq.height || 86);
  const smoothing = Number(eq.smoothing || 0.65);
  const sensitivity = Number(eq.sensitivity || 1);
  const bands = Array.isArray(audioData?.bands) ? audioData.bands : null;

  if (bands && bands.length > 0) {
    renderEqualizerBands(bands, maxHeight, smoothing, sensitivity);
  } else {
    renderEqualizerLevel(audioData?.level || 0, maxHeight, smoothing, sensitivity);
  }
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

    const center = Math.abs(i - eqBars.length / 2) / (eqBars.length / 2);
    const centerShape = 1.05 - center * 0.18;
    const height = 4 + lastEqBands[i] * maxHeight * centerShape;
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
      await loadConfig();
      applyConfig();
      createEqualizer();

      lastEqBands = [];

      console.log("[MusicOverlay] Config reloaded by WebSocket");
    } catch (e) {
      console.error("[MusicOverlay] Config reload failed:", e);
    }
  }, 120);
}

init();
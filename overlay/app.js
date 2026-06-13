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

const DEFAULT_COVER = "/assets/default-cover.png";

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
  albumArt: {
    useWindowsThumbnail: false,
    defaultCover: DEFAULT_COVER
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
  applyConfig();

  setDefaultCover();

  setInterval(updateNowPlayingFromApi, 1000);
  setInterval(renderProgress, 250);

  updateNowPlayingFromApi();
}

async function loadConfig() {
  try {
    const response = await fetch(`/api/config?t=${Date.now()}`, {
      cache: "no-store"
    });

    const loadedConfig = await response.json();
    config = mergeConfig(defaultConfig, loadedConfig);
  } catch (e) {
    console.error("Config load error:", e);
    config = defaultConfig;
  }
}

function mergeConfig(base, incoming) {
  return {
    position: {
      ...base.position,
      ...(incoming.position || {})
    },
    sizes: {
      ...base.sizes,
      ...(incoming.sizes || {})
    },
    colors: {
      ...base.colors,
      ...(incoming.colors || {})
    },
    timings: {
      ...base.timings,
      ...(incoming.timings || {})
    },
    albumArt: {
      ...base.albumArt,
      ...(incoming.albumArt || {})
    }
  };
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
}

async function updateNowPlayingFromApi() {
  try {
    const response = await fetch(`/api/nowplaying?t=${Date.now()}`, {
      cache: "no-store"
    });

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

  if (waitingFreshCover && thumbnail === previousThumbnail) {
    return false;
  }

  if (thumbnail === lastThumbnail) {
    return false;
  }

  return true;
}

function syncPositionFromWindows(apiPosition) {
  if (!apiPosition || apiPosition <= 0) return;

  const current = state.position;
  const diff = apiPosition - current;

  if (apiPosition < 3 && current > 5) {
    return;
  }

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

  const progress = state.duration > 0
    ? Math.min((state.position / state.duration) * 100, 100)
    : 0;

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

  tickerOverlay.classList.add("hidden");

  fullOverlay.classList.remove("exit-down");
  fullOverlay.classList.remove("show-cover");
  fullOverlay.classList.remove("show-card");
  fullOverlay.classList.remove("hidden");

  animationTimer1 = setTimeout(() => {
    fullOverlay.classList.add("show-cover");
  }, config.timings.coverDelayMs);

  animationTimer2 = setTimeout(() => {
    fullOverlay.classList.add("show-card");
  }, config.timings.cardDelayMs);

  fullTimer = setTimeout(() => {
    fullOverlay.classList.add("exit-down");

    exitTimer = setTimeout(() => {
      fullOverlay.classList.add("hidden");
      fullOverlay.classList.remove("exit-down");
      fullOverlay.classList.remove("show-cover");
      fullOverlay.classList.remove("show-card");

      tickerOverlay.classList.remove("hidden");
    }, config.timings.exitMs);
  }, config.timings.fullVisibleMs);
}

function hideAll() {
  clearTimers();

  fullOverlay.classList.add("hidden");
  fullOverlay.classList.remove("exit-down");
  fullOverlay.classList.remove("show-cover");
  fullOverlay.classList.remove("show-card");

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
  coverEl.onerror = () => {
    setDefaultCover();
  };

  coverEl.src = src;
}

function setScrollingText(box, textEl, text, type) {
  textEl.classList.remove("scrolling");
  textEl.style.removeProperty("--scroll-distance");
  textEl.textContent = text;

  let existingTimer = null;

  if (type === "title") existingTimer = titleScrollTimer;
  if (type === "artist") existingTimer = artistScrollTimer;
  if (type === "ticker") existingTimer = tickerScrollTimer;

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

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

init();
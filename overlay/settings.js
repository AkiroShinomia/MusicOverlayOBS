const previewEqualizer = document.getElementById("previewEqualizer");
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
    defaultCover: "/assets/default-cover.png"
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
    sensitivity: 1.15,
    smoothing: 0.65,
    glow: true,
    glowPower: 18,
    colorMode: "progress",
    color: "#ffffff"
  }
};

let availableThemes = [];
let loadedThemes = {};

const statusEl = document.getElementById("status");

const previewFull = document.getElementById("previewFull");
const previewCard = document.getElementById("previewCard");
const previewTicker = document.getElementById("previewTicker");
const previewVinyl = document.querySelector(".preview-vinyl");
const previewCover = document.getElementById("previewCover");
const defaultCoverPreview = document.getElementById("defaultCoverPreview");

const previewTitle = document.getElementById("previewTitle");
const previewArtist = document.getElementById("previewArtist");
const previewTickerTitle = document.getElementById("previewTickerTitle");
const previewTickerTime = document.getElementById("previewTickerTime");
const previewTickerProgress = document.getElementById("previewTickerProgress");

const previewCards = document.querySelectorAll(".preview-card, .preview-ticker");
const previewProgressBars = document.querySelectorAll(".preview-progress-bar");
const previewProgress = document.querySelectorAll(".preview-progress");

let currentDefaultCover = defaultConfig.albumArt.defaultCover;

async function loadThemes() {
  const select = document.getElementById("themePreset");

  select.innerHTML = `<option value="Custom">Custom</option>`;

  try {
    const res = await fetch("/api/themes?t=" + Date.now(), {
      cache: "no-store"
    });

    availableThemes = await res.json();

    for (const theme of availableThemes) {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name || theme.id;
      select.appendChild(option);
    }
  } catch (e) {
    console.error("Themes load error:", e);
  }
}

async function getThemePreset(id) {
  if (!id || id === "Custom") return null;

  if (loadedThemes[id]) {
    return loadedThemes[id];
  }

  const meta = availableThemes.find(x => x.id === id);

  if (!meta) return null;

  const res = await fetch(meta.path + "?t=" + Date.now(), {
    cache: "no-store"
  });

  const theme = await res.json();
  loadedThemes[id] = theme;

  return theme;
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config?t=" + Date.now(), {
      cache: "no-store"
    });

    const loaded = await res.json();
    const config = mergeConfig(defaultConfig, loaded);

    fillForm(config);
    updatePreview(config);
  } catch (e) {
    console.error(e);
    fillForm(defaultConfig);
    updatePreview(defaultConfig);
    statusEl.textContent = "Не удалось прочитать config.json, поставлены дефолтные значения.";
  }
}

function fillForm(config) {
  set("themePreset", config.theme.preset || "Custom");

  set("left", config.position.left);
  set("fullBottom", config.position.fullBottom);
  set("tickerBottom", config.position.tickerBottom);

  set("fullCardWidth", config.sizes.fullCardWidth);
  set("tickerWidth", config.sizes.tickerWidth);
  set("tickerHeight", config.sizes.tickerHeight);
  set("coverSize", config.sizes.coverSize);
  set("vinylSize", config.sizes.vinylSize);

  const bg = parseRgba(config.colors.background);
  const progressBg = parseRgba(config.colors.progressBackground);

  set("backgroundColor", bg.hex);
  set("backgroundOpacity", Math.round(bg.alpha * 100));

  set("text", normalizeHex(config.colors.text));
  set("progress", normalizeHex(config.colors.progress));

  set("progressBackgroundColor", progressBg.hex);
  set("progressBackgroundOpacity", Math.round(progressBg.alpha * 100));

  set("fontFamily", config.font.family || "Arial");
  set("titleSize", config.font.titleSize);
  set("artistSize", config.font.artistSize);
  set("tickerSize", config.font.tickerSize);

  set("tickerStyle", config.ticker.style || "pill");

  set("fullVisibleMs", config.timings.fullVisibleMs);
  set("coverDelayMs", config.timings.coverDelayMs);
  set("cardDelayMs", config.timings.cardDelayMs);
  set("exitMs", config.timings.exitMs);
  set("marqueeDelayMs", config.timings.marqueeDelayMs);
  set("marqueeSpeedSec", config.timings.marqueeSpeedSec);
  set("fullCardStyle", config.fullCard.style || "glass");
  set("vinylStyle", config.vinyl?.style || "classic");

  document.getElementById("particlesEnabled").checked =
  Boolean(config.particles?.enabled);

  set("particlesStyle", config.particles?.style || "notes");
  set("particlesColor", config.particles?.color || "#ffffff");
  set("particlesCount", config.particles?.count || 2);
  set("particlesSize", config.particles?.size || 18);
  set("particlesDurationMs", config.particles?.durationMs || 2200);

  document.getElementById("equalizerEnabled").checked =
  Boolean(config.equalizer?.enabled);

  set("equalizerStyle", config.equalizer?.style || "solid");
  set("equalizerColorMode", config.equalizer?.colorMode || "progress");
  set("equalizerColor", config.equalizer?.color || "#ffffff");

  set("equalizerBarCount", config.equalizer?.barCount || 64);
  set("equalizerBarWidth", config.equalizer?.barWidth || 5);
  set("equalizerGap", config.equalizer?.gap || 3);
  set("equalizerHeight", config.equalizer?.height || 86);
  set("equalizerOffsetY", config.equalizer?.offsetY ?? 0);
  set("equalizerSidePadding", config.equalizer?.sidePadding || 14);
  set("equalizerSensitivity", Math.round((config.equalizer?.sensitivity || 1.15) * 100));
  set("equalizerSmoothing", Math.round((config.equalizer?.smoothing || 0.65) * 100));

  document.getElementById("equalizerGlow").checked =
    Boolean(config.equalizer?.glow);

  set("equalizerGlowPower", config.equalizer?.glowPower || 18);

  set(
    "fullEnterAnimation",
    config.animations?.fullEnter || "slideLeft"
  );

  set(
    "fullExitAnimation",
    config.animations?.fullExit || "slideDown"
  );

  set(
    "tickerEnterAnimation",
    config.animations?.tickerEnter || "slideUp"
  );

  document.getElementById("useWindowsThumbnail").checked = Boolean(config.albumArt.useWindowsThumbnail);

  currentDefaultCover = config.albumArt.defaultCover || defaultConfig.albumArt.defaultCover;
  defaultCoverPreview.src = currentDefaultCover;
  previewCover.src = currentDefaultCover;
}

function readForm() {
  return {
    position: {
      left: num("left"),
      fullBottom: num("fullBottom"),
      tickerBottom: num("tickerBottom")
    },
    sizes: {
      fullCardWidth: num("fullCardWidth"),
      tickerWidth: num("tickerWidth"),
      tickerHeight: num("tickerHeight"),
      coverSize: num("coverSize"),
      vinylSize: num("vinylSize")
    },
    colors: {
      background: rgbaFromInputs("backgroundColor", "backgroundOpacity"),
      text: val("text"),
      progress: val("progress"),
      progressBackground: rgbaFromInputs("progressBackgroundColor", "progressBackgroundOpacity")
    },
    timings: {
      fullVisibleMs: num("fullVisibleMs"),
      coverDelayMs: num("coverDelayMs"),
      cardDelayMs: num("cardDelayMs"),
      exitMs: num("exitMs"),
      marqueeDelayMs: num("marqueeDelayMs"),
      marqueeSpeedSec: num("marqueeSpeedSec")
    },
    animations: {
      fullEnter: val("fullEnterAnimation"),
      fullExit: val("fullExitAnimation"),
      tickerEnter: val("tickerEnterAnimation")
    },
    albumArt: {
      useWindowsThumbnail: document.getElementById("useWindowsThumbnail").checked,
      defaultCover: currentDefaultCover
    },
    theme: {
      preset: val("themePreset")
    },
    font: {
      family: val("fontFamily"),
      titleSize: num("titleSize"),
      artistSize: num("artistSize"),
      tickerSize: num("tickerSize")
    },
    ticker: {
      style: val("tickerStyle")
    },
    fullCard: {
      style: val("fullCardStyle")
    },
    vinyl: {
      style: val("vinylStyle")
    },
    particles: {
    enabled: document.getElementById("particlesEnabled").checked,
    style: val("particlesStyle"),
    count: num("particlesCount"),
    size: num("particlesSize"),
    durationMs: num("particlesDurationMs"),
    color: val("particlesColor")
  },
  equalizer: {
    enabled: document.getElementById("equalizerEnabled").checked,
    style: val("equalizerStyle"),
    barCount: num("equalizerBarCount"),
    barWidth: num("equalizerBarWidth"),
    gap: num("equalizerGap"),
    height: num("equalizerHeight"),
    offsetY: num("equalizerOffsetY"),
    sidePadding: num("equalizerSidePadding"),
    sensitivity: num("equalizerSensitivity") / 100,
    smoothing: num("equalizerSmoothing") / 100,
    glow: document.getElementById("equalizerGlow").checked,
    glowPower: num("equalizerGlowPower"),
    colorMode: val("equalizerColorMode"),
    color: val("equalizerColor")
  }
  };
}

function updatePreview(config) {
  const scale = 1;

  document.documentElement.style.setProperty("--preview-cover-size", `${config.sizes.coverSize}px`);
  document.documentElement.style.setProperty("--preview-vinyl-size", `${config.sizes.vinylSize}px`);

  previewFull.style.left = `${config.position.left * scale}px`;
  previewFull.style.bottom = `${config.position.fullBottom * scale + 160}px`;

  previewTicker.style.left = `${config.position.left * scale}px`;
  previewTicker.style.bottom = `${config.position.tickerBottom * scale}px`;

  previewCard.style.width = `${config.sizes.fullCardWidth * scale}px`;

  previewTicker.style.width = `${config.sizes.tickerWidth * scale}px`;
  previewTicker.style.height = `${config.sizes.tickerHeight}px`;

  previewCover.style.width = `${config.sizes.coverSize * scale}px`;
  previewCover.style.height = `${config.sizes.coverSize * scale}px`;
  previewCover.src = config.albumArt.defaultCover || defaultConfig.albumArt.defaultCover;

  previewVinyl.style.width = `${config.sizes.vinylSize}px`;
  previewVinyl.style.height = `${config.sizes.vinylSize}px`;
  previewVinyl.style.left = `${config.sizes.coverSize * 0.2}px`;

  previewCards.forEach(el => {
    el.style.background = config.colors.background;
    el.style.color = config.colors.text;
    el.style.fontFamily = `"${config.font.family}", Arial, sans-serif`;
  });

  previewTitle.style.fontSize = `${config.font.titleSize}px`;
  previewArtist.style.fontSize = `${config.font.artistSize}px`;
  previewTickerTitle.style.fontSize = `${config.font.tickerSize}px`;

  previewProgressBars.forEach(el => {
    el.style.background = config.colors.progress;
  });

  previewProgress.forEach(el => {
    el.style.background = config.colors.progressBackground;
  });

  defaultCoverPreview.src = config.albumArt.defaultCover || defaultConfig.albumArt.defaultCover;

  applyPreviewTickerStyle(config.ticker.style);
  applyPreviewCardStyle(config.fullCard.style);
  applyPreviewVinylStyle(config.vinyl?.style || "classic");

  createPreviewEqualizer(config);
  updatePreviewEqualizer(config);
}

function applyPreviewTickerStyle(style) {
  const classes = [
    "preview-ticker-style-pill",
    "preview-ticker-style-glass",
    "preview-ticker-style-thin",
    "preview-ticker-style-compact",
    "preview-ticker-style-textonly"
  ];

  previewTicker.classList.remove(...classes);
  previewTicker.classList.add(`preview-ticker-style-${style}`);

  previewTickerTime.style.display = "";
  previewTickerProgress.style.display = "";

  if (style === "thin") {
    previewTickerTime.style.display = "none";
  }

  if (style === "compact") {
    previewTickerProgress.style.display = "none";
  }

  if (style === "textonly") {
    previewTickerTime.style.display = "none";
    previewTickerProgress.style.display = "none";
  }
}

async function applyThemePreset() {
  const presetName = val("themePreset");
  const preset = await getThemePreset(presetName);

  if (!preset) {
    const config = readForm();
    config.theme.preset = "Custom";
    fillForm(config);
    updatePreview(config);
    return;
  }

  const current = readForm();

  const next = mergeConfig(current, {
    theme: {
      preset: presetName
    },
    colors: preset.colors,
    font: preset.font,
    ticker: preset.ticker,
    fullCard: preset.fullCard,
    vinyl: preset.vinyl,
    particles: preset.particles,
    equalizer: preset.equalizer
  });

  fillForm(next);
  updatePreview(next);
}

async function saveConfig(config) {
  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(config)
    });

    const result = await res.json();

    if (result.ok) {
      statusEl.textContent = "Сохранено. Обнови OBS Browser Source или Ctrl+F5 на оверлее.";
    } else {
      statusEl.textContent = "Ошибка сохранения.";
    }
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Ошибка сохранения.";
  }
}

function setupDragNumbers() {
  document.querySelectorAll(".drag-label").forEach(label => {
    let startX = 0;
    let startValue = 0;
    let input = null;

    label.addEventListener("pointerdown", e => {
      input = document.getElementById(label.dataset.target);
      if (!input) return;

      startX = e.clientX;
      startValue = Number(input.value || 0);

      label.setPointerCapture(e.pointerId);
      document.body.style.cursor = "ew-resize";
    });

    label.addEventListener("pointermove", e => {
      if (!input) return;

      const diff = e.clientX - startX;
      const step = e.shiftKey ? 10 : 1;

      input.value = Math.round(startValue + diff * step);

      const config = readForm();
      config.theme.preset = "Custom";
      set("themePreset", "Custom");

      updatePreview(config);
    });

    label.addEventListener("pointerup", e => {
      input = null;
      document.body.style.cursor = "";

      try {
        label.releasePointerCapture(e.pointerId);
      } catch {}
    });
  });
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

function parseRgba(value) {
  if (!value) return { hex: "#000000", alpha: 1 };

  if (value.startsWith("#")) {
    return { hex: normalizeHex(value), alpha: 1 };
  }

  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);

  if (!match) return { hex: "#000000", alpha: 1 };

  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const a = match[4] !== undefined ? Number(match[4]) : 1;

  return {
    hex: rgbToHex(r, g, b),
    alpha: a
  };
}

function rgbaFromInputs(colorId, opacityId) {
  const hex = val(colorId);
  const opacity = Math.max(0, Math.min(100, num(opacityId))) / 100;
  const { r, g, b } = hexToRgb(hex);

  return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`;
}

function normalizeHex(value) {
  if (!value || !value.startsWith("#")) return "#ffffff";
  return value.length === 7 ? value : "#ffffff";
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");

  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

function fileToBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function createPreviewEqualizer(config) {
  if (!previewEqualizer) return;

  previewEqualizer.innerHTML = "";

  const eq = config?.equalizer || defaultConfig.equalizer;
  const count = Math.max(8, Math.min(120, Number(eq.barCount || 64)));

  for (let i = 0; i < count; i++) {
    const bar = document.createElement("div");

    bar.className = "preview-eq-bar";

    bar.style.animationDelay = `${i * -0.08}s`;

    const center = Math.abs(i - count / 2) / (count / 2);
    const centerBoost = 1.35 - center * 0.65;

    bar.style.height = `${8 + Math.random() * 40 * centerBoost}px`;

    previewEqualizer.appendChild(bar);
  }
}

function updatePreviewEqualizer(config) {
  if (!previewEqualizer) return;

  const eq = config.equalizer || defaultConfig.equalizer;

  previewEqualizer.style.display = eq.enabled ? "" : "none";

  previewEqualizer.style.left = `${eq.sidePadding ?? 14}px`;
  previewEqualizer.style.right = `${eq.sidePadding ?? 14}px`;
  previewEqualizer.style.bottom = `calc(100% + ${eq.offsetY ?? 0}px)`;
  previewEqualizer.style.height = `${eq.height ?? 86}px`;
  previewEqualizer.style.gap = `${eq.gap ?? 3}px`;

  const color =
    eq.colorMode === "custom"
      ? eq.color
      : config.colors.progress;

  previewEqualizer.style.setProperty("--preview-eq-color", color);

  previewEqualizer.className =
    `preview-equalizer preview-equalizer-style-${eq.style || "solid"}`;

  if (eq.glow) {
    previewEqualizer.classList.add("preview-eq-glow");
  }

  const bars = previewEqualizer.querySelectorAll(".preview-eq-bar");

  bars.forEach(bar => {
    bar.style.width = `${eq.barWidth ?? 5}px`;
  });
}

function set(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function val(id) {
  return document.getElementById(id).value;
}

function num(id) {
  return Number(document.getElementById(id).value);
}

function applyPreviewCardStyle(style) {
  const classes = [
    "preview-card-style-glass",
    "preview-card-style-solid",
    "preview-card-style-minimal",
    "preview-card-style-neon",
    "preview-card-style-spotify"
  ];

  previewCard.classList.remove(...classes);
  previewCard.classList.add(
    `preview-card-style-${style}`
  );
}

function applyPreviewVinylStyle(style) {
  const classes = [
    "preview-vinyl-style-classic",
    "preview-vinyl-style-black",
    "preview-vinyl-style-white",
    "preview-vinyl-style-gold",
    "preview-vinyl-style-transparent",
    "preview-vinyl-style-cd"
  ];

  previewVinyl.classList.remove(...classes);
  previewVinyl.classList.add(`preview-vinyl-style-${style}`);
}

document.querySelectorAll("input, select").forEach(input => {
  input.addEventListener("input", () => {
    const config = readForm();
    config.theme.preset = "Custom";

    if (input.id !== "themePreset") {
      set("themePreset", "Custom");
    }

    updatePreview(config);
  });
});

document.getElementById("applyThemeBtn").addEventListener("click", async () => {
  await applyThemePreset();
});

document.getElementById("themePreset").addEventListener("change", async () => {
  await applyThemePreset();
});

document.getElementById("defaultCoverFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  currentDefaultCover = await fileToBase64(file);

  const config = readForm();
  config.albumArt.defaultCover = currentDefaultCover;
  config.theme.preset = "Custom";

  fillForm(config);
  updatePreview(config);
  await saveConfig(config);
});

document.getElementById("saveBtn").addEventListener("click", () => {
  saveConfig(readForm());
});

document.getElementById("resetBtn").addEventListener("click", () => {
  currentDefaultCover = defaultConfig.albumArt.defaultCover;
  fillForm(defaultConfig);
  updatePreview(defaultConfig);
  saveConfig(defaultConfig);
});

function playPreviewAnimation() {
  const config = readForm();

  updatePreview(config);

  previewFull.classList.remove(
    "preview-anim-running",
    "preview-anim-start",
    "preview-anim-show-cover",
    "preview-anim-show-card",
    "preview-anim-exit"
  );

  previewTicker.classList.remove(
    "preview-anim-hidden",
    "preview-anim-show"
  );

  void previewFull.offsetWidth;

  previewTicker.classList.add("preview-anim-hidden");

  previewFull.classList.add("preview-anim-running");
  previewFull.classList.add("preview-anim-start");

  setTimeout(() => {
    previewFull.classList.remove("preview-anim-start");
  }, 50);

  setTimeout(() => {
    previewFull.classList.add("preview-anim-show-cover");
  }, config.timings.coverDelayMs);

  setTimeout(() => {
    previewFull.classList.add("preview-anim-show-card");
  }, config.timings.cardDelayMs);

  setTimeout(() => {
    previewFull.classList.add("preview-anim-exit");

    setTimeout(() => {
      previewFull.classList.remove(
        "preview-anim-running",
        "preview-anim-show-cover",
        "preview-anim-show-card",
        "preview-anim-exit"
      );

      previewTicker.classList.remove("preview-anim-hidden");
      previewTicker.classList.add("preview-anim-show");
    }, config.timings.exitMs);
  }, config.timings.fullVisibleMs);
}

document.getElementById("playPreviewAnimationBtn").addEventListener("click", () => {
  playPreviewAnimation();
});

setInterval(() => {
  if (!previewEqualizer) return;

  const bars = previewEqualizer.querySelectorAll(".preview-eq-bar");

  bars.forEach((bar, index) => {
    const center = Math.abs(index - bars.length / 2) / (bars.length / 2);
    const centerBoost = 1.35 - center * 0.65;

    const height =
      4 + Math.random() * 46 * centerBoost;

    bar.style.height = `${height}px`;
  });
}, 140);

setupDragNumbers();
(async () => {
  await loadThemes();
  await loadConfig();
})();
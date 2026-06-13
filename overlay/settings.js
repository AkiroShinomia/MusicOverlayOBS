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
  }
};

const themePresets = {
  Custom: null,

  DarkGlass: {
    colors: {
      background: "rgba(10, 10, 14, 0.80)",
      text: "#ffffff",
      progress: "#ffffff",
      progressBackground: "rgba(255, 255, 255, 0.18)"
    },
    font: {
      family: "Arial",
      titleSize: 25,
      artistSize: 16,
      tickerSize: 14
    },
    ticker: {
      style: "pill"
    }
  },

  AnimePink: {
    colors: {
      background: "rgba(45, 12, 38, 0.82)",
      text: "#ffe6f5",
      progress: "#ff7ad9",
      progressBackground: "rgba(255, 122, 217, 0.22)"
    },
    font: {
      family: "Trebuchet MS",
      titleSize: 25,
      artistSize: 16,
      tickerSize: 14
    },
    ticker: {
      style: "glass"
    }
  },

  Cyberpunk: {
    colors: {
      background: "rgba(4, 16, 18, 0.86)",
      text: "#d8fff8",
      progress: "#00ffe1",
      progressBackground: "rgba(0, 255, 225, 0.20)"
    },
    font: {
      family: "Consolas",
      titleSize: 24,
      artistSize: 15,
      tickerSize: 14
    },
    ticker: {
      style: "thin"
    }
  },

  MinimalWhite: {
    colors: {
      background: "rgba(255, 255, 255, 0.82)",
      text: "#111111",
      progress: "#111111",
      progressBackground: "rgba(0, 0, 0, 0.16)"
    },
    font: {
      family: "Segoe UI",
      titleSize: 24,
      artistSize: 15,
      tickerSize: 14
    },
    ticker: {
      style: "compact"
    }
  }
};

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

function applyThemePreset() {
  const presetName = val("themePreset");
  const preset = themePresets[presetName];

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
    ticker: preset.ticker
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
    fullCard: { ...base.fullCard, ...(incoming.fullCard || {}) }
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

document.getElementById("applyThemeBtn").addEventListener("click", () => {
  applyThemePreset();
});

document.getElementById("themePreset").addEventListener("change", () => {
  applyThemePreset();
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

setupDragNumbers();
loadConfig();
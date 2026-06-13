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
    defaultCover: "/assets/default-cover.png"
  }
};

const statusEl = document.getElementById("status");

const previewFull = document.getElementById("previewFull");
const previewCard = document.getElementById("previewCard");
const previewTicker = document.getElementById("previewTicker");
const previewVinyl = document.querySelector(".preview-vinyl");
const previewCover = document.getElementById("previewCover");
const defaultCoverPreview = document.getElementById("defaultCoverPreview");

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

  set("fullVisibleMs", config.timings.fullVisibleMs);
  set("coverDelayMs", config.timings.coverDelayMs);
  set("cardDelayMs", config.timings.cardDelayMs);
  set("exitMs", config.timings.exitMs);
  set("marqueeDelayMs", config.timings.marqueeDelayMs);
  set("marqueeSpeedSec", config.timings.marqueeSpeedSec);

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
    albumArt: {
      useWindowsThumbnail: document.getElementById("useWindowsThumbnail").checked,
      defaultCover: currentDefaultCover
    }
  };
}

function updatePreview(config) {
  const scale = 0.75;

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

  previewVinyl.style.width = `${config.sizes.vinylSize * scale}px`;
  previewVinyl.style.height = `${config.sizes.vinylSize * scale}px`;
  previewVinyl.style.left = `${(config.sizes.coverSize * scale) * 0.2}px`;
  previewVinyl.style.top = `${-(config.sizes.vinylSize * scale - config.sizes.coverSize * scale) / 2}px`;

  previewCards.forEach(el => {
    el.style.background = config.colors.background;
    el.style.color = config.colors.text;
  });

  previewProgressBars.forEach(el => {
    el.style.background = config.colors.progress;
  });

  previewProgress.forEach(el => {
    el.style.background = config.colors.progressBackground;
  });

  defaultCoverPreview.src = config.albumArt.defaultCover || defaultConfig.albumArt.defaultCover;
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
      updatePreview(readForm());
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
    albumArt: { ...base.albumArt, ...(incoming.albumArt || {}) }
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

document.querySelectorAll("input").forEach(input => {
  input.addEventListener("input", () => {
    updatePreview(readForm());
  });
});

document.getElementById("defaultCoverFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  currentDefaultCover = await fileToBase64(file);

  const config = readForm();
  config.albumArt.defaultCover = currentDefaultCover;

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

setupDragNumbers();
loadConfig();
const previewEqualizer = document.getElementById("previewEqualizer");

const defaultConfig = {
  position: { left: 70, fullBottom: 80, tickerBottom: 44 },
  sizes: { fullCardWidth: 430, tickerWidth: 500, tickerHeight: 42, coverSize: 92, vinylSize: 108 },
  colors: { background: "rgba(10, 10, 14, 0.80)", text: "#ffffff", progress: "#ffffff", progressBackground: "rgba(255, 255, 255, 0.18)" },
  timings: { fullVisibleMs: 10000, coverDelayMs: 500, cardDelayMs: 850, exitMs: 600, marqueeDelayMs: 2000, marqueeSpeedSec: 10 },
  animations: { fullEnter: "slideLeft", fullExit: "slideDown", tickerEnter: "slideUp" },
  albumArt: { useWindowsThumbnail: false, defaultCover: "/assets/default-cover.png" },
  theme: { preset: "Custom" },
  font: { family: "Arial", titleSize: 25, artistSize: 16, tickerSize: 14 },
  ticker: { style: "pill" },
  fullCard: { style: "glass" },
  vinyl: { style: "classic" },
  particles: { enabled: true, style: "notes", count: 20, size: 18, durationMs: 2200, color: "#ffffff" },
  equalizer: {
    enabled: true, style: "solid", barCount: 64, barWidth: 5, gap: 3, height: 86, offsetY: 0, sidePadding: 14,
    preset: "balanced", sensitivity: 1.15, smoothing: 0.65, autoGain: true, outputGain: 1.0, spectralContrast: 1.0, visualCurvePower: 1.0,
    glow: true, glowPower: 18, colorMode: "progress", color: "#ffffff"
  },
  audio: { sourceMode: "auto" }
};

const FFT_PRESETS = {
  balanced: { sensitivity: 1.15, smoothing: 0.65, autoGain: true, outputGain: 1.0, spectralContrast: 1.0, visualCurvePower: 1.0 },
  smooth: { sensitivity: 1.05, smoothing: 0.82, autoGain: true, outputGain: 0.95, spectralContrast: 0.85, visualCurvePower: 1.15 },
  punchy: { sensitivity: 1.35, smoothing: 0.48, autoGain: true, outputGain: 1.15, spectralContrast: 1.45, visualCurvePower: 0.9 },
  vocal: { sensitivity: 1.2, smoothing: 0.62, autoGain: true, outputGain: 1.05, spectralContrast: 1.25, visualCurvePower: 1.05 },
  bass: { sensitivity: 1.3, smoothing: 0.58, autoGain: true, outputGain: 1.2, spectralContrast: 1.15, visualCurvePower: 0.95 },
  orchestra: { sensitivity: 1.1, smoothing: 0.74, autoGain: true, outputGain: 1.0, spectralContrast: 1.35, visualCurvePower: 1.2 }
};

const manualFftFields = new Set([
  "equalizerAutoGain", "equalizerSensitivity", "equalizerSmoothing",
  "equalizerOutputGain", "equalizerSpectralContrast", "equalizerVisualCurvePower"
]);

let availableThemes = [];
let loadedThemes = {};
let currentDefaultCover = defaultConfig.albumArt.defaultCover;
let activeThemeId = null;
let activeThemeType = null;
let themeDirty = false;

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

function $(id) { return document.getElementById(id); }
function val(id) { return $(id).value; }
function num(id) { return Number(val(id)); }
function set(id, value) { const el = $(id); if (el) el.value = value; }

// --- Helpers ---
function mergeConfig(base, incoming) {
  return {
    position: { ...base.position, ...incoming.position },
    sizes: { ...base.sizes, ...incoming.sizes },
    colors: { ...base.colors, ...incoming.colors },
    timings: { ...base.timings, ...incoming.timings },
    animations: { ...base.animations, ...incoming.animations },
    albumArt: { ...base.albumArt, ...incoming.albumArt },
    theme: { ...base.theme, ...incoming.theme },
    font: { ...base.font, ...incoming.font },
    ticker: { ...base.ticker, ...incoming.ticker },
    fullCard: { ...base.fullCard, ...incoming.fullCard },
    vinyl: { ...base.vinyl, ...incoming.vinyl },
    particles: { ...base.particles, ...incoming.particles },
    equalizer: { ...base.equalizer, ...incoming.equalizer },
    audio: { ...base.audio, ...incoming.audio }
  };
}

function parseRgba(value) {
  if (!value) return { hex: "#000000", alpha: 1 };
  if (value.startsWith("#")) return { hex: normalizeHex(value), alpha: 1 };
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return { hex: "#000000", alpha: 1 };
  return {
    hex: rgbToHex(+match[1], +match[2], +match[3]),
    alpha: match[4] !== undefined ? +match[4] : 1
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
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

function fileToBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// --- Form mapping ---
const fieldMappings = [
  // position
  { id: "left", path: "position.left" },
  { id: "fullBottom", path: "position.fullBottom" },
  { id: "tickerBottom", path: "position.tickerBottom" },
  // sizes
  { id: "fullCardWidth", path: "sizes.fullCardWidth" },
  { id: "tickerWidth", path: "sizes.tickerWidth" },
  { id: "tickerHeight", path: "sizes.tickerHeight" },
  { id: "coverSize", path: "sizes.coverSize" },
  { id: "vinylSize", path: "sizes.vinylSize" },
  // font
  { id: "fontFamily", path: "font.family" },
  { id: "titleSize", path: "font.titleSize" },
  { id: "artistSize", path: "font.artistSize" },
  { id: "tickerSize", path: "font.tickerSize" },
  // timings
  { id: "fullVisibleMs", path: "timings.fullVisibleMs" },
  { id: "coverDelayMs", path: "timings.coverDelayMs" },
  { id: "cardDelayMs", path: "timings.cardDelayMs" },
  { id: "exitMs", path: "timings.exitMs" },
  { id: "marqueeDelayMs", path: "timings.marqueeDelayMs" },
  { id: "marqueeSpeedSec", path: "timings.marqueeSpeedSec" },
  // animations
  { id: "fullEnterAnimation", path: "animations.fullEnter" },
  { id: "fullExitAnimation", path: "animations.fullExit" },
  { id: "tickerEnterAnimation", path: "animations.tickerEnter" },
  // styles
  { id: "tickerStyle", path: "ticker.style" },
  { id: "fullCardStyle", path: "fullCard.style" },
  { id: "vinylStyle", path: "vinyl.style" },
  // particles
  { id: "particlesStyle", path: "particles.style" },
  { id: "particlesColor", path: "particles.color" },
  { id: "particlesCount", path: "particles.count" },
  { id: "particlesSize", path: "particles.size" },
  { id: "particlesDurationMs", path: "particles.durationMs" },
  // equalizer
  { id: "equalizerStyle", path: "equalizer.style" },
  { id: "equalizerColorMode", path: "equalizer.colorMode" },
  { id: "equalizerColor", path: "equalizer.color" },
  { id: "equalizerBarCount", path: "equalizer.barCount" },
  { id: "equalizerBarWidth", path: "equalizer.barWidth" },
  { id: "equalizerGap", path: "equalizer.gap" },
  { id: "equalizerHeight", path: "equalizer.height" },
  { id: "equalizerOffsetY", path: "equalizer.offsetY" },
  { id: "equalizerSidePadding", path: "equalizer.sidePadding" },
  { id: "equalizerGlowPower", path: "equalizer.glowPower" },
  // audio
  { id: "audioSourceMode", path: "audio.sourceMode" },
];

const booleanFields = [
  { id: "particlesEnabled", path: "particles.enabled" },
  { id: "equalizerEnabled", path: "equalizer.enabled" },
  { id: "equalizerGlow", path: "equalizer.glow" },
  { id: "equalizerAutoGain", path: "equalizer.autoGain" },
  { id: "useWindowsThumbnail", path: "albumArt.useWindowsThumbnail" }
];

function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function fillForm(config) {
  set("themePreset", config.theme.preset || "Custom");

  fieldMappings.forEach(({ id, path }) => {
    const value = path.split('.').reduce((o, k) => o?.[k], config);
    set(id, value);
  });

  booleanFields.forEach(({ id, path }) => {
    const value = path.split('.').reduce((o, k) => o?.[k], config);
    const el = $(id);
    if (!el) return;

    el.checked =
      value === true ||
      value === "true" ||
      value === 1 ||
      value === "1";
  });

  // colors special handling
  const bg = parseRgba(config.colors.background);
  set("backgroundColor", bg.hex);
  set("backgroundOpacity", Math.round(bg.alpha * 100));

  const progressBg = parseRgba(config.colors.progressBackground);
  set("progressBackgroundColor", progressBg.hex);
  set("progressBackgroundOpacity", Math.round(progressBg.alpha * 100));

  set("text", normalizeHex(config.colors.text));
  set("progress", normalizeHex(config.colors.progress));

  // FFT derived values
  set("fftPreset", config.equalizer?.preset || "balanced");
  set("equalizerSensitivity", Math.round((config.equalizer?.sensitivity || 1.15) * 100));
  set("equalizerSmoothing", Math.round((config.equalizer?.smoothing || 0.65) * 100));
  set("equalizerOutputGain", Math.round((config.equalizer?.outputGain || 1.0) * 100));
  set("equalizerSpectralContrast", Math.round((config.equalizer?.spectralContrast || 1.0) * 100));
  set("equalizerVisualCurvePower", Math.round((config.equalizer?.visualCurvePower || 1.0) * 100));

  currentDefaultCover = config.albumArt.defaultCover || defaultConfig.albumArt.defaultCover;
  defaultCoverPreview.src = currentDefaultCover;
  previewCover.src = currentDefaultCover;
}

function readForm() {
  const config = structuredClone(defaultConfig);

  setNestedValue(config, "theme.preset", val("themePreset") || "Custom");

  fieldMappings.forEach(({ id, path }) => {
    const el = $(id);
    if (!el) return;

    const value = el.type === "number"
      ? Number(el.value)
      : el.value;

    setNestedValue(config, path, value);
  });

  booleanFields.forEach(({ id, path }) => {
    const el = $(id);
    if (!el) return;

    setNestedValue(config, path, el.checked);
  });

  // colors
  config.colors.background = rgbaFromInputs("backgroundColor", "backgroundOpacity");
  config.colors.text = val("text");
  config.colors.progress = val("progress");
  config.colors.progressBackground = rgbaFromInputs("progressBackgroundColor", "progressBackgroundOpacity");

  // FFT
  config.equalizer.preset = val("fftPreset");
  config.equalizer.sensitivity = num("equalizerSensitivity") / 100;
  config.equalizer.smoothing = num("equalizerSmoothing") / 100;
  config.equalizer.outputGain = num("equalizerOutputGain") / 100;
  config.equalizer.spectralContrast = num("equalizerSpectralContrast") / 100;
  config.equalizer.visualCurvePower = num("equalizerVisualCurvePower") / 100;
  config.equalizer.autoGain = document.getElementById("equalizerAutoGain").checked;

  config.albumArt.defaultCover = currentDefaultCover;
  return config;
}

// --- Preview updates ---
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

  previewProgressBars.forEach(el => el.style.background = config.colors.progress);
  previewProgress.forEach(el => el.style.background = config.colors.progressBackground);

  defaultCoverPreview.src = config.albumArt.defaultCover || defaultConfig.albumArt.defaultCover;

  applyPreviewTickerStyle(config.ticker.style);
  applyPreviewCardStyle(config.fullCard.style);
  applyPreviewVinylStyle(config.vinyl?.style || "classic");

  createPreviewEqualizer(config);
  updatePreviewEqualizer(config);
}

function applyPreviewTickerStyle(style) {
  const classes = ["preview-ticker-style-pill", "preview-ticker-style-glass", "preview-ticker-style-thin", "preview-ticker-style-compact", "preview-ticker-style-textonly"];
  previewTicker.classList.remove(...classes);
  previewTicker.classList.add(`preview-ticker-style-${style}`);

  previewTickerTime.style.display = style === "thin" || style === "textonly" ? "none" : "";
  previewTickerProgress.style.display = (style === "compact" || style === "textonly") ? "none" : "";
}

function applyPreviewCardStyle(style) {
  const classes = ["preview-card-style-glass", "preview-card-style-solid", "preview-card-style-minimal", "preview-card-style-neon", "preview-card-style-spotify"];
  previewCard.classList.remove(...classes);
  previewCard.classList.add(`preview-card-style-${style}`);
}

function applyPreviewVinylStyle(style) {
  const classes = ["preview-vinyl-style-classic", "preview-vinyl-style-black", "preview-vinyl-style-white", "preview-vinyl-style-gold", "preview-vinyl-style-transparent", "preview-vinyl-style-cd","preview-vinyl-style-bloodMoon"];
  previewVinyl.classList.remove(...classes);
  previewVinyl.classList.add(`preview-vinyl-style-${style}`);
}

// --- Equalizer preview ---
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

  const color = eq.colorMode === "custom" ? eq.color : config.colors.progress;
  previewEqualizer.style.setProperty("--preview-eq-color", color);

  previewEqualizer.className = `preview-equalizer preview-equalizer-style-${eq.style || "solid"}`;
  previewEqualizer.classList.toggle("preview-eq-glow", Boolean(eq.glow));

  const bars = previewEqualizer.querySelectorAll(".preview-eq-bar");
  bars.forEach(bar => bar.style.width = `${eq.barWidth ?? 5}px`);
}

// --- Animation preview ---
function playPreviewAnimation() {
  const config = readForm();
  updatePreview(config);

  previewFull.classList.remove("preview-anim-running", "preview-anim-start", "preview-anim-show-cover", "preview-anim-show-card", "preview-anim-exit");
  previewTicker.classList.remove("preview-anim-hidden", "preview-anim-show");

  void previewFull.offsetWidth; // reflow

  previewTicker.classList.add("preview-anim-hidden");
  previewFull.classList.add("preview-anim-running", "preview-anim-start");
  setTimeout(() => previewFull.classList.remove("preview-anim-start"), 50);

  setTimeout(() => previewFull.classList.add("preview-anim-show-cover"), config.timings.coverDelayMs);
  setTimeout(() => previewFull.classList.add("preview-anim-show-card"), config.timings.cardDelayMs);

  setTimeout(() => {
    previewFull.classList.add("preview-anim-exit");
    setTimeout(() => {
      previewFull.classList.remove("preview-anim-running", "preview-anim-show-cover", "preview-anim-show-card", "preview-anim-exit");
      previewTicker.classList.remove("preview-anim-hidden");
      previewTicker.classList.add("preview-anim-show");
    }, config.timings.exitMs);
  }, config.timings.fullVisibleMs);
}

// --- Theme management ---
async function loadThemes() {
  const select = $("themePreset");
  select.innerHTML = `<option value="Custom">Custom</option>`;

  try {
    const res = await fetch(`/api/themes?t=${Date.now()}`, { cache: "no-store" });
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
  if (loadedThemes[id]) return loadedThemes[id];

  const meta = availableThemes.find(x => x.id === id);
  if (!meta) return null;

  const res = await fetch(`${meta.path}?t=${Date.now()}`, { cache: "no-store" });
  const theme = await res.json();
  loadedThemes[id] = theme;
  return theme;
}

async function applyThemePreset() {
  const presetName = val("themePreset");
  const meta = getCurrentThemeMeta();
  const preset = await getThemePreset(presetName);

  if (!preset) {
    activeThemeId = null;
    activeThemeType = null;
    themeDirty = false;

    const config = readForm();
    config.theme.preset = "Custom";
    fillForm(config);
    updatePreview(config);
    updateThemeControls();
    return;
  }

  activeThemeId = meta?.id || presetName;
  activeThemeType = meta?.type || "builtin";
  themeDirty = false;

  const current = readForm();
  const next = mergeConfig(current, {
    theme: { preset: presetName },
    colors: preset.colors,
    font: preset.font,
    ticker: preset.ticker,
    fullCard: preset.fullCard,
    vinyl: preset.vinyl,
    particles: preset.particles,
    equalizer: preset.equalizer,
    audio: preset.audio,
    animations: preset.animations
  });
  fillForm(next);
  updatePreview(next);
  updateThemeControls();
}

function applyFftPresetToForm(presetName) {
  const preset = FFT_PRESETS[presetName];
  if (!preset) return;

  set("equalizerSensitivity", Math.round(preset.sensitivity * 100));
  set("equalizerSmoothing", Math.round(preset.smoothing * 100));
  set("equalizerOutputGain", Math.round(preset.outputGain * 100));
  set("equalizerSpectralContrast", Math.round(preset.spectralContrast * 100));
  set("equalizerVisualCurvePower", Math.round(preset.visualCurvePower * 100));
  $("equalizerAutoGain").checked = Boolean(preset.autoGain ?? true);
}

// --- Config loading/saving ---
async function loadConfig() {
  try {
    const res = await fetch(`/api/config?t=${Date.now()}`, { cache: "no-store" });
    const loaded = await res.json();
    const config = mergeConfig(defaultConfig, loaded);
    fillForm(config);
    updatePreview(config);
    const meta = getCurrentThemeMeta();

    activeThemeId = meta?.id || null;
    activeThemeType = meta?.type || null;
    themeDirty = false;

    updateThemeControls();
  } catch (e) {
    console.error(e);
    fillForm(defaultConfig);
    updatePreview(defaultConfig);
    statusEl.textContent = "Не удалось прочитать config.json, поставлены дефолтные значения.";
  }
}

async function saveConfig(config) {
  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    const result = await res.json();
    statusEl.textContent = result.ok ? "Сохранено. Обнови OBS Browser Source или Ctrl+F5 на оверлее." : "Ошибка сохранения.";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Ошибка сохранения.";
  }
}

// --- Drag numbers ---
function setupDragNumbers() {
  document.querySelectorAll(".drag-label").forEach(label => {
    let startX = 0;
    let startValue = 0;
    let input = null;

    label.addEventListener("pointerdown", e => {
      input = $(label.dataset.target);
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

      if (input.id !== "themePreset") {
        config.theme.preset = "Custom";
        markThemeDirty();
      }

      updatePreview(config);
    });

    label.addEventListener("pointerup", e => {
      input = null;
      document.body.style.cursor = "";
      try { label.releasePointerCapture(e.pointerId); } catch {}
    });
  });
}

// --- Audio status ---
async function updateAudioStatus() {
  try {
    const res = await fetch(`/api/audiolevel?t=${Date.now()}`, { cache: "no-store" });
    const data = await res.json();
    $("captureStatusMode").textContent = data.captureMode || "-";
    $("captureStatusSource").textContent = data.sourceAppId || "-";
    $("captureStatusPid").textContent = data.processId || "-";
    $("captureStatusError").textContent = data.processCaptureError || "none";
  } catch {}
}

function setupCollapsibleSections() {
  const storageKey = "musicOverlay.settings.sections";

  let savedState = {};

  try {
    savedState = JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    savedState = {};
  }

  const groups = document.querySelectorAll(".panel > .group");

  groups.forEach((group, index) => {
    const title = group.querySelector("h2");
    if (!title) return;

    const rawTitle = title.textContent.trim();
    const sectionKey = `${index}-${rawTitle}`;
    const defaultExpanded = [
      "Темы"
    ];

    group.classList.add("settings-section");
    group.dataset.sectionKey = sectionKey;

    title.setAttribute("role", "button");
    title.setAttribute("tabindex", "0");

    const hasSavedState = sectionKey in savedState;

    const isCollapsed = hasSavedState
      ? savedState[sectionKey]
      : !defaultExpanded.includes(rawTitle);

    group.classList.toggle("is-collapsed", isCollapsed);

    const toggle = () => {
      const collapsed = !group.classList.contains("is-collapsed");

      group.classList.toggle("is-collapsed", collapsed);

      savedState[sectionKey] = collapsed;
      localStorage.setItem(storageKey, JSON.stringify(savedState));
    };

    title.addEventListener("click", toggle);

    title.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

function getCurrentThemeMeta() {
  const id = val("themePreset");

  if (!id || id === "Custom") {
    return null;
  }

  return availableThemes.find(theme => theme.id === id) || null;
}

function updateThemeControls() {
  const customControls = $("customThemeControls");
  const updateBtn = $("updateCustomThemeBtn");

  if (!customControls || !updateBtn) return;

  const canSaveAsNew = themeDirty;
  const canUpdateCurrent =
    themeDirty &&
    activeThemeType === "custom" &&
    activeThemeId;

  customControls.classList.toggle("is-visible", canSaveAsNew);
  updateBtn.classList.toggle("is-visible", canUpdateCurrent);
}

function markThemeDirty() {
  themeDirty = true;

  const currentMeta = getCurrentThemeMeta();

  if (currentMeta) {
    activeThemeId = currentMeta.id;
    activeThemeType = currentMeta.type;
  }

  if (activeThemeType !== "custom") {
    set("themePreset", "Custom");
  }

  updateThemeControls();
}

function createThemePayload(config) {
  return {
    colors: config.colors,
    font: config.font,
    ticker: config.ticker,
    fullCard: config.fullCard,
    vinyl: config.vinyl,
    particles: config.particles,
    equalizer: config.equalizer,
    audio: config.audio,
    animations: config.animations
  };
}

async function saveCustomTheme() {
  const name = val("customThemeName").trim();

  if (!name) {
    statusEl.textContent = "Введите название темы.";
    return;
  }

  const config = readForm();

  const res = await fetch("/api/themes/custom", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      theme: createThemePayload(config)
    })
  });

  const result = await res.json();

  if (!result.ok) {
    statusEl.textContent = result.error || "Не удалось сохранить тему.";
    return;
  }

  statusEl.textContent = "Тема сохранена.";

  $("customThemeName").value = "";

  await loadThemes();

  set("themePreset", result.id);

  activeThemeId = result.id;
  activeThemeType = "custom";
  themeDirty = false;

  updateThemeControls();
}

async function updateCustomTheme() {
  if (!activeThemeId || activeThemeType !== "custom") {
    statusEl.textContent = "Выбрана не пользовательская тема.";
    return;
  }

  const themeId = activeThemeId.replace("custom/", "");
  const config = readForm();

  const res = await fetch(`/api/themes/custom/${themeId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      theme: createThemePayload(config)
    })
  });

  const result = await res.json();

  if (!result.ok) {
    statusEl.textContent = result.error || "Не удалось обновить тему.";
    return;
  }

  statusEl.textContent = "Изменения темы сохранены.";

  themeDirty = false;

  await loadThemes();

  set("themePreset", activeThemeId);
  updateThemeControls();
}

// --- Event wiring ---
document.querySelectorAll("input, select").forEach(input => {
  input.addEventListener("input", () => {
    if (input.id === "themePreset") {
      return;
    }

    if (input.id === "customThemeName") {
      return;
    }

    if (input.id === "fftPreset") {
      applyFftPresetToForm(input.value);
    }

    if (manualFftFields.has(input.id)) {
      set("fftPreset", "custom");
    }

    markThemeDirty();

    const config = readForm();

    if (activeThemeType !== "custom") {
      config.theme.preset = "Custom";
    }

    updatePreview(config);
  });
});

$("applyThemeBtn").addEventListener("click", applyThemePreset);
$("themePreset").addEventListener("change", applyThemePreset);
$("saveCustomThemeBtn").addEventListener("click", saveCustomTheme);
$("updateCustomThemeBtn").addEventListener("click", updateCustomTheme);

$("defaultCoverFile").addEventListener("change", async e => {
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

$("saveBtn").addEventListener("click", () => saveConfig(readForm()));
$("resetBtn").addEventListener("click", () => {
  currentDefaultCover = defaultConfig.albumArt.defaultCover;
  fillForm(defaultConfig);
  updatePreview(defaultConfig);
  saveConfig(defaultConfig);
});

$("playPreviewAnimationBtn").addEventListener("click", playPreviewAnimation);

// --- Periodic updates ---
setInterval(updateAudioStatus, 1000);
updateAudioStatus();

setInterval(() => {
  if (!previewEqualizer) return;
  const bars = previewEqualizer.querySelectorAll(".preview-eq-bar");
  bars.forEach((bar, index) => {
    const center = Math.abs(index - bars.length / 2) / (bars.length / 2);
    const centerBoost = 1.35 - center * 0.65;
    bar.style.height = `${4 + Math.random() * 46 * centerBoost}px`;
  });
}, 140);

// --- Init ---
setupCollapsibleSections();
setupDragNumbers();

(async () => {
  await loadThemes();
  await loadConfig();
})();
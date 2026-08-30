const DEFAULT_COVER = "/assets/default-cover.png";
const DEFAULT_CANVAS_BACKGROUND = "#00a84f";
const CANVAS_BACKGROUND_STORAGE_KEY = "musicOverlay.editor.canvasBackground.v1";
const EDITOR_LANGUAGE_STORAGE_KEY = "musicOverlay.editor.language.v1";
const LIBRARY_ASSETS_STORAGE_KEY = "musicOverlay.editor.libraryAssets.v1";

const I18N = {
  ru: {
    appTitle: "Overlay Editor", theme: "Тема", saveTheme: "Сохранить", delete: "Удалить", reset: "Сбросить", apply: "Применить",
    objects: "Объекты", uploadObject: "+ Свой объект", libraryHintTitle: "Выберите объект",
    libraryHint: "Откройте категорию, посмотрите preview и перетащите карточку на Timeline.",
    groupTimingRule: "Группа задаёт окно. Вложенные объекты не выходят за его конец.", timing: "Тайминг",
    inDevelopment: "В разработке", noActiveTrack: "Нет активного трека", infinityRecording: "Infinity recording", untilGroup: "До конца группы",
    freeTimeline: "Свободные объекты · перетащите сюда", layersControls: "Слои / управление", undo: "Отменить", redo: "Повторить",
    deleteLayer: "Удалить объект", deleteGroup: "Удалить группу"
  },
  en: {
    appTitle: "Overlay Editor", theme: "Theme", saveTheme: "Save theme", delete: "Delete", reset: "Reset", apply: "Apply",
    objects: "Objects", uploadObject: "+ Custom", libraryHintTitle: "Pick an object",
    libraryHint: "Open a category, check the preview, then drag a card to the Timeline.",
    groupTimingRule: "A group owns the time window. Child objects stay inside it.", timing: "Timing",
    inDevelopment: "In development", noActiveTrack: "No active track", infinityRecording: "Infinity recording", untilGroup: "Until group end",
    freeTimeline: "Free objects · drop here", layersControls: "Layers / controls", undo: "Undo", redo: "Redo",
    deleteLayer: "Delete object", deleteGroup: "Delete group"
  }
};

const UI_TEXT_PAIRS = [
  ["Название", "Name"], ["Видимость", "Visibility"], ["Блокировка", "Lock"], ["Группа", "Group"], ["Без группы", "No group"],
  ["Трансформация", "Transform"], ["Эффекты", "Effects"], ["Анимация", "Animation"], ["Настройки объекта", "Object settings"],
  ["Размер объекта", "Object size"], ["Цвета", "Colors"], ["Фон", "Background"], ["Текст", "Text"], ["Прогресс", "Progress"],
  ["Фон прогресса", "Progress background"], ["Шрифт", "Font"], ["Включено", "Enabled"], ["Количество", "Count"], ["Размер", "Size"],
  ["Тип", "Type"], ["Своя обложка", "Custom cover"], ["Источник звука", "Audio source"], ["Резервная обложка", "Album art fallback"],
  ["Миниатюра Windows", "Windows thumbnail"], ["Удалить группу", "Delete group"], ["Композиция", "Composition"], ["сек", "sec"],
  ["Цвет фона", "Canvas background"], ["Запустить таймлайн", "Play timeline"], ["Холст / Превью", "Canvas / Preview"],
  ["Библиотека", "Library"], ["Слои / Таймлайн", "Layers / Timeline"], ["Глобальные настройки", "Global Settings"],
  ["Приложение", "Application"], ["Маркер цвета", "Color marker"], ["Масштаб, %", "Scale, %"], ["Прозрачность, %", "Opacity, %"],
  ["Размытие, px", "Blur, px"], ["Свечение, px", "Glow, px"], ["Анимация In", "Animation In"], ["Анимация Out", "Animation Out"],
  ["Длительность In, мс", "In duration, ms"], ["Длительность Out, мс", "Out duration, ms"], ["Плавность In", "In easing"], ["Плавность Out", "Out easing"],
  ["Ширина карточки", "Card width"], ["Ширина тикера", "Ticker width"], ["Высота тикера", "Ticker height"], ["Размер обложки", "Cover size"],
  ["Размер пластинки", "Vinyl size"], ["Прозрачность фона, %", "Background opacity, %"], ["Прозрачность прогресса, %", "Progress opacity, %"],
  ["Типографика и стиль", "Typography & style"], ["Размер названия", "Title size"], ["Размер исполнителя", "Artist size"], ["Размер тикера", "Ticker size"],
  ["Стиль карточки", "Card style"], ["Стиль тикера", "Ticker style"], ["Стиль пластинки", "Vinyl style"], ["Частицы", "Particles"],
  ["Длительность", "Duration"], ["Эквалайзер", "Equalizer"], ["Стиль", "Style"], ["Режим цвета", "Color mode"], ["Бары", "Bars"],
  ["Ширина", "Width"], ["Высота", "Height"], ["Отступ", "Gap"], ["Боковой отступ", "Side padding"], ["Чувствительность ×100", "Sensitivity ×100"],
  ["Сглаживание %", "Smoothing %"], ["Усиление ×100", "Output gain ×100"], ["Контраст ×100", "Contrast ×100"], ["Кривая ×100", "Curve ×100"],
  ["Сила свечения", "Glow power"], ["Автоусиление", "Auto gain"], ["Текущая обложка", "Current cover"], ["Добавить группу", "+ Group"],
  ["FFT-пресет", "FFT preset"], ["Смещение Y", "Offset Y"], ["Библиотека тем", "Theme library"]
];
const UI_TEXT_LOOKUP = new Map(UI_TEXT_PAIRS.flatMap(([ru, en]) => [[ru, { ru, en }], [en, { ru, en }]]));

const LIBRARY_CATEGORIES = [
  { id: "blocks", icon: "▣", name: { ru: "Блоки", en: "Blocks" }, items: [
    { id: "block-glass", payloadType: "object", kind: "block", icon: "▧", name: { ru: "Glass block", en: "Glass block" }, desc: { ru: "Фоновый контейнер", en: "Background container" }, properties: { width: 300, height: 120, color: "#151a24", borderRadius: 18 } },
    { id: "block-solid", payloadType: "object", kind: "block", icon: "■", name: { ru: "Solid block", en: "Solid block" }, desc: { ru: "Плотная панель", en: "Solid panel" }, properties: { width: 280, height: 100, color: "#090b10", borderRadius: 12 } },
    { id: "primitive-rectangle", payloadType: "object", kind: "block", icon: "▬", name: { ru: "Прямоугольник", en: "Rectangle" }, desc: { ru: "Базовый примитив", en: "Basic primitive" }, properties: { width: 220, height: 70, color: "#2a3342", borderRadius: 4 } },
    { id: "primitive-circle", payloadType: "object", kind: "block", icon: "●", name: { ru: "Круг", en: "Circle" }, desc: { ru: "Базовый примитив", en: "Basic primitive" }, properties: { width: 100, height: 100, color: "#8b5cf6", borderRadius: 50 } }
  ]},
  { id: "artwork", icon: "▧", name: { ru: "Обложки", en: "Artwork" }, items: [
    { id: "cover-square", payloadType: "object", kind: "image", icon: "▧", name: { ru: "Square cover", en: "Square cover" }, desc: { ru: "Текущая обложка", en: "Current cover" }, properties: { width: 120, height: 120, borderRadius: 10, source: "track" } },
    { id: "cover-round", payloadType: "object", kind: "image", icon: "◫", name: { ru: "Round cover", en: "Round cover" }, desc: { ru: "Обложка с мягкими углами", en: "Soft rounded cover" }, properties: { width: 140, height: 140, borderRadius: 28, source: "track" } }
  ]},
  { id: "vinyl", icon: "◉", name: { ru: "Пластинки", en: "Vinyl & discs" }, items: [
    { id: "vinyl-classic", payloadType: "object", kind: "disc", icon: "◉", name: { ru: "Classic vinyl", en: "Classic vinyl" }, desc: { ru: "Черная пластинка", en: "Black record" }, properties: { size: 130, style: "classic" } },
    { id: "vinyl-cd", payloadType: "object", kind: "disc", icon: "◎", name: { ru: "CD", en: "CD" }, desc: { ru: "Компакт-диск", en: "Compact disc" }, properties: { size: 125, style: "cd" } },
    { id: "anime-glossy-cd", payloadType: "object", kind: "disc", icon: "◉", name: { ru: "Anime glossy CD", en: "Anime glossy CD" }, desc: { ru: "Диск с радужными бликами", en: "Iridescent glossy disc" }, properties: { size: 138, style: "animeCd", glow: 18 } }
  ]},
  { id: "text", icon: "T", name: { ru: "Текст", en: "Text" }, items: [
    { id: "plain-text", payloadType: "object", kind: "text", icon: "Ab", name: { ru: "Обычный текст", en: "Plain text" }, desc: { ru: "Любая своя надпись", en: "Any custom label" }, properties: { binding: "custom", width: 320, fontSize: 24, fontWeight: 700, color: "#ffffff", text: "Ваш текст" } },
    { id: "now-playing-text", payloadType: "object", kind: "text", icon: "NP", name: { ru: "Now Playing", en: "Now Playing" }, desc: { ru: "Редактируемый заголовок", en: "Editable heading" }, properties: { binding: "custom", width: 320, fontSize: 22, fontWeight: 800, color: "#ffffff", text: "Now Playing" } },
    { id: "track-title", payloadType: "object", kind: "text", icon: "T", name: { ru: "Название трека", en: "Track title" }, desc: { ru: "Данные title", en: "Title binding" }, properties: { binding: "title", width: 360, fontSize: 30, color: "#ffffff", text: "Track title" } },
    { id: "track-artist", payloadType: "object", kind: "text", icon: "Aa", name: { ru: "Исполнитель", en: "Artist" }, desc: { ru: "Данные artist", en: "Artist binding" }, properties: { binding: "artist", width: 320, fontSize: 20, color: "#d6dce7", text: "Artist" } }
  ]},
  { id: "track-data", icon: "◷", name: { ru: "Данные трека", en: "Track data" }, items: [
    { id: "track-time", payloadType: "object", kind: "time", icon: "◷", name: { ru: "Время", en: "Time" }, desc: { ru: "Позиция и длительность", en: "Position and duration" }, properties: { width: 190, fontSize: 18, color: "#ffffff" } },
    { id: "track-progress", payloadType: "object", kind: "progress", icon: "━", name: { ru: "Прогресс", en: "Progress" }, desc: { ru: "Полоса трека", en: "Track progress" }, properties: { width: 300, height: 8, color: "#ffffff" } }
  ]},
  { id: "equalizers", icon: "▥", name: { ru: "Эквалайзеры", en: "Equalizers" }, items: [
    { id: "equalizer-bars", payloadType: "object", kind: "equalizer", icon: "▥", name: { ru: "Bars", en: "Bars" }, desc: { ru: "Аудио-бары", en: "Audio bars" }, properties: { width: 300, height: 90, barCount: 32, color: "#8b5cf6" } },
    { id: "equalizer-neon", payloadType: "object", kind: "equalizer", icon: "▥", name: { ru: "Neon bars", en: "Neon bars" }, desc: { ru: "Бары со свечением", en: "Glowing bars" }, properties: { width: 340, height: 100, barCount: 48, color: "#35d0ba", glow: 18 } },
    { id: "equalizer-waveform", payloadType: "object", kind: "equalizer", icon: "〰", name: { ru: "Waveform", en: "Waveform" }, desc: { ru: "Тонкая звуковая волна", en: "Compact audio waveform" }, properties: { width: 300, height: 32, barCount: 72, gap: 1, style: "waveform", color: "#ffffff" } },
    { id: "equalizer-pulse", payloadType: "object", kind: "equalizer", icon: "ϟ", name: { ru: "Pulse bars", en: "Pulse bars" }, desc: { ru: "Контрастные светящиеся бары", en: "High-contrast glowing bars" }, properties: { width: 340, height: 110, barCount: 48, gap: 3, style: "pulse", color: "#74ff70" } }
  ]},
  { id: "tickers", icon: "≡", name: { ru: "Тикеры", en: "Tickers" }, items: [
    { id: "ticker-compact", payloadType: "object", kind: "ticker", icon: "≡", name: { ru: "Compact ticker", en: "Compact ticker" }, desc: { ru: "Title + artist", en: "Title + artist" }, properties: { width: 440, height: 46, fontSize: 16, color: "#ffffff", binding: "ticker" } }
  ]},
  { id: "animations", icon: "↗", name: { ru: "Анимации", en: "Animations" }, items: [
    { id: "anim-in-left", section: "in", payloadType: "animation-in", icon: "←", name: { ru: "Slide left", en: "Slide left" }, desc: { ru: "In · слева", en: "In · from left" }, value: "slideLeft" },
    { id: "anim-in-right", section: "in", payloadType: "animation-in", icon: "→", name: { ru: "Slide right", en: "Slide right" }, desc: { ru: "In · справа", en: "In · from right" }, value: "slideRight" },
    { id: "anim-in-up", section: "in", payloadType: "animation-in", icon: "↑", name: { ru: "Slide up", en: "Slide up" }, desc: { ru: "In · снизу вверх", en: "In · slide up" }, value: "slideUp" },
    { id: "anim-in-down", section: "in", payloadType: "animation-in", icon: "↓", name: { ru: "Slide down", en: "Slide down" }, desc: { ru: "In · сверху вниз", en: "In · slide down" }, value: "slideDown" },
    { id: "anim-in-scale", section: "in", payloadType: "animation-in", icon: "◇", name: { ru: "Scale", en: "Scale" }, desc: { ru: "In · масштаб", en: "In · scale" }, value: "scale" },
    { id: "anim-in-fade", section: "in", payloadType: "animation-in", icon: "◌", name: { ru: "Fade", en: "Fade" }, desc: { ru: "In · прозрачность", en: "In · fade" }, value: "fade" },
    { id: "anim-in-roll-right", section: "in", payloadType: "animation-in", icon: "◉→", name: { ru: "Roll right", en: "Roll right" }, desc: { ru: "In · выкатка вправо", en: "In · roll to the right" }, value: "rollRight" },
    { id: "anim-out-left", section: "out", payloadType: "animation-out", icon: "←", name: { ru: "Slide left", en: "Slide left" }, desc: { ru: "Out · влево", en: "Out · to left" }, value: "slideLeft" },
    { id: "anim-out-right", section: "out", payloadType: "animation-out", icon: "→", name: { ru: "Slide right", en: "Slide right" }, desc: { ru: "Out · вправо", en: "Out · to right" }, value: "slideRight" },
    { id: "anim-out-up", section: "out", payloadType: "animation-out", icon: "↑", name: { ru: "Slide up", en: "Slide up" }, desc: { ru: "Out · вверх", en: "Out · up" }, value: "slideUp" },
    { id: "anim-out-down", section: "out", payloadType: "animation-out", icon: "↓", name: { ru: "Slide down", en: "Slide down" }, desc: { ru: "Out · вниз", en: "Out · down" }, value: "slideDown" },
    { id: "anim-out-scale", section: "out", payloadType: "animation-out", icon: "◇", name: { ru: "Scale", en: "Scale" }, desc: { ru: "Out · масштаб", en: "Out · scale" }, value: "scale" },
    { id: "anim-out-fade", section: "out", payloadType: "animation-out", icon: "◌", name: { ru: "Fade", en: "Fade" }, desc: { ru: "Out · прозрачность", en: "Out · fade" }, value: "fade" }
  ]},
  { id: "effects", icon: "✦", name: { ru: "Эффекты", en: "Effects" }, items: [
    { id: "effect-blur", payloadType: "effect", icon: "◌", name: { ru: "Blur", en: "Blur" }, desc: { ru: "Размытие 12 px", en: "12 px blur" }, value: { blur: 12 } },
    { id: "effect-glow", payloadType: "effect", icon: "✦", name: { ru: "Glow", en: "Glow" }, desc: { ru: "Свечение 24 px", en: "24 px glow" }, value: { glow: 24 } }
  ]}
];

const baseConfig = {
  position: { left: 70, fullBottom: 80, tickerBottom: 44 },
  sizes: { fullCardWidth: 430, tickerWidth: 500, tickerHeight: 42, coverSize: 92, vinylSize: 108 },
  colors: { background: "rgba(10, 10, 14, 0.80)", text: "#ffffff", progress: "#ffffff", progressBackground: "rgba(255, 255, 255, 0.18)" },
  timings: { fullVisibleMs: 10000, coverDelayMs: 500, cardDelayMs: 850, exitMs: 600, marqueeDelayMs: 2000, marqueeSpeedSec: 10 },
  animations: { fullEnter: "slideRight", fullExit: "slideDown", tickerEnter: "slideUp", tickerExit: "none" },
  albumArt: { useWindowsThumbnail: false, defaultCover: DEFAULT_COVER },
  theme: { preset: "Custom" },
  font: { family: "Arial", titleSize: 25, artistSize: 16, tickerSize: 14 },
  ticker: { style: "pill" },
  fullCard: { style: "glass" },
  vinyl: { style: "classic" },
  particles: { enabled: true, style: "notes", count: 20, size: 18, durationMs: 2200, color: "#ffffff" },
  equalizer: {
    enabled: true, style: "solid", barCount: 64, barWidth: 5, gap: 3, height: 86, offsetY: 0, sidePadding: 14,
    preset: "dynamicBars", sensitivity: 1.12, smoothing: 0.28, autoGain: true, outputGain: 1, spectralContrast: 1,
    visualCurvePower: 1, glow: true, glowPower: 18, colorMode: "progress", color: "#ffffff"
  },
  audio: { sourceMode: "auto" }
};

const FFT_PRESETS = {
  balanced: { sensitivity: 1.15, smoothing: 0.65, autoGain: true, outputGain: 1, spectralContrast: 1, visualCurvePower: 1 },
  smooth: { sensitivity: 1.05, smoothing: 0.82, autoGain: true, outputGain: 0.95, spectralContrast: 0.85, visualCurvePower: 1.15 },
  punchy: { sensitivity: 1.35, smoothing: 0.48, autoGain: true, outputGain: 1.15, spectralContrast: 1.45, visualCurvePower: 0.9 },
  vocal: { sensitivity: 1.2, smoothing: 0.62, autoGain: true, outputGain: 1.05, spectralContrast: 1.25, visualCurvePower: 1.05 },
  bass: { sensitivity: 1.3, smoothing: 0.58, autoGain: true, outputGain: 1.2, spectralContrast: 1.15, visualCurvePower: 0.95 },
  orchestra: { sensitivity: 1.1, smoothing: 0.74, autoGain: true, outputGain: 1, spectralContrast: 1.35, visualCurvePower: 1.2 },
  energy: { sensitivity: 1.35, smoothing: 0.38, autoGain: true, outputGain: 1.1, spectralContrast: 1.0, visualCurvePower: 1.0 },
  dynamicBars: { sensitivity: 1.12, smoothing: 0.28, autoGain: true, outputGain: 1.0, spectralContrast: 1.0, visualCurvePower: 1.0 }
};

const markerPalette = ["#8b5cf6", "#35d0ba", "#ff9f43", "#4da3ff", "#fb7185", "#e879f9"];
const runtimeGroupIds = new Set(["full-card-group", "ticker-group"]);

function makeEffects() {
  return { opacity: 100, blur: 0, glow: 0 };
}

function makeAnimation(enter = "fade", exit = "fade", durationMs = 600) {
  return {
    enter, exit,
    enterDurationMs: durationMs, enterEasing: "ease-out",
    exitDurationMs: durationMs, exitEasing: "ease-out",
    durationMs, easing: "ease-out"
  };
}

function makeTiming(startMs, endMs, untilNextTrack = false) {
  return { startMs, endMs, untilNextTrack };
}

function createDefaultLayout(config = baseConfig) {
  const fullEnd = Math.max(1000, Number(config.timings?.fullVisibleMs || 10000));
  const coverStart = Math.max(0, Number(config.timings?.coverDelayMs || 500));
  const cardStart = Math.max(0, Number(config.timings?.cardDelayMs || 850));
  const duration = Math.max(0, Number(config.timings?.exitMs || 600));

  return {
    version: 1,
    canvas: { width: 1920, height: 1080, backgroundColor: DEFAULT_CANVAS_BACKGROUND },
    compositionDurationMs: 30000,
    groups: [
      {
        id: "full-card-group", name: "Full Card", runtimeTarget: "full", visible: true, locked: false,
        marker: "#8b5cf6", x: 0, y: 0, scale: 100, effects: makeEffects(),
        animation: makeAnimation(config.animations?.fullEnter || "slideRight", config.animations?.fullExit || "slideDown", duration),
        timing: makeTiming(0, fullEnd, false)
      },
      {
        id: "ticker-group", name: "Ticker / Until next track", runtimeTarget: "ticker", visible: true, locked: false,
        marker: "#35d0ba", x: 0, y: 0, scale: 100, effects: makeEffects(),
        animation: makeAnimation(config.animations?.tickerEnter || "slideUp", config.animations?.tickerExit || "none", duration),
        timing: makeTiming(fullEnd, null, true)
      }
    ],
    layers: [
      { id: "full-particles", name: "Particles", kind: "effect", groupId: "full-card-group", marker: "#e879f9", timing: makeTiming(0, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) },
      { id: "full-cover", name: "Cover", kind: "image", groupId: "full-card-group", marker: "#fb7185", timing: makeTiming(coverStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("scale", "fade", 450) },
      { id: "full-vinyl", name: "Vinyl", kind: "disc", groupId: "full-card-group", marker: "#ff9f43", timing: makeTiming(coverStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("slideLeft", "fade", 500) },
      { id: "full-title", name: "Title", kind: "text", groupId: "full-card-group", marker: "#4da3ff", timing: makeTiming(cardStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("slideLeft", "fade", 450) },
      { id: "full-artist", name: "Artist", kind: "text", groupId: "full-card-group", marker: "#4da3ff", timing: makeTiming(cardStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("slideLeft", "fade", 450) },
      { id: "full-time", name: "Time", kind: "data", groupId: "full-card-group", marker: "#35d0ba", timing: makeTiming(cardStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) },
      { id: "full-progress", name: "Progress", kind: "data", groupId: "full-card-group", marker: "#35d0ba", timing: makeTiming(cardStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) },
      { id: "full-card-shell", name: "Card container", kind: "container", groupId: "full-card-group", marker: "#8b5cf6", timing: makeTiming(cardStart, fullEnd), visible: true, locked: true, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) },
      { id: "ticker-equalizer", name: "Equalizer", kind: "effect", groupId: "ticker-group", marker: "#e879f9", timing: makeTiming(fullEnd, null, true), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("slideUp", "fade", 500) },
      { id: "ticker-title", name: "Ticker title", kind: "text", groupId: "ticker-group", marker: "#4da3ff", timing: makeTiming(fullEnd, null, true), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("slideUp", "fade", 500) },
      { id: "ticker-time", name: "Ticker time", kind: "data", groupId: "ticker-group", marker: "#35d0ba", timing: makeTiming(fullEnd, null, true), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) },
      { id: "ticker-progress", name: "Ticker progress", kind: "data", groupId: "ticker-group", marker: "#35d0ba", timing: makeTiming(fullEnd, null, true), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) }
    ]
  };
}

const defaultConfig = { ...structuredClone(baseConfig), layout: createDefaultLayout(baseConfig) };

const previewLayerMap = {
  "full-particles": "previewParticles",
  "full-cover": "previewCover",
  "full-vinyl": "previewVinyl",
  "full-title": "previewTitle",
  "full-artist": "previewArtist",
  "full-time": "previewTime",
  "full-progress": "previewProgress",
  "full-card-shell": "previewCard",
  "ticker-equalizer": "previewEqualizer",
  "ticker-title": "previewTickerTitle",
  "ticker-time": "previewTickerTime",
  "ticker-progress": "previewTickerProgress"
};

const previewGroupMap = {
  "full-card-group": "previewFull",
  "ticker-group": "previewTicker"
};

const fieldMappings = [
  ["left", "position.left"], ["fullBottom", "position.fullBottom"], ["tickerBottom", "position.tickerBottom"],
  ["fullCardWidth", "sizes.fullCardWidth"], ["tickerWidth", "sizes.tickerWidth"], ["tickerHeight", "sizes.tickerHeight"],
  ["coverSize", "sizes.coverSize"], ["vinylSize", "sizes.vinylSize"],
  ["fontFamily", "font.family"], ["titleSize", "font.titleSize"], ["artistSize", "font.artistSize"], ["tickerSize", "font.tickerSize"],
  ["fullVisibleMs", "timings.fullVisibleMs"], ["coverDelayMs", "timings.coverDelayMs"], ["cardDelayMs", "timings.cardDelayMs"],
  ["exitMs", "timings.exitMs"], ["marqueeDelayMs", "timings.marqueeDelayMs"], ["marqueeSpeedSec", "timings.marqueeSpeedSec"],
  ["fullEnterAnimation", "animations.fullEnter"], ["fullExitAnimation", "animations.fullExit"], ["tickerEnterAnimation", "animations.tickerEnter"],
  ["tickerStyle", "ticker.style"], ["fullCardStyle", "fullCard.style"], ["vinylStyle", "vinyl.style"],
  ["particlesStyle", "particles.style"], ["particlesColor", "particles.color"], ["particlesCount", "particles.count"],
  ["particlesSize", "particles.size"], ["particlesDurationMs", "particles.durationMs"],
  ["equalizerStyle", "equalizer.style"], ["equalizerColorMode", "equalizer.colorMode"], ["equalizerColor", "equalizer.color"],
  ["equalizerBarCount", "equalizer.barCount"], ["equalizerBarWidth", "equalizer.barWidth"], ["equalizerGap", "equalizer.gap"],
  ["equalizerHeight", "equalizer.height"], ["equalizerOffsetY", "equalizer.offsetY"], ["equalizerSidePadding", "equalizer.sidePadding"],
  ["equalizerGlowPower", "equalizer.glowPower"], ["audioSourceMode", "audio.sourceMode"]
];

const booleanFields = [
  ["particlesEnabled", "particles.enabled"], ["equalizerEnabled", "equalizer.enabled"], ["equalizerGlow", "equalizer.glow"],
  ["equalizerAutoGain", "equalizer.autoGain"], ["useWindowsThumbnail", "albumArt.useWindowsThumbnail"]
];

const manualFftFields = new Set([
  "equalizerAutoGain", "equalizerSensitivity", "equalizerSmoothing", "equalizerOutputGain",
  "equalizerSpectralContrast", "equalizerVisualCurvePower"
]);

let currentConfig = structuredClone(defaultConfig);
let editorSocket = null;
let editorSocketRetry = null;
let currentDefaultCover = DEFAULT_COVER;
let currentLiveCover = "";
let availableThemes = [];
let loadedThemes = {};
let activeThemeId = null;
let activeThemeType = null;
let themeDirty = false;
let selection = { type: "group", id: "full-card-group" };
let collapsedGroups = new Set();
let previewTimeMs = 1500;
let timelineDurationMs = 30000;
let canvasScale = 1;
let canvasController = null;
let timelineController = null;
let workspaceController = null;
let playbackFrame = null;
let playbackStartedAt = 0;
let playbackOffset = 0;
let currentLanguage = "ru";
let customLibraryAssets = [];
let undoStack = [];
let redoStack = [];
let historySuspended = false;
let historyLastRecordedAt = 0;

function $(id) { return document.getElementById(id); }

function t(key) {
  return I18N[currentLanguage]?.[key] || I18N.ru[key] || key;
}

function loadEditorLanguage() {
  try { currentLanguage = localStorage.getItem(EDITOR_LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ru"; } catch { currentLanguage = "ru"; }
}

function applyEditorLanguage() {
  document.documentElement.lang = currentLanguage;
  $("languageSelect").value = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach(element => {
    const value = t(element.dataset.i18n);
    if (value) element.textContent = value;
  });
  renderLibrary();
  renderInspector();
  document.querySelectorAll("summary, .field > span, .compact-toggle > span, .composition-duration > span, .canvas-background-control > span, button, .eyebrow, h2, h3").forEach(element => {
    if (element.childElementCount > 0 || element.dataset.i18n) return;
    const source = element.dataset.i18nOriginal || element.textContent.trim();
    const pair = UI_TEXT_LOOKUP.get(source);
    if (!pair) return;
    element.dataset.i18nOriginal = pair.en;
    element.textContent = pair[currentLanguage];
  });
  if ($("undoBtn")) {
    $("undoBtn").title = `${t("undo")} · Ctrl+Z`;
    $("redoBtn").title = `${t("redo")} · Ctrl+Shift+Z`;
  }
  const audioLabels = currentLanguage === "ru" ? ["Режим", "Источник", "PID", "Ошибка"] : ["Mode", "Source", "PID", "Error"];
  document.querySelectorAll(".audio-status > span").forEach((element, index) => {
    if (element.firstChild) element.firstChild.nodeValue = `${audioLabels[index]}: `;
  });
  const zoomLabel = document.querySelector(".canvas-zoom-control");
  if (zoomLabel?.firstChild) zoomLabel.firstChild.nodeValue = `${currentLanguage === "ru" ? "Масштаб" : "Zoom"} `;
  renderTimeline();
  if ($("wsStatus")) setWebSocketStatus($("wsStatus").classList.contains("is-online"));
}

function setEditorLanguage(language) {
  currentLanguage = language === "en" ? "en" : "ru";
  try { localStorage.setItem(EDITOR_LANGUAGE_STORAGE_KEY, currentLanguage); } catch {}
  applyEditorLanguage();
}

function createHistorySnapshot() {
  return JSON.stringify({
    config: currentConfig,
    selection,
    previewTimeMs
  });
}

function updateHistoryControls() {
  if (!$(`undoBtn`)) return;
  $("undoBtn").disabled = undoStack.length < 2;
  $("redoBtn").disabled = redoStack.length === 0;
}

function resetHistory() {
  undoStack = [createHistorySnapshot()];
  redoStack = [];
  historyLastRecordedAt = 0;
  updateHistoryControls();
}

function recordHistorySnapshot(force = false) {
  if (historySuspended) return;
  const snapshot = createHistorySnapshot();
  if (!undoStack.length) {
    undoStack.push(snapshot);
    updateHistoryControls();
    return;
  }
  if (undoStack.at(-1) === snapshot) return;
  const now = performance.now();
  if (!force && undoStack.length > 1 && now - historyLastRecordedAt < 350) undoStack[undoStack.length - 1] = snapshot;
  else undoStack.push(snapshot);
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
  historyLastRecordedAt = now;
  updateHistoryControls();
}

function applyHistorySnapshot(snapshot, message) {
  historySuspended = true;
  try {
    const state = JSON.parse(snapshot);
    currentConfig = mergeConfig(defaultConfig, state.config || {});
    previewTimeMs = clampNumber(state.previewTimeMs, 0, getCompositionDuration(), 0);
    const candidate = state.selection || {};
    const collection = candidate.type === "layer" ? currentConfig.layout.layers : currentConfig.layout.groups;
    selection = collection.some(item => item.id === candidate.id)
      ? candidate
      : currentConfig.layout.groups.length
        ? { type: "group", id: currentConfig.layout.groups[0].id }
        : { type: "layer", id: currentConfig.layout.layers[0]?.id || "" };
    currentDefaultCover = currentConfig.albumArt?.defaultCover || DEFAULT_COVER;
    fillGlobalForm(currentConfig);
    themeDirty = true;
    updateThemeControls();
    updateEditor();
    setStatus(message, "success");
  } finally {
    historySuspended = false;
  }
  updateHistoryControls();
}

function undoEditor() {
  if (undoStack.length < 2) return;
  redoStack.push(undoStack.pop());
  applyHistorySnapshot(undoStack.at(-1), currentLanguage === "ru" ? "Изменение отменено" : "Change undone");
}

function redoEditor() {
  if (!redoStack.length) return;
  const snapshot = redoStack.pop();
  undoStack.push(snapshot);
  applyHistorySnapshot(snapshot, currentLanguage === "ru" ? "Изменение повторено" : "Change redone");
}

function loadCustomLibraryAssets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIBRARY_ASSETS_STORAGE_KEY) || "[]");
    customLibraryAssets = Array.isArray(parsed) ? parsed.filter(asset => asset?.id && asset?.assetData) : [];
  } catch { customLibraryAssets = []; }
}

function saveCustomLibraryAssets() {
  try { localStorage.setItem(LIBRARY_ASSETS_STORAGE_KEY, JSON.stringify(customLibraryAssets)); } catch {}
}

function getStoredCanvasBackground() {
  try {
    const value = localStorage.getItem(CANVAS_BACKGROUND_STORAGE_KEY);
    return /^#[0-9a-f]{6}$/i.test(value || "") ? value : null;
  } catch { return null; }
}

function storeCanvasBackground(value) {
  try { localStorage.setItem(CANVAS_BACKGROUND_STORAGE_KEY, value); } catch {}
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  let target = object;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!target[keys[i]] || typeof target[keys[i]] !== "object") target[keys[i]] = {};
    target = target[keys[i]];
  }
  target[keys.at(-1)] = value;
}

function clampNumber(value, min, max, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function mergeConfig(base, incoming = {}) {
  const merged = { ...structuredClone(base), ...structuredClone(incoming) };
  const sections = ["position", "sizes", "colors", "timings", "animations", "albumArt", "theme", "font", "ticker", "fullCard", "vinyl", "particles", "equalizer", "audio"];
  sections.forEach(section => {
    merged[section] = { ...(base[section] || {}), ...(incoming[section] || {}) };
  });
  merged.layout = incoming.layout
    ? normalizeLayout(incoming.layout, merged)
    : normalizeLayout(base.layout || createDefaultLayout(merged), merged);
  return merged;
}

function normalizeItem(item, fallback) {
  const next = { ...structuredClone(fallback), ...structuredClone(item || {}) };
  next.visible = next.visible !== false;
  next.locked = next.locked === true;
  next.x = clampNumber(next.x, -10000, 10000, 0);
  next.y = clampNumber(next.y, -10000, 10000, 0);
  next.scale = clampNumber(next.scale, 10, 400, 100);
  next.marker = /^#[0-9a-f]{6}$/i.test(next.marker || "") ? next.marker : fallback.marker;
  next.effects = { ...makeEffects(), ...(fallback.effects || {}), ...(item?.effects || {}) };
  next.effects.opacity = clampNumber(next.effects.opacity, 0, 100, 100);
  next.effects.blur = clampNumber(next.effects.blur, 0, 80, 0);
  next.effects.glow = clampNumber(next.effects.glow, 0, 100, 0);
  next.animation = { ...makeAnimation(), ...(fallback.animation || {}), ...(item?.animation || {}) };
  const legacyDuration = clampNumber(item?.animation?.durationMs ?? fallback.animation?.durationMs ?? next.animation.durationMs, 0, 10000, 600);
  const legacyEasing = item?.animation?.easing || fallback.animation?.easing || next.animation.easing || "ease-out";
  next.animation.enterDurationMs = clampNumber(item?.animation?.enterDurationMs ?? item?.animation?.durationMs ?? fallback.animation?.enterDurationMs, 0, 10000, legacyDuration);
  next.animation.exitDurationMs = clampNumber(item?.animation?.exitDurationMs ?? item?.animation?.durationMs ?? fallback.animation?.exitDurationMs, 0, 10000, legacyDuration);
  next.animation.enterEasing = item?.animation?.enterEasing || item?.animation?.easing || fallback.animation?.enterEasing || legacyEasing;
  next.animation.exitEasing = item?.animation?.exitEasing || item?.animation?.easing || fallback.animation?.exitEasing || legacyEasing;
  next.animation.durationMs = next.animation.enterDurationMs;
  next.animation.easing = next.animation.enterEasing;
  next.timing = { ...makeTiming(0, 10000), ...(fallback.timing || {}), ...(item?.timing || {}) };
  next.timing.startMs = clampNumber(next.timing.startMs, 0, 3600000, 0);
  next.timing.untilNextTrack = next.timing.untilNextTrack === true;
  next.timing.untilGroupEnd = next.timing.untilGroupEnd === true;
  next.timing.endMs = next.timing.untilNextTrack
    ? null
    : Math.max(next.timing.startMs + 50, clampNumber(next.timing.endMs, 0, 3600000, next.timing.startMs + 1000));
  return next;
}

function normalizeLayout(layout, config) {
  const fallback = createDefaultLayout(config);
  const incomingGroups = Array.isArray(layout?.groups) ? layout.groups : [];
  const incomingLayers = Array.isArray(layout?.layers) ? layout.layers : [];
  const replaceDefaults = layout?.replaceDefaults === true;

  const groups = replaceDefaults
    ? []
    : fallback.groups.map(group => normalizeItem(incomingGroups.find(item => item?.id === group.id), group));
  incomingGroups.forEach((group, index) => {
    if (!group?.id || groups.some(existing => existing.id === group.id)) return;
    groups.push(normalizeItem(group, {
      id: group.id, name: group.name || `Group ${groups.length + 1}`, runtimeTarget: null,
      visible: true, locked: false, marker: markerPalette[index % markerPalette.length], x: 0, y: 0, scale: 100,
      effects: makeEffects(), animation: makeAnimation(), timing: makeTiming(0, 10000)
    }));
  });

  const layers = [];
  const knownIds = new Set();
  incomingLayers.forEach((layer, index) => {
    const fallbackLayer = fallback.layers.find(item => item.id === layer?.id);
    if (!layer?.id || knownIds.has(layer.id)) return;
    const genericFallback = fallbackLayer || {
      id: layer.id,
      name: layer.name || `Object ${layers.length + 1}`,
      kind: layer.kind || "block",
      templateId: layer.templateId || null,
      groupId: layer.groupId || null,
      marker: markerPalette[index % markerPalette.length],
      timing: makeTiming(0, 5000), visible: true, locked: false, x: 700, y: 440, scale: 100,
      effects: makeEffects(), animation: makeAnimation("fade", "fade", 500), properties: layer.properties || {}
    };
    layers.push(normalizeItem(layer, genericFallback));
    knownIds.add(layer.id);
  });
  if (!replaceDefaults) {
    fallback.layers.forEach(layer => {
      if (knownIds.has(layer.id)) return;
      layers.push(normalizeItem(null, layer));
    });
  }

  const groupIds = new Set(groups.map(group => group.id));
  layers.forEach(layer => {
    if (!groupIds.has(layer.groupId)) layer.groupId = null;
  });

  const compositionDurationMs = clampNumber(layout?.compositionDurationMs, 1000, 180000, 30000);
  groups.forEach(group => constrainGroupTiming(group, compositionDurationMs));
  layers.forEach(layer => constrainLayerTiming(layer, groups, compositionDurationMs));

  return {
    version: 1,
    replaceDefaults,
    canvas: {
      width: 1920,
      height: 1080,
      ...(layout?.canvas || {}),
      backgroundColor: /^#[0-9a-f]{6}$/i.test(layout?.canvas?.backgroundColor || "")
        ? layout.canvas.backgroundColor
        : DEFAULT_CANVAS_BACKGROUND
    },
    compositionDurationMs,
    groups,
    layers
  };
}

function getTimingEnd(item, duration = timelineDurationMs) {
  return item?.timing?.untilNextTrack ? duration : Number(item?.timing?.endMs ?? item?.timing?.startMs + 1000);
}

function constrainGroupTiming(group, duration = timelineDurationMs) {
  group.timing.startMs = clampNumber(group.timing.startMs, 0, Math.max(0, duration - 50), 0);
  if (group.timing.untilNextTrack) {
    group.timing.endMs = null;
    return;
  }
  group.timing.endMs = clampNumber(group.timing.endMs, group.timing.startMs + 50, duration, Math.min(duration, group.timing.startMs + 1000));
}

function constrainLayerTiming(layer, groups = currentConfig.layout?.groups || [], duration = timelineDurationMs) {
  const group = groups.find(candidate => candidate.id === layer.groupId) || null;
  const minStart = group ? Number(group.timing.startMs || 0) : 0;
  const maxEnd = group ? getTimingEnd(group, duration) : duration;
  layer.timing.startMs = clampNumber(layer.timing.startMs, minStart, Math.max(minStart, maxEnd - 50), minStart);

  if (group && !group.timing.untilNextTrack) {
    layer.timing.untilNextTrack = false;
    if (Math.abs(Number(layer.timing.endMs || 0) - maxEnd) < 1) layer.timing.untilGroupEnd = true;
    if (layer.timing.untilGroupEnd) {
      layer.timing.endMs = maxEnd;
    } else {
      layer.timing.endMs = clampNumber(layer.timing.endMs, layer.timing.startMs + 50, maxEnd, maxEnd);
    }
    return;
  }

  layer.timing.untilGroupEnd = false;
  if (layer.timing.untilNextTrack) {
    layer.timing.endMs = null;
  } else {
    layer.timing.endMs = clampNumber(layer.timing.endMs, layer.timing.startMs + 50, maxEnd, Math.min(maxEnd, layer.timing.startMs + 1000));
  }
}

function constrainAllTimings() {
  const duration = getCompositionDuration();
  currentConfig.layout.groups.forEach(group => constrainGroupTiming(group, duration));
  currentConfig.layout.layers.forEach(layer => constrainLayerTiming(layer, currentConfig.layout.groups, duration));
}

function parseRgba(value) {
  if (!value) return { hex: "#000000", alpha: 1 };
  if (value.startsWith("#")) return { hex: normalizeHex(value), alpha: 1 };
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return { hex: "#000000", alpha: 1 };
  return { hex: rgbToHex(+match[1], +match[2], +match[3]), alpha: match[4] === undefined ? 1 : +match[4] };
}

function normalizeHex(value) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#ffffff";
}

function hexToRgb(hex) {
  const clean = normalizeHex(hex).slice(1);
  return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(value => value.toString(16).padStart(2, "0")).join("")}`;
}

function rgbaFromInputs(colorId, opacityId) {
  const { r, g, b } = hexToRgb($(colorId)?.value);
  const alpha = clampNumber($(opacityId)?.value, 0, 100, 100) / 100;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

function fileToBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function setStatus(message, type = "") {
  const element = $("status");
  element.textContent = message;
  element.classList.toggle("is-success", type === "success");
  element.classList.toggle("is-error", type === "error");
}

function fillGlobalForm(config) {
  $("themePreset").value = config.theme?.preset || "Custom";
  fieldMappings.forEach(([id, path]) => {
    const element = $(id);
    const value = getPath(config, path);
    if (element && value !== undefined && value !== null) element.value = value;
  });
  booleanFields.forEach(([id, path]) => {
    const element = $(id);
    if (element) element.checked = getPath(config, path) === true;
  });

  const background = parseRgba(config.colors.background);
  $("backgroundColor").value = background.hex;
  $("backgroundOpacity").value = Math.round(background.alpha * 100);
  const progressBackground = parseRgba(config.colors.progressBackground);
  $("progressBackgroundColor").value = progressBackground.hex;
  $("progressBackgroundOpacity").value = Math.round(progressBackground.alpha * 100);
  $("text").value = normalizeHex(config.colors.text);
  $("progress").value = normalizeHex(config.colors.progress);

  $("fftPreset").value = config.equalizer?.preset || "balanced";
  $("equalizerSensitivity").value = Math.round((config.equalizer?.sensitivity ?? 1.15) * 100);
  $("equalizerSmoothing").value = Math.round((config.equalizer?.smoothing ?? 0.65) * 100);
  $("equalizerOutputGain").value = Math.round((config.equalizer?.outputGain ?? 1) * 100);
  $("equalizerSpectralContrast").value = Math.round((config.equalizer?.spectralContrast ?? 1) * 100);
  $("equalizerVisualCurvePower").value = Math.round((config.equalizer?.visualCurvePower ?? 1) * 100);

  currentDefaultCover = config.albumArt?.defaultCover || DEFAULT_COVER;
  $("defaultCoverPreview").src = currentDefaultCover;
  $("previewCover").src = currentDefaultCover;
}

function readGlobalForm() {
  const config = structuredClone(currentConfig);
  config.theme.preset = $("themePreset").value || "Custom";

  fieldMappings.forEach(([id, path]) => {
    const element = $(id);
    if (!element) return;
    setPath(config, path, element.type === "number" ? Number(element.value) : element.value);
  });
  booleanFields.forEach(([id, path]) => {
    const element = $(id);
    if (element) setPath(config, path, element.checked);
  });

  config.colors.background = rgbaFromInputs("backgroundColor", "backgroundOpacity");
  config.colors.text = $("text").value;
  config.colors.progress = $("progress").value;
  config.colors.progressBackground = rgbaFromInputs("progressBackgroundColor", "progressBackgroundOpacity");
  config.equalizer.preset = $("fftPreset").value;
  config.equalizer.sensitivity = Number($("equalizerSensitivity").value) / 100;
  config.equalizer.smoothing = Number($("equalizerSmoothing").value) / 100;
  config.equalizer.outputGain = Number($("equalizerOutputGain").value) / 100;
  config.equalizer.spectralContrast = Number($("equalizerSpectralContrast").value) / 100;
  config.equalizer.visualCurvePower = Number($("equalizerVisualCurvePower").value) / 100;
  config.albumArt.defaultCover = currentDefaultCover;
  config.layout = normalizeLayout(currentConfig.layout, config);
  return config;
}

function getSelectedItem() {
  const collection = selection.type === "group" ? currentConfig.layout.groups : currentConfig.layout.layers;
  return collection.find(item => item.id === selection.id) || null;
}

function getGroup(id) {
  return currentConfig.layout.groups.find(group => group.id === id) || null;
}

function activateSidebarPane(name) {
  const inspectorActive = name === "inspector";
  $("inspectorTab").classList.toggle("is-active", inspectorActive);
  $("globalSettingsTab").classList.toggle("is-active", !inspectorActive);
  $("inspectorPane").classList.toggle("is-active", inspectorActive);
  $("globalSettingsPane").classList.toggle("is-active", !inspectorActive);
  $("inspectorType").hidden = !inspectorActive;
}

function renderContextualSettings(item) {
  document.querySelectorAll("[data-context]").forEach(element => {
    const contexts = (element.dataset.context || "").split(/\s+/).filter(Boolean);
    element.classList.toggle("is-applicable", contexts.includes(item.id));
  });
  renderDynamicObjectSettings(item);
  $("contextualSettings").hidden = !document.querySelector("#contextualSettings .context-setting.is-applicable");
}

function renderDynamicObjectSettings(item) {
  const panel = $("dynamicObjectSettings");
  const isDynamic = selection.type === "layer" && Boolean(item.templateId);
  panel.classList.toggle("is-applicable", isDynamic);
  if (!isDynamic) {
    panel.innerHTML = "";
    return;
  }

  const props = item.properties ||= {};
  if (item.kind === "text") {
    props.fontWeight ??= 800;
    props.letterSpacing ??= 0;
    props.accentWord ??= "";
    props.accentColor ??= "#74ff70";
  }
  if (item.kind === "equalizer") {
    props.style ??= "bars";
    props.gap ??= 3;
  }
  if (item.kind === "image") {
    props.outline ??= 0;
    props.outlineColor ??= "#ffffff";
  }
  const fields = [];
  const labels = currentLanguage === "ru"
    ? { width: "Ширина", height: "Высота", size: "Размер", fontSize: "Размер шрифта", color: "Цвет", radius: "Скругление", bars: "Бары", binding: "Данные", customText: "Свой текст", weight: "Толщина шрифта", spacing: "Расстояние между буквами", style: "Стиль", gap: "Зазор", outline: "Обводка", outlineColor: "Цвет обводки", accentWord: "Акцентное слово", accentColor: "Цвет акцента" }
    : { width: "Width", height: "Height", size: "Size", fontSize: "Font size", color: "Color", radius: "Radius", bars: "Bars", binding: "Data binding", customText: "Custom text", weight: "Font weight", spacing: "Letter spacing", style: "Style", gap: "Gap", outline: "Outline", outlineColor: "Outline color", accentWord: "Accent word", accentColor: "Accent color" };
  const numberField = (key, label, min = 1, max = 2000) => fields.push(`<label class="field field-stack"><span>${label}</span><input type="number" min="${min}" max="${max}" data-object-prop="${key}" value="${Number(props[key] ?? 0)}" /></label>`);
  const colorField = (key, label) => fields.push(`<label class="field marker-field"><span>${label}</span><input type="color" data-object-prop="${key}" value="${normalizeHex(props[key] || "#ffffff")}" /></label>`);

  if (["block", "image", "text", "time", "progress", "equalizer", "ticker"].includes(item.kind)) numberField("width", labels.width);
  if (["block", "image", "progress", "equalizer", "ticker"].includes(item.kind)) numberField("height", labels.height);
  if (item.kind === "disc") numberField("size", labels.size);
  if (["text", "time", "ticker"].includes(item.kind)) numberField("fontSize", labels.fontSize, 6, 300);
  if (["block", "text", "time", "progress", "equalizer", "ticker"].includes(item.kind)) colorField("color", labels.color);
  if (["block", "image"].includes(item.kind)) numberField("borderRadius", labels.radius, 0, 500);
  if (item.kind === "image") {
    numberField("outline", labels.outline, 0, 30);
    colorField("outlineColor", labels.outlineColor);
  }
  if (item.kind === "disc") {
    fields.push(`<label class="field field-stack"><span>${labels.style}</span><select data-object-prop="style"><option value="classic">Classic vinyl</option><option value="cd">CD</option><option value="animeCd">Anime glossy CD</option></select></label>`);
  }
  if (item.kind === "equalizer") {
    numberField("barCount", labels.bars, 4, 120);
    numberField("gap", labels.gap, 0, 20);
    fields.push(`<label class="field field-stack"><span>${labels.style}</span><select data-object-prop="style"><option value="bars">Bars</option><option value="neon">Neon</option><option value="waveform">Waveform</option><option value="pulse">Pulse</option></select></label>`);
  }
  if (item.kind === "text") {
    fields.push(`<label class="field field-stack"><span>${labels.binding}</span><select data-object-prop="binding"><option value="title">Title</option><option value="artist">Artist</option><option value="custom">Custom</option></select></label>`);
    fields.push(`<label class="field field-stack"><span>${labels.customText}</span><input type="text" data-object-prop="text" value="${String(props.text || "").replaceAll('"', '&quot;')}" /></label>`);
    numberField("fontWeight", labels.weight, 100, 1000);
    numberField("letterSpacing", labels.spacing, -10, 40);
    fields.push(`<label class="field field-stack"><span>${labels.accentWord}</span><input type="text" data-object-prop="accentWord" value="${String(props.accentWord || "").replaceAll('"', '&quot;')}" /></label>`);
    colorField("accentColor", labels.accentColor);
  }

  panel.innerHTML = `<h3>${currentLanguage === "ru" ? "Параметры объекта" : "Object properties"}</h3>${fields.join("")}`;
  panel.querySelectorAll("[data-object-prop]").forEach(input => {
    if (input.tagName === "SELECT") input.value = props[input.dataset.objectProp] || "title";
    input.addEventListener("input", () => {
      props[input.dataset.objectProp] = input.type === "number" ? Number(input.value) : input.value;
      markThemeDirty();
      applyLayoutToPreview();
    });
  });
}

function selectItem(type, id) {
  const collection = type === "group" ? currentConfig.layout.groups : currentConfig.layout.layers;
  if (!collection.some(item => item.id === id)) return;
  selection = { type, id };
  activateSidebarPane("inspector");
  renderInspector();
  renderTimeline();
  applyLayoutToPreview();
}

function renderInspector() {
  const item = getSelectedItem();
  if (!item) return;

  $("inspectorType").textContent = selection.type === "group"
    ? (currentLanguage === "ru" ? "ГРУППА" : "GROUP")
    : (currentLanguage === "ru" ? "ОБЪЕКТ" : "OBJECT");
  $("inspectorName").value = item.name || item.id;
  $("inspectorVisible").checked = item.visible !== false;
  $("inspectorLocked").checked = item.locked === true;
  $("inspectorMarker").value = normalizeHex(item.marker);
  $("inspectorX").value = item.x || 0;
  $("inspectorY").value = item.y || 0;
  $("inspectorScale").value = item.scale || 100;
  const parentGroup = selection.type === "layer" ? getGroup(item.groupId) : null;
  const groupStart = Number(parentGroup?.timing?.startMs || 0);
  const localTiming = selection.type === "layer" && parentGroup;
  const finiteParent = localTiming && !parentGroup.timing.untilNextTrack;
  const displayStart = localTiming ? Number(item.timing?.startMs || 0) - groupStart : Number(item.timing?.startMs || 0);
  const displayEnd = localTiming && item.timing?.endMs !== null ? Number(item.timing.endMs) - groupStart : item.timing?.endMs;
  const fillsBoundary = finiteParent ? item.timing?.untilGroupEnd === true : item.timing?.untilNextTrack === true;
  const groupDuration = parentGroup ? getTimingEnd(parentGroup) - groupStart : getCompositionDuration();
  $("inspectorStart").value = Math.max(0, displayStart);
  $("inspectorEnd").value = fillsBoundary ? "" : displayEnd ?? 10000;
  $("inspectorStart").max = String(Math.max(0, groupDuration - 50));
  $("inspectorEnd").max = String(groupDuration);
  $("inspectorEnd").disabled = fillsBoundary;
  $("inspectorUntilNext").checked = fillsBoundary;
  $("inspectorStartLabel").textContent = localTiming
    ? (currentLanguage === "ru" ? "Старт в группе, мс" : "Start in group, ms")
    : (currentLanguage === "ru" ? "Старт, мс" : "Start, ms");
  $("inspectorEndLabel").textContent = localTiming
    ? (currentLanguage === "ru" ? "Конец в группе, мс" : "End in group, ms")
    : (currentLanguage === "ru" ? "Конец, мс" : "End, ms");
  $("inspectorUntilLabel").textContent = t("infinityRecording");
  $("inspectorUntilNext").title = finiteParent
    ? (currentLanguage === "ru" ? "Объект будет отображаться до конца группы." : "The object stays visible until the group ends.")
    : (currentLanguage === "ru" ? "Объект будет отображаться до следующего трека." : "The object stays visible until the next track.");
  $("inspectorTimingScope").textContent = localTiming
    ? `${currentLanguage === "ru" ? "Окно группы" : "Group window"}: 0 – ${Math.round(groupDuration)} ms`
    : `${currentLanguage === "ru" ? "Окно композиции" : "Composition window"}: 0 – ${getCompositionDuration()} ms`;
  $("inspectorOpacity").value = item.effects?.opacity ?? 100;
  $("inspectorBlur").value = item.effects?.blur ?? 0;
  $("inspectorGlow").value = item.effects?.glow ?? 0;
  $("inspectorEnter").value = item.animation?.enter || "fade";
  $("inspectorExit").value = item.animation?.exit || "fade";
  $("inspectorEnterDuration").value = item.animation?.enterDurationMs ?? item.animation?.durationMs ?? 600;
  $("inspectorEnterEasing").value = item.animation?.enterEasing || item.animation?.easing || "ease-out";
  $("inspectorExitDuration").value = item.animation?.exitDurationMs ?? item.animation?.durationMs ?? 600;
  $("inspectorExitEasing").value = item.animation?.exitEasing || item.animation?.easing || "ease-out";
  renderContextualSettings(item);

  const groupField = $("inspectorGroupField");
  const groupSelect = $("inspectorGroup");
  groupField.hidden = selection.type !== "layer";
  groupSelect.innerHTML = `<option value="">${currentLanguage === "ru" ? "Без группы" : "No group"}</option>`;
  currentConfig.layout.groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    groupSelect.appendChild(option);
  });
  if (selection.type === "layer") groupSelect.value = item.groupId || "";

  const group = selection.type === "layer" ? getGroup(item.groupId) : item;
  $("transformHint").textContent = selection.type === "layer" && group
    ? (currentLanguage === "ru" ? `Перетаскивание двигает объект «${item.name}». Выберите группу на таймлайне для общего изменения.` : `Drag moves “${item.name}”. Select its group on the Timeline for a shared transform.`)
    : (currentLanguage === "ru" ? "Перетаскивайте выбранную группу на холсте или задайте точные координаты." : "Drag the selected group on the Canvas or enter exact coordinates.");

  $("deleteGroupBtn").disabled = selection.type !== "group";
}

function updateSelectedFromInspector() {
  const item = getSelectedItem();
  if (!item) return;

  item.name = $("inspectorName").value.trim() || item.id;
  item.visible = $("inspectorVisible").checked;
  item.locked = $("inspectorLocked").checked;
  item.marker = $("inspectorMarker").value;
  item.x = clampNumber($("inspectorX").value, -10000, 10000, 0);
  item.y = clampNumber($("inspectorY").value, -10000, 10000, 0);
  item.scale = clampNumber($("inspectorScale").value, 10, 400, 100);
  if (selection.type === "layer") item.groupId = $("inspectorGroup").value || null;
  const parentGroup = selection.type === "layer" ? getGroup(item.groupId) : null;
  const groupStart = Number(parentGroup?.timing?.startMs || 0);
  const finiteParent = parentGroup && !parentGroup.timing.untilNextTrack;
  const startInput = clampNumber($("inspectorStart").value, 0, 3600000, 0);
  if (item.timing.endMs !== null && Number.isFinite(Number(item.timing.endMs))) {
    item.timing.finiteEndMs = Number(item.timing.endMs);
  }
  const storedFiniteEnd = item.timing.finiteEndMs !== null && item.timing.finiteEndMs !== undefined
    ? Number(item.timing.finiteEndMs) - groupStart
    : startInput + 1000;
  const rawEnd = $("inspectorEnd").value.trim();
  const endInput = rawEnd === ""
    ? clampNumber(storedFiniteEnd, startInput + 50, 3600000, startInput + 1000)
    : clampNumber(rawEnd, startInput + 50, 3600000, startInput + 1000);
  item.timing.startMs = groupStart + startInput;
  if (finiteParent) {
    item.timing.untilNextTrack = false;
    item.timing.untilGroupEnd = $("inspectorUntilNext").checked;
    item.timing.endMs = item.timing.untilGroupEnd ? getTimingEnd(parentGroup) : groupStart + endInput;
  } else {
    item.timing.untilGroupEnd = false;
    item.timing.untilNextTrack = $("inspectorUntilNext").checked;
    item.timing.endMs = item.timing.untilNextTrack ? null : groupStart + endInput;
  }
  if (item.timing.endMs !== null) item.timing.finiteEndMs = Number(item.timing.endMs);
  item.effects.opacity = clampNumber($("inspectorOpacity").value, 0, 100, 100);
  item.effects.blur = clampNumber($("inspectorBlur").value, 0, 80, 0);
  item.effects.glow = clampNumber($("inspectorGlow").value, 0, 100, 0);
  item.animation.enter = $("inspectorEnter").value;
  item.animation.exit = $("inspectorExit").value;
  item.animation.enterDurationMs = clampNumber($("inspectorEnterDuration").value, 0, 10000, 600);
  item.animation.enterEasing = $("inspectorEnterEasing").value;
  item.animation.exitDurationMs = clampNumber($("inspectorExitDuration").value, 0, 10000, 600);
  item.animation.exitEasing = $("inspectorExitEasing").value;
  item.animation.durationMs = item.animation.enterDurationMs;
  item.animation.easing = item.animation.enterEasing;
  constrainAllTimings();
  $("inspectorEnd").disabled = finiteParent ? item.timing.untilGroupEnd : item.timing.untilNextTrack;
  syncLegacyFromLayout();
  markThemeDirty();
  updateEditor();
}

function syncLegacyFromLayout() {
  const full = getGroup("full-card-group");
  const ticker = getGroup("ticker-group");
  if (full) {
    currentConfig.timings.fullVisibleMs = full.timing.untilNextTrack
      ? currentConfig.timings.fullVisibleMs
      : Math.max(0, Number(full.timing.endMs || 0));
    currentConfig.animations.fullEnter = full.animation.enter;
    currentConfig.animations.fullExit = full.animation.exit;
    currentConfig.timings.exitMs = full.animation.exitDurationMs ?? full.animation.durationMs;
  }
  if (ticker) {
    currentConfig.animations.tickerEnter = ticker.animation.enter;
    currentConfig.animations.tickerExit = ticker.animation.exit || "none";
  }
  fillLegacySyncFields();
}

function fillLegacySyncFields() {
  $("fullVisibleMs").value = currentConfig.timings.fullVisibleMs;
  $("exitMs").value = currentConfig.timings.exitMs;
  $("fullEnterAnimation").value = currentConfig.animations.fullEnter;
  $("fullExitAnimation").value = currentConfig.animations.fullExit;
  $("tickerEnterAnimation").value = currentConfig.animations.tickerEnter;
}

function syncLayoutFromLegacyInput(id) {
  const full = getGroup("full-card-group");
  const ticker = getGroup("ticker-group");
  if (!full || !ticker) return;

  if (id === "fullVisibleMs") {
    const previousEnd = full.timing.endMs;
    const nextEnd = Math.max(100, Number(currentConfig.timings.fullVisibleMs || 10000));
    full.timing.endMs = nextEnd;
    full.timing.untilNextTrack = false;
    ticker.timing.startMs = nextEnd;
    currentConfig.layout.layers.forEach(layer => {
      if (layer.groupId === full.id && !layer.timing.untilNextTrack && layer.timing.endMs === previousEnd) layer.timing.endMs = nextEnd;
      if (layer.groupId === ticker.id && layer.timing.startMs === previousEnd) layer.timing.startMs = nextEnd;
    });
  }
  if (id === "fullEnterAnimation") full.animation.enter = currentConfig.animations.fullEnter;
  if (id === "fullExitAnimation") full.animation.exit = currentConfig.animations.fullExit;
  if (id === "tickerEnterAnimation") ticker.animation.enter = currentConfig.animations.tickerEnter;
  if (id === "exitMs") {
    full.animation.exitDurationMs = Number(currentConfig.timings.exitMs || 600);
    ticker.animation.exitDurationMs = Number(currentConfig.timings.exitMs || 600);
  }
}

function updateEditor() {
  timelineDurationMs = calculateTimelineDuration();
  previewTimeMs = Math.min(previewTimeMs, timelineDurationMs);
  $("compositionDurationSec").value = String(Math.round(timelineDurationMs / 1000));
  updatePreview(currentConfig);
  renderTimeline();
  renderInspector();
}

function updatePreview(config) {
  const previewFull = $("previewFull");
  const previewCard = $("previewCard");
  const previewTicker = $("previewTicker");
  const previewCover = $("previewCover");
  const previewVinyl = $("previewVinyl");
  const canvasBackground = getStoredCanvasBackground() || config.layout?.canvas?.backgroundColor || DEFAULT_CANVAS_BACKGROUND;

  config.layout.canvas.backgroundColor = canvasBackground;
  $("canvasSurface").style.backgroundColor = canvasBackground;
  $("canvasBackgroundColor").value = canvasBackground;

  document.documentElement.style.setProperty("--preview-cover-size", `${config.sizes.coverSize}px`);
  document.documentElement.style.setProperty("--preview-vinyl-size", `${config.sizes.vinylSize}px`);
  document.documentElement.style.setProperty("--preview-particle-color", config.particles.color);
  previewFull.style.left = `${config.position.left}px`;
  previewFull.style.bottom = `${config.position.fullBottom}px`;
  previewTicker.style.left = `${config.position.left}px`;
  previewTicker.style.bottom = `${config.position.tickerBottom}px`;
  previewCard.style.width = `${config.sizes.fullCardWidth}px`;
  previewTicker.style.width = `${config.sizes.tickerWidth}px`;
  previewTicker.style.height = `${config.sizes.tickerHeight}px`;
  previewCover.style.width = `${config.sizes.coverSize}px`;
  previewCover.style.height = `${config.sizes.coverSize}px`;
  previewCover.src = config.albumArt.defaultCover || DEFAULT_COVER;
  previewVinyl.style.width = `${config.sizes.vinylSize}px`;
  previewVinyl.style.height = `${config.sizes.vinylSize}px`;
  previewVinyl.style.left = `${config.sizes.coverSize * 0.2}px`;

  [previewCard, previewTicker].forEach(element => {
    element.style.background = config.colors.background;
    element.style.color = config.colors.text;
    element.style.fontFamily = `"${config.font.family}", Arial, sans-serif`;
  });
  $("previewTitle").style.fontSize = `${config.font.titleSize}px`;
  $("previewArtist").style.fontSize = `${config.font.artistSize}px`;
  $("previewTickerTitle").style.fontSize = `${config.font.tickerSize}px`;
  document.querySelectorAll(".preview-progress-bar").forEach(element => element.style.background = config.colors.progress);
  document.querySelectorAll(".preview-progress").forEach(element => element.style.background = config.colors.progressBackground);
  $("defaultCoverPreview").src = config.albumArt.defaultCover || DEFAULT_COVER;

  applyPreviewTickerStyle(config.ticker.style);
  applyPreviewCardStyle(config.fullCard.style);
  applyPreviewVinylStyle(config.vinyl?.style || "classic");
  createPreviewEqualizer(config);
  applyLayoutToPreview();
  updatePreviewTimeLabel();
}

function applyPreviewTickerStyle(style) {
  const element = $("previewTicker");
  [...element.classList].filter(name => name.startsWith("preview-ticker-style-")).forEach(name => element.classList.remove(name));
  element.classList.add(`preview-ticker-style-${style || "pill"}`);
}

function applyPreviewCardStyle(style) {
  const element = $("previewCard");
  [...element.classList].filter(name => name.startsWith("preview-card-style-")).forEach(name => element.classList.remove(name));
  element.classList.add(`preview-card-style-${style || "glass"}`);
}

function applyPreviewVinylStyle(style) {
  const element = $("previewVinyl");
  [...element.classList].filter(name => name.startsWith("preview-vinyl-style-")).forEach(name => element.classList.remove(name));
  element.classList.add(`preview-vinyl-style-${style}`);
}

function createPreviewEqualizer(config) {
  const equalizer = $("previewEqualizer");
  const count = Math.max(8, Math.min(120, Number(config.equalizer?.barCount || 64)));
  if (equalizer.children.length !== count) {
    equalizer.innerHTML = "";
    for (let index = 0; index < count; index++) {
      const bar = document.createElement("div");
      bar.className = "preview-eq-bar";
      bar.style.height = `${8 + ((index * 19) % 54)}px`;
      equalizer.appendChild(bar);
    }
  }
  const eq = config.equalizer || baseConfig.equalizer;
  equalizer.style.display = eq.enabled ? "" : "none";
  equalizer.style.left = `${eq.sidePadding ?? 14}px`;
  equalizer.style.right = `${eq.sidePadding ?? 14}px`;
  equalizer.style.bottom = `calc(100% + ${eq.offsetY ?? 0}px)`;
  equalizer.style.height = `${eq.height ?? 86}px`;
  equalizer.style.gap = `${eq.gap ?? 3}px`;
  equalizer.style.setProperty("--preview-eq-color", eq.colorMode === "custom" ? eq.color : config.colors.progress);
  equalizer.className = `preview-equalizer preview-equalizer-style-${eq.style || "solid"}`;
  equalizer.classList.toggle("preview-eq-glow", Boolean(eq.glow));
  equalizer.dataset.layerId = "ticker-equalizer";
  equalizer.querySelectorAll(".preview-eq-bar").forEach(bar => bar.style.width = `${eq.barWidth ?? 5}px`);
}

function buildFilter(effects) {
  const filters = [];
  if (Number(effects?.blur) > 0) filters.push(`blur(${effects.blur}px)`);
  if (Number(effects?.glow) > 0) filters.push(`drop-shadow(0 0 ${effects.glow}px currentColor)`);
  return filters.join(" ");
}

function isVisibleAt(item, timeMs) {
  if (item.visible === false) return false;
  const timing = item.timing || makeTiming(0, 10000);
  if (timeMs < Number(timing.startMs || 0)) return false;
  if (timing.untilNextTrack) return true;
  return timeMs < Number(timing.endMs || 0);
}

function getAnimationFrame(item, timeMs) {
  const timing = item.timing || makeTiming(0, 10000);
  const enterDuration = Math.max(1, Number(item.animation?.enterDurationMs ?? item.animation?.durationMs ?? 1));
  const exitDuration = Math.max(1, Number(item.animation?.exitDurationMs ?? item.animation?.durationMs ?? 1));
  let progress = 1;
  let animation = item.animation?.enter || "none";
  let phase = "enter";
  if (timeMs < timing.startMs + enterDuration) {
    progress = Math.max(0, Math.min(1, (timeMs - timing.startMs) / enterDuration));
  } else if (!timing.untilNextTrack && timeMs > timing.endMs - exitDuration) {
    progress = Math.max(0, Math.min(1, (timing.endMs - timeMs) / exitDuration));
    animation = item.animation?.exit || "none";
    phase = "exit";
  }

  if (animation === "none" || progress >= 1) return { x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 };
  const distance = 140 * (1 - progress);
  const sign = phase === "exit" ? -1 : 1;
  if (animation === "rollRight") return { x: -220 * (1 - progress) * sign, y: 0, opacity: progress, scale: 1, rotate: -360 * (1 - progress) * sign };
  if (animation === "slideLeft") return { x: distance * sign, y: 0, opacity: progress, scale: 1 };
  if (animation === "slideRight") return { x: -distance * sign, y: 0, opacity: progress, scale: 1 };
  if (animation === "slideUp") return { x: 0, y: distance * sign, opacity: progress, scale: 1 };
  if (animation === "slideDown") return { x: 0, y: -distance * sign, opacity: progress, scale: 1 };
  if (animation === "scale") return { x: 0, y: 0, opacity: progress, scale: 0.8 + progress * 0.2 };
  return { x: 0, y: 0, opacity: progress, scale: 1, rotate: 0 };
}

function getPreviewLayerNode(layerOrId) {
  const id = typeof layerOrId === "string" ? layerOrId : layerOrId?.id;
  const staticId = previewLayerMap[id];
  return staticId ? $(staticId) : document.querySelector(`[data-dynamic-layer-id="${CSS.escape(id || "")}"]`);
}

function syncDynamicPreviewLayers() {
  const root = $("dynamicPreviewLayers");
  const dynamicLayers = currentConfig.layout.layers.filter(layer => !previewLayerMap[layer.id]);
  const ids = new Set(dynamicLayers.map(layer => layer.id));
  root.querySelectorAll("[data-dynamic-layer-id]").forEach(node => {
    if (!ids.has(node.dataset.dynamicLayerId)) node.remove();
  });

  dynamicLayers.forEach(layer => {
    let node = root.querySelector(`[data-dynamic-layer-id="${CSS.escape(layer.id)}"]`);
    const tag = layer.kind === "image" ? "img" : "div";
    if (!node || node.tagName.toLowerCase() !== tag) {
      node?.remove();
      node = document.createElement(tag);
      node.dataset.dynamicLayerId = layer.id;
      node.dataset.layerId = layer.id;
      node.className = `dynamic-preview-object kind-${layer.kind || "block"}`;
      root.appendChild(node);
    }
    updateDynamicPreviewNode(node, layer);
  });
}

function updateDynamicPreviewNode(node, layer) {
  const props = layer.properties || {};
  node.className = `dynamic-preview-object kind-${layer.kind || "block"} style-${String(props.style || "default").toLowerCase()}`;
  node.dataset.layerId = layer.id;
  if (layer.kind === "image") {
    node.src = layer.assetData || currentLiveCover || currentDefaultCover || DEFAULT_COVER;
    node.alt = layer.name || "Artwork";
  } else if (layer.kind === "text") {
    const text = props.binding === "artist" ? "Серега Пират" : props.binding === "custom" ? props.text || "Custom text" : "я не пойду с тобой гулять";
    renderDynamicText(node, text, props);
  } else if (layer.kind === "time") {
    node.innerHTML = '<span class="time-current">00:42</span><span class="time-total">02:56</span>';
  } else if (layer.kind === "ticker") {
    node.textContent = "я не пойду с тобой гулять · Серега Пират";
  } else if (layer.kind === "equalizer") {
    const count = clampNumber(props.barCount, 4, 120, 32);
    if (node.children.length !== count) {
      node.innerHTML = "";
      for (let index = 0; index < count; index++) {
        const bar = document.createElement("i");
        bar.style.setProperty("--bar-height", `${18 + (index * 29) % 80}%`);
        node.appendChild(bar);
      }
    }
  } else if (!node.textContent && !["progress", "block", "disc"].includes(layer.kind)) {
    node.textContent = layer.name || "Object";
  }
  node.style.setProperty("--object-width", `${clampNumber(props.width, 10, 2000, 260)}px`);
  node.style.setProperty("--object-height", `${clampNumber(props.height, 2, 1200, 100)}px`);
  node.style.setProperty("--object-size", `${clampNumber(props.size, 10, 1200, 120)}px`);
  node.style.setProperty("--object-font-size", `${clampNumber(props.fontSize, 6, 300, 20)}px`);
  node.style.setProperty("--object-color", props.color || "#ffffff");
  node.style.setProperty("--object-gap", `${clampNumber(props.gap, 0, 20, 3)}px`);
  node.style.fontWeight = String(clampNumber(props.fontWeight, 100, 1000, 800));
  node.style.letterSpacing = `${clampNumber(props.letterSpacing, -10, 40, 0)}px`;
  node.style.borderRadius = `${clampNumber(props.borderRadius, 0, 500, layer.kind === "image" ? 12 : 0)}px`;
  node.style.border = Number(props.outline) > 0 ? `${clampNumber(props.outline, 0, 30, 0)}px solid ${props.outlineColor || "#ffffff"}` : "";
  if (props.glow) node.style.boxShadow = `0 0 ${props.glow}px ${props.color || "#ffffff"}`; else node.style.removeProperty("box-shadow");
}

function renderDynamicText(node, text, props) {
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

function applyLayoutToPreview() {
  if (!currentConfig.layout) return;
  syncDynamicPreviewLayers();
  document.querySelectorAll("[data-layer-id], [data-group-id]").forEach(element => {
    element.classList.remove("is-selected", "is-editor-hidden", "is-outside-time", "is-locked");
  });
  const activeGroupIds = new Set(currentConfig.layout.groups.map(group => group.id));
  const activeLayerIds = new Set(currentConfig.layout.layers.map(layer => layer.id));
  Object.entries(previewGroupMap).forEach(([id, nodeId]) => {
    if (!activeGroupIds.has(id)) $(nodeId)?.classList.add("is-editor-hidden");
  });
  Object.entries(previewLayerMap).forEach(([id, nodeId]) => {
    if (!activeLayerIds.has(id)) $(nodeId)?.classList.add("is-editor-hidden");
  });

  currentConfig.layout.groups.forEach((group, groupIndex) => {
    const nodeId = previewGroupMap[group.id];
    const node = nodeId ? $(nodeId) : null;
    if (!node) return;
    const frame = getAnimationFrame(group, previewTimeMs);
    node.style.translate = `${group.x + frame.x}px ${group.y + frame.y}px`;
    node.style.scale = `${(group.scale / 100) * frame.scale}`;
    node.style.rotate = `${frame.rotate || 0}deg`;
    node.style.opacity = `${(group.effects.opacity / 100) * frame.opacity}`;
    node.style.filter = buildFilter(group.effects);
    node.style.zIndex = String(currentConfig.layout.groups.length - groupIndex + 100);
    node.classList.toggle("is-editor-hidden", group.visible === false);
    node.classList.toggle("is-outside-time", !isVisibleAt(group, previewTimeMs));
    node.classList.toggle("is-locked", group.locked === true);
    node.classList.toggle("is-selected", selection.type === "group" && selection.id === group.id);
  });

  currentConfig.layout.layers.forEach((layer, index) => {
    const node = getPreviewLayerNode(layer);
    if (!node) return;
    const group = getGroup(layer.groupId);
    const isDynamic = Boolean(node.dataset.dynamicLayerId);
    const customGroup = group && (isDynamic || !runtimeGroupIds.has(group.id)) ? group : null;
    const frame = getAnimationFrame(layer, previewTimeMs);
    const x = layer.x + (customGroup?.x || 0) + frame.x;
    const y = layer.y + (customGroup?.y || 0) + frame.y;
    const groupScale = customGroup ? customGroup.scale / 100 : 1;
    const groupOpacity = customGroup ? customGroup.effects.opacity / 100 : 1;
    node.style.translate = `${x}px ${y}px`;
    node.style.scale = `${(layer.scale / 100) * groupScale * frame.scale}`;
    node.style.rotate = `${frame.rotate || 0}deg`;
    const opacity = (layer.effects.opacity / 100) * groupOpacity * frame.opacity;
    if (opacity < 0.999) node.style.opacity = String(opacity); else node.style.removeProperty("opacity");
    node.style.setProperty("--layout-opacity", String(opacity));
    node.style.filter = [buildFilter(customGroup?.effects), buildFilter(layer.effects)].filter(Boolean).join(" ");
    node.style.zIndex = String(currentConfig.layout.layers.length - index + 10);
    node.classList.toggle("is-editor-hidden", layer.visible === false || customGroup?.visible === false);
    node.classList.toggle("is-outside-time", !isVisibleAt(layer, previewTimeMs) || (group && !isVisibleAt(group, previewTimeMs)));
    node.classList.toggle("is-locked", layer.locked === true || group?.locked === true);
    node.classList.toggle("is-selected", selection.type === "layer" && selection.id === layer.id);
  });
  updateSelectionBounds();
}

function updateSelectionBounds() {
  const bounds = $("selectionBounds");
  const node = selection.type === "group"
    ? $(previewGroupMap[selection.id])
    : getPreviewLayerNode(selection.id);
  if (!canvasScale) {
    bounds.classList.remove("is-visible");
    return;
  }
  let rects = [];
  if (node && !node.classList.contains("is-editor-hidden") && !node.classList.contains("is-outside-time")) {
    rects = [node.getBoundingClientRect()];
  } else if (selection.type === "group") {
    const group = getGroup(selection.id);
    if (group && group.visible !== false && isVisibleAt(group, previewTimeMs)) {
      rects = currentConfig.layout.layers
        .filter(layer => layer.groupId === group.id && layer.visible !== false && isVisibleAt(layer, previewTimeMs))
        .map(layer => getPreviewLayerNode(layer)?.getBoundingClientRect())
        .filter(rect => rect && rect.width && rect.height);
    }
  }
  if (!rects.length) {
    bounds.classList.remove("is-visible");
    return;
  }
  const nodeRect = {
    left: Math.min(...rects.map(rect => rect.left)),
    top: Math.min(...rects.map(rect => rect.top)),
    right: Math.max(...rects.map(rect => rect.right)),
    bottom: Math.max(...rects.map(rect => rect.bottom))
  };
  nodeRect.width = nodeRect.right - nodeRect.left;
  nodeRect.height = nodeRect.bottom - nodeRect.top;
  const surfaceRect = $("canvasSurface").getBoundingClientRect();
  if (!nodeRect.width || !nodeRect.height) {
    bounds.classList.remove("is-visible");
    return;
  }

  bounds.style.left = `${(nodeRect.left - surfaceRect.left) / canvasScale}px`;
  bounds.style.top = `${(nodeRect.top - surfaceRect.top) / canvasScale}px`;
  bounds.style.width = `${nodeRect.width / canvasScale}px`;
  bounds.style.height = `${nodeRect.height / canvasScale}px`;
  bounds.style.setProperty("--selection-handle-size", `${16 / canvasScale}px`);
  bounds.classList.add("is-visible");
}

function calculateTimelineDuration() {
  return clampNumber(currentConfig.layout?.compositionDurationMs, 1000, 180000, 30000);
}

function getCompositionDuration() {
  return calculateTimelineDuration();
}

function renderTimeline() {
  timelineDurationMs = calculateTimelineDuration();
  renderRuler();
  const body = $("timelineBody");
  body.innerHTML = "";

  currentConfig.layout.groups.forEach(group => {
    body.appendChild(createTimelineRow(group, "group"));
    if (collapsedGroups.has(group.id)) return;
    currentConfig.layout.layers.filter(layer => layer.groupId === group.id).forEach(layer => {
      body.appendChild(createTimelineRow(layer, "layer"));
    });
  });

  body.appendChild(createFreeTimelineZone());
  const ungrouped = currentConfig.layout.layers.filter(layer => !layer.groupId);
  ungrouped.forEach(layer => body.appendChild(createTimelineRow(layer, "layer")));
  updatePlayhead();
}

function renderRuler() {
  const ruler = $("timelineRuler");
  ruler.innerHTML = `<div class="ruler-label">${t("layersControls")}</div><div class="ruler-track"></div>`;
  const track = ruler.querySelector(".ruler-track");
  const steps = Math.max(4, timelineDurationMs / 5000);
  for (let index = 0; index <= steps; index++) {
    const tick = document.createElement("div");
    tick.className = "ruler-tick";
    tick.style.left = `${(index / steps) * 100}%`;
    const label = document.createElement("span");
    label.textContent = `${Math.round((timelineDurationMs / steps * index) / 1000)}s`;
    tick.appendChild(label);
    track.appendChild(tick);
  }
}

function applyTimelineBarStyle(bar, item) {
  const start = Number(item.timing?.startMs || 0);
  const end = item.timing?.untilNextTrack ? timelineDurationMs : Number(item.timing?.endMs || start + 1000);
  bar.style.left = `${Math.min(100, start / timelineDurationMs * 100)}%`;
  bar.style.width = `${Math.max(.4, (end - start) / timelineDurationMs * 100)}%`;
  bar.classList.toggle("is-infinite", item.timing?.untilNextTrack === true);
  if (!item.timing?.untilNextTrack) bar.querySelector(".bar-infinity")?.remove();
  const group = currentConfig.layout.groups.find(candidate => candidate.id === item.groupId);
  const offset = Number(group?.timing?.startMs || 0);
  const label = bar.querySelector(".bar-range");
  if (label) label.textContent = `${((start - offset) / 1000).toFixed(1)}–${item.timing?.untilNextTrack ? "∞" : ((end - offset) / 1000).toFixed(1)}s`;
}

function refreshTimelineBar(item) {
  const row = [...document.querySelectorAll(".timeline-row")].find(element => element.dataset.itemId === item.id);
  const bar = row?.querySelector(".track-bar");
  if (bar) applyTimelineBarStyle(bar, item);
}

function setupTimingDrag(bar, item, type) {
  bar.title = type === "group" ? "Перетащить группу по timeline" : "Перетащить слой по timeline";
  bar.addEventListener("pointerdown", event => {
    if (event.target.closest(".timing-resize-handle")) return;
    const itemGroup = type === "layer" ? getGroup(item.groupId) : item;
    if (event.button !== 0 || item.locked || itemGroup?.locked) return;
    event.stopPropagation();
    event.preventDefault();

    selection = { type, id: item.id };
    activateSidebarPane("inspector");
    document.querySelectorAll(".timeline-row").forEach(row => {
      row.classList.toggle("is-selected", row.dataset.itemType === type && row.dataset.itemId === item.id);
    });
    renderInspector();

    const affected = type === "group"
      ? [item, ...currentConfig.layout.layers.filter(layer => layer.groupId === item.id)]
      : [item];
    const affectedIds = new Set(affected.map(affectedItem => affectedItem.id));
    const snapshots = affected.map(item => ({
      item,
      startMs: Number(item.timing?.startMs || 0),
      endMs: item.timing?.untilNextTrack ? null : Number(item.timing?.endMs || 0),
      untilNextTrack: item.timing?.untilNextTrack === true,
      untilGroupEnd: item.timing?.untilGroupEnd === true
    }));
    const earliestStart = Math.min(...snapshots.map(snapshot => snapshot.startMs));
    const latestBoundary = Math.max(...snapshots.map(snapshot => snapshot.untilNextTrack ? snapshot.startMs + 50 : snapshot.endMs));
    const anchoredToGroupEnd = type === "layer" && itemGroup && !itemGroup.timing.untilNextTrack && item.timing.untilGroupEnd;
    const allowedStart = type === "layer" && itemGroup ? Number(itemGroup.timing.startMs || 0) : 0;
    const allowedEnd = type === "layer" && itemGroup ? getTimingEnd(itemGroup) : timelineDurationMs;
    const minDelta = allowedStart - earliestStart;
    const maxDelta = anchoredToGroupEnd
      ? Math.max(minDelta, allowedEnd - earliestStart - 50)
      : Math.max(minDelta, allowedEnd - latestBoundary);
    const trackWidth = bar.parentElement.getBoundingClientRect().width || 1;
    const snapThresholdMs = Math.max(80, timelineDurationMs / trackWidth * 10);
    const snapTargets = [...currentConfig.layout.groups, ...currentConfig.layout.layers]
      .filter(target => !affectedIds.has(target.id))
      .flatMap(target => {
        const edges = [Number(target.timing?.startMs || 0)];
        if (!target.timing?.untilNextTrack) edges.push(Number(target.timing?.endMs || 0));
        return edges;
      });
    const startClientX = event.clientX;
    const pointerId = event.pointerId;
    let moved = false;

    bar.setPointerCapture(pointerId);

    const move = moveEvent => {
      if (moveEvent.pointerId !== pointerId) return;
      const rawDelta = (moveEvent.clientX - startClientX) / trackWidth * timelineDurationMs;
      let delta = Math.min(maxDelta, Math.max(minDelta, Math.round(rawDelta / 50) * 50));
      let snapEdge = null;
      let snapDistance = Infinity;
      snapTargets.forEach(targetEdge => {
        [targetEdge - earliestStart, ...(anchoredToGroupEnd ? [] : [targetEdge - latestBoundary])].forEach(candidate => {
          if (candidate < minDelta || candidate > maxDelta) return;
          const distance = Math.abs(candidate - delta);
          if (distance <= snapThresholdMs && distance < snapDistance) {
            snapDistance = distance;
            delta = candidate;
            snapEdge = targetEdge;
          }
        });
      });
      if (Math.abs(delta) > 0.001) moved = true;
      snapshots.forEach(snapshot => {
        snapshot.item.timing.startMs = snapshot.startMs + delta;
        snapshot.item.timing.endMs = snapshot.untilNextTrack ? null : anchoredToGroupEnd ? snapshot.endMs : snapshot.endMs + delta;
        refreshTimelineBar(snapshot.item);
      });
      applyLayoutToPreview();
      renderInspector();
      const guide = $("timelineSnapGuide");
      guide.classList.toggle("is-visible", snapEdge !== null);
      if (snapEdge !== null) guide.style.setProperty("--snap-pct", String(snapEdge / timelineDurationMs));
    };

    const end = endEvent => {
      if (endEvent.pointerId !== pointerId) return;
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", end);
      bar.removeEventListener("pointercancel", end);
      try { bar.releasePointerCapture(pointerId); } catch {}
      $("timelineSnapGuide").classList.remove("is-visible");
      if (moved) {
        constrainAllTimings();
        syncLegacyFromLayout();
        markThemeDirty();
      }
      renderTimeline();
      renderInspector();
    };

    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", end);
  });
}

function setupTimingResize(handle, item, type, edge) {
  handle.title = edge === "start"
    ? (currentLanguage === "ru" ? "Изменить начало тайминга" : "Trim timing start")
    : (currentLanguage === "ru" ? "Изменить конец тайминга" : "Trim timing end");
  handle.addEventListener("pointerdown", event => {
    const parentGroup = type === "layer" ? getGroup(item.groupId) : null;
    if (event.button !== 0 || item.locked || parentGroup?.locked) return;
    event.stopPropagation();
    event.preventDefault();

    selection = { type, id: item.id };
    activateSidebarPane("inspector");
    renderInspector();

    const track = handle.closest(".track-cell");
    const rect = track?.getBoundingClientRect();
    if (!rect?.width) return;
    const pointerId = event.pointerId;
    const originalStart = Number(item.timing?.startMs || 0);
    const originalEnd = item.timing?.untilNextTrack ? timelineDurationMs : Number(item.timing?.endMs || originalStart + 1000);
    const groupStart = Number(parentGroup?.timing?.startMs || 0);
    const groupEnd = parentGroup ? getTimingEnd(parentGroup) : timelineDurationMs;
    const minTime = edge === "start" ? groupStart : originalStart + 50;
    const maxTime = edge === "start" ? originalEnd - 50 : groupEnd;
    const affected = type === "group"
      ? [item, ...currentConfig.layout.layers.filter(layer => layer.groupId === item.id)]
      : [item];
    const affectedIds = new Set(affected.map(candidate => candidate.id));
    const snapTargets = [...currentConfig.layout.groups, ...currentConfig.layout.layers]
      .filter(candidate => !affectedIds.has(candidate.id))
      .flatMap(candidate => {
        const points = [Number(candidate.timing?.startMs || 0)];
        if (!candidate.timing?.untilNextTrack) points.push(Number(candidate.timing?.endMs || 0));
        return points;
      });
    const snapThresholdMs = Math.max(80, timelineDurationMs / rect.width * 10);
    let moved = false;

    handle.setPointerCapture(pointerId);

    const move = moveEvent => {
      if (moveEvent.pointerId !== pointerId) return;
      const ratio = Math.min(1, Math.max(0, (moveEvent.clientX - rect.left) / rect.width));
      let nextTime = Math.round((ratio * timelineDurationMs) / 50) * 50;
      nextTime = Math.min(maxTime, Math.max(minTime, nextTime));
      let snapTime = null;
      let snapDistance = Infinity;
      snapTargets.forEach(target => {
        const distance = Math.abs(target - nextTime);
        if (target >= minTime && target <= maxTime && distance <= snapThresholdMs && distance < snapDistance) {
          nextTime = target;
          snapTime = target;
          snapDistance = distance;
        }
      });

      if (edge === "start") {
        item.timing.startMs = nextTime;
      } else {
        item.timing.untilNextTrack = false;
        item.timing.untilGroupEnd = false;
        item.timing.endMs = nextTime;
        item.timing.finiteEndMs = nextTime;
      }

      if (type === "group") {
        if (edge === "end") {
          currentConfig.layout.layers.filter(layer => layer.groupId === item.id).forEach(layer => {
            if (layer.timing.untilNextTrack) {
              layer.timing.untilNextTrack = false;
              layer.timing.untilGroupEnd = true;
              layer.timing.endMs = nextTime;
            }
          });
        }
        constrainGroupTiming(item, timelineDurationMs);
        currentConfig.layout.layers.filter(layer => layer.groupId === item.id).forEach(layer => constrainLayerTiming(layer));
      } else {
        constrainLayerTiming(item);
      }

      affected.forEach(refreshTimelineBar);
      applyLayoutToPreview();
      renderInspector();
      const guide = $("timelineSnapGuide");
      guide.classList.toggle("is-visible", snapTime !== null);
      if (snapTime !== null) guide.style.setProperty("--snap-pct", String(snapTime / timelineDurationMs));
      moved = moved || Math.abs(nextTime - (edge === "start" ? originalStart : originalEnd)) > 0.001;
    };

    const end = endEvent => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      try { handle.releasePointerCapture(pointerId); } catch {}
      $("timelineSnapGuide").classList.remove("is-visible");
      if (moved) {
        constrainAllTimings();
        syncLegacyFromLayout();
        markThemeDirty();
      }
      renderTimeline();
      renderInspector();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  });
}

function createTimelineRow(item, type) {
  const row = document.createElement("div");
  row.className = `timeline-row ${type === "group" ? "is-group" : "layer-row-child"}`;
  row.classList.toggle("is-selected", selection.type === type && selection.id === item.id);
  row.dataset.itemType = type;
  row.dataset.itemId = item.id;

  const cell = document.createElement("div");
  cell.className = "layer-cell";

  const handle = document.createElement("button");
  handle.className = "drag-handle";
  handle.textContent = type === "group" ? (collapsedGroups.has(item.id) ? "▸" : "▾") : "⠿";
  handle.title = type === "group" ? "Свернуть группу" : "Перетащить для изменения Z-order";
  if (type === "group") {
    handle.addEventListener("click", event => {
      event.stopPropagation();
      if (handle.dataset.dragMoved === "1") return;
      if (collapsedGroups.has(item.id)) collapsedGroups.delete(item.id); else collapsedGroups.add(item.id);
      renderTimeline();
    });
  }
  setupNativeTimelineStructureDrag(handle, row, item, type);

  const visibleButton = document.createElement("button");
  visibleButton.className = `row-icon-button ${item.visible === false ? "is-off" : ""}`;
  visibleButton.textContent = item.visible === false ? "○" : "◉";
  visibleButton.title = "Видимость";
  visibleButton.addEventListener("click", event => {
    event.stopPropagation();
    item.visible = item.visible === false;
    markThemeDirty();
    updateEditor();
  });

  const lockButton = document.createElement("button");
  lockButton.className = `row-icon-button ${item.locked ? "" : "is-off"}`;
  lockButton.textContent = item.locked ? "▣" : "□";
  lockButton.title = "Lock";
  lockButton.addEventListener("click", event => {
    event.stopPropagation();
    item.locked = !item.locked;
    markThemeDirty();
    updateEditor();
  });

  const marker = document.createElement("span");
  marker.className = "color-marker";
  marker.style.background = item.marker;

  const name = document.createElement("span");
  name.className = "layer-name";
  name.textContent = item.name;
  name.title = item.name;
  name.dataset.kindLabel = type === "group"
    ? (currentLanguage === "ru" ? "ГРУППА · " : "GROUP · ")
    : (currentLanguage === "ru" ? "ОБЪЕКТ · " : "OBJ · ");

  const zIndex = document.createElement("span");
  zIndex.className = "z-index-label";
  if (type === "layer") zIndex.textContent = `#${currentConfig.layout.layers.indexOf(item) + 1}`;
  else zIndex.textContent = `${currentConfig.layout.layers.filter(layer => layer.groupId === item.id).length}${currentLanguage === "ru" ? "О" : "L"}`;

  const deleteButton = document.createElement("button");
  deleteButton.className = "row-icon-button row-delete-button";
  deleteButton.textContent = "🗑";
  deleteButton.title = type === "group" ? t("deleteGroup") : t("deleteLayer");
  deleteButton.addEventListener("click", event => {
    event.stopPropagation();
    deleteTimelineItem(type, item.id);
  });

  cell.append(handle, visibleButton, lockButton, marker, name, zIndex, deleteButton);
  cell.addEventListener("click", () => selectItem(type, item.id));

  const track = document.createElement("div");
  track.className = "track-cell";
  const bar = document.createElement("div");
  bar.className = `track-bar ${item.timing?.untilNextTrack ? "is-infinite" : ""}`;
  bar.style.setProperty("--marker", item.marker);
  applyTimelineBarStyle(bar, item);
  const range = document.createElement("span");
  range.className = "bar-range";
  const startResize = document.createElement("span");
  startResize.className = "timing-resize-handle is-start";
  const endResize = document.createElement("span");
  endResize.className = "timing-resize-handle is-end";
  bar.append(startResize, range, endResize);
  setupTimingResize(startResize, item, type, "start");
  setupTimingResize(endResize, item, type, "end");
  applyTimelineBarStyle(bar, item);
  if (item.timing?.untilNextTrack) {
    const infinity = document.createElement("span");
    infinity.className = "bar-infinity";
    infinity.textContent = "∞";
    bar.appendChild(infinity);
  }
  bar.addEventListener("click", event => {
    event.stopPropagation();
    selectItem(type, item.id);
  });
  setupTimingDrag(bar, item, type);
  track.appendChild(bar);
  row.append(cell, track);
  setupLibraryDropOnTimelineRow(row, item, type);
  setupNativeTimelineStructureDrop(row);
  return row;
}

function createFreeTimelineZone() {
  const row = document.createElement("div");
  row.className = "timeline-row timeline-free-zone";
  row.dataset.itemType = "free";
  row.innerHTML = `<div class="free-zone-label"><span>↳</span>${t("freeTimeline")}</div><div class="track-cell"></div>`;
  setupNativeTimelineStructureDrop(row);
  return row;
}

function setupNativeTimelineStructureDrag(handle, row, item, type) {
  handle.draggable = true;
  handle.addEventListener("dragstart", event => {
    handle.dataset.dragMoved = "1";
    row.classList.add("is-structure-source");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-music-timeline-item", JSON.stringify({ type, id: item.id }));
  });
  handle.addEventListener("dragend", () => {
    row.classList.remove("is-structure-source");
    document.querySelectorAll(".is-structure-drop").forEach(node => node.classList.remove("is-structure-drop"));
    setTimeout(() => { handle.dataset.dragMoved = "0"; }, 80);
  });
}

function setupNativeTimelineStructureDrop(row) {
  const hasStructurePayload = event => [...(event.dataTransfer?.types || [])].includes("application/x-music-timeline-item");
  row.addEventListener("dragover", event => {
    if (!hasStructurePayload(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    row.classList.add("is-structure-drop");
  });
  row.addEventListener("dragleave", event => {
    if (!row.contains(event.relatedTarget)) row.classList.remove("is-structure-drop");
  });
  row.addEventListener("drop", event => {
    if (!hasStructurePayload(event)) return;
    event.preventDefault();
    event.stopPropagation();
    row.classList.remove("is-structure-drop");
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/x-music-timeline-item"));
      moveTimelineStructureItem(payload.type, payload.id, row);
    } catch {}
  });
}

function setupTimelineStructureDrag(handle, item, type) {
  let drag = null;
  const clearTargets = () => document.querySelectorAll(".is-structure-drop").forEach(node => node.classList.remove("is-structure-drop"));
  const move = event => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7) {
      drag.moved = true;
      drag.ghost = document.createElement("div");
      drag.ghost.className = "timeline-structure-ghost";
      drag.ghost.textContent = `${type === "group" ? "▣" : "⠿"} ${item.name}`;
      document.body.appendChild(drag.ghost);
      handle.dataset.dragMoved = "1";
    }
    if (!drag.moved) return;
    drag.ghost.style.left = `${event.clientX + 12}px`;
    drag.ghost.style.top = `${event.clientY + 12}px`;
    clearTargets();
    drag.targetRow = document.elementFromPoint(event.clientX, event.clientY)?.closest(".timeline-row") || null;
    drag.targetRow?.classList.add("is-structure-drop");
    event.preventDefault();
  };
  const finish = event => {
    if (!drag) return;
    if (drag.moved) {
      moveTimelineStructureItem(type, item.id, drag.targetRow);
      event.preventDefault();
    }
    drag.ghost?.remove();
    clearTargets();
    document.removeEventListener("mousemove", move, true);
    document.removeEventListener("mouseup", finish, true);
    const moved = drag.moved;
    drag = null;
    if (moved) setTimeout(() => { handle.dataset.dragMoved = "0"; }, 80);
  };
  handle.addEventListener("mousedown", event => {
    if (event.button !== 0) return;
    drag = { startX: event.clientX, startY: event.clientY, moved: false, ghost: null, targetRow: null };
    document.addEventListener("mousemove", move, true);
    document.addEventListener("mouseup", finish, true);
  });
}

function moveTimelineStructureItem(type, sourceId, targetRow) {
  if (!targetRow || targetRow.dataset.itemId === sourceId) return;
  const targetType = targetRow.dataset.itemType;
  if (type === "group") {
    const groups = currentConfig.layout.groups;
    const sourceIndex = groups.findIndex(group => group.id === sourceId);
    if (sourceIndex < 0) return;
    const targetGroupId = targetType === "group"
      ? targetRow.dataset.itemId
      : targetType === "layer"
        ? currentConfig.layout.layers.find(layer => layer.id === targetRow.dataset.itemId)?.groupId
        : null;
    const [source] = groups.splice(sourceIndex, 1);
    const targetIndex = targetGroupId ? groups.findIndex(group => group.id === targetGroupId) : groups.length;
    groups.splice(targetIndex < 0 ? groups.length : targetIndex, 0, source);
  } else {
    const layers = currentConfig.layout.layers;
    const sourceIndex = layers.findIndex(layer => layer.id === sourceId);
    if (sourceIndex < 0) return;
    const [source] = layers.splice(sourceIndex, 1);
    let targetLayerId = null;
    if (targetType === "group") source.groupId = targetRow.dataset.itemId;
    else if (targetType === "layer") {
      const targetLayer = layers.find(layer => layer.id === targetRow.dataset.itemId);
      source.groupId = targetLayer?.groupId || null;
      targetLayerId = targetLayer?.id || null;
    } else source.groupId = null;
    const targetIndex = targetLayerId ? layers.findIndex(layer => layer.id === targetLayerId) : layers.length;
    layers.splice(targetIndex < 0 ? layers.length : targetIndex, 0, source);
    constrainLayerTiming(source);
  }
  markThemeDirty(true);
  updateEditor();
}

function deleteTimelineItem(type, id) {
  if (type === "layer") {
    const index = currentConfig.layout.layers.findIndex(layer => layer.id === id);
    if (index < 0) return;
    currentConfig.layout.layers.splice(index, 1);
  } else {
    const group = getGroup(id);
    if (!group) return;
    const childCount = currentConfig.layout.layers.filter(layer => layer.groupId === id).length;
    if (childCount) {
      const question = currentLanguage === "ru"
        ? `Удалить группу «${group.name}» и объектов внутри: ${childCount}? Ctrl+Z восстановит их.`
        : `Delete “${group.name}” and its ${childCount} object(s)? Ctrl+Z can restore them.`;
      if (!window.confirm(question)) return;
    }
    currentConfig.layout.groups = currentConfig.layout.groups.filter(candidate => candidate.id !== id);
    currentConfig.layout.layers = currentConfig.layout.layers.filter(layer => layer.groupId !== id);
    collapsedGroups.delete(id);
  }
  const fallbackGroup = currentConfig.layout.groups[0];
  const fallbackLayer = currentConfig.layout.layers[0];
  selection = fallbackGroup
    ? { type: "group", id: fallbackGroup.id }
    : { type: "layer", id: fallbackLayer?.id || "" };
  markThemeDirty(true);
  updateEditor();
}

function getLibraryCategories() {
  return LIBRARY_CATEGORIES.map(category => ({
    ...category,
    items: category.id === "artwork" ? [...category.items, ...customLibraryAssets] : [...category.items]
  }));
}

function findLibraryItem(id) {
  return getLibraryCategories().flatMap(category => category.items).find(item => item.id === id) || null;
}

function localized(value) {
  return typeof value === "string" ? value : value?.[currentLanguage] || value?.ru || value?.en || "";
}

function renderLibrary() {
  const root = $("objectLibrary");
  if (!root) return;
  root.innerHTML = "";
  getLibraryCategories().forEach(category => {
    const details = document.createElement("details");
    details.className = "library-category";
    details.dataset.categoryId = category.id;
    const summary = document.createElement("summary");
    summary.innerHTML = `<span>${category.icon}</span><b>${localized(category.name)}</b><span class="library-category-count">${category.items.length}</span>`;
    const items = document.createElement("div");
    items.className = "library-items";
    if (!category.items.length) {
      items.innerHTML = `<div class="library-empty">${t("inDevelopment")}</div>`;
    }
    let activeSection = null;
    category.items.forEach(item => {
      if (item.section && item.section !== activeSection) {
        activeSection = item.section;
        const heading = document.createElement("div");
        heading.className = "library-subheading";
        heading.textContent = item.section === "in" ? "IN" : "OUT";
        items.appendChild(heading);
      }
      const card = document.createElement("button");
      card.type = "button";
      card.className = "library-object";
      card.draggable = false;
      card.dataset.libraryItem = item.id;
      const icon = item.assetData ? `<img src="${item.assetData}" alt="" />` : item.icon;
      card.innerHTML = `<span class="object-icon">${icon}</span><span>${localized(item.name)}</span><small>${localized(item.desc)}</small>`;
      card.addEventListener("click", () => previewLibraryItem(item, card));
      card.addEventListener("dragstart", event => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-music-library", JSON.stringify({ id: item.id, payloadType: item.payloadType }));
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
      setupPointerLibraryDrag(card, item);
      setupMouseLibraryDrag(card, item);
      items.appendChild(card);
    });
    details.append(summary, items);
    root.appendChild(details);
  });
}

function previewLibraryItem(item, card) {
  document.querySelectorAll(".library-object.is-previewed").forEach(node => node.classList.remove("is-previewed"));
  card?.classList.add("is-previewed");
  const preview = $("libraryPreview");
  const icon = item.assetData ? `<img src="${item.assetData}" alt="" />` : item.icon;
  preview.innerHTML = `<span class="library-preview-icon">${icon}</span><div><b>${localized(item.name)}</b><small>${localized(item.desc)} · ${currentLanguage === "ru" ? "Drag на объект, группу или Timeline" : "Drag to an object, group or Timeline"}</small></div>`;
}

function readLibraryPayload(event) {
  try {
    const raw = event.dataTransfer?.getData("application/x-music-library");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function isLibraryDrag(event) {
  return [...(event.dataTransfer?.types || [])].includes("application/x-music-library");
}

function getDropTime(event, row = null) {
  const track = row?.querySelector(".track-cell") || $("timelineRuler").querySelector(".ruler-track");
  if (!track) return 0;
  const rect = track.getBoundingClientRect();
  return clampNumber((event.clientX - rect.left) / Math.max(1, rect.width) * timelineDurationMs, 0, timelineDurationMs, 0);
}

function getDropTimeFromPoint(clientX, row = null) {
  const track = row?.querySelector(".track-cell") || $("timelineRuler").querySelector(".ruler-track");
  if (!track) return 0;
  const rect = track.getBoundingClientRect();
  return clampNumber((clientX - rect.left) / Math.max(1, rect.width) * timelineDurationMs, 0, timelineDurationMs, 0);
}

function setupPointerLibraryDrag(card, libraryItem) {
  let drag = null;
  card.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.pointerType === "mouse") return;
    drag?.ghost?.remove();
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, ghost: null, targetRow: null };
    card.setPointerCapture(event.pointerId);
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
  });
  card.addEventListener("pointermove", event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7) {
      drag.moved = true;
      drag.ghost = document.createElement("div");
      drag.ghost.className = "library-drag-ghost";
      drag.ghost.innerHTML = `<span>${libraryItem.icon}</span>${localized(libraryItem.name)}`;
      document.body.appendChild(drag.ghost);
      card.classList.add("is-dragging");
    }
    if (drag.moved) {
      drag.ghost.style.left = `${event.clientX + 12}px`;
      drag.ghost.style.top = `${event.clientY + 12}px`;
      document.querySelectorAll(".timeline-row.is-drop-target").forEach(row => row.classList.remove("is-drop-target"));
      drag.targetRow = document.elementFromPoint(event.clientX, event.clientY)?.closest(".timeline-row") || drag.targetRow;
      drag.targetRow?.classList.add("is-drop-target");
      event.preventDefault();
    }
  });
  const finish = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      dropLibraryItemAt(libraryItem, event.clientX, event.clientY, drag.targetRow);
      event.preventDefault();
    }
    try { card.releasePointerCapture(drag.pointerId); } catch {}
    drag.ghost?.remove();
    card.classList.remove("is-dragging");
    document.querySelectorAll(".timeline-row.is-drop-target").forEach(row => row.classList.remove("is-drop-target"));
    document.removeEventListener("pointerup", finish, true);
    document.removeEventListener("pointercancel", finish, true);
    drag = null;
  };
  card.addEventListener("pointerup", finish);
  card.addEventListener("pointercancel", finish);
}

function setupMouseLibraryDrag(card, libraryItem) {
  let drag = null;
  const move = event => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7) {
      drag.moved = true;
      drag.ghost = document.createElement("div");
      drag.ghost.className = "library-drag-ghost";
      drag.ghost.innerHTML = `<span>${libraryItem.icon}</span>${localized(libraryItem.name)}`;
      document.body.appendChild(drag.ghost);
      card.classList.add("is-dragging");
    }
    if (!drag.moved) return;
    drag.ghost.style.left = `${event.clientX + 12}px`;
    drag.ghost.style.top = `${event.clientY + 12}px`;
    document.querySelectorAll(".timeline-row.is-drop-target").forEach(row => row.classList.remove("is-drop-target"));
    drag.targetRow = document.elementFromPoint(event.clientX, event.clientY)?.closest(".timeline-row") || drag.targetRow;
    drag.targetRow?.classList.add("is-drop-target");
    event.preventDefault();
  };
  const finish = event => {
    if (!drag) return;
    if (drag.moved) {
      dropLibraryItemAt(libraryItem, event.clientX, event.clientY, drag.targetRow);
      event.preventDefault();
    }
    drag.ghost?.remove();
    card.classList.remove("is-dragging");
    document.querySelectorAll(".timeline-row.is-drop-target").forEach(row => row.classList.remove("is-drop-target"));
    document.removeEventListener("mousemove", move, true);
    document.removeEventListener("mouseup", finish, true);
    drag = null;
  };
  card.addEventListener("mousedown", event => {
    if (event.button !== 0) return;
    drag = { startX: event.clientX, startY: event.clientY, moved: false, ghost: null, targetRow: null };
    document.addEventListener("mousemove", move, true);
    document.addEventListener("mouseup", finish, true);
  });
}

function dropLibraryItemAt(libraryItem, clientX, clientY, preferredRow = null) {
  const target = document.elementFromPoint(clientX, clientY);
  const row = preferredRow || target?.closest(".timeline-row") || null;
  const targetType = row?.dataset.itemType;
  const targetItem = targetType === "group"
    ? getGroup(row.dataset.itemId)
    : currentConfig.layout.layers.find(layer => layer.id === row?.dataset.itemId) || null;
  const groupId = targetType === "group" ? targetItem?.id : targetItem?.groupId || null;
  if (row || target?.closest(".timeline-scroll")) {
    applyLibraryItemDrop(libraryItem, groupId, targetItem, getDropTimeFromPoint(clientX, row));
  }
}

function setupLibraryDropOnTimelineRow(row, item, type) {
  row.addEventListener("dragover", event => {
    if (!isLibraryDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    row.classList.add("is-drop-target");
  });
  row.addEventListener("dragleave", event => {
    if (!row.contains(event.relatedTarget)) row.classList.remove("is-drop-target");
  });
  row.addEventListener("drop", event => {
    if (!isLibraryDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    row.classList.remove("is-drop-target");
    const groupId = type === "group" ? item.id : item.groupId;
    handleLibraryDrop(event, groupId, item);
  });
}

function setupTimelineLibraryDropZone() {
  const timeline = document.querySelector(".timeline-scroll");
  timeline.addEventListener("dragover", event => {
    if (!isLibraryDrag(event)) return;
    event.preventDefault();
    timeline.classList.add("is-library-drop");
  });
  timeline.addEventListener("dragleave", event => {
    if (!timeline.contains(event.relatedTarget)) timeline.classList.remove("is-library-drop");
  });
  timeline.addEventListener("drop", event => {
    timeline.classList.remove("is-library-drop");
    const row = event.target.closest(".timeline-row");
    if (!isLibraryDrag(event) || (row && row.dataset.itemType !== "free")) return;
    event.preventDefault();
    handleLibraryDrop(event, null, null);
  });
}

function handleLibraryDrop(event, groupId, targetItem) {
  const payload = readLibraryPayload(event);
  const libraryItem = findLibraryItem(payload?.id);
  if (!libraryItem) return;
  applyLibraryItemDrop(libraryItem, groupId, targetItem, getDropTime(event, event.target.closest(".timeline-row")));
}

function applyLibraryItemDrop(libraryItem, groupId, targetItem, requestedStart) {
  if (libraryItem.payloadType === "object") {
    addLibraryObject(libraryItem, groupId, requestedStart);
    return;
  }
  if (!targetItem) {
    setStatus(currentLanguage === "ru" ? "Анимацию или эффект нужно бросить на объект или группу." : "Drop animations and effects on an object or group.", "error");
    return;
  }
  if (libraryItem.payloadType === "animation-in") {
    targetItem.animation.enter = libraryItem.value;
  } else if (libraryItem.payloadType === "animation-out") {
    targetItem.animation.exit = libraryItem.value;
  } else if (libraryItem.payloadType === "effect") {
    Object.assign(targetItem.effects, libraryItem.value || {});
  }
  selection = { type: currentConfig.layout.groups.includes(targetItem) ? "group" : "layer", id: targetItem.id };
  markThemeDirty();
  updateEditor();
  setStatus(`${localized(libraryItem.name)} → ${targetItem.name}`, "success");
}

function addLibraryObject(template, groupId, requestedStart) {
  const group = getGroup(groupId);
  const boundaryStart = Number(group?.timing?.startMs || 0);
  const boundaryEnd = group ? getTimingEnd(group) : getCompositionDuration();
  const startMs = clampNumber(Math.round(requestedStart / 50) * 50, boundaryStart, Math.max(boundaryStart, boundaryEnd - 50), boundaryStart);
  const endMs = Math.min(boundaryEnd, startMs + 5000);
  const id = `lib-${template.id}-${Date.now().toString(36)}`;
  const layer = normalizeItem(null, {
    id,
    name: localized(template.name),
    templateId: template.id,
    kind: template.kind,
    groupId: group?.id || null,
    marker: markerPalette[currentConfig.layout.layers.length % markerPalette.length],
    timing: { ...makeTiming(startMs, Math.max(startMs + 50, endMs)), untilGroupEnd: false },
    visible: true, locked: false,
    x: 720 + (currentConfig.layout.layers.length % 6) * 24,
    y: 410 + (currentConfig.layout.layers.length % 5) * 24,
    scale: 100,
    effects: makeEffects(),
    animation: makeAnimation("fade", "fade", 500),
    properties: structuredClone(template.properties || {}),
    assetData: template.assetData || null
  });
  currentConfig.layout.layers.unshift(layer);
  constrainLayerTiming(layer);
  previewTimeMs = Math.min(getCompositionDuration(), layer.timing.startMs + 100);
  markThemeDirty();
  selectItem("layer", layer.id);
  setStatus(`${localized(template.name)} ${currentLanguage === "ru" ? "добавлен" : "added"}`, "success");
}

async function uploadLibraryObject(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const assetData = await fileToBase64(file);
  const asset = {
    id: `custom-art-${Date.now().toString(36)}`,
    payloadType: "object",
    kind: "image",
    icon: "▧",
    name: { ru: file.name.replace(/\.[^.]+$/, ""), en: file.name.replace(/\.[^.]+$/, "") },
    desc: { ru: "Свой объект", en: "Custom asset" },
    properties: { width: 160, height: 160, borderRadius: 12, source: "asset" },
    assetData
  };
  customLibraryAssets.push(asset);
  saveCustomLibraryAssets();
  renderLibrary();
  const category = document.querySelector('[data-category-id="artwork"]');
  if (category) category.open = true;
  previewLibraryItem(asset, document.querySelector(`[data-library-item="${asset.id}"]`));
  event.target.value = "";
}

function formatTimelineTime(milliseconds) {
  const total = Math.max(0, Math.round(milliseconds));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const ms = total % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function updatePreviewTimeLabel() {
  $("previewTimeLabel").textContent = formatTimelineTime(previewTimeMs);
}

function updatePlayhead() {
  const pct = timelineDurationMs > 0 ? previewTimeMs / timelineDurationMs : 0;
  $("timelinePlayhead").style.setProperty("--timeline-pct", String(Math.max(0, Math.min(1, pct))));
}

function setPreviewTime(timeMs) {
  previewTimeMs = clampNumber(timeMs, 0, timelineDurationMs, 0);
  applyLayoutToPreview();
  updatePreviewTimeLabel();
  updatePlayhead();
}

function startTimelinePlayback() {
  stopTimelinePlayback(false);
  playbackOffset = previewTimeMs >= timelineDurationMs ? 0 : previewTimeMs;
  playbackStartedAt = performance.now();
  const tick = now => {
    const next = playbackOffset + (now - playbackStartedAt);
    if (next >= timelineDurationMs) {
      setPreviewTime(timelineDurationMs);
      stopTimelinePlayback(false);
      return;
    }
    setPreviewTime(next);
    playbackFrame = requestAnimationFrame(tick);
  };
  playbackFrame = requestAnimationFrame(tick);
}

function stopTimelinePlayback(reset = false) {
  if (playbackFrame) cancelAnimationFrame(playbackFrame);
  playbackFrame = null;
  if (reset) setPreviewTime(0);
}

function fitCanvas() {
  if (canvasController) canvasScale = canvasController.fit();
}

function updateCompositionDuration(event) {
  if (event.type === "input" && event.target.value === "") return;
  const rawSeconds = Number(event.target.value);
  if (event.type === "input" && !Number.isFinite(rawSeconds)) return;
  const seconds = clampNumber(rawSeconds, 1, 180, 30);
  currentConfig.layout.compositionDurationMs = Math.round(seconds * 1000);
  timelineDurationMs = currentConfig.layout.compositionDurationMs;
  constrainAllTimings();
  event.target.value = String(Math.round(seconds));
  markThemeDirty();
  updateEditor();
}

function setupCanvasDragging() {
  const surface = $("canvasSurface");
  let drag = null;

  surface.addEventListener("pointerdown", event => {
    const layerNode = event.target.closest("[data-layer-id]");
    const groupNode = event.target.closest("[data-group-id]");
    if (!layerNode && !groupNode) return;

    const clickedLayer = layerNode
      ? currentConfig.layout.layers.find(item => item.id === layerNode.dataset.layerId)
      : null;
    const keepSelectedGroup = selection.type === "group" && clickedLayer?.groupId === selection.id;
    const type = keepSelectedGroup || !layerNode ? "group" : "layer";
    const id = keepSelectedGroup ? selection.id : layerNode?.dataset.layerId || groupNode.dataset.groupId;
    selectItem(type, id);
    const layer = type === "layer" ? clickedLayer : null;
    const group = type === "group" ? getGroup(id) : getGroup(layer?.groupId);
    const target = type === "layer" ? layer : group;
    if (!target || target.locked || group?.locked) return;

    drag = {
      target,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: target.x || 0,
      startY: target.y || 0,
      pointerId: event.pointerId
    };
    surface.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  surface.addEventListener("pointermove", event => {
    if (!drag) return;
    const rawX = drag.startX + (event.clientX - drag.startClientX) / canvasScale;
    const rawY = drag.startY + (event.clientY - drag.startClientY) / canvasScale;
    const snap = event.shiftKey ? 1 : 5;
    drag.target.x = Math.round(rawX / snap) * snap;
    drag.target.y = Math.round(rawY / snap) * snap;
    markThemeDirty();
    renderInspector();
    applyLayoutToPreview();
  });

  const endDrag = event => {
    if (!drag) return;
    try { surface.releasePointerCapture(drag.pointerId); } catch {}
    drag = null;
    renderTimeline();
  };
  surface.addEventListener("pointerup", endDrag);
  surface.addEventListener("pointercancel", endDrag);
}

function setupSelectionResizing() {
  const handle = $("selectionResizeHandle");
  let resize = null;

  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const item = getSelectedItem();
    const group = selection.type === "layer" ? getGroup(item?.groupId) : item;
    if (!item || item.locked || group?.locked) return;

    const boundsRect = $("selectionBounds").getBoundingClientRect();
    resize = {
      item,
      pointerId: event.pointerId,
      originX: boundsRect.left,
      originY: boundsRect.top,
      startDistance: Math.max(1, Math.hypot(event.clientX - boundsRect.left, event.clientY - boundsRect.top)),
      startScale: Number(item.scale || 100)
    };
    handle.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  });

  handle.addEventListener("pointermove", event => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    const distance = Math.max(1, Math.hypot(event.clientX - resize.originX, event.clientY - resize.originY));
    resize.item.scale = Math.round(clampNumber(resize.startScale * distance / resize.startDistance, 10, 400, resize.startScale));
    $("inspectorScale").value = resize.item.scale;
    markThemeDirty();
    applyLayoutToPreview();
  });

  const endResize = event => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    try { handle.releasePointerCapture(resize.pointerId); } catch {}
    resize = null;
    renderInspector();
    renderTimeline();
  };
  handle.addEventListener("pointerup", endResize);
  handle.addEventListener("pointercancel", endResize);
}

function addGroup() {
  const index = currentConfig.layout.groups.length + 1;
  const id = `group-${Date.now().toString(36)}`;
  currentConfig.layout.groups.push(normalizeItem(null, {
    id, name: `Group ${index}`, runtimeTarget: null, visible: true, locked: false,
    marker: markerPalette[(index - 1) % markerPalette.length], x: 0, y: 0, scale: 100,
    effects: makeEffects(), animation: makeAnimation("fade", "fade", 500), timing: makeTiming(0, 10000)
  }));
  markThemeDirty();
  selectItem("group", id);
}

function deleteSelectedGroup() {
  if (selection.type !== "group") return;
  deleteTimelineItem("group", selection.id);
}

function applyAnimationPreset(preset, direction = "in") {
  const selected = getSelectedItem();
  if (!selected) return;
  selected.animation[direction === "out" ? "exit" : "enter"] = preset;
  if (!selected.animation.enterDurationMs) selected.animation.enterDurationMs = 600;
  if (!selected.animation.exitDurationMs) selected.animation.exitDurationMs = 600;
  markThemeDirty(true);
  updateEditor();
  const duration = direction === "out" ? selected.animation.exitDurationMs : selected.animation.enterDurationMs;
  setPreviewTime(direction === "out" && !selected.timing.untilNextTrack
    ? Math.max(selected.timing.startMs, selected.timing.endMs - Math.min(250, duration / 2))
    : selected.timing.startMs + Math.min(250, duration / 2));
}

function markThemeDirty(forceHistory = false) {
  themeDirty = true;
  const meta = getCurrentThemeMeta();
  if (meta) {
    activeThemeId = meta.id;
    activeThemeType = meta.type;
  }
  updateThemeControls();
  recordHistorySnapshot(forceHistory);
}

function getCurrentThemeMeta() {
  const id = $("themePreset").value;
  return id && id !== "Custom" ? availableThemes.find(theme => theme.id === id) || null : null;
}

function updateThemeControls() {
  const meta = getCurrentThemeMeta();
  $("deleteThemeBtn").hidden = !meta || meta.type !== "custom" || meta.id !== activeThemeId;
}

async function loadThemes() {
  const select = $("themePreset");
  const selectedId = activeThemeId || select.value;
  select.innerHTML = '<option value="Custom">Custom</option>';
  try {
    const response = await fetch(`/api/themes?t=${Date.now()}`, { cache: "no-store" });
    const rawThemes = await response.json();
    const seenIds = new Set();
    const seenNames = new Set();
    availableThemes = rawThemes.filter(theme => {
      const id = String(theme.id || "").toLocaleLowerCase();
      const name = String(theme.name || theme.id || "").trim().toLocaleLowerCase();
      if (!id || seenIds.has(id) || seenNames.has(name)) return false;
      seenIds.add(id);
      seenNames.add(name);
      return true;
    });
    availableThemes.forEach(theme => {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name || theme.id;
      select.appendChild(option);
    });
    if ([...select.options].some(option => option.value === selectedId)) select.value = selectedId;
  } catch (error) {
    console.error("Themes load error:", error);
  }
  updateThemeControls();
}

async function getThemePreset(id) {
  if (!id || id === "Custom") return null;
  if (loadedThemes[id]) return loadedThemes[id];
  const meta = availableThemes.find(theme => theme.id === id);
  if (!meta) return null;
  const response = await fetch(`${meta.path}?t=${Date.now()}`, { cache: "no-store" });
  const theme = await response.json();
  loadedThemes[id] = theme;
  return theme;
}

async function applyThemePreset() {
  const presetId = $("themePreset").value;
  const preset = await getThemePreset(presetId);
  if (!preset) {
    activeThemeId = null;
    activeThemeType = null;
    themeDirty = false;
    currentConfig.theme.preset = "Custom";
    updateThemeControls();
    return;
  }

  const meta = getCurrentThemeMeta();
  currentConfig = mergeConfig(currentConfig, {
    theme: { preset: presetId }, colors: preset.colors, font: preset.font, ticker: preset.ticker,
    fullCard: preset.fullCard, vinyl: preset.vinyl, particles: preset.particles, equalizer: preset.equalizer,
    audio: preset.audio, animations: preset.animations, ...(preset.layout ? { layout: preset.layout } : {})
  });
  // Legacy themes do not carry a layout. Rebuild their standard scene instead
  // of keeping a standalone replaceDefaults composition from the prior theme.
  if (!preset.layout) currentConfig.layout = normalizeLayout(createDefaultLayout(currentConfig), currentConfig);
  const selectionCollection = selection.type === "group" ? currentConfig.layout.groups : currentConfig.layout.layers;
  if (!selectionCollection.some(item => item.id === selection.id)) {
    selection = currentConfig.layout.groups.length
      ? { type: "group", id: currentConfig.layout.groups[0].id }
      : { type: "layer", id: currentConfig.layout.layers[0]?.id || "" };
  }
  activeThemeId = meta?.id || presetId;
  activeThemeType = meta?.type || "builtin";
  themeDirty = false;
  fillGlobalForm(currentConfig);
  updateThemeControls();
  updateEditor();
  recordHistorySnapshot(true);
}

function applyFftPresetToForm(name) {
  const preset = FFT_PRESETS[name];
  if (!preset) return;
  $("equalizerSensitivity").value = Math.round(preset.sensitivity * 100);
  $("equalizerSmoothing").value = Math.round(preset.smoothing * 100);
  $("equalizerOutputGain").value = Math.round(preset.outputGain * 100);
  $("equalizerSpectralContrast").value = Math.round(preset.spectralContrast * 100);
  $("equalizerVisualCurvePower").value = Math.round(preset.visualCurvePower * 100);
  $("equalizerAutoGain").checked = preset.autoGain;
}

function createThemePayload(config) {
  return {
    colors: config.colors, font: config.font, ticker: config.ticker, fullCard: config.fullCard, vinyl: config.vinyl,
    particles: config.particles, equalizer: config.equalizer, audio: config.audio, animations: config.animations,
    layout: config.layout
  };
}

async function saveCustomTheme() {
  const name = $("customThemeName").value.trim();
  if (!name) {
    setStatus("Введите название темы.", "error");
    return;
  }
  currentConfig = readGlobalForm();
  try {
    const response = await fetch("/api/themes/custom", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, theme: createThemePayload(currentConfig) })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Не удалось сохранить тему.");
    $("customThemeName").value = "";
    await loadThemes();
    $("themePreset").value = result.id;
    activeThemeId = result.id;
    activeThemeType = "custom";
    themeDirty = false;
    updateThemeControls();
    setStatus("Тема сохранена.", "success");
    return true;
  } catch (error) {
    setStatus(error.message || "Не удалось сохранить тему.", "error");
    return false;
  }
}

async function updateCustomTheme() {
  if (!activeThemeId || activeThemeType !== "custom") return;
  currentConfig = readGlobalForm();
  try {
    const themeId = activeThemeId.replace("custom/", "");
    const response = await fetch(`/api/themes/custom/${themeId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: createThemePayload(currentConfig) })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Не удалось обновить тему.");
    themeDirty = false;
    await loadThemes();
    $("themePreset").value = activeThemeId;
    updateThemeControls();
    setStatus("Пользовательская тема обновлена.", "success");
    return true;
  } catch (error) {
    setStatus(error.message || "Не удалось обновить тему.", "error");
    return false;
  }
}

function refreshThemeSaveDialog() {
  const meta = getCurrentThemeMeta();
  const canOverwrite = meta?.type === "custom" && meta.id === activeThemeId;
  const overwrite = $("themeSaveModeOverwrite");
  overwrite.disabled = !canOverwrite;
  $("themeOverwriteHint").textContent = canOverwrite
    ? `Будет обновлена тема «${meta.name || meta.id}»`
    : "Доступно только для пользовательских тем";
  if (!canOverwrite && overwrite.checked) $("themeSaveModeNew").checked = true;
  $("themeNameField").hidden = !$("themeSaveModeNew").checked;
}

function openThemeSaveDialog() {
  const meta = getCurrentThemeMeta();
  const canOverwrite = meta?.type === "custom" && meta.id === activeThemeId;
  $(canOverwrite ? "themeSaveModeOverwrite" : "themeSaveModeNew").checked = true;
  refreshThemeSaveDialog();
  $("themeSaveDialog").showModal();
  if (!canOverwrite) requestAnimationFrame(() => $("customThemeName").focus());
}

async function confirmThemeSave(event) {
  event.preventDefault();
  const overwrite = $("themeSaveModeOverwrite").checked && !$("themeSaveModeOverwrite").disabled;
  const saved = overwrite ? await updateCustomTheme() : await saveCustomTheme();
  if (saved) $("themeSaveDialog").close();
}

async function deleteSelectedTheme() {
  const meta = getCurrentThemeMeta();
  if (!meta || meta.type !== "custom" || meta.id !== activeThemeId) return;
  const question = currentLanguage === "ru"
    ? `Удалить тему «${meta.name || meta.id}»? Файл темы будет удалён.`
    : `Delete theme “${meta.name || meta.id}”? The theme file will be removed.`;
  if (!window.confirm(question)) return;
  try {
    const response = await fetch(`/api/themes/custom/${encodeURIComponent(meta.id.replace("custom/", ""))}`, { method: "DELETE" });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Не удалось удалить тему.");
    delete loadedThemes[meta.id];
    activeThemeId = null;
    activeThemeType = null;
    themeDirty = true;
    await loadThemes();
    $("themePreset").value = "Custom";
    updateThemeControls();
    setStatus(currentLanguage === "ru" ? "Тема удалена. Композиция осталась в редакторе." : "Theme deleted. The composition stays in the editor.", "success");
  } catch (error) {
    setStatus(error.message || "Не удалось удалить тему.", "error");
  }
}

function setWebSocketStatus(connected) {
  const status = $("wsStatus");
  status.classList.toggle("is-online", connected);
  status.classList.toggle("is-offline", !connected);
  status.querySelector("span").textContent = connected
    ? (currentLanguage === "ru" ? "WS подключён" : "WS connected")
    : (currentLanguage === "ru" ? "WS отключён" : "WS offline");
}

function connectEditorWebSocket() {
  clearTimeout(editorSocketRetry);
  try {
    editorSocket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
    editorSocket.addEventListener("open", () => setWebSocketStatus(true));
    editorSocket.addEventListener("message", async event => {
      let message = event.data;
      try { message = JSON.parse(event.data)?.type || event.data; } catch {}
      if (message === "themesChanged") await loadThemes();
    });
    editorSocket.addEventListener("close", () => {
      setWebSocketStatus(false);
      editorSocketRetry = setTimeout(connectEditorWebSocket, 2000);
    });
    editorSocket.addEventListener("error", () => editorSocket.close());
  } catch {
    setWebSocketStatus(false);
    editorSocketRetry = setTimeout(connectEditorWebSocket, 2000);
  }
}

async function loadConfig() {
  try {
    const response = await fetch(`/api/config?t=${Date.now()}`, { cache: "no-store" });
    const loaded = await response.json();
    currentConfig = mergeConfig(defaultConfig, loaded);
    if (!loaded.layout) currentConfig.layout = createDefaultLayout(currentConfig);
    currentConfig.layout = normalizeLayout(currentConfig.layout, currentConfig);
    fillGlobalForm(currentConfig);
    const meta = getCurrentThemeMeta();
    activeThemeId = meta?.id || null;
    activeThemeType = meta?.type || null;
    themeDirty = false;
    updateThemeControls();
    updateEditor();
    resetHistory();
    setStatus(
      currentLanguage === "ru"
        ? (loaded.layout ? "Макет загружен" : "Старый config преобразован в новый макет")
        : (loaded.layout ? "Layout loaded" : "Legacy config converted to the new layout"),
      "success"
    );
  } catch (error) {
    console.error(error);
    currentConfig = structuredClone(defaultConfig);
    fillGlobalForm(currentConfig);
    updateEditor();
    resetHistory();
    setStatus("Не удалось прочитать config.json — используются defaults.", "error");
  }
}

async function saveConfig() {
  currentConfig = readGlobalForm();
  currentConfig.layout = normalizeLayout(currentConfig.layout, currentConfig);
  syncLegacyFromLayout();
  try {
    const response = await fetch("/api/config", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentConfig)
    });
    const result = await response.json();
    if (!result.ok) throw new Error("Ошибка сохранения.");
    setStatus("Применено · OBS обновлён через WebSocket", "success");
  } catch (error) {
    console.error(error);
    setStatus("Ошибка сохранения config.json", "error");
  }
}

async function updateAudioStatus() {
  try {
    const stamp = Date.now();
    const [audioResponse, nowPlayingResponse] = await Promise.all([
      fetch(`/api/audiolevel?t=${stamp}`, { cache: "no-store" }),
      fetch(`/api/nowplaying?t=${stamp}`, { cache: "no-store" })
    ]);
    const [data, nowPlaying] = await Promise.all([audioResponse.json(), nowPlayingResponse.json()]);
    $("captureStatusMode").textContent = data.captureMode || "—";
    $("captureStatusSource").textContent = data.sourceAppId || "—";
    $("captureStatusPid").textContent = data.processId || "—";
    $("captureStatusError").textContent = data.processCaptureError || "none";
    $("liveTrackTitle").textContent = nowPlaying.hasTrack ? nowPlaying.title || t("noActiveTrack") : t("noActiveTrack");
    $("liveTrackArtist").textContent = nowPlaying.hasTrack ? nowPlaying.artist || "—" : "—";
    currentLiveCover = nowPlaying.thumbnail || "";
    $("liveCoverPreview").src = currentLiveCover || currentDefaultCover || DEFAULT_COVER;
    currentConfig.layout.layers.filter(layer => layer.kind === "image" && !layer.assetData).forEach(layer => {
      const node = getPreviewLayerNode(layer);
      if (node) node.src = currentLiveCover || currentDefaultCover || DEFAULT_COVER;
    });
  } catch {}
}

function setupEvents() {
  const selectionCard = $("inspectorPane").querySelector(".selection-card");
  if (selectionCard && $("contextualSettings")) selectionCard.after($("contextualSettings"));
  const inspectorIds = [
    "inspectorName", "inspectorVisible", "inspectorLocked", "inspectorGroup", "inspectorMarker", "inspectorX", "inspectorY",
    "inspectorScale", "inspectorStart", "inspectorEnd", "inspectorUntilNext", "inspectorOpacity", "inspectorBlur",
    "inspectorGlow", "inspectorEnter", "inspectorExit", "inspectorEnterDuration", "inspectorEnterEasing",
    "inspectorExitDuration", "inspectorExitEasing"
  ];
  inspectorIds.forEach(id => $(id).addEventListener("input", updateSelectedFromInspector));

  document.querySelectorAll(".legacy-section input, .legacy-section select").forEach(input => {
    if (["themePreset", "customThemeName", "defaultCoverFile"].includes(input.id)) return;
    input.addEventListener("input", () => {
      if (input.id === "fftPreset") applyFftPresetToForm(input.value);
      if (manualFftFields.has(input.id)) $("fftPreset").value = "custom";
      currentConfig = readGlobalForm();
      syncLayoutFromLegacyInput(input.id);
      markThemeDirty();
      updateEditor();
    });
  });

  $("themePreset").addEventListener("change", applyThemePreset);
  $("saveThemeBtn").addEventListener("click", openThemeSaveDialog);
  $("deleteThemeBtn").addEventListener("click", deleteSelectedTheme);
  $("themeSaveDialog").querySelector("form").addEventListener("submit", confirmThemeSave);
  document.querySelectorAll('[name="themeSaveMode"]').forEach(input => input.addEventListener("change", refreshThemeSaveDialog));
  $("inspectorTab").addEventListener("click", () => activateSidebarPane("inspector"));
  $("globalSettingsTab").addEventListener("click", () => activateSidebarPane("global"));
  $("languageSelect").addEventListener("change", event => setEditorLanguage(event.target.value));
  $("undoBtn").addEventListener("click", undoEditor);
  $("redoBtn").addEventListener("click", redoEditor);
  document.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) redoEditor(); else undoEditor();
    } else if (key === "y") {
      event.preventDefault();
      redoEditor();
    }
  });
  $("uploadLibraryObjectBtn").addEventListener("click", () => $("libraryObjectFile").click());
  $("libraryObjectFile").addEventListener("change", uploadLibraryObject);
  $("saveBtn").addEventListener("click", saveConfig);
  $("resetBtn").addEventListener("click", () => {
    currentConfig = structuredClone(defaultConfig);
    currentDefaultCover = DEFAULT_COVER;
    storeCanvasBackground(DEFAULT_CANVAS_BACKGROUND);
    selection = { type: "group", id: "full-card-group" };
    previewTimeMs = 1500;
    fillGlobalForm(currentConfig);
    markThemeDirty();
    updateEditor();
    setStatus("Defaults восстановлены. Нажмите «Применить».");
  });

  $("defaultCoverFile").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    currentDefaultCover = await fileToBase64(file);
    currentConfig.albumArt.defaultCover = currentDefaultCover;
    $("defaultCoverPreview").src = currentDefaultCover;
    $("previewCover").src = currentDefaultCover;
    markThemeDirty();
    updatePreview(currentConfig);
  });

  $("playTimelineBtn").addEventListener("click", startTimelinePlayback);
  $("stopTimelineBtn").addEventListener("click", () => stopTimelinePlayback(true));
  $("canvasBackgroundColor").addEventListener("input", event => {
    const color = event.target.value;
    currentConfig.layout.canvas.backgroundColor = color;
    $("canvasSurface").style.backgroundColor = color;
    storeCanvasBackground(color);
    markThemeDirty();
  });
  $("compositionDurationSec").addEventListener("input", updateCompositionDuration);
  $("compositionDurationSec").addEventListener("change", updateCompositionDuration);
  $("addGroupBtn").addEventListener("click", addGroup);
  $("deleteGroupBtn").addEventListener("click", deleteSelectedGroup);

  document.querySelectorAll("[data-library-layer]").forEach(button => {
    button.addEventListener("click", () => selectItem("layer", button.dataset.libraryLayer));
  });
  document.querySelectorAll("[data-animation-preset]").forEach(button => {
    button.addEventListener("click", () => applyAnimationPreset(button.dataset.animationPreset));
  });

  setupCanvasDragging();
  setupSelectionResizing();
  setupTimelineLibraryDropZone();
  canvasController = MusicOverlayEditor.createCanvasController({
    viewport: $("canvasViewport"), surface: $("canvasSurface"), zoomInput: $("canvasZoom"),
    worldWidth: 1920, worldHeight: 1080,
    onScaleChange: nextScale => {
      canvasScale = nextScale;
      updateSelectionBounds();
    }
  });
  canvasController.attach();
  timelineController = MusicOverlayEditor.createTimelineController({
    surface: document.querySelector(".timeline-scroll"), ruler: $("timelineRuler"),
    getDuration: () => timelineDurationMs,
    setTime: setPreviewTime,
    stopPlayback: () => stopTimelinePlayback(false)
  });
  timelineController.attach();
  workspaceController = MusicOverlayEditor.createWorkspaceController({
    root: document.querySelector(".editor-grid"),
    onResize: () => canvasController?.fit()
  });
  workspaceController.attach();
}

setInterval(() => {
  const bars = $("previewEqualizer").querySelectorAll(".preview-eq-bar");
  bars.forEach((bar, index) => {
    const energy = bar.parentElement?.classList.contains("preview-equalizer-style-pulse");
    const wave = (Math.sin(Date.now() / (energy ? 82 : 210) + index * 0.42) + 1) / 2;
    const beat = energy ? Math.pow(Math.max(0, Math.sin(Date.now() / 185)), 5) : 0;
    bar.style.height = `${5 + wave * (energy ? 58 : 70) + beat * (energy ? 28 : 0)}px`;
  });
  document.querySelectorAll(".dynamic-preview-object.kind-equalizer i").forEach((bar, index) => {
    const energy = bar.parentElement?.classList.contains("style-pulse");
    const wave = (Math.sin(Date.now() / (energy ? 76 : 170) + index * 0.58) + Math.sin(Date.now() / (energy ? 145 : 310) + index * 0.19) + 2) / 4;
    const beat = energy ? Math.pow(Math.max(0, Math.sin(Date.now() / 175)), 6) : 0;
    bar.style.setProperty("--bar-height", `${10 + wave * (energy ? 58 : 78) + beat * (energy ? 32 : 0)}%`);
  });
}, 120);

loadEditorLanguage();
loadCustomLibraryAssets();
renderLibrary();
setupEvents();
applyEditorLanguage();
connectEditorWebSocket();
renderInspector();
fitCanvas();
setInterval(updateAudioStatus, 1200);
updateAudioStatus();

(async () => {
  await loadThemes();
  await loadConfig();
  requestAnimationFrame(fitCanvas);
})();

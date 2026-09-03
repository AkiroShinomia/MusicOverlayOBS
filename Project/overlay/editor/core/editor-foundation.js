const DEFAULT_COVER = "/assets/default-cover.png";
const DEFAULT_CANVAS_BACKGROUND = "#00a84f";
const CANVAS_BACKGROUND_STORAGE_KEY = "musicOverlay.editor.canvasBackground.v1";
const EDITOR_LANGUAGE_STORAGE_KEY = "musicOverlay.editor.language.v1";
const LIBRARY_ASSETS_STORAGE_KEY = "musicOverlay.editor.libraryAssets.v1";
const SceneOrder = window.MusicOverlaySceneOrder;
const SceneRendererApi = window.MusicOverlaySceneRenderer;
const SceneEditorModel = window.MusicOverlaySceneEditorModel;
const FftPresetApi = window.MusicOverlayFftPresets;
const BUILTIN_IDS = window.MusicOverlay.editor.compat.builtinV2Rules.IDS;

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
    { id: "equalizer-bars", payloadType: "object", kind: "equalizer", icon: "▥", name: { ru: "Bars", en: "Bars" }, desc: { ru: "Аудио-бары", en: "Audio bars" }, properties: { width: 300, height: 90, barCount: 32, color: "#8b5cf6", fftPreset: "balanced" } },
    { id: "equalizer-neon", payloadType: "object", kind: "equalizer", icon: "▥", name: { ru: "Neon bars", en: "Neon bars" }, desc: { ru: "Бары со свечением", en: "Glowing bars" }, properties: { width: 340, height: 100, barCount: 48, color: "#35d0ba", glow: 18, fftPreset: "energy" } },
    { id: "equalizer-waveform", payloadType: "object", kind: "equalizer", icon: "〰", name: { ru: "Waveform", en: "Waveform" }, desc: { ru: "Тонкая звуковая волна", en: "Compact audio waveform" }, properties: { width: 300, height: 32, barCount: 72, gap: 1, style: "waveform", color: "#ffffff", fftPreset: "dynamicBars" } },
    { id: "equalizer-pulse", payloadType: "object", kind: "equalizer", icon: "ϟ", name: { ru: "Pulse bars", en: "Pulse bars" }, desc: { ru: "Контрастные светящиеся бары", en: "High-contrast glowing bars" }, properties: { width: 340, height: 110, barCount: 48, gap: 3, style: "pulse", color: "#74ff70", fftPreset: "punchy" } }
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

const FFT_PRESETS = FftPresetApi?.presets || {};

const markerPalette = ["#8b5cf6", "#35d0ba", "#ff9f43", "#4da3ff", "#fb7185", "#e879f9"];
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

function makeGroupAnimation(enter = "fade", exit = "fade", durationMs = 600, overrideChildren = false) {
  return { ...makeAnimation(enter, exit, durationMs), overrideChildren };
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
        id: BUILTIN_IDS.fullGroup, name: "Full Card", runtimeTarget: "full", visible: true, locked: false,
        marker: "#8b5cf6", x: 0, y: 0, scale: 100, effects: makeEffects(),
        animation: makeGroupAnimation(config.animations?.fullEnter || "slideRight", config.animations?.fullExit || "slideDown", duration, false),
        timing: makeTiming(0, fullEnd, false)
      },
      {
        id: BUILTIN_IDS.tickerGroup, name: "Ticker / Until next track", runtimeTarget: "ticker", visible: true, locked: false,
        marker: "#35d0ba", x: 0, y: 0, scale: 100, effects: makeEffects(),
        animation: makeGroupAnimation(config.animations?.tickerEnter || "slideUp", config.animations?.tickerExit || "none", duration, false),
        timing: makeTiming(fullEnd, null, true)
      }
    ],
    layers: [
      { id: BUILTIN_IDS.fullParticles, name: "Particles", kind: "effect", groupId: BUILTIN_IDS.fullGroup, marker: "#e879f9", timing: makeTiming(0, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) },
      { id: BUILTIN_IDS.fullCover, name: "Cover", kind: "image", groupId: BUILTIN_IDS.fullGroup, marker: "#fb7185", timing: makeTiming(coverStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("scale", "fade", 450) },
      { id: BUILTIN_IDS.fullVinyl, name: "Vinyl", kind: "disc", groupId: BUILTIN_IDS.fullGroup, marker: "#ff9f43", timing: makeTiming(coverStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("slideLeft", "fade", 500) },
      { id: BUILTIN_IDS.fullTitle, name: "Title", kind: "text", groupId: BUILTIN_IDS.fullGroup, marker: "#4da3ff", timing: makeTiming(cardStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("slideLeft", "fade", 450) },
      { id: BUILTIN_IDS.fullArtist, name: "Artist", kind: "text", groupId: BUILTIN_IDS.fullGroup, marker: "#4da3ff", timing: makeTiming(cardStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("slideLeft", "fade", 450) },
      { id: BUILTIN_IDS.fullTime, name: "Time", kind: "data", groupId: BUILTIN_IDS.fullGroup, marker: "#35d0ba", timing: makeTiming(cardStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) },
      { id: BUILTIN_IDS.fullProgress, name: "Progress", kind: "data", groupId: BUILTIN_IDS.fullGroup, marker: "#35d0ba", timing: makeTiming(cardStart, fullEnd), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) },
      { id: BUILTIN_IDS.fullShell, name: "Card container", kind: "container", groupId: BUILTIN_IDS.fullGroup, marker: "#8b5cf6", timing: makeTiming(cardStart, fullEnd), visible: true, locked: true, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) },
      { id: BUILTIN_IDS.tickerEqualizer, name: "Equalizer", kind: "effect", groupId: BUILTIN_IDS.tickerGroup, marker: "#e879f9", timing: makeTiming(fullEnd, null, true), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("slideUp", "fade", 500) },
      { id: BUILTIN_IDS.tickerTitle, name: "Ticker title", kind: "text", groupId: BUILTIN_IDS.tickerGroup, marker: "#4da3ff", timing: makeTiming(fullEnd, null, true), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("slideUp", "fade", 500) },
      { id: BUILTIN_IDS.tickerTime, name: "Ticker time", kind: "data", groupId: BUILTIN_IDS.tickerGroup, marker: "#35d0ba", timing: makeTiming(fullEnd, null, true), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) },
      { id: BUILTIN_IDS.tickerProgress, name: "Ticker progress", kind: "data", groupId: BUILTIN_IDS.tickerGroup, marker: "#35d0ba", timing: makeTiming(fullEnd, null, true), visible: true, locked: false, x: 0, y: 0, scale: 100, effects: makeEffects(), animation: makeAnimation("fade", "fade", 350) },
      {
        id: BUILTIN_IDS.tickerBackground, name: "Ticker background", kind: "block", templateId: "block-solid", groupId: BUILTIN_IDS.tickerGroup,
        marker: "#8b5cf6", timing: makeTiming(fullEnd, null, true), visible: true, locked: false, x: 0, y: 0, scale: 100,
        effects: makeEffects(), animation: makeAnimation(config.animations?.tickerEnter || "slideUp", config.animations?.tickerExit || "none", duration),
        properties: {
          width: Number(config.sizes?.tickerWidth || 500), height: Number(config.sizes?.tickerHeight || 42),
          color: config.colors?.background || "rgba(10,10,14,.8)", borderRadius: 999, style: config.ticker?.style || "pill"
        }
      }
    ]
  };
}

const defaultConfig = { ...structuredClone(baseConfig), layout: createDefaultLayout(baseConfig) };

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


MusicOverlay.compat.editorRuntime.previewTrackData = {
  title: "я не пойду с тобой гулять",
  artist: "Серега Пират",
  position: 42,
  duration: 176,
  thumbnail: DEFAULT_COVER,
  audioBins: Array.from({ length: 128 }, (_, index) => .08 + Math.abs(Math.sin(index * .31) * Math.cos(index * .071)) * .72)
};
MusicOverlay.compat.editorRuntime.previewTrackData.audioBinsByPreset = Object.fromEntries(
  (FftPresetApi?.options || []).map(option => [option.value, MusicOverlay.compat.editorRuntime.previewTrackData.audioBins])
);

function $(id) { return document.getElementById(id); }

function t(key) {
  return I18N[MusicOverlay.compat.editorRuntime.currentLanguage]?.[key] || I18N.ru[key] || key;
}

function populateFftPresetSelect(select) {
  if (!select || !FftPresetApi?.options) return;
  select.replaceChildren(...FftPresetApi.options.map(option => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    return element;
  }));
}

function loadEditorLanguage() {
  try { MusicOverlay.compat.editorRuntime.currentLanguage = localStorage.getItem(EDITOR_LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ru"; } catch { MusicOverlay.compat.editorRuntime.currentLanguage = "ru"; }
}

function applyEditorLanguage() {
  document.documentElement.lang = MusicOverlay.compat.editorRuntime.currentLanguage;
  $("languageSelect").value = MusicOverlay.compat.editorRuntime.currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach(element => {
    const value = t(element.dataset.i18n);
    if (value) element.textContent = value;
  });
  renderLibrary();
  if (MusicOverlay.editor.context?.isInitialized()) renderInspector();
  document.querySelectorAll("summary, .field > span, .compact-toggle > span, .composition-duration > span, .canvas-background-control > span, button, .eyebrow, h2, h3").forEach(element => {
    if (element.childElementCount > 0 || element.dataset.i18n) return;
    const source = element.dataset.i18nOriginal || element.textContent.trim();
    const pair = UI_TEXT_LOOKUP.get(source);
    if (!pair) return;
    element.dataset.i18nOriginal = pair.en;
    element.textContent = pair[MusicOverlay.compat.editorRuntime.currentLanguage];
  });
  if ($("undoBtn")) {
    $("undoBtn").title = `${t("undo")} · Ctrl+Z`;
    $("redoBtn").title = `${t("redo")} · Ctrl+Shift+Z`;
  }
  const audioLabels = MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? ["Режим", "Источник", "PID", "Ошибка"] : ["Mode", "Source", "PID", "Error"];
  document.querySelectorAll(".audio-status > span").forEach((element, index) => {
    if (element.firstChild) element.firstChild.nodeValue = `${audioLabels[index]}: `;
  });
  const zoomLabel = document.querySelector(".canvas-zoom-control");
  if (zoomLabel?.firstChild) zoomLabel.firstChild.nodeValue = `${MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Масштаб" : "Zoom"} `;
  if (MusicOverlay.editor.context?.isInitialized()) renderTimeline();
  if ($("wsStatus")) setWebSocketStatus($("wsStatus").classList.contains("is-online"));
}

function setEditorLanguage(language) {
  MusicOverlay.compat.editorRuntime.currentLanguage = language === "en" ? "en" : "ru";
  try { localStorage.setItem(EDITOR_LANGUAGE_STORAGE_KEY, MusicOverlay.compat.editorRuntime.currentLanguage); } catch {}
  applyEditorLanguage();
}

/* Obsolete Stage 2F history helper removed.




  });
}

*/
function loadCustomLibraryAssets() {
  let customLibraryAssets = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LIBRARY_ASSETS_STORAGE_KEY) || "[]");
    customLibraryAssets = Array.isArray(parsed) ? parsed.filter(asset => asset?.id && asset?.assetData) : [];
  } catch {}
  MusicOverlay.editor.context.sessionStore.patch({ customLibraryAssets });
}

function saveCustomLibraryAssets() {
  try { localStorage.setItem(LIBRARY_ASSETS_STORAGE_KEY, JSON.stringify(MusicOverlay.editor.state.uiAdapters.customLibraryAssets())); } catch {}
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
  next.animation.overrideChildren = next.animation.overrideChildren === true;
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
      effects: makeEffects(), animation: makeGroupAnimation(), timing: makeTiming(0, 10000)
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

function getTimingEnd(item, duration = MusicOverlay.editor.state.uiAdapters.timelineDurationMs()) {
  return item?.timing?.untilNextTrack ? duration : Number(item?.timing?.endMs ?? item?.timing?.startMs + 1000);
}

function constrainGroupTiming(group, duration = MusicOverlay.editor.state.uiAdapters.timelineDurationMs()) {
  group.timing.startMs = clampNumber(group.timing.startMs, 0, Math.max(0, duration - 50), 0);
  if (group.timing.untilNextTrack) {
    group.timing.endMs = null;
    return;
  }
  group.timing.endMs = clampNumber(group.timing.endMs, group.timing.startMs + 50, duration, Math.min(duration, group.timing.startMs + 1000));
}

function constrainLayerTiming(layer, groups = [], duration = MusicOverlay.editor.state.uiAdapters.timelineDurationMs()) {
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
  const context = MusicOverlay.editor.context;
  if (!context?.isInitialized()) return;
  const scene = context.sceneStore.getSnapshot();
  const duration = Number(scene.timeline?.durationMs || 30000);
  const mutations = [];
  scene.nodes.forEach(node => {
    const window = context.selectors.effectiveTiming(scene, node.id);
    if (!window || node.timing?.endMode !== "fixed") return;
    const parentWindow = node.parentId ? context.selectors.effectiveTiming(scene, node.parentId) : null;
    const parentStart = Number(parentWindow?.startMs || 0);
    const parentEnd = Number.isFinite(Number(parentWindow?.endMs)) ? Number(parentWindow.endMs) : duration;
    const start = Math.min(Math.max(parentStart, Number(window.startMs || 0)), Math.max(parentStart, parentEnd - 50));
    const end = Math.min(Math.max(start + 50, Number(window.endMs || start + 1000)), parentEnd);
    const localStart = Math.max(0, start - parentStart);
    const nextDuration = Math.max(50, end - start);
    if (Math.abs(localStart - Number(node.timing?.startMs || 0)) < .001 && Math.abs(nextDuration - Number(node.timing?.durationMs || 0)) < .001) return;
    mutations.push({
      type: "node.timing",
      payload: { id: node.id, patch: { startMs: localStart, durationMs: nextDuration } }
    });
  });
  if (mutations.length) context.commit({ type: "batch", payload: { mutations } });
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


function updateHistoryControls() {
  if (!$("undoBtn") || !MusicOverlay.editor.context) return;
  $("undoBtn").disabled = !MusicOverlay.editor.context.history.canUndo();
  $("redoBtn").disabled = !MusicOverlay.editor.context.history.canRedo();
}

function resetHistory() {
  if (!MusicOverlay.editor.context?.isInitialized()) return;
  MusicOverlay.editor.context.history.reset();
  updateHistoryControls();
}

function recordHistorySnapshot(force = false) {
  if (!MusicOverlay.editor.context?.isInitialized()) return;
  MusicOverlay.editor.context.history.record(force);
  updateHistoryControls();
}

function syncUiAfterHistory(message) {
  const scene = MusicOverlay.editor.context.sceneStore.getSnapshot();
  if (!scene) return;
  MusicOverlay.editor.context.sessionStore.ensureValidSelection(scene, MusicOverlay.editor.context.selectors);
  const session = MusicOverlay.editor.context.sessionStore.getSnapshot();
  MusicOverlay.editor.context.sessionStore.patch({
    playheadMs: Math.min(session.playheadMs, Number(scene.timeline?.durationMs || 30000))
  });
  updateThemeControls();
  updateEditor();
  setStatus(message, "success");
  updateHistoryControls();
}

function undoEditor() {
  if (!MusicOverlay.editor.context?.undo()) return;
  syncUiAfterHistory(MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Изменение отменено" : "Change undone");
}

function redoEditor() {
  if (!MusicOverlay.editor.context?.redo()) return;
  syncUiAfterHistory(MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Изменение повторено" : "Change redone");
}

MusicOverlay.core.editorFoundation = Object.freeze({ normalizeLayout, normalizeItem, constrainAllTimings, parseRgba, normalizeHex, rgbToHex, rgbaFromInputs, setEditorLanguage, applyEditorLanguage, recordHistorySnapshot, undoEditor, redoEditor });

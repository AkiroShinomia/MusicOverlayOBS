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

  MusicOverlay.compat.editorRuntime.currentDefaultCover = config.albumArt?.defaultCover || DEFAULT_COVER;
  $("defaultCoverPreview").src = MusicOverlay.compat.editorRuntime.currentDefaultCover;
}

function readGlobalForm() {
  const config = structuredClone(MusicOverlay.compat.legacyEditorState.value);
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
  config.albumArt.defaultCover = MusicOverlay.compat.editorRuntime.currentDefaultCover;
  config.layout = normalizeLayout(MusicOverlay.compat.legacyEditorState.value.layout, config);
  return config;
}

function getSelectedItem() {
  const collection = MusicOverlay.compat.editorRuntime.selection.type === "group" ? MusicOverlay.compat.legacyEditorState.value.layout.groups : MusicOverlay.compat.legacyEditorState.value.layout.layers;
  return collection.find(item => item.id === MusicOverlay.compat.editorRuntime.selection.id) || null;
}

function getGroup(id) {
  return MusicOverlay.compat.legacyEditorState.value.layout.groups.find(group => group.id === id) || null;
}

function getAnimationOverrideGroup(item, itemType = MusicOverlay.compat.editorRuntime.selection.type) {
  let parentId = itemType === "group" ? item?.parentId : item?.groupId;
  const visited = new Set();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const group = getGroup(parentId);
    if (!group) return null;
    if (group.animation?.overrideChildren === true) return group;
    parentId = group.parentId;
  }
  return null;
}

function auditionAnimation(item, direction) {
  const inheritedFrom = getAnimationOverrideGroup(item);
  const owner = inheritedFrom || item;
  if (owner === item && MusicOverlay.compat.editorRuntime.selection.type === "group" && item.animation?.overrideChildren !== true) return;
  const animation = owner.animation || makeAnimation();
  const duration = direction === "out"
    ? Number(animation.exitDurationMs || animation.durationMs || 600)
    : Number(animation.enterDurationMs || animation.durationMs || 600);
  if (direction === "out" && !owner.timing?.untilNextTrack) {
    setPreviewTime(Math.max(Number(owner.timing?.startMs || 0), getTimingEnd(owner) - Math.max(50, duration / 2)));
  } else {
    setPreviewTime(Number(owner.timing?.startMs || 0) + Math.max(50, duration / 2));
  }
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
  const isDynamic = MusicOverlay.compat.editorRuntime.selection.type === "layer" && Boolean(item.templateId);
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
    props.fftPreset ??= MusicOverlay.compat.legacyEditorState.value.equalizer?.preset || "balanced";
  }
  if (item.kind === "image") {
    props.outline ??= 0;
    props.outlineColor ??= "#ffffff";
  }
  const fields = [];
  const labels = MusicOverlay.compat.editorRuntime.currentLanguage === "ru"
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
    const presetOptions = (FftPresetApi?.options || []).map(option => `<option value="${option.value}">${option.label}</option>`).join("");
    fields.push(`<label class="field field-stack"><span>FFT preset</span><select data-object-prop="fftPreset" data-default="balanced">${presetOptions}</select></label>`);
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

  panel.innerHTML = `<h3>${MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Параметры объекта" : "Object properties"}</h3>${fields.join("")}`;
  panel.querySelectorAll("[data-object-prop]").forEach(input => {
    if (input.tagName === "SELECT") input.value = props[input.dataset.objectProp] || input.dataset.default || input.options[0]?.value || "";
    input.addEventListener("input", () => {
      props[input.dataset.objectProp] = input.type === "number" ? Number(input.value) : input.value;
      markThemeDirty();
      applyLayoutToPreview();
    });
  });
}

function selectItem(type, id) {
  const collection = type === "group" ? MusicOverlay.compat.legacyEditorState.value.layout.groups : MusicOverlay.compat.legacyEditorState.value.layout.layers;
  if (!collection.some(item => item.id === id)) return;
  MusicOverlay.compat.editorRuntime.selection = { type, id };
  activateSidebarPane("inspector");
  renderInspector();
  renderTimeline();
  applyLayoutToPreview();
}

function renderInspector() {
  const item = getSelectedItem();
  if (!item) return;

  $("inspectorType").textContent = MusicOverlay.compat.editorRuntime.selection.type === "group"
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "ГРУППА" : "GROUP")
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "ОБЪЕКТ" : "OBJECT");
  $("inspectorName").value = item.name || item.id;
  $("inspectorVisible").checked = item.visible !== false;
  $("inspectorLocked").checked = item.locked === true;
  $("inspectorMarker").value = normalizeHex(item.marker);
  $("inspectorX").value = item.x || 0;
  $("inspectorY").value = item.y || 0;
  $("inspectorScale").value = item.scale || 100;
  const parentGroup = MusicOverlay.compat.editorRuntime.selection.type === "layer" ? getGroup(item.groupId) : null;
  const groupStart = Number(parentGroup?.timing?.startMs || 0);
  const localTiming = MusicOverlay.compat.editorRuntime.selection.type === "layer" && parentGroup;
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
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Старт в группе, мс" : "Start in group, ms")
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Старт, мс" : "Start, ms");
  $("inspectorEndLabel").textContent = localTiming
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Конец в группе, мс" : "End in group, ms")
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Конец, мс" : "End, ms");
  $("inspectorUntilLabel").textContent = t("infinityRecording");
  $("inspectorUntilNext").title = finiteParent
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Объект будет отображаться до конца группы." : "The object stays visible until the group ends.")
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Объект будет отображаться до следующего трека." : "The object stays visible until the next track.");
  $("inspectorTimingScope").textContent = localTiming
    ? `${MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Окно группы" : "Group window"}: 0 – ${Math.round(groupDuration)} ms`
    : `${MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Окно композиции" : "Composition window"}: 0 – ${getCompositionDuration()} ms`;
  $("inspectorOpacity").value = item.effects?.opacity ?? 100;
  $("inspectorBlur").value = item.effects?.blur ?? 0;
  $("inspectorGlow").value = item.effects?.glow ?? 0;
  const isGroup = MusicOverlay.compat.editorRuntime.selection.type === "group";
  const inheritedAnimationGroup = getAnimationOverrideGroup(item);
  const displayedAnimation = inheritedAnimationGroup?.animation || item.animation || makeAnimation();
  const groupOverridesChildren = isGroup && item.animation?.overrideChildren === true;
  $("groupAnimationOverrideField").hidden = !isGroup;
  $("inspectorOverrideChildren").checked = groupOverridesChildren;
  $("inspectorOverrideChildren").disabled = Boolean(inheritedAnimationGroup);
  $("animationDirectionControls").hidden = isGroup && !groupOverridesChildren && !inheritedAnimationGroup;
  $("animationDirectionControls").disabled = Boolean(inheritedAnimationGroup);
  $("animationInheritanceHint").hidden = !inheritedAnimationGroup && (!isGroup || groupOverridesChildren);
  $("animationInheritanceHint").textContent = inheritedAnimationGroup
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru"
      ? `Анимация наследуется от группы «${inheritedAnimationGroup.name}». Отключите затирание в родительской группе, чтобы редактировать объект отдельно.`
      : `Animation is inherited from “${inheritedAnimationGroup.name}”. Disable override on the parent group to edit this object.`)
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru"
      ? "Анимация группы выключена. Каждый объект внутри группы настраивается отдельно."
      : "Group animation is disabled. Each child object uses its own animation.");
  $("inspectorEnter").value = displayedAnimation.enter || "fade";
  $("inspectorExit").value = displayedAnimation.exit || "fade";
  $("inspectorEnterDuration").value = displayedAnimation.enterDurationMs ?? displayedAnimation.durationMs ?? 600;
  $("inspectorEnterEasing").value = displayedAnimation.enterEasing || displayedAnimation.easing || "ease-out";
  $("inspectorExitDuration").value = displayedAnimation.exitDurationMs ?? displayedAnimation.durationMs ?? 600;
  $("inspectorExitEasing").value = displayedAnimation.exitEasing || displayedAnimation.easing || "ease-out";
  renderContextualSettings(item);

  const groupField = $("inspectorGroupField");
  const groupSelect = $("inspectorGroup");
  groupField.hidden = MusicOverlay.compat.editorRuntime.selection.type !== "layer";
  groupSelect.innerHTML = `<option value="">${MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Без группы" : "No group"}</option>`;
  MusicOverlay.compat.legacyEditorState.value.layout.groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    groupSelect.appendChild(option);
  });
  if (MusicOverlay.compat.editorRuntime.selection.type === "layer") groupSelect.value = item.groupId || "";

  const group = MusicOverlay.compat.editorRuntime.selection.type === "layer" ? getGroup(item.groupId) : item;
  $("transformHint").textContent = MusicOverlay.compat.editorRuntime.selection.type === "layer" && group
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? `Перетаскивание двигает объект «${item.name}». Выберите группу на таймлайне для общего изменения.` : `Drag moves “${item.name}”. Select its group on the Timeline for a shared transform.`)
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Перетаскивайте выбранную группу на холсте или задайте точные координаты." : "Drag the selected group on the Canvas or enter exact coordinates.");

  $("deleteGroupBtn").disabled = MusicOverlay.compat.editorRuntime.selection.type !== "group";
}

function updateSelectedFromInspector(event) {
  const item = getSelectedItem();
  if (!item) return;
  const changedField = event?.target?.id || "";

  item.name = $("inspectorName").value.trim() || item.id;
  item.visible = $("inspectorVisible").checked;
  item.locked = $("inspectorLocked").checked;
  item.marker = $("inspectorMarker").value;
  item.x = clampNumber($("inspectorX").value, -10000, 10000, 0);
  item.y = clampNumber($("inspectorY").value, -10000, 10000, 0);
  item.scale = clampNumber($("inspectorScale").value, 10, 400, 100);
  if (MusicOverlay.compat.editorRuntime.selection.type === "layer") item.groupId = $("inspectorGroup").value || null;
  const parentGroup = MusicOverlay.compat.editorRuntime.selection.type === "layer" ? getGroup(item.groupId) : null;
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
  const inheritedAnimationGroup = getAnimationOverrideGroup(item);
  if (MusicOverlay.compat.editorRuntime.selection.type === "group" && !inheritedAnimationGroup) {
    item.animation.overrideChildren = $("inspectorOverrideChildren").checked;
  }
  const animationEditable = !inheritedAnimationGroup && (MusicOverlay.compat.editorRuntime.selection.type !== "group" || item.animation.overrideChildren === true);
  if (animationEditable) {
    item.animation.enter = $("inspectorEnter").value;
    item.animation.exit = $("inspectorExit").value;
    item.animation.enterDurationMs = clampNumber($("inspectorEnterDuration").value, 0, 10000, 600);
    if (item.animation.enter !== "none" && item.animation.enterDurationMs === 0) item.animation.enterDurationMs = 600;
    item.animation.enterEasing = $("inspectorEnterEasing").value;
    item.animation.exitDurationMs = clampNumber($("inspectorExitDuration").value, 0, 10000, 600);
    if (item.animation.exit !== "none" && item.animation.exitDurationMs === 0) item.animation.exitDurationMs = 600;
    item.animation.exitEasing = $("inspectorExitEasing").value;
    item.animation.durationMs = item.animation.enterDurationMs;
    item.animation.easing = item.animation.enterEasing;
  }
  constrainAllTimings();
  $("inspectorEnd").disabled = finiteParent ? item.timing.untilGroupEnd : item.timing.untilNextTrack;
  syncLegacyFromLayout();
  markThemeDirty();
  updateEditor();
  if (animationEditable && (changedField.startsWith("inspectorEnter") || changedField === "inspectorOverrideChildren")) {
    auditionAnimation(item, "in");
  } else if (animationEditable && changedField.startsWith("inspectorExit")) {
    auditionAnimation(item, "out");
  }
}

function syncLegacyFromLayout() {
  const full = getGroup("full-card-group");
  const ticker = getGroup("ticker-group");
  if (full) {
    MusicOverlay.compat.legacyEditorState.value.timings.fullVisibleMs = full.timing.untilNextTrack
      ? MusicOverlay.compat.legacyEditorState.value.timings.fullVisibleMs
      : Math.max(0, Number(full.timing.endMs || 0));
    MusicOverlay.compat.legacyEditorState.value.animations.fullEnter = full.animation.enter;
    MusicOverlay.compat.legacyEditorState.value.animations.fullExit = full.animation.exit;
    MusicOverlay.compat.legacyEditorState.value.timings.exitMs = full.animation.exitDurationMs ?? full.animation.durationMs;
  }
  if (ticker) {
    MusicOverlay.compat.legacyEditorState.value.animations.tickerEnter = ticker.animation.enter;
    MusicOverlay.compat.legacyEditorState.value.animations.tickerExit = ticker.animation.exit || "none";
  }
  fillLegacySyncFields();
}

function fillLegacySyncFields() {
  $("fullVisibleMs").value = MusicOverlay.compat.legacyEditorState.value.timings.fullVisibleMs;
  $("exitMs").value = MusicOverlay.compat.legacyEditorState.value.timings.exitMs;
  $("fullEnterAnimation").value = MusicOverlay.compat.legacyEditorState.value.animations.fullEnter;
  $("fullExitAnimation").value = MusicOverlay.compat.legacyEditorState.value.animations.fullExit;
  $("tickerEnterAnimation").value = MusicOverlay.compat.legacyEditorState.value.animations.tickerEnter;
}

function syncLayoutFromLegacyInput(id) {
  const full = getGroup("full-card-group");
  const ticker = getGroup("ticker-group");
  if (!full || !ticker) return;

  if (id === "fullVisibleMs") {
    const previousEnd = full.timing.endMs;
    const nextEnd = Math.max(100, Number(MusicOverlay.compat.legacyEditorState.value.timings.fullVisibleMs || 10000));
    full.timing.endMs = nextEnd;
    full.timing.untilNextTrack = false;
    ticker.timing.startMs = nextEnd;
    MusicOverlay.compat.legacyEditorState.value.layout.layers.forEach(layer => {
      if (layer.groupId === full.id && !layer.timing.untilNextTrack && layer.timing.endMs === previousEnd) layer.timing.endMs = nextEnd;
      if (layer.groupId === ticker.id && layer.timing.startMs === previousEnd) layer.timing.startMs = nextEnd;
    });
  }
  if (id === "fullEnterAnimation") full.animation.enter = MusicOverlay.compat.legacyEditorState.value.animations.fullEnter;
  if (id === "fullExitAnimation") full.animation.exit = MusicOverlay.compat.legacyEditorState.value.animations.fullExit;
  if (id === "tickerEnterAnimation") ticker.animation.enter = MusicOverlay.compat.legacyEditorState.value.animations.tickerEnter;
  if (id === "exitMs") {
    full.animation.exitDurationMs = Number(MusicOverlay.compat.legacyEditorState.value.timings.exitMs || 600);
    ticker.animation.exitDurationMs = Number(MusicOverlay.compat.legacyEditorState.value.timings.exitMs || 600);
  }

  const layer = layerId => MusicOverlay.compat.legacyEditorState.value.layout.layers.find(item => item.id === layerId);
  const props = item => item ? (item.properties ||= {}) : {};
  const fullShell = layer("full-card-shell");
  const fullCover = layer("full-cover");
  const fullVinyl = layer("full-vinyl");
  const fullTitle = layer("full-title");
  const fullArtist = layer("full-artist");
  const fullTime = layer("full-time");
  const fullProgress = layer("full-progress");
  const tickerTitle = layer("ticker-title");
  const tickerTime = layer("ticker-time");
  const tickerProgress = layer("ticker-progress");
  const tickerEqualizer = layer("ticker-equalizer");
  const tickerBackground = layer("ticker-group-background");
  const fullParticles = layer("full-particles");

  if (id === "fullCardWidth") props(fullShell).width = Number(MusicOverlay.compat.legacyEditorState.value.sizes.fullCardWidth);
  if (id === "coverSize") {
    props(fullCover).width = Number(MusicOverlay.compat.legacyEditorState.value.sizes.coverSize);
    props(fullCover).height = Number(MusicOverlay.compat.legacyEditorState.value.sizes.coverSize);
  }
  if (id === "vinylSize") props(fullVinyl).size = Number(MusicOverlay.compat.legacyEditorState.value.sizes.vinylSize);
  if (id === "tickerWidth") {
    const width = Number(MusicOverlay.compat.legacyEditorState.value.sizes.tickerWidth);
    props(ticker).width = width;
    props(tickerBackground).width = width;
    props(tickerTitle).width = Math.max(40, width - 150);
    props(tickerProgress).width = Math.max(20, width - 32);
    props(tickerEqualizer).width = Math.max(20, width - Number(MusicOverlay.compat.legacyEditorState.value.equalizer.sidePadding || 14) * 2);
    if (tickerTime) tickerTime.x = Math.max(16, width - 116);
  }
  if (id === "tickerHeight") {
    const height = Number(MusicOverlay.compat.legacyEditorState.value.sizes.tickerHeight);
    props(ticker).height = height;
    props(tickerBackground).height = height;
    if (tickerProgress) tickerProgress.y = Math.max(0, height - 10);
  }
  if (id === "titleSize") props(fullTitle).fontSize = Number(MusicOverlay.compat.legacyEditorState.value.font.titleSize);
  if (id === "artistSize") props(fullArtist).fontSize = Number(MusicOverlay.compat.legacyEditorState.value.font.artistSize);
  if (id === "tickerSize") {
    props(tickerTitle).fontSize = Number(MusicOverlay.compat.legacyEditorState.value.font.tickerSize);
    props(tickerTime).fontSize = Math.min(12, Number(MusicOverlay.compat.legacyEditorState.value.font.tickerSize));
  }
  if (["backgroundColor", "backgroundOpacity", "fullCardStyle"].includes(id)) {
    props(fullShell).color = MusicOverlay.compat.legacyEditorState.value.fullCard.style === "minimal" ? "transparent" : MusicOverlay.compat.legacyEditorState.value.colors.background;
    props(fullShell).style = MusicOverlay.compat.legacyEditorState.value.fullCard.style;
  }
  if (["backgroundColor", "backgroundOpacity", "tickerStyle"].includes(id)) {
    props(tickerBackground).color = MusicOverlay.compat.legacyEditorState.value.colors.background;
    props(tickerBackground).style = MusicOverlay.compat.legacyEditorState.value.ticker.style;
    props(tickerBackground).borderRadius = ["thin", "compact"].includes(MusicOverlay.compat.legacyEditorState.value.ticker.style)
      ? 8
      : MusicOverlay.compat.legacyEditorState.value.ticker.style === "glass" ? 18 : 999;
  }
  if (id === "text") {
    [fullTitle, fullArtist, fullTime, tickerTitle, tickerTime].forEach(item => props(item).color = MusicOverlay.compat.legacyEditorState.value.colors.text);
  }
  if (id === "progress") {
    [fullProgress, tickerProgress].forEach(item => props(item).color = MusicOverlay.compat.legacyEditorState.value.colors.progress);
  }
  if (["progressBackgroundColor", "progressBackgroundOpacity"].includes(id)) {
    [fullProgress, tickerProgress].forEach(item => props(item).background = MusicOverlay.compat.legacyEditorState.value.colors.progressBackground);
  }
  if (id === "vinylStyle") props(fullVinyl).style = MusicOverlay.compat.legacyEditorState.value.vinyl.style;
  if (id.startsWith("particles")) {
    Object.assign(props(fullParticles), {
      style: MusicOverlay.compat.legacyEditorState.value.particles.style, color: MusicOverlay.compat.legacyEditorState.value.particles.color,
      count: MusicOverlay.compat.legacyEditorState.value.particles.count, size: MusicOverlay.compat.legacyEditorState.value.particles.size,
      durationMs: MusicOverlay.compat.legacyEditorState.value.particles.durationMs
    });
    if (fullParticles) fullParticles.visible = MusicOverlay.compat.legacyEditorState.value.particles.enabled;
  }
  if (id.startsWith("equalizer") || id === "fftPreset") {
    Object.assign(props(tickerEqualizer), {
      style: MusicOverlay.compat.legacyEditorState.value.equalizer.style, color: MusicOverlay.compat.legacyEditorState.value.equalizer.colorMode === "custom" ? MusicOverlay.compat.legacyEditorState.value.equalizer.color : MusicOverlay.compat.legacyEditorState.value.colors.progress,
      barCount: MusicOverlay.compat.legacyEditorState.value.equalizer.barCount, gap: MusicOverlay.compat.legacyEditorState.value.equalizer.gap,
      height: MusicOverlay.compat.legacyEditorState.value.equalizer.height, glow: MusicOverlay.compat.legacyEditorState.value.equalizer.glow,
      glowPower: MusicOverlay.compat.legacyEditorState.value.equalizer.glowPower
    });
    if (tickerEqualizer) tickerEqualizer.visible = MusicOverlay.compat.legacyEditorState.value.equalizer.enabled;
  }
}


MusicOverlay.editor.inspector = Object.freeze({ render: renderInspector, select: selectItem, updateFromEvent: updateSelectedFromInspector, fillGlobalForm, readGlobalForm });

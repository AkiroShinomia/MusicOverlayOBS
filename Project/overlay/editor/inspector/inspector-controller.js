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
  const config = MusicOverlay.editor.compat.legacyFormProjection.getSnapshot();
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
  config.layout = normalizeLayout(config.layout, config);
  return config;
}

function getSceneGroups() {
  return MusicOverlay.editor.state.uiAdapters.groups();
}

function getSceneLayers() {
  return MusicOverlay.editor.state.uiAdapters.layers();
}

function getSelectedItem() {
  return MusicOverlay.editor.state.uiAdapters.get(MusicOverlay.editor.state.uiAdapters.selection().id);
}

function getGroup(id) {
  const item = MusicOverlay.editor.state.uiAdapters.get(id);
  return item?.__sceneNode?.nodeType === "group" ? item : null;
}

function getAnimationOverrideGroup(item, itemType = MusicOverlay.editor.state.uiAdapters.selection().type) {
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
  if (owner === item && MusicOverlay.editor.state.uiAdapters.selection().type === "group" && item.animation?.overrideChildren !== true) return;
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
  const isDynamic = MusicOverlay.editor.state.uiAdapters.selection().type === "layer" && Boolean(item.templateId);
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
    props.fftPreset ??= MusicOverlay.editor.context.sceneStore.getSnapshot().appearance?.equalizer?.preset || "balanced";
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
  const item = MusicOverlay.editor.state.uiAdapters.get(id);
  if (!item) return;
  const actualType = item.__sceneNode?.nodeType === "group" ? "group" : "layer";
  MusicOverlay.editor.context.sessionStore.setSelection({ type: item.__sceneNode?.nodeType || "component", id });
  activateSidebarPane("inspector");
  renderInspector();
  renderTimeline();
  applyLayoutToPreview();
}

function renderInspector() {
  const item = getSelectedItem();
  if (!item) return;

  $("inspectorType").textContent = MusicOverlay.editor.state.uiAdapters.selection().type === "group"
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "ГРУППА" : "GROUP")
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "ОБЪЕКТ" : "OBJECT");
  $("inspectorName").value = item.name || item.id;
  $("inspectorVisible").checked = item.visible !== false;
  $("inspectorLocked").checked = item.locked === true;
  $("inspectorMarker").value = normalizeHex(item.marker);
  $("inspectorX").value = item.x || 0;
  $("inspectorY").value = item.y || 0;
  $("inspectorScale").value = item.scale || 100;
  const parentGroup = MusicOverlay.editor.state.uiAdapters.selection().type === "layer" ? getGroup(item.groupId) : null;
  const groupStart = Number(parentGroup?.timing?.startMs || 0);
  const localTiming = MusicOverlay.editor.state.uiAdapters.selection().type === "layer" && parentGroup;
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
  const isGroup = MusicOverlay.editor.state.uiAdapters.selection().type === "group";
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
  groupField.hidden = MusicOverlay.editor.state.uiAdapters.selection().type !== "layer";
  groupSelect.innerHTML = `<option value="">${MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Без группы" : "No group"}</option>`;
  const scene = MusicOverlay.editor.context.sceneStore.getSnapshot();
  scene.nodes.filter(node => node.nodeType === "group").forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    groupSelect.appendChild(option);
  });
  if (MusicOverlay.editor.state.uiAdapters.selection().type === "layer") groupSelect.value = item.groupId || "";

  const group = MusicOverlay.editor.state.uiAdapters.selection().type === "layer" ? getGroup(item.groupId) : item;
  $("transformHint").textContent = MusicOverlay.editor.state.uiAdapters.selection().type === "layer" && group
    ? (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? `Перетаскивание двигает объект «${item.name}». Выберите группу на таймлайне для общего изменения.` : `Drag moves “${item.name}”. Select its group on the Timeline for a shared transform.`)
    : (MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Перетаскивайте выбранную группу на холсте или задайте точные координаты." : "Drag the selected group on the Canvas or enter exact coordinates.");

  $("deleteGroupBtn").disabled = MusicOverlay.editor.state.uiAdapters.selection().type !== "group";
}

function updateSelectedFromInspector(event) {
  const context = MusicOverlay.editor.context;
  const scene = context.sceneStore.getSnapshot();
  const selectedId = MusicOverlay.editor.state.uiAdapters.selection().id;
  const node = context.selectors.nodeById(scene, selectedId);
  if (!node) return;
  const item = MusicOverlay.editor.state.uiAdapters.get(selectedId);
  const changedField = event?.target?.id || "";
  const isGroup = node.nodeType === "group";
  const targetParentId = isGroup ? node.parentId || null : ($("inspectorGroup").value || null);
  const targetParent = targetParentId ? context.selectors.nodeById(scene, targetParentId) : null;
  const parentWindow = targetParent ? context.selectors.effectiveTiming(scene, targetParent.id) : null;
  const finiteParent = Boolean(targetParent && Number.isFinite(Number(parentWindow?.endMs)));
  const startInput = clampNumber($("inspectorStart").value, 0, 3600000, 0);
  const rawEnd = $("inspectorEnd").value.trim();
  const endInput = rawEnd === ""
    ? startInput + Math.max(50, Number(node.timing?.durationMs || 1000))
    : clampNumber(rawEnd, startInput + 50, 3600000, startInput + 1000);
  const fillBoundary = $("inspectorUntilNext").checked;
  const endMode = fillBoundary ? (finiteParent ? "parentEnd" : "trackEnd") : "fixed";
  const scale = clampNumber($("inspectorScale").value, 10, 400, 100) / 100;
  const effects = {
    opacity: clampNumber($("inspectorOpacity").value, 0, 100, 100),
    blur: clampNumber($("inspectorBlur").value, 0, 80, 0),
    glow: clampNumber($("inspectorGlow").value, 0, 100, 0)
  };
  const mutations = [
    { type: "node.rename", payload: { id: node.id, name: $("inspectorName").value.trim() || node.id } },
    { type: "node.visibility", payload: { id: node.id, visible: $("inspectorVisible").checked } },
    { type: "node.lock", payload: { id: node.id, locked: $("inspectorLocked").checked } },
    { type: "node.marker", payload: { id: node.id, marker: $("inspectorMarker").value } },
    {
      type: "node.transform",
      payload: {
        id: node.id,
        patch: {
          x: clampNumber($("inspectorX").value, -10000, 10000, 0),
          y: clampNumber($("inspectorY").value, -10000, 10000, 0),
          scaleX: scale,
          scaleY: scale
        }
      }
    }
  ];

  if (!isGroup && (node.parentId || null) !== targetParentId) {
    mutations.push({ type: "node.reparent", payload: { id: node.id, parentId: targetParentId } });
  }

  mutations.push({
    type: "node.timing",
    payload: {
      id: node.id,
      patch: {
        startMs: startInput,
        endMode,
        durationMs: endMode === "fixed" ? Math.max(50, endInput - startInput) : null
      }
    }
  });
  mutations.push({
    type: "node.effects",
    payload: {
      id: node.id,
      effects: [
        { type: "opacity", enabled: true, value: effects.opacity },
        { type: "blur", enabled: effects.blur > 0, value: effects.blur },
        { type: "glow", enabled: effects.glow > 0, value: effects.glow }
      ]
    }
  });

  const inheritedAnimationGroup = getAnimationOverrideGroup(item, isGroup ? "group" : "layer");
  const overrideChildren = isGroup ? $("inspectorOverrideChildren").checked : false;
  const animationEditable = !inheritedAnimationGroup && (!isGroup || overrideChildren);
  if (isGroup && !inheritedAnimationGroup) {
    mutations.push({
      type: "node.animations",
      payload: { id: node.id, patch: { overrideChildren } }
    });
  }
  if (animationEditable) {
    let enterDuration = clampNumber($("inspectorEnterDuration").value, 0, 10000, 600);
    let exitDuration = clampNumber($("inspectorExitDuration").value, 0, 10000, 600);
    const enterType = $("inspectorEnter").value;
    const exitType = $("inspectorExit").value;
    if (enterType !== "none" && enterDuration === 0) enterDuration = 600;
    if (exitType !== "none" && exitDuration === 0) exitDuration = 600;
    mutations.push({
      type: "node.animations",
      payload: {
        id: node.id,
        patch: {
          in: {
            ...(node.animations?.in || {}),
            type: enterType,
            durationMs: enterDuration,
            easing: $("inspectorEnterEasing").value
          },
          out: {
            ...(node.animations?.out || {}),
            type: exitType,
            durationMs: exitDuration,
            easing: $("inspectorExitEasing").value
          }
        }
      }
    });
  }

  context.commit({ type: "batch", payload: { mutations } });
  $("inspectorEnd").disabled = fillBoundary;
  updateEditor();
  updateHistoryControls();
  const updatedItem = MusicOverlay.editor.state.uiAdapters.get(node.id);
  if (animationEditable && (changedField.startsWith("inspectorEnter") || changedField === "inspectorOverrideChildren")) {
    auditionAnimation(updatedItem, "in");
  } else if (animationEditable && changedField.startsWith("inspectorExit")) {
    auditionAnimation(updatedItem, "out");
  }
}


MusicOverlay.editor.inspector = Object.freeze({ render: renderInspector, select: selectItem, updateFromEvent: updateSelectedFromInspector, fillGlobalForm, readGlobalForm });

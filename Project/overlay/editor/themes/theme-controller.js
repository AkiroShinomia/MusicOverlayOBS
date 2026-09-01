function markThemeDirty(forceHistory = false) {
  MusicOverlay.compat.editorRuntime.themeDirty = true;
  const meta = getCurrentThemeMeta();
  if (meta) {
    MusicOverlay.compat.editorRuntime.activeThemeId = meta.id;
    MusicOverlay.compat.editorRuntime.activeThemeType = meta.type;
  }
  updateThemeControls();
  recordHistorySnapshot(forceHistory);
}

function getCurrentThemeMeta() {
  const id = $("themePreset").value;
  return id && id !== "Custom" ? MusicOverlay.compat.editorRuntime.availableThemes.find(theme => theme.id === id) || null : null;
}

function updateThemeControls() {
  const meta = getCurrentThemeMeta();
  $("deleteThemeBtn").hidden = !meta || meta.type !== "custom" || meta.id !== MusicOverlay.compat.editorRuntime.activeThemeId;
}

async function loadThemes() {
  const select = $("themePreset");
  const selectedId = MusicOverlay.compat.editorRuntime.activeThemeId || select.value;
  select.innerHTML = '<option value="Custom">Custom</option>';
  try {
    const response = await MusicOverlay.api.themes.list();
    const rawThemes = await response.json();
    const seenIds = new Set();
    const seenNames = new Set();
    MusicOverlay.compat.editorRuntime.availableThemes = rawThemes.filter(theme => {
      const id = String(theme.id || "").toLocaleLowerCase();
      const name = String(theme.name || theme.id || "").trim().toLocaleLowerCase();
      if (!id || seenIds.has(id) || seenNames.has(name)) return false;
      seenIds.add(id);
      seenNames.add(name);
      return true;
    });
    MusicOverlay.compat.editorRuntime.availableThemes.forEach(theme => {
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
  if (MusicOverlay.compat.editorRuntime.loadedThemes[id]) return MusicOverlay.compat.editorRuntime.loadedThemes[id];
  const meta = MusicOverlay.compat.editorRuntime.availableThemes.find(theme => theme.id === id);
  if (!meta) return null;
  const response = await MusicOverlay.api.scenes.getTheme(meta.path);
  const theme = await response.json();
  MusicOverlay.compat.editorRuntime.loadedThemes[id] = theme;
  return theme;
}

async function applyThemePreset() {
  const presetId = $("themePreset").value;
  const preset = await getThemePreset(presetId);
  if (!preset) {
    MusicOverlay.compat.editorRuntime.activeThemeId = null;
    MusicOverlay.compat.editorRuntime.activeThemeType = null;
    MusicOverlay.compat.editorRuntime.themeDirty = false;
    MusicOverlay.compat.legacyEditorState.value.theme.preset = "Custom";
    updateThemeControls();
    return;
  }

  const meta = getCurrentThemeMeta();
  const globalSettings = { audio: structuredClone(MusicOverlay.compat.legacyEditorState.value.audio || { sourceMode: "auto" }) };
  MusicOverlay.compat.legacyEditorState.value = SceneEditorModel.fromScene(preset, globalSettings, defaultConfig);
  MusicOverlay.compat.legacyEditorState.value.theme.preset = presetId;
  MusicOverlay.compat.legacyEditorState.value.layout = normalizeLayout(MusicOverlay.compat.legacyEditorState.value.layout, MusicOverlay.compat.legacyEditorState.value);
  const selectionCollection = MusicOverlay.compat.editorRuntime.selection.type === "group" ? MusicOverlay.compat.legacyEditorState.value.layout.groups : MusicOverlay.compat.legacyEditorState.value.layout.layers;
  if (!selectionCollection.some(item => item.id === MusicOverlay.compat.editorRuntime.selection.id)) {
    MusicOverlay.compat.editorRuntime.selection = MusicOverlay.compat.legacyEditorState.value.layout.groups.length
      ? { type: "group", id: MusicOverlay.compat.legacyEditorState.value.layout.groups[0].id }
      : { type: "layer", id: MusicOverlay.compat.legacyEditorState.value.layout.layers[0]?.id || "" };
  }
  MusicOverlay.compat.editorRuntime.activeThemeId = meta?.id || presetId;
  MusicOverlay.compat.editorRuntime.activeThemeType = meta?.type || "builtin";
  MusicOverlay.compat.editorRuntime.themeDirty = false;
  fillGlobalForm(MusicOverlay.compat.legacyEditorState.value);
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
  return SceneEditorModel.toScene(config, {
    id: `theme-${String(config.theme?.preset || "custom").replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}`,
    name: config.theme?.preset || "Custom theme",
    themeType: "custom",
    sourceThemeId: config.theme?.preset || "Custom"
  });
}

async function saveCustomTheme() {
  const name = $("customThemeName").value.trim();
  if (!name) {
    setStatus("Введите название темы.", "error");
    return;
  }
  MusicOverlay.compat.legacyEditorState.value = readGlobalForm();
  try {
    const response = await MusicOverlay.api.themes.create({ name, scene: createThemePayload(MusicOverlay.compat.legacyEditorState.value) });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Не удалось сохранить тему.");
    $("customThemeName").value = "";
    await loadThemes();
    $("themePreset").value = result.id;
    MusicOverlay.compat.editorRuntime.activeThemeId = result.id;
    MusicOverlay.compat.editorRuntime.activeThemeType = "custom";
    MusicOverlay.compat.editorRuntime.themeDirty = false;
    updateThemeControls();
    setStatus("Тема сохранена.", "success");
    return true;
  } catch (error) {
    setStatus(error.message || "Не удалось сохранить тему.", "error");
    return false;
  }
}

async function updateCustomTheme() {
  if (!MusicOverlay.compat.editorRuntime.activeThemeId || MusicOverlay.compat.editorRuntime.activeThemeType !== "custom") return;
  MusicOverlay.compat.legacyEditorState.value = readGlobalForm();
  try {
    const themeId = MusicOverlay.compat.editorRuntime.activeThemeId.replace("custom/", "");
    const response = await MusicOverlay.api.themes.update(themeId, { scene: createThemePayload(MusicOverlay.compat.legacyEditorState.value) });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Не удалось обновить тему.");
    MusicOverlay.compat.editorRuntime.themeDirty = false;
    await loadThemes();
    $("themePreset").value = MusicOverlay.compat.editorRuntime.activeThemeId;
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
  const canOverwrite = meta?.type === "custom" && meta.id === MusicOverlay.compat.editorRuntime.activeThemeId;
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
  const canOverwrite = meta?.type === "custom" && meta.id === MusicOverlay.compat.editorRuntime.activeThemeId;
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
  if (!meta || meta.type !== "custom" || meta.id !== MusicOverlay.compat.editorRuntime.activeThemeId) return;
  const question = MusicOverlay.compat.editorRuntime.currentLanguage === "ru"
    ? `Удалить тему «${meta.name || meta.id}»? Файл темы будет удалён.`
    : `Delete theme “${meta.name || meta.id}”? The theme file will be removed.`;
  if (!window.confirm(question)) return;
  try {
    const response = await MusicOverlay.api.themes.remove(meta.id.replace("custom/", ""));
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Не удалось удалить тему.");
    delete MusicOverlay.compat.editorRuntime.loadedThemes[meta.id];
    MusicOverlay.compat.editorRuntime.activeThemeId = null;
    MusicOverlay.compat.editorRuntime.activeThemeType = null;
    MusicOverlay.compat.editorRuntime.themeDirty = true;
    await loadThemes();
    $("themePreset").value = "Custom";
    updateThemeControls();
    setStatus(MusicOverlay.compat.editorRuntime.currentLanguage === "ru" ? "Тема удалена. Композиция осталась в редакторе." : "Theme deleted. The composition stays in the editor.", "success");
  } catch (error) {
    setStatus(error.message || "Не удалось удалить тему.", "error");
  }
}


MusicOverlay.editor.themes = Object.freeze({ load: loadThemes, applySelected: applyThemePreset, saveCustom: saveCustomTheme, updateCustom: updateCustomTheme, deleteSelected: deleteSelectedTheme, markDirty: markThemeDirty });

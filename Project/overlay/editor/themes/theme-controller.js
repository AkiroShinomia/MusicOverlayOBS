function getThemeSession() {
  return MusicOverlay.editor.context.sessionStore.getSnapshot().theme;
}

function patchThemeSession(patch) {
  const session = MusicOverlay.editor.context.sessionStore.getSnapshot();
  MusicOverlay.editor.context.sessionStore.patch({
    theme: { ...session.theme, ...patch }
  });
}

function markThemeDirty(forceHistory = false) {
  const meta = getCurrentThemeMeta();
  const current = getThemeSession();
  patchThemeSession({
    activeId: meta?.id || current.activeId,
    activeType: meta?.type || current.activeType,
    dirty: true
  });
  const context = MusicOverlay.editor.context;
  if (forceHistory && context?.isInitialized()) context.history.record(true);
  updateThemeControls();
}

function getCurrentThemeMeta() {
  const id = $("themePreset").value;
  return id && id !== "Custom"
    ? getThemeSession().available.find(theme => theme.id === id) || null
    : null;
}

function updateThemeControls() {
  const meta = getCurrentThemeMeta();
  $("deleteThemeBtn").hidden = !meta || meta.type !== "custom" || meta.id !== getThemeSession().activeId;
}

async function loadThemes() {
  const select = $("themePreset");
  const selectedId = getThemeSession().activeId || select.value;
  select.innerHTML = '<option value="Custom">Custom</option>';
  try {
    const response = await MusicOverlay.api.themes.list();
    if (!response.ok) throw new Error(`Themes API returned HTTP ${response.status}`);
    const rawThemes = await response.json();
    if (!Array.isArray(rawThemes)) throw new Error("Themes API returned an invalid payload");
    const seenIds = new Set();
    const seenNames = new Set();
    const available = rawThemes.filter(theme => {
      const id = String(theme.id || "").toLocaleLowerCase();
      const name = String(theme.name || theme.id || "").trim().toLocaleLowerCase();
      if (!id || seenIds.has(id) || seenNames.has(name)) return false;
      seenIds.add(id);
      seenNames.add(name);
      return true;
    });
    patchThemeSession({ available });
    available.forEach(theme => {
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
  const current = getThemeSession();
  if (current.loaded[id]) return current.loaded[id];
  const meta = current.available.find(theme => theme.id === id);
  if (!meta) return null;
  const response = await MusicOverlay.api.scenes.getTheme(meta.path);
  if (!response.ok) throw new Error(`Theme '${id}' is unavailable`);
  const theme = await response.json();
  patchThemeSession({ loaded: { ...getThemeSession().loaded, [id]: theme } });
  return theme;
}

function asWorkspaceScene(scene, sourceThemeId) {
  const next = structuredClone(scene);
  next.id = "workspace-draft";
  next.metadata = {
    ...(next.metadata || {}),
    name: "Draft",
    themeType: "workspace",
    sourceThemeId
  };
  return next;
}

function syncLegacyProjection(scene) {
  const settings = MusicOverlay.editor.context.getSettings();
  const projection = MusicOverlay.editor.compat.legacyFormProjection.fromScene(scene, settings);
  fillGlobalForm(projection);
}

function syncSelectionFromContext() {
  MusicOverlay.editor.context.sessionStore.ensureValidSelection(
    MusicOverlay.editor.context.sceneStore.getSnapshot(),
    MusicOverlay.editor.context.selectors
  );
}

async function applyThemePreset() {
  const presetId = $("themePreset").value;
  if (!presetId || presetId === "Custom") {
    MusicOverlay.editor.compat.legacyFormProjection.setThemePreset("Custom");
    patchThemeSession({ activeId: null, activeType: null, dirty: false });
    updateThemeControls();
    return;
  }

  try {
    const preset = await getThemePreset(presetId);
    if (!preset) return;
    const meta = getCurrentThemeMeta();
    const scene = asWorkspaceScene(preset, presetId);

    MusicOverlay.editor.context.replaceScene(scene, { forceHistory: true, themeDirty: false });
    MusicOverlay.editor.context.history.reset();
    syncSelectionFromContext();
    syncLegacyProjection(scene);

    const currentSession = MusicOverlay.editor.context.sessionStore.getSnapshot();
    MusicOverlay.editor.context.sessionStore.patch({
      playheadMs: Math.min(currentSession.playheadMs, Number(scene.timeline?.durationMs || 30000))
    });
    MusicOverlay.compat.editorRuntime.currentDefaultCover = scene.appearance?.albumArt?.defaultCover || DEFAULT_COVER;
    patchThemeSession({
      activeId: meta?.id || presetId,
      activeType: meta?.type || "builtin",
      dirty: false
    });

    updateThemeControls();
    updateEditor();
    updateHistoryControls();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Не удалось применить тему.", "error");
  }
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

function createThemePayload() {
  return structuredClone(MusicOverlay.editor.context.sceneStore.getSnapshot());
}

function setActiveThemeAfterSave(id, type = "custom") {
  patchThemeSession({ activeId: id, activeType: type, dirty: false });
  MusicOverlay.editor.context.commit({
    type: "scene.metadata",
    payload: { patch: { sourceThemeId: id, themeType: "workspace" } }
  }, { forceHistory: true, themeDirty: false });
}

async function saveCustomTheme() {
  const name = $("customThemeName").value.trim();
  if (!name) {
    setStatus("Введите название темы.", "error");
    return false;
  }
  try {
    const response = await MusicOverlay.api.themes.create({ name, scene: createThemePayload() });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось сохранить тему.");
    $("customThemeName").value = "";
    await loadThemes();
    $("themePreset").value = result.id;
    setActiveThemeAfterSave(result.id, "custom");
    updateThemeControls();
    updateHistoryControls();
    setStatus("Тема сохранена.", "success");
    return true;
  } catch (error) {
    setStatus(error.message || "Не удалось сохранить тему.", "error");
    return false;
  }
}

async function updateCustomTheme() {
  const activeTheme = getThemeSession();
  if (!activeTheme.activeId || activeTheme.activeType !== "custom") return false;
  try {
    const themeId = activeTheme.activeId.replace("custom/", "");
    const response = await MusicOverlay.api.themes.update(themeId, { scene: createThemePayload() });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось обновить тему.");
    setActiveThemeAfterSave(activeTheme.activeId, "custom");
    await loadThemes();
    $("themePreset").value = activeTheme.activeId;
    updateThemeControls();
    updateHistoryControls();
    setStatus("Пользовательская тема обновлена.", "success");
    return true;
  } catch (error) {
    setStatus(error.message || "Не удалось обновить тему.", "error");
    return false;
  }
}

function refreshThemeSaveDialog() {
  const meta = getCurrentThemeMeta();
  const canOverwrite = meta?.type === "custom" && meta.id === getThemeSession().activeId;
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
  const canOverwrite = meta?.type === "custom" && meta.id === getThemeSession().activeId;
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
  if (!meta || meta.type !== "custom" || meta.id !== getThemeSession().activeId) return;
  const question = MusicOverlay.compat.editorRuntime.currentLanguage === "ru"
    ? `Удалить тему «${meta.name || meta.id}»? Файл темы будет удалён.`
    : `Delete theme “${meta.name || meta.id}”? The theme file will be removed.`;
  if (!window.confirm(question)) return;
  try {
    const response = await MusicOverlay.api.themes.remove(meta.id.replace("custom/", ""));
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось удалить тему.");
    const currentTheme = getThemeSession();
    const loaded = { ...currentTheme.loaded };
    delete loaded[meta.id];
    patchThemeSession({ loaded, activeId: null, activeType: null, dirty: true });
    await loadThemes();
    $("themePreset").value = "Custom";
    updateThemeControls();
    setStatus(
      MusicOverlay.compat.editorRuntime.currentLanguage === "ru"
        ? "Тема удалена. Композиция осталась в редакторе."
        : "Theme deleted. The composition stays in the editor.",
      "success"
    );
  } catch (error) {
    setStatus(error.message || "Не удалось удалить тему.", "error");
  }
}

MusicOverlay.editor.themes = Object.freeze({
  load: loadThemes,
  applySelected: applyThemePreset,
  saveCustom: saveCustomTheme,
  updateCustom: updateCustomTheme,
  deleteSelected: deleteSelectedTheme,
  markDirty: markThemeDirty
});

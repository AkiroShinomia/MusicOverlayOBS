(function registerEditorContext(root) {
  "use strict";

  const sceneStore = root.editor.state.sceneStore.create();
  const sessionStore = root.editor.state.editorSessionStore.create({
    selection: null,
    expandedGroups: new Set(),
    viewport: { zoom: 1, panX: 0, panY: 0 },
    playheadMs: 1500,
    playback: { playing: false, frame: null, startedAt: 0, offsetMs: 0 },
    activePanels: { left: "inspector", right: "library" },
    transientDrag: null,
    persistence: { pending: false, saving: false, error: null, serverRevision: 0 },
    currentLanguage: "ru",
    theme: { available: [], loaded: {}, activeId: null, activeType: null, dirty: false },
    live: {
      currentDefaultCover: "/assets/default-cover.png",
      currentLiveCover: "",
      trackData: {
        title: "я не пойду с тобой гулять",
        artist: "Серега Пират",
        position: 42,
        duration: 176,
        thumbnail: "/assets/default-cover.png",
        audioBins: Array.from({ length: 128 }, (_, index) => .08 + Math.abs(Math.sin(index * .31) * Math.cos(index * .071)) * .72),
        audioBinsByPreset: {}
      }
    },
    websocket: { socket: null, retry: null, connected: false },
    controllers: { canvas: null, timeline: null, workspace: null, previewRenderer: null },
    canvasScale: 1,
    customLibraryAssets: []
  });
  const history = root.editor.history.snapshotHistory.create(sceneStore, sessionStore, { limit: 100, coalesceMs: 350 });
  let globalSettings = { audio: { sourceMode: "auto" } };
  let settingsRevision = 0;
  let savedSettingsRevision = 0;
  let initialized = false;
  let applying = false;

  function settingsDirty() {
    return settingsRevision !== savedSettingsRevision;
  }

  function draftDirty() {
    return root.editor.state.selectors.draftDirty(sceneStore.getState()) || settingsDirty();
  }

  async function saveDraftSnapshot(payload) {
    const { scene, localRevision, settings, settingsRevision: payloadSettingsRevision } = payload;
    sessionStore.patch({ persistence: { ...sessionStore.getSnapshot().persistence, pending: true, saving: true, error: null } });
    try {
      const response = await root.api.scenes.saveDraft({ scene, settings });
      const result = await response.json();
      if (!response.ok || result?.ok === false) throw new Error(result?.error || "Draft save failed");
      sceneStore.markDraftSaved(localRevision);
      const numericSettingsRevision = Number(payloadSettingsRevision);
      if (Number.isFinite(numericSettingsRevision) && numericSettingsRevision >= savedSettingsRevision && numericSettingsRevision <= settingsRevision) {
        savedSettingsRevision = numericSettingsRevision;
      }
      sessionStore.patch({
        persistence: {
          ...sessionStore.getSnapshot().persistence,
          pending: draftDirty(),
          saving: false,
          error: null,
          serverRevision: Number(result?.revision || 0)
        }
      });
    } catch (error) {
      sessionStore.patch({
        persistence: {
          ...sessionStore.getSnapshot().persistence,
          pending: true,
          saving: false,
          error: error?.message || String(error)
        }
      });
      throw error;
    }
  }

  const draftScheduler = root.editor.persistence.draftSaveScheduler.create(saveDraftSnapshot, 350);

  function settingsPayload() {
    return { audio: structuredClone(globalSettings.audio || { sourceMode: "auto" }) };
  }

  function scheduleDraftSave() {
    if (!initialized || applying) return;
    const snapshot = sceneStore.getSnapshot();
    if (!snapshot) return;
    sessionStore.patch({ persistence: { ...sessionStore.getSnapshot().persistence, pending: true } });
    draftScheduler.schedule({
      scene: snapshot,
      localRevision: sceneStore.getRevision(),
      settings: settingsPayload(),
      settingsRevision
    });
  }

  function commit(mutation, options = {}) {
    const beforeRevision = sceneStore.getRevision();
    const state = sceneStore.dispatch(mutation);
    if (sceneStore.getRevision() === beforeRevision) return state;
    history.record(options.forceHistory === true);
    const session = sessionStore.getSnapshot();
    sessionStore.patch({ theme: { ...session.theme, dirty: options.themeDirty !== false ? true : session.theme.dirty } });
    scheduleDraftSave();
    root.core.events?.emit?.("sceneChanged", { mutation, revision: sceneStore.getRevision() });
    return state;
  }

  function replaceScene(scene, options = {}) {
    const state = commit({ type: "scene.replace", payload: { scene } }, { forceHistory: options.forceHistory !== false, themeDirty: options.themeDirty });
    const snapshot = sceneStore.getSnapshot();
    sessionStore.ensureValidSelection(snapshot, root.editor.state.selectors);
    const groups = snapshot.nodes.filter(node => node.nodeType === "group").map(node => node.id);
    sessionStore.patch({ expandedGroups: new Set(groups) });
    return state;
  }

  function initialize(draft, published, settings) {
    globalSettings = structuredClone(settings || { audio: { sourceMode: "auto" } });
    globalSettings.audio ||= { sourceMode: "auto" };
    settingsRevision = 0;
    savedSettingsRevision = 0;
    const snapshot = sceneStore.load(draft, "workspace-draft");
    sceneStore.markPublished(sceneStore.hashSnapshot(published || draft));
    const groups = snapshot.nodes.filter(node => node.nodeType === "group").map(node => node.id);
    const sourceThemeId = snapshot.metadata?.sourceThemeId || null;
    const session = sessionStore.getSnapshot();
    sessionStore.patch({
      expandedGroups: new Set(groups),
      playheadMs: Math.min(1500, Number(snapshot.timeline?.durationMs || 30000)),
      theme: { ...session.theme, activeId: sourceThemeId, activeType: snapshot.metadata?.themeType || null, dirty: false },
      live: {
        ...session.live,
        currentDefaultCover: snapshot.appearance?.albumArt?.defaultCover || "/assets/default-cover.png",
        trackData: { ...session.live.trackData, thumbnail: snapshot.appearance?.albumArt?.defaultCover || "/assets/default-cover.png" }
      },
      persistence: { pending: false, saving: false, error: null, serverRevision: Number(snapshot.revision || 0) }
    });
    sessionStore.ensureValidSelection(snapshot, root.editor.state.selectors);
    history.reset();
    initialized = true;
    return snapshot;
  }

  async function apply() {
    applying = true;
    let appliedRevision = null;
    let appliedSettingsRevision = null;
    try {
      await draftScheduler.flush();
      const scene = sceneStore.getSnapshot();
      const settings = settingsPayload();
      appliedRevision = sceneStore.getRevision();
      appliedSettingsRevision = settingsRevision;
      const validation = sceneStore.validate();
      if (!validation.valid) throw new Error(validation.errors.join("; "));
      const response = await root.api.scenes.publish({ scene, settings });
      const result = await response.json();
      if (!response.ok || result?.ok === false) throw new Error(result?.error || "Publish failed");

      sceneStore.markDraftSaved(appliedRevision);
      if (appliedSettingsRevision >= savedSettingsRevision && appliedSettingsRevision <= settingsRevision) {
        savedSettingsRevision = appliedSettingsRevision;
      }
      sceneStore.markPublished(sceneStore.hashSnapshot(scene));
      const hasNewerScene = sceneStore.getRevision() !== appliedRevision;
      const session = sessionStore.getSnapshot();
      sessionStore.patch({
        persistence: {
          pending: draftDirty(),
          saving: false,
          error: null,
          serverRevision: Number(result?.revision || 0)
        },
        theme: { ...session.theme, dirty: hasNewerScene ? session.theme.dirty : false }
      });
      return result;
    } finally {
      applying = false;
      if (initialized && draftDirty()) scheduleDraftSave();
    }
  }

  function updateSettings(patch) {
    const next = {
      ...globalSettings,
      ...structuredClone(patch || {}),
      audio: { ...(globalSettings.audio || {}), ...(patch?.audio || {}) }
    };
    if (JSON.stringify(next) === JSON.stringify(globalSettings)) return false;
    globalSettings = next;
    settingsRevision += 1;
    scheduleDraftSave();
    return true;
  }

  function undo() {
    const changed = history.undo();
    if (changed) scheduleDraftSave();
    return changed;
  }

  function redo() {
    const changed = history.redo();
    if (changed) scheduleDraftSave();
    return changed;
  }

  root.editor.context = Object.freeze({
    sceneStore,
    sessionStore,
    history,
    selectors: root.editor.state.selectors,
    initialize,
    commit,
    replaceScene,
    apply,
    flushDraft: () => draftScheduler.flush(),
    scheduleDraftSave,
    getSettings: () => structuredClone(globalSettings),
    updateSettings,
    undo,
    redo,
    isInitialized: () => initialized
  });
})(window.MusicOverlay);

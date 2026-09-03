(() => {
  "use strict";

  const CLIENT_VERSION = "2.1.0";
  const DEFAULT_COVER = "/assets/default-cover.png";
  const RendererApi = window.MusicOverlaySceneRenderer;
  const FftPresetApi = window.MusicOverlayFftPresets;
  const PlaybackApi = window.MusicOverlayPlaybackClock;
  const mount = document.getElementById("sceneRuntimeMount");

  if (!RendererApi?.SceneRenderer || !FftPresetApi?.settings || !PlaybackApi?.PlaybackClock || !mount) {
    document.body.dataset.runtimeState = "error";
    throw new Error("Published scene runtime dependencies were not loaded");
  }

  const renderer = new RendererApi.SceneRenderer(mount, { mode: "published" });
  const playbackClock = new PlaybackApi.PlaybackClock();
  let publishedScene = null;
  let configSocket = null;
  let reconnectTimer = 0;
  let reloadTimer = 0;
  let compositionStartedAt = performance.now();
  let lastRenderAt = 0;
  let lastTrackKey = "";
  let trackMissingSince = 0;
  let previousThumbnail = "";
  let lastThumbnail = "";
  let ignoreOldThumbnailUntil = 0;
  let latestAudioBins = [];
  let latestAudioBinsByPreset = {};
  const smoothedAudioBinsByPreset = new Map();

  const track = {
    active: false,
    title: "Track title",
    artist: "Artist",
    thumbnail: DEFAULT_COVER
  };

  const clamp = (value, min, max, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };

  async function fetchJson(path) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${path}${separator}t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${path}`);
    return response.json();
  }

  async function loadPublishedScene({ restartTimeline = false } = {}) {
    const scene = await fetchJson("/api/scene/published");
    RendererApi.validateScene(scene);
    publishedScene = scene;
    renderer.updateScene(scene);
    if (restartTimeline || !mount.dataset.publishedRevision) compositionStartedAt = performance.now();
    mount.dataset.publishedSceneId = scene.id || "published-scene";
    mount.dataset.publishedRevision = String(scene.revision ?? 0);
    mount.dataset.geometryModel = scene.extensions?.["musicOverlay.geometry"]?.coordinateSpace || "native";
    document.body.dataset.runtimeState = "ready";
    renderFrame(performance.now(), true);
  }

  function setTrackActive(active) {
    track.active = active;
    document.body.classList.toggle("has-active-track", active);
    mount.dataset.trackActive = active ? "true" : "false";
  }

  function defaultCover() {
    return publishedScene?.appearance?.albumArt?.defaultCover || DEFAULT_COVER;
  }

  function acceptsThumbnail(value, isNewTrack) {
    if (!publishedScene?.appearance?.albumArt?.useWindowsThumbnail) return false;
    if (typeof value !== "string" || value.length <= 100) return false;
    if (isNewTrack && value === previousThumbnail) return false;
    if (!isNewTrack && Date.now() < ignoreOldThumbnailUntil && value === previousThumbnail) return false;
    return value !== lastThumbnail;
  }

  async function updateNowPlaying() {
    try {
      const data = await fetchJson("/api/nowplaying");
      if (!data.hasTrack || !data.title) {
        setTrackActive(false);
        if (!trackMissingSince) trackMissingSince = Date.now();
        if (Date.now() - trackMissingSince > 2500) lastTrackKey = "";
        return;
      }
      trackMissingSince = 0;

      const title = data.title || "Unknown track";
      const artist = data.artist || "Unknown artist";
      const apiPosition = Math.max(0, Number(data.position) || 0);
      const duration = Math.max(0, Number(data.duration) || 0);
      const key = `${title.trim().toLocaleLowerCase()}__${artist.trim().toLocaleLowerCase()}`;
      const currentPlayback = playbackClock.snapshot();
      const wasNearTrackEnd = currentPlayback.duration > 0 &&
        currentPlayback.position >= Math.max(8, currentPlayback.duration - 5);
      const restartedSameTrack = key === lastTrackKey && Boolean(data.isPlaying) && apiPosition < 2.5 && wasNearTrackEnd;
      const isNewTrack = key !== lastTrackKey || restartedSameTrack;

      if (isNewTrack) {
        lastTrackKey = key;
        previousThumbnail = lastThumbnail;
        lastThumbnail = "";
        ignoreOldThumbnailUntil = Date.now() + 3000;
        compositionStartedAt = performance.now();
        track.title = title;
        track.artist = artist;
        playbackClock.reset({ position: apiPosition, duration, isPlaying: data.isPlaying });
        track.thumbnail = defaultCover();
        if (acceptsThumbnail(data.thumbnail, true)) {
          track.thumbnail = data.thumbnail;
          lastThumbnail = data.thumbnail;
        }
        setTrackActive(true);
      } else {
        track.title = title;
        track.artist = artist;
        playbackClock.update({ position: apiPosition, duration, isPlaying: data.isPlaying });
        if (acceptsThumbnail(data.thumbnail, false)) {
          track.thumbnail = data.thumbnail;
          lastThumbnail = data.thumbnail;
        }
        setTrackActive(true);
      }
    } catch (error) {
      console.error("[MusicOverlay] Now Playing update failed:", error);
    }
  }

  function equalizerSettings(preset) {
    return FftPresetApi.settings(preset, publishedScene?.appearance?.equalizer || {});
  }

  function sourceAudioBands(audioData, settings) {
    if (settings.preset === "dynamicBars" && Array.isArray(audioData?.dynamicBarBands) && audioData.dynamicBarBands.length) return audioData.dynamicBarBands;
    if (settings.preset === "energy" && Array.isArray(audioData?.energyBands) && audioData.energyBands.length) return audioData.energyBands;
    if (Array.isArray(audioData?.bands) && audioData.bands.length) return audioData.bands;
    return [];
  }

  function processAudioBins(audioData, preset) {
    const settings = equalizerSettings(preset);
    const source = sourceAudioBands(audioData, settings);
    if (!source.length) return [];
    let smoothedAudioBins = smoothedAudioBinsByPreset.get(settings.preset);
    if (!smoothedAudioBins || smoothedAudioBins.length !== source.length) {
      smoothedAudioBins = new Array(source.length).fill(0);
      smoothedAudioBinsByPreset.set(settings.preset, smoothedAudioBins);
    }
    const sensitivity = clamp(settings.sensitivity, .25, 4, 1);
    const outputGain = clamp(settings.outputGain, .1, 4, 1);
    const contrast = clamp(settings.spectralContrast, .2, 4, 1);
    const curve = clamp(settings.visualCurvePower, .2, 4, 1);
    const smoothing = clamp(settings.smoothing, 0, .95, .55);
    const mean = source.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0) / source.length;
    const dynamicBars = settings.preset === "dynamicBars";
    const energy = settings.preset === "energy";
    const attack = dynamicBars || energy ? .78 + (1 - smoothing) * .18 : Math.max(.22, 1 - smoothing);
    const release = dynamicBars ? .12 + (1 - smoothing) * .16 : energy ? .18 + (1 - smoothing) * .28 : Math.max(.08, (1 - smoothing) * .55);

    return source.map((value, index) => {
      const raw = Math.max(0, Number(value) || 0);
      const aboveFloor = dynamicBars ? Math.max(0, (raw - .025) / .975) : Math.max(0, raw - .008);
      const contrasted = Math.max(0, mean + (aboveFloor - mean) * contrast);
      const presetCurve = dynamicBars ? 1.08 : energy ? .86 : curve;
      const presetGain = energy ? .92 : 1;
      const target = Math.min(1, Math.pow(contrasted, presetCurve) * sensitivity * outputGain * presetGain);
      const mix = target > smoothedAudioBins[index] ? attack : release;
      smoothedAudioBins[index] += (target - smoothedAudioBins[index]) * mix;
      if (smoothedAudioBins[index] < .003) smoothedAudioBins[index] = 0;
      return smoothedAudioBins[index];
    });
  }

  async function updateAudioLevel() {
    try {
      const audioData = await fetchJson("/api/audiolevel");
      const fallbackPreset = FftPresetApi.normalize(publishedScene?.appearance?.equalizer?.preset, "balanced");
      const presets = new Set([fallbackPreset]);
      (publishedScene?.nodes || [])
        .filter(node => node?.component?.kind === "equalizer")
        .forEach(node => presets.add(FftPresetApi.normalize(node.component?.properties?.fftPreset, fallbackPreset)));
      latestAudioBinsByPreset = Object.fromEntries([...presets].map(preset => [preset, processAudioBins(audioData, preset)]));
      latestAudioBins = latestAudioBinsByPreset[fallbackPreset] || [];
    } catch {
      // Audio capture can briefly switch between process and system fallback.
    }
  }

  function renderFrame(now, force = false) {
    if (!publishedScene) return;
    if (!force && now - lastRenderAt < 1000 / 30) return;
    const playback = playbackClock.snapshot();
    renderer.setFrame({
      timeMs: Math.max(0, now - compositionStartedAt),
      data: {
        title: track.title,
        artist: track.artist,
        position: playback.position,
        duration: playback.duration,
        thumbnail: track.thumbnail || defaultCover(),
        audioBins: latestAudioBins,
        audioBinsByPreset: latestAudioBinsByPreset
      }
    });
    lastRenderAt = now;
  }

  function animationLoop(now) {
    renderFrame(now);
    requestAnimationFrame(animationLoop);
  }

  function schedulePublishedReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(async () => {
      try {
        smoothedAudioBinsByPreset.clear();
        await loadPublishedScene({ restartTimeline: track.active });
        console.log("[MusicOverlay] Published scene reloaded; timeline restarted");
      } catch (error) {
        document.body.dataset.runtimeState = "error";
        console.error("[MusicOverlay] Published scene reload failed:", error);
      }
    }, 120);
  }

  async function verifyRuntimeVersion() {
    try {
      const data = await fetchJson("/api/version");
      if (data.version && data.version !== CLIENT_VERSION) location.reload();
    } catch {}
  }

  function connectConfigSocket() {
    clearTimeout(reconnectTimer);
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    configSocket = new WebSocket(`${protocol}//${location.host}/ws`);
    configSocket.onopen = () => {
      document.body.dataset.wsState = "connected";
      verifyRuntimeVersion();
    };
    configSocket.onmessage = event => {
      try {
        if (JSON.parse(event.data)?.type === "configChanged") schedulePublishedReload();
      } catch {}
    };
    configSocket.onclose = () => {
      document.body.dataset.wsState = "disconnected";
      reconnectTimer = setTimeout(connectConfigSocket, 1500);
    };
    configSocket.onerror = () => {
      try { configSocket.close(); } catch {}
    };
  }

  function schedulePoll(task, intervalMs) {
    setTimeout(async function poll() {
      await task();
      setTimeout(poll, intervalMs);
    }, intervalMs);
  }

  async function init() {
    try {
      await loadPublishedScene();
      connectConfigSocket();
      await Promise.all([updateNowPlaying(), updateAudioLevel()]);
      schedulePoll(updateNowPlaying, 750);
      schedulePoll(updateAudioLevel, 50);
      requestAnimationFrame(animationLoop);
    } catch (error) {
      document.body.dataset.runtimeState = "error";
      console.error("[MusicOverlay] Published runtime initialization failed:", error);
    }
  }

  window.MusicOverlayPublishedRuntime = Object.freeze({
    getDiagnostics: () => ({
      ...renderer.getDiagnostics(),
      runtimeState: document.body.dataset.runtimeState,
      wsState: document.body.dataset.wsState,
      trackActive: track.active,
      playback: playbackClock.snapshot(),
      publishedSceneId: mount.dataset.publishedSceneId,
      publishedRevision: mount.dataset.publishedRevision,
      compatibilityGeometry: mount.dataset.compatibilityGeometry
    })
  });

  init();
})();

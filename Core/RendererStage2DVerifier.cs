using System.Text.Json.Nodes;

namespace MusicOverlay.Core;

public sealed record RendererStage2DResult(
    int Scenes,
    int Nodes,
    int NativeClassicScenes,
    bool SceneWriteContract,
    bool LegacyRuntimeRemoved,
    bool PortableSettingsSeparated,
    bool MonotonicPlaybackClock,
    bool AnimationInheritancePolicy,
    bool EqualizerFftPresets,
    bool VisualGroupsMaterialized
);

public static class RendererStage2DVerifier
{
    public static async Task<RendererStage2DResult> VerifyAsync(PortableDataStore store)
    {
        string overlay = store.Paths.OverlayRoot;
        string settingsHtml = await File.ReadAllTextAsync(Path.Combine(overlay, "settings.html"));
        string[] editorSources = Directory.GetFiles(Path.Combine(overlay, "editor"), "*.js", SearchOption.AllDirectories)
            .Append(Path.Combine(overlay, "settings.js"))
            .ToArray();
        string settingsJs = string.Join('\n', await Task.WhenAll(editorSources.Select(path => File.ReadAllTextAsync(path))));
        string index = await File.ReadAllTextAsync(Path.Combine(overlay, "index.html"));
        string runtime = await File.ReadAllTextAsync(Path.Combine(overlay, "scene-runtime.js"));
        string playbackClock = await File.ReadAllTextAsync(Path.Combine(overlay, "shared", "playback-clock.js"));
        string timeline = await File.ReadAllTextAsync(Path.Combine(overlay, "shared", "scene-timeline.js"));
        string renderer = await File.ReadAllTextAsync(Path.Combine(overlay, "shared", "scene-renderer.js"));
        string fftPresets = await File.ReadAllTextAsync(Path.Combine(overlay, "shared", "fft-presets.js"));

        string[] removedAssets =
        [
            Path.Combine(overlay, "app.js"),
            Path.Combine(overlay, "style.css"),
            Path.Combine(overlay, "shared", "legacy-scene-adapter.js")
        ];
        bool legacyRuntimeRemoved = removedAssets.All(path => !File.Exists(path)) &&
            !settingsHtml.Contains("legacy-scene-adapter", StringComparison.OrdinalIgnoreCase) &&
            !index.Contains("legacy-scene-adapter", StringComparison.OrdinalIgnoreCase) &&
            !runtime.Contains("/api/config", StringComparison.OrdinalIgnoreCase);
        if (!legacyRuntimeRemoved)
            throw new InvalidDataException("A legacy Preview/OBS runtime dependency is still active.");

        bool monotonicPlaybackClock = index.Contains("shared/playback-clock.js", StringComparison.Ordinal) &&
            runtime.Contains("playbackClock.update", StringComparison.Ordinal) &&
            playbackClock.Contains("apiPosition > predicted", StringComparison.Ordinal) &&
            playbackClock.Contains("apiMovedBack", StringComparison.Ordinal);
        if (!monotonicPlaybackClock)
            throw new InvalidDataException("Published runtime does not use the shared monotonic playback clock.");

        bool sceneWriteContract = settingsJs.Contains("/api/scene/draft", StringComparison.Ordinal) &&
            settingsJs.Contains("/api/scene/publish", StringComparison.Ordinal) &&
            settingsJs.Contains("MusicOverlaySceneEditorModel", StringComparison.Ordinal) &&
            !settingsJs.Contains("fetch(\"/api/config", StringComparison.Ordinal);
        if (!sceneWriteContract)
            throw new InvalidDataException("Editor does not use the native Scene v2 read/write contract.");

        JsonObject globalSettings = await store.GetGlobalSettingsAsync();
        bool settingsSeparated = globalSettings["documentType"]?.GetValue<string>() == "music-overlay.settings" &&
            globalSettings["audio"]?["sourceMode"] is not null;
        if (!settingsSeparated)
            throw new InvalidDataException("Portable global settings are not separated from the scene document.");

        var scenes = new List<(string Source, JsonObject Scene)>
        {
            ("draft", await store.GetDraftSceneAsync()),
            ("published", await store.GetPublishedSceneAsync())
        };
        foreach (ThemeSummary theme in store.GetThemes())
            scenes.Add((theme.id, await store.GetThemeSceneAsync(theme.id)));

        int nodes = 0;
        int nativeClassicScenes = 0;
        bool animationPolicy = timeline.Contains("resolveAnimations", StringComparison.Ordinal) &&
            timeline.Contains("overrideChildren", StringComparison.Ordinal) &&
            renderer.Contains("Timeline.resolveAnimations", StringComparison.Ordinal) &&
            settingsJs.Contains("inspectorOverrideChildren", StringComparison.Ordinal);
        bool equalizerPresets = fftPresets.Contains("dynamicBars", StringComparison.Ordinal) &&
            runtime.Contains("audioBinsByPreset", StringComparison.Ordinal) &&
            settingsHtml.Contains("shared/fft-presets.js", StringComparison.Ordinal);
        bool visualGroupsMaterialized = !renderer.Contains("mo-scene-group-surface", StringComparison.Ordinal);
        foreach ((string source, JsonObject scene) in scenes)
        {
            SceneDocumentConverter.Validate(scene);
            nodes += scene["nodes"]!.AsArray().Count;
            foreach (JsonObject node in scene["nodes"]!.AsArray().OfType<JsonObject>())
            {
                if (node["nodeType"]?.GetValue<string>() == "group" && node["animations"]?["overrideChildren"] is null)
                    animationPolicy = false;
                if (node["component"]?["kind"]?.GetValue<string>() == "equalizer" && node["component"]?["properties"]?["fftPreset"] is null)
                    equalizerPresets = false;
                if (node["nodeType"]?.GetValue<string>() == "group" && node["component"]?["properties"]?["surface"]?.GetValue<bool>() == true)
                    visualGroupsMaterialized = false;
            }
            if (scene["extensions"]?["musicOverlay.runtime.v1"] is not null)
                throw new InvalidDataException($"Legacy runtime geometry remains in {source}.");

            Dictionary<string, JsonObject> byId = scene["nodes"]!.AsArray()
                .OfType<JsonObject>()
                .ToDictionary(node => node["id"]!.GetValue<string>(), StringComparer.OrdinalIgnoreCase);
            if (!byId.ContainsKey("full-card-group") || !byId.ContainsKey("ticker-group"))
                continue;

            JsonObject fullGroup = byId["full-card-group"];
            JsonObject tickerGroup = byId["ticker-group"];
            bool tickerBackgroundIsLayer = byId.Values.Any(node =>
                node["nodeType"]?.GetValue<string>() == "component" &&
                node["parentId"]?.GetValue<string>() == "ticker-group" &&
                node["component"]?["kind"]?.GetValue<string>() == "block");
            if (!tickerBackgroundIsLayer)
                throw new InvalidDataException($"Classic ticker background is not represented by a Block layer in {source}.");
            double fullX = fullGroup["transform"]?["x"]?.GetValue<double>() ?? 0;
            double fullWidth = fullGroup["component"]?["properties"]?["width"]?.GetValue<double>() ?? 0;
            double tickerWidth = tickerGroup["component"]?["properties"]?["width"]?.GetValue<double>() ?? 0;
            if (fullX == 0 || fullWidth <= 0 || tickerWidth <= 0)
                throw new InvalidDataException($"Classic geometry is not materialized in {source}.");
            nativeClassicScenes++;
        }

        if (!animationPolicy)
            throw new InvalidDataException("Scene group animation inheritance policy is incomplete.");
        if (!equalizerPresets)
            throw new InvalidDataException("Equalizer nodes do not expose per-object FFT presets.");
        if (!visualGroupsMaterialized)
            throw new InvalidDataException("A group still paints a visual surface outside Layers/Timeline.");

        return new RendererStage2DResult(
            scenes.Count,
            nodes,
            nativeClassicScenes,
            sceneWriteContract,
            legacyRuntimeRemoved,
            settingsSeparated,
            monotonicPlaybackClock,
            animationPolicy,
            equalizerPresets,
            visualGroupsMaterialized
        );
    }
}

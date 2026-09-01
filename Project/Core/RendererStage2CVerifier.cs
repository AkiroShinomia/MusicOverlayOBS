using System.Text.Json.Nodes;

namespace MusicOverlay.Core;

public sealed record RendererStage2CResult(
    int PublishedNodes,
    int RuntimeAssets,
    bool PublishedOnly,
    bool LegacyRuntimeDetached,
    bool DraftPublishedSeparated,
    bool LiveDataConnected
);

public static class RendererStage2CVerifier
{
    private static readonly string[] RuntimeAssets =
    {
        "scene-runtime.js",
        "scene-runtime.css",
        Path.Combine("shared", "playback-clock.js"),
        Path.Combine("shared", "fft-presets.js")
    };

    public static async Task<RendererStage2CResult> VerifyAsync(PortableDataStore store)
    {
        string overlayRoot = store.Paths.OverlayRoot;
        foreach (string asset in RuntimeAssets)
        {
            string path = Path.Combine(overlayRoot, asset);
            if (!File.Exists(path) || new FileInfo(path).Length == 0)
                throw new InvalidDataException($"Published runtime asset is missing: {asset}");
        }

        string index = await File.ReadAllTextAsync(Path.Combine(overlayRoot, "index.html"));
        string runtime = await File.ReadAllTextAsync(Path.Combine(overlayRoot, "scene-runtime.js"));
        JsonObject published = await store.GetPublishedSceneAsync();
        JsonObject draft = await store.GetDraftSceneAsync();
        SceneDocumentConverter.Validate(published);

        bool publishedOnly = runtime.Contains("/api/scene/published", StringComparison.Ordinal) &&
            !runtime.Contains("/api/scene/draft", StringComparison.Ordinal) &&
            !runtime.Contains("/api/config", StringComparison.Ordinal);
        bool legacyDetached = index.Contains("scene-runtime.js", StringComparison.Ordinal) &&
            index.Contains("shared/scene-renderer.js", StringComparison.Ordinal) &&
            !index.Contains("app.js", StringComparison.Ordinal) &&
            !index.Contains("fullOverlay", StringComparison.Ordinal);
        bool separated = store.Paths.DraftSceneFile != store.Paths.PublishedSceneFile &&
            draft["id"]?.GetValue<string>() != published["id"]?.GetValue<string>();
        bool liveData = runtime.Contains("/api/nowplaying", StringComparison.Ordinal) &&
            runtime.Contains("/api/audiolevel", StringComparison.Ordinal) &&
            runtime.Contains("configChanged", StringComparison.Ordinal) &&
            runtime.Contains("setFrame", StringComparison.Ordinal) &&
            runtime.Contains("audioBinsByPreset", StringComparison.Ordinal) &&
            runtime.Contains("PlaybackClock", StringComparison.Ordinal) &&
            index.Contains("shared/playback-clock.js", StringComparison.Ordinal) &&
            index.Contains("shared/fft-presets.js", StringComparison.Ordinal);

        if (!publishedOnly) throw new InvalidDataException("OBS runtime is not bound exclusively to Published Scene.");
        if (!legacyDetached) throw new InvalidDataException("Legacy OBS runtime is still mounted by index.html.");
        if (!separated) throw new InvalidDataException("Draft and Published sources are not separated.");
        if (!liveData) throw new InvalidDataException("Published runtime live-data pipeline is incomplete.");

        return new RendererStage2CResult(
            published["nodes"]!.AsArray().Count,
            RuntimeAssets.Length,
            publishedOnly,
            legacyDetached,
            separated,
            liveData
        );
    }
}

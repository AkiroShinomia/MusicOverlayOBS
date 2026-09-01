using System.Text.Json.Nodes;

namespace MusicOverlay.Core;

public sealed record SceneVerificationResult(
    int BundledThemes,
    int WorkspaceNodes,
    int RoundTrips,
    string AudioSourceMode,
    bool WritePipeline,
    bool CustomThemePipeline
);

public static class SceneMigrationVerifier
{
    public static async Task<SceneVerificationResult> VerifyAsync(PortableDataStore store)
    {
        AppPaths paths = store.Paths;
        JsonObject settings = await AtomicJsonFile.ReadObjectAsync(paths.SettingsFile)
            ?? throw new InvalidDataException("Global settings are missing.");
        if (settings["documentType"]?.GetValue<string>() != "music-overlay.settings")
            throw new InvalidDataException("Global settings document type is invalid.");

        string audioSourceMode = settings["audio"]?["sourceMode"]?.GetValue<string>() ?? "";
        if (audioSourceMode is not ("auto" or "process" or "system"))
            throw new InvalidDataException("Global audio source mode is invalid.");

        JsonObject draft = await AtomicJsonFile.ReadObjectAsync(paths.DraftSceneFile)
            ?? throw new InvalidDataException("Draft scene is missing.");
        JsonObject published = await AtomicJsonFile.ReadObjectAsync(paths.PublishedSceneFile)
            ?? throw new InvalidDataException("Published scene is missing.");
        SceneDocumentConverter.Validate(draft);
        SceneDocumentConverter.Validate(published);
        AssertParentEndProjection(
            SceneDocumentConverter.SceneToLegacyConfig(draft, settings, includeAudio: true),
            paths.DraftSceneFile
        );
        AssertParentEndProjection(
            SceneDocumentConverter.SceneToLegacyConfig(published, settings, includeAudio: true),
            paths.PublishedSceneFile
        );

        int themes = 0;
        int roundTrips = 0;
        foreach (string file in Directory.GetFiles(paths.BundledThemesRoot, "*.json", SearchOption.TopDirectoryOnly))
        {
            string themeId = Path.GetFileNameWithoutExtension(file);
            JsonObject scene = await store.GetBundledThemeSceneAsync(themeId);
            AssertCompositionIsUsable(scene, file);

            JsonObject roundTrip = SceneDocumentConverter.NormalizeSceneV2(scene);
            SceneDocumentConverter.Validate(roundTrip);
            AssertSameNodeIds(scene, roundTrip, file);
            themes++;
            roundTrips++;
        }

        JsonObject defaultScene = await AtomicJsonFile.ReadObjectAsync(paths.BundledDefaultSceneFile)
            ?? throw new InvalidDataException("Bundled default scene is missing.");
        SceneDocumentConverter.Validate(defaultScene);
        AssertCompositionIsUsable(defaultScene, paths.BundledDefaultSceneFile);

        (bool writePipeline, bool customThemePipeline) = await VerifyPortableWritePipelineAsync(store);

        return new SceneVerificationResult(
            themes,
            draft["nodes"]!.AsArray().Count,
            roundTrips,
            audioSourceMode,
            writePipeline,
            customThemePipeline
        );
    }

    private static async Task<(bool WritePipeline, bool CustomThemePipeline)> VerifyPortableWritePipelineAsync(
        PortableDataStore sourceStore
    )
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), $"MusicOverlayStage1Verify-{Guid.NewGuid():N}");
        string resolvedTempRoot = Path.GetFullPath(tempRoot);
        string resolvedSystemTemp = Path.GetFullPath(Path.GetTempPath());
        if (!resolvedTempRoot.StartsWith(resolvedSystemTemp, StringComparison.OrdinalIgnoreCase) ||
            !Path.GetFileName(resolvedTempRoot).StartsWith("MusicOverlayStage1Verify-", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Verification directory is outside the expected temporary root.");
        }

        try
        {
            AppPaths tempPaths = CreatePaths(resolvedTempRoot);
            Directory.CreateDirectory(tempPaths.BundledThemesRoot);
            File.Copy(sourceStore.Paths.BundledDefaultSceneFile, tempPaths.BundledDefaultSceneFile);
            foreach (string theme in Directory.GetFiles(sourceStore.Paths.BundledThemesRoot, "*.json", SearchOption.TopDirectoryOnly))
                File.Copy(theme, Path.Combine(tempPaths.BundledThemesRoot, Path.GetFileName(theme)));
            string sourceScenesRoot = Path.Combine(sourceStore.Paths.OverlayRoot, "scenes");
            string tempScenesRoot = Path.Combine(tempPaths.OverlayRoot, "scenes");
            if (Directory.Exists(sourceScenesRoot))
            {
                Directory.CreateDirectory(tempScenesRoot);
                foreach (string scene in Directory.GetFiles(sourceScenesRoot, "*.json", SearchOption.TopDirectoryOnly))
                    File.Copy(scene, Path.Combine(tempScenesRoot, Path.GetFileName(scene)));
            }

            JsonObject legacySeed = sourceStore.GetDraftLegacyConfig();
            await AtomicJsonFile.WriteAsync(tempPaths.LegacyConfigFile, legacySeed);

            var tempStore = new PortableDataStore(tempPaths);
            await tempStore.InitializeAsync();
            JsonObject before = AtomicJsonFile.ReadObject(tempPaths.DraftSceneFile)!;
            long beforeRevision = before["revision"]!.GetValue<long>();
            JsonObject settingsPatch = new()
            {
                ["audio"] = new JsonObject { ["sourceMode"] = "system" }
            };
            await tempStore.SaveDraftAndPublishSceneAsync(before, settingsPatch);

            JsonObject afterDraft = AtomicJsonFile.ReadObject(tempPaths.DraftSceneFile)!;
            JsonObject afterPublished = AtomicJsonFile.ReadObject(tempPaths.PublishedSceneFile)!;
            bool writePipeline = afterDraft["revision"]!.GetValue<long>() == beforeRevision + 1 &&
                afterPublished["revision"]!.GetValue<long>() == beforeRevision + 1 &&
                tempStore.GetAudioSourceMode() == "system";
            if (!writePipeline)
                throw new InvalidDataException("Draft/published write pipeline verification failed.");

            ThemeSummary created = await tempStore.SaveCustomThemeAsync("Verifier Theme", afterDraft);
            JsonObject loaded = await tempStore.GetThemeSceneAsync(created.id);
            await tempStore.UpdateCustomThemeAsync("verifier-theme", loaded);
            await tempStore.DeleteCustomThemeAsync("verifier-theme");
            bool customThemePipeline = !Directory.Exists(Path.Combine(tempPaths.CustomThemesRoot, "verifier-theme"));
            if (!customThemePipeline)
                throw new InvalidDataException("Custom theme lifecycle verification failed.");

            return (writePipeline, customThemePipeline);
        }
        finally
        {
            if (Directory.Exists(resolvedTempRoot))
                Directory.Delete(resolvedTempRoot, recursive: true);
        }
    }

    private static AppPaths CreatePaths(string appRoot)
    {
        string overlayRoot = Path.Combine(appRoot, "overlay");
        string dataRoot = Path.Combine(appRoot, "data");
        Directory.CreateDirectory(overlayRoot);
        return new AppPaths(
            appRoot,
            overlayRoot,
            dataRoot,
            Path.Combine(dataRoot, "settings.json"),
            Path.Combine(dataRoot, "workspace", "draft.scene.json"),
            Path.Combine(dataRoot, "workspace", "published.scene.json"),
            Path.Combine(dataRoot, "themes", "custom"),
            Path.Combine(dataRoot, "library", "assets"),
            Path.Combine(dataRoot, "library", "compositions"),
            Path.Combine(dataRoot, "backups"),
            Path.Combine(overlayRoot, "config.json"),
            Path.Combine(overlayRoot, "default.scene.json"),
            Path.Combine(overlayRoot, "themes")
        );
    }

    private static void AssertCompositionIsUsable(JsonObject scene, string source)
    {
        JsonArray nodes = scene["nodes"]!.AsArray();
        if (nodes.Count == 0)
            throw new InvalidDataException($"Scene has no nodes: {source}");
        if (!nodes.OfType<JsonObject>().Any(node => node["nodeType"]?.GetValue<string>() == "group"))
            throw new InvalidDataException($"Scene has no group: {source}");
        if (!nodes.OfType<JsonObject>().Any(node => node["nodeType"]?.GetValue<string>() == "component"))
            throw new InvalidDataException($"Scene has no component: {source}");

        double duration = scene["timeline"]?["durationMs"]?.GetValue<double>() ?? 0;
        if (duration is < 1000 or > 180000)
            throw new InvalidDataException($"Scene duration is outside supported bounds: {source}");
    }

    private static void AssertParentEndProjection(JsonObject legacyProjection, string source)
    {
        JsonObject layout = legacyProjection["layout"]?.AsObject()
            ?? throw new InvalidDataException($"Legacy projection has no layout: {source}");
        Dictionary<string, JsonObject> groups = layout["groups"]!.AsArray()
            .OfType<JsonObject>()
            .ToDictionary(group => group["id"]!.GetValue<string>(), StringComparer.OrdinalIgnoreCase);

        foreach (JsonObject layer in layout["layers"]!.AsArray().OfType<JsonObject>())
        {
            if (layer["timing"]?["untilGroupEnd"]?.GetValue<bool>() != true)
                continue;
            string? groupId = layer["groupId"]?.GetValue<string>();
            if (groupId is null || !groups.TryGetValue(groupId, out JsonObject? group))
                throw new InvalidDataException($"Parent-end layer has no parent group: {source}");

            bool groupIsInfinite = group["timing"]?["untilNextTrack"]?.GetValue<bool>() == true;
            bool layerIsInfinite = layer["timing"]?["untilNextTrack"]?.GetValue<bool>() == true;
            if (groupIsInfinite != layerIsInfinite)
                throw new InvalidDataException($"Parent-end layer infinity differs from its group: {source}");

            if (!groupIsInfinite)
            {
                double groupEnd = group["timing"]!["endMs"]!.GetValue<double>();
                double layerEnd = layer["timing"]!["endMs"]!.GetValue<double>();
                if (Math.Abs(groupEnd - layerEnd) > 0.001)
                    throw new InvalidDataException($"Parent-end layer does not inherit group end: {source}");
            }
        }
    }

    private static void AssertSameNodeIds(JsonObject expected, JsonObject actual, string source)
    {
        string[] expectedIds = expected["nodes"]!.AsArray()
            .OfType<JsonObject>()
            .Select(node => node["id"]!.GetValue<string>())
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        string[] actualIds = actual["nodes"]!.AsArray()
            .OfType<JsonObject>()
            .Select(node => node["id"]!.GetValue<string>())
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (!expectedIds.SequenceEqual(actualIds, StringComparer.OrdinalIgnoreCase))
            throw new InvalidDataException($"Round-trip changed scene nodes: {source}");

        Dictionary<string, JsonObject> expectedNodes = expected["nodes"]!.AsArray().OfType<JsonObject>()
            .ToDictionary(node => node["id"]!.GetValue<string>(), StringComparer.OrdinalIgnoreCase);
        Dictionary<string, JsonObject> actualNodes = actual["nodes"]!.AsArray().OfType<JsonObject>()
            .ToDictionary(node => node["id"]!.GetValue<string>(), StringComparer.OrdinalIgnoreCase);
        foreach (string id in expectedIds)
        {
            if (expectedNodes[id].ToJsonString() == actualNodes[id].ToJsonString())
                continue;
            string difference = FindFirstDifference(expectedNodes[id], actualNodes[id], $"nodes[{id}]");
            throw new InvalidDataException($"Round-trip changed node data at {difference}: {source}");
        }
    }

    private static string FindFirstDifference(JsonNode? left, JsonNode? right, string path)
    {
        if (left is JsonObject leftObject && right is JsonObject rightObject)
        {
            foreach (string key in leftObject.Select(item => item.Key).Union(rightObject.Select(item => item.Key)))
            {
                if (!leftObject.ContainsKey(key) || !rightObject.ContainsKey(key))
                    return $"{path}.{key} (missing)";
                string difference = FindFirstDifference(leftObject[key], rightObject[key], $"{path}.{key}");
                if (difference.Length > 0)
                    return difference;
            }
            return "";
        }
        if (left is JsonArray leftArray && right is JsonArray rightArray)
        {
            if (leftArray.Count != rightArray.Count)
                return $"{path}.length";
            for (int index = 0; index < leftArray.Count; index++)
            {
                string difference = FindFirstDifference(leftArray[index], rightArray[index], $"{path}[{index}]");
                if (difference.Length > 0)
                    return difference;
            }
            return "";
        }
        return left?.ToJsonString() == right?.ToJsonString() ? "" : $"{path} ({left?.ToJsonString()} != {right?.ToJsonString()})";
    }
}

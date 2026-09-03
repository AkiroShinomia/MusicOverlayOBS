using System.Text.Json.Nodes;
using MusicOverlay.Application.Abstractions;

namespace MusicOverlay.Core;

public sealed record ThemeSummary(string id, string name, string type, string path);

public sealed class PortableDataStore : ISceneStore, ISettingsStore, IThemeStore
{
    private readonly SemaphoreSlim writeGate = new(1, 1);

    public AppPaths Paths { get; }

    public PortableDataStore(AppPaths paths)
    {
        Paths = paths;
    }

    public async Task InitializeAsync(bool rewriteBundledDocuments = false)
    {
        Paths.EnsurePortableDirectories();

        JsonObject? legacyConfig = await TryReadObjectAsync(Paths.LegacyConfigFile);

        if (rewriteBundledDocuments)
            await RewriteBundledDocumentsAsync(legacyConfig);

        if (!File.Exists(Paths.SettingsFile))
        {
            await AtomicJsonFile.WriteAsync(
                Paths.SettingsFile,
                SceneDocumentConverter.CreateGlobalSettings(legacyConfig),
                Paths.BackupsRoot,
                "settings"
            );
        }

        JsonObject seedScene = await GetSeedSceneAsync(legacyConfig);

        if (!File.Exists(Paths.DraftSceneFile))
        {
            JsonObject draft = CreateWorkspaceCopy(seedScene, "workspace-draft", "Draft");
            await AtomicJsonFile.WriteAsync(Paths.DraftSceneFile, draft, Paths.BackupsRoot, "draft-scene");
        }

        if (!File.Exists(Paths.PublishedSceneFile))
        {
            JsonObject published = CreateWorkspaceCopy(seedScene, "workspace-published", "Published");
            await AtomicJsonFile.WriteAsync(Paths.PublishedSceneFile, published, Paths.BackupsRoot, "published-scene");
        }

        await NormalizeExistingStoredScenesAsync();

        await MigrateLegacyCustomThemesAsync();
        await WriteMigrationMarkerAsync(legacyConfig);
        await ArchiveImportedLegacyConfigAsync();
    }

    public JsonObject GetDraftLegacyConfig()
    {
        JsonObject scene = AtomicJsonFile.ReadObject(Paths.DraftSceneFile)
            ?? throw new FileNotFoundException("Draft scene is missing.", Paths.DraftSceneFile);
        JsonObject settings = AtomicJsonFile.ReadObject(Paths.SettingsFile)
            ?? SceneDocumentConverter.CreateGlobalSettings();
        return SceneDocumentConverter.SceneToLegacyConfig(scene, settings, includeAudio: true);
    }

    public JsonObject GetPublishedLegacyConfig()
    {
        JsonObject scene = AtomicJsonFile.ReadObject(Paths.PublishedSceneFile)
            ?? throw new FileNotFoundException("Published scene is missing.", Paths.PublishedSceneFile);
        JsonObject settings = AtomicJsonFile.ReadObject(Paths.SettingsFile)
            ?? SceneDocumentConverter.CreateGlobalSettings();
        return SceneDocumentConverter.SceneToLegacyConfig(scene, settings, includeAudio: true);
    }

    public async Task<JsonObject> GetDraftSceneAsync()
    {
        JsonObject scene = await AtomicJsonFile.ReadObjectAsync(Paths.DraftSceneFile)
            ?? throw new FileNotFoundException("Draft scene is missing.", Paths.DraftSceneFile);
        return SceneDocumentConverter.NormalizeSceneV2(scene);
    }

    public async Task<JsonObject> GetPublishedSceneAsync()
    {
        JsonObject scene = await AtomicJsonFile.ReadObjectAsync(Paths.PublishedSceneFile)
            ?? throw new FileNotFoundException("Published scene is missing.", Paths.PublishedSceneFile);
        return SceneDocumentConverter.NormalizeSceneV2(scene);
    }

    public async Task<JsonObject> GetGlobalSettingsAsync() =>
        await AtomicJsonFile.ReadObjectAsync(Paths.SettingsFile)
        ?? SceneDocumentConverter.CreateGlobalSettings();

    public async Task<long> SaveDraftSceneAsync(JsonObject sceneInput, JsonObject? settingsPatch)
    {
        await writeGate.WaitAsync();
        try
        {
            JsonObject scene = SceneDocumentConverter.NormalizeSceneV2(sceneInput);
            JsonObject? previousDraft = await AtomicJsonFile.ReadObjectAsync(Paths.DraftSceneFile);
            long revision = Math.Max(0, previousDraft?["revision"]?.GetValue<long>() ?? 0) + 1;
            scene["id"] = "workspace-draft";
            scene["revision"] = revision;
            JsonObject metadata = scene["metadata"] as JsonObject ?? new JsonObject();
            metadata["name"] = "Draft";
            metadata["themeType"] = "workspace";
            scene["metadata"] = metadata;

            JsonObject settings = await GetGlobalSettingsAsync();
            if (settingsPatch?["audio"]?["sourceMode"] is JsonValue sourceValue)
            {
                string sourceMode = sourceValue.GetValue<string>();
                if (sourceMode is not ("auto" or "process" or "system"))
                    throw new InvalidDataException("Unsupported audio source mode.");
                settings["audio"] = new JsonObject { ["sourceMode"] = sourceMode };
            }

            await AtomicJsonFile.WriteAsync(Paths.SettingsFile, settings, Paths.BackupsRoot, "settings");
            await AtomicJsonFile.WriteAsync(Paths.DraftSceneFile, scene, Paths.BackupsRoot, "draft-scene");
            return revision;
        }
        finally
        {
            writeGate.Release();
        }
    }

    public async Task<long> SaveDraftAndPublishSceneAsync(JsonObject sceneInput, JsonObject? settingsPatch)
    {
        await writeGate.WaitAsync();
        try
        {
            JsonObject scene = SceneDocumentConverter.NormalizeSceneV2(sceneInput);
            JsonObject? previousDraft = await AtomicJsonFile.ReadObjectAsync(Paths.DraftSceneFile);
            long revision = Math.Max(0, previousDraft?["revision"]?.GetValue<long>() ?? 0) + 1;
            scene["id"] = "workspace-draft";
            scene["revision"] = revision;
            JsonObject metadata = scene["metadata"] as JsonObject ?? new JsonObject();
            metadata["name"] = "Draft";
            metadata["themeType"] = "workspace";
            scene["metadata"] = metadata;

            JsonObject settings = await GetGlobalSettingsAsync();
            if (settingsPatch?["audio"]?["sourceMode"] is JsonValue sourceValue)
            {
                string sourceMode = sourceValue.GetValue<string>();
                if (sourceMode is not ("auto" or "process" or "system"))
                    throw new InvalidDataException("Unsupported audio source mode.");
                settings["audio"] = new JsonObject { ["sourceMode"] = sourceMode };
            }

            JsonObject published = CreateWorkspaceCopy(scene, "workspace-published", "Published");
            published["revision"] = revision;
            await AtomicJsonFile.WriteAsync(Paths.SettingsFile, settings, Paths.BackupsRoot, "settings");
            await AtomicJsonFile.WriteAsync(Paths.DraftSceneFile, scene, Paths.BackupsRoot, "draft-scene");
            await AtomicJsonFile.WriteAsync(Paths.PublishedSceneFile, published, Paths.BackupsRoot, "published-scene");
            return revision;
        }
        finally
        {
            writeGate.Release();
        }
    }

    public async Task SaveDraftAndPublishLegacyAsync(JsonObject legacyConfig)
    {
        await writeGate.WaitAsync();
        try
        {
            JsonObject settings = await AtomicJsonFile.ReadObjectAsync(Paths.SettingsFile)
                ?? SceneDocumentConverter.CreateGlobalSettings(legacyConfig);
            settings = SceneDocumentConverter.UpdateGlobalSettingsFromLegacy(settings, legacyConfig);

            JsonObject? previousDraft = await AtomicJsonFile.ReadObjectAsync(Paths.DraftSceneFile);
            long revision = Math.Max(0, previousDraft?["revision"]?.GetValue<long>() ?? 0) + 1;
            string sourceThemeId = legacyConfig["theme"]?["preset"]?.GetValue<string>() ?? "Custom";
            JsonObject scene = SceneDocumentConverter.LegacyConfigToScene(
                legacyConfig,
                "workspace-draft",
                "Draft",
                "workspace",
                sourceThemeId
            );
            scene["revision"] = revision;

            JsonObject published = CreateWorkspaceCopy(scene, "workspace-published", "Published");
            published["revision"] = revision;

            await AtomicJsonFile.WriteAsync(Paths.SettingsFile, settings, Paths.BackupsRoot, "settings");
            await AtomicJsonFile.WriteAsync(Paths.DraftSceneFile, scene, Paths.BackupsRoot, "draft-scene");
            await AtomicJsonFile.WriteAsync(Paths.PublishedSceneFile, published, Paths.BackupsRoot, "published-scene");
        }
        finally
        {
            writeGate.Release();
        }
    }

    public IReadOnlyList<ThemeSummary> GetThemes()
    {
        var themes = new List<ThemeSummary>();

        if (Directory.Exists(Paths.BundledThemesRoot))
        {
            foreach (string file in Directory.GetFiles(Paths.BundledThemesRoot, "*.json", SearchOption.TopDirectoryOnly))
            {
                string id = Path.GetFileNameWithoutExtension(file);
                try
                {
                    JsonObject source = AtomicJsonFile.ReadObject(file)!;
                    JsonObject scene = SceneDocumentConverter.ThemeToScene(source, ResolveBundledSceneReference);
                    string name = scene["metadata"]?["name"]?.GetValue<string>() ?? id;
                    themes.Add(new ThemeSummary(id, name, "builtin", ThemeApiPath(id)));
                }
                catch
                {
                    themes.Add(new ThemeSummary(id, $"{id} (invalid)", "builtin", ThemeApiPath(id)));
                }
            }
        }

        if (Directory.Exists(Paths.CustomThemesRoot))
        {
            foreach (string directory in Directory.GetDirectories(Paths.CustomThemesRoot))
            {
                string id = Path.GetFileName(directory);
                string sceneFile = Path.Combine(directory, "scene.json");
                if (!File.Exists(sceneFile))
                    continue;
                try
                {
                    JsonObject scene = AtomicJsonFile.ReadObject(sceneFile)!;
                    SceneDocumentConverter.Validate(scene);
                    string name = scene["metadata"]?["name"]?.GetValue<string>() ?? id;
                    themes.Add(new ThemeSummary($"custom/{id}", name, "custom", ThemeApiPath($"custom/{id}")));
                }
                catch
                {
                    themes.Add(new ThemeSummary($"custom/{id}", $"{id} (invalid)", "custom", ThemeApiPath($"custom/{id}")));
                }
            }
        }

        return themes
            .GroupBy(theme => theme.id, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(theme => theme.name, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    public async Task<JsonObject> GetThemeLegacyAsync(string id)
    {
        JsonObject scene = await GetThemeSceneAsync(id);
        return SceneDocumentConverter.SceneToLegacyConfig(scene, null, includeAudio: false);
    }

    public async Task<JsonObject> GetThemeSceneAsync(string id)
    {
        JsonObject scene;
        if (id.StartsWith("custom/", StringComparison.OrdinalIgnoreCase))
        {
            string customId = ValidateThemeId(id["custom/".Length..]);
            string path = Path.Combine(Paths.CustomThemesRoot, customId, "scene.json");
            scene = await AtomicJsonFile.ReadObjectAsync(path)
                ?? throw new FileNotFoundException("Theme not found.", path);
        }
        else
        {
            string builtinId = ValidateThemeId(id);
            scene = await GetBundledThemeSceneAsync(builtinId);
        }
        return SceneDocumentConverter.NormalizeSceneV2(scene);
    }

    public async Task<JsonObject> GetBundledThemeSceneAsync(string id)
    {
        string builtinId = ValidateThemeId(id);
        string path = Path.Combine(Paths.BundledThemesRoot, $"{builtinId}.json");
        JsonObject source = await AtomicJsonFile.ReadObjectAsync(path)
            ?? throw new FileNotFoundException("Theme not found.", path);
        return SceneDocumentConverter.ThemeToScene(source, ResolveBundledSceneReference);
    }

    public async Task<ThemeSummary> SaveCustomThemeAsync(string name, JsonObject legacyTheme)
    {
        string id = NormalizeThemeId(name);
        string directory = Path.Combine(Paths.CustomThemesRoot, id);
        if (Directory.Exists(directory))
            throw new InvalidOperationException("Theme already exists");

        return await WriteCustomThemeAsync(id, name, legacyTheme, requireExisting: false);
    }

    public async Task<ThemeSummary> UpdateCustomThemeAsync(string id, JsonObject legacyTheme)
    {
        id = ValidateThemeId(id);
        string scenePath = Path.Combine(Paths.CustomThemesRoot, id, "scene.json");
        JsonObject existing = await AtomicJsonFile.ReadObjectAsync(scenePath)
            ?? throw new FileNotFoundException("Theme not found.", scenePath);
        string name = existing["metadata"]?["name"]?.GetValue<string>() ?? id;
        return await WriteCustomThemeAsync(id, name, legacyTheme, requireExisting: true);
    }

    public async Task DeleteCustomThemeAsync(string id)
    {
        id = ValidateThemeId(id);
        string directory = Path.Combine(Paths.CustomThemesRoot, id);
        if (!Directory.Exists(directory))
            throw new FileNotFoundException("Theme not found.", directory);

        await Task.Run(() => Directory.Delete(directory, recursive: true));
    }

    public string GetAudioSourceMode()
    {
        try
        {
            string value = AtomicJsonFile.ReadObject(Paths.SettingsFile)?["audio"]?["sourceMode"]?.GetValue<string>() ?? "auto";
            return value is "process" or "system" ? value : "auto";
        }
        catch
        {
            return "auto";
        }
    }

    public JsonObject GetEqualizerSettings()
    {
        try
        {
            JsonObject scene = AtomicJsonFile.ReadObject(Paths.DraftSceneFile)!;
            return scene["appearance"]?["equalizer"]?.DeepClone().AsObject() ?? new JsonObject();
        }
        catch
        {
            return new JsonObject();
        }
    }

    private async Task<ThemeSummary> WriteCustomThemeAsync(
        string id,
        string name,
        JsonObject legacyTheme,
        bool requireExisting
    )
    {
        await writeGate.WaitAsync();
        try
        {
            string directory = Path.Combine(Paths.CustomThemesRoot, id);
            if (requireExisting && !Directory.Exists(directory))
                throw new FileNotFoundException("Theme not found.", directory);
            Directory.CreateDirectory(directory);

            JsonObject scene;
            if (SceneDocumentConverter.IsSceneV2(legacyTheme))
            {
                scene = SceneDocumentConverter.NormalizeSceneV2(legacyTheme);
            }
            else
            {
                JsonObject themeInput = legacyTheme.DeepClone().AsObject();
                themeInput["id"] = id;
                themeInput["name"] = name;
                themeInput["type"] = "custom";
                scene = SceneDocumentConverter.ThemeToScene(themeInput);
            }
            scene["id"] = $"theme-{id}";
            scene["metadata"]!["name"] = name;
            scene["metadata"]!["themeType"] = "custom";
            scene["metadata"]!["sourceThemeId"] = $"custom/{id}";

            string scenePath = Path.Combine(directory, "scene.json");
            long revision = (await AtomicJsonFile.ReadObjectAsync(scenePath))?["revision"]?.GetValue<long>() ?? 0;
            scene["revision"] = revision + 1;

            var manifest = new JsonObject
            {
                ["schemaVersion"] = 1,
                ["documentType"] = "music-overlay.theme-manifest",
                ["id"] = id,
                ["name"] = name,
                ["type"] = "custom",
                ["scene"] = "scene.json"
            };

            await AtomicJsonFile.WriteAsync(scenePath, scene, Paths.BackupsRoot, $"theme-{id}");
            await AtomicJsonFile.WriteAsync(Path.Combine(directory, "manifest.json"), manifest, Paths.BackupsRoot, $"theme-{id}-manifest");
            return new ThemeSummary($"custom/{id}", name, "custom", ThemeApiPath($"custom/{id}"));
        }
        finally
        {
            writeGate.Release();
        }
    }

    private async Task<JsonObject> GetSeedSceneAsync(JsonObject? legacyConfig)
    {
        // A preserved 2.0 config is personal data and therefore wins over the
        // bundled default on the first 2.1 launch.
        if (legacyConfig is not null)
        {
            string preset = legacyConfig["theme"]?["preset"]?.GetValue<string>() ?? "Custom";
            return SceneDocumentConverter.LegacyConfigToScene(
                legacyConfig,
                "workspace-seed",
                "Migrated workspace",
                "workspace",
                preset
            );
        }

        JsonObject? bundled = await TryReadObjectAsync(Paths.BundledDefaultSceneFile);
        if (bundled is not null)
        {
            JsonObject scene = SceneDocumentConverter.IsSceneV2(bundled)
                ? SceneDocumentConverter.NormalizeSceneV2(bundled)
                : SceneDocumentConverter.LegacyConfigToScene(bundled, "default-scene", "Default", "builtin");
            SceneDocumentConverter.Validate(scene);
            return scene;
        }

        return SceneDocumentConverter.LegacyConfigToScene(null, "default-scene", "Default", "builtin");
    }

    private async Task NormalizeExistingStoredScenesAsync()
    {
        foreach ((string path, string backupKey) in new[]
        {
            (Paths.DraftSceneFile, "draft-scene-normalized"),
            (Paths.PublishedSceneFile, "published-scene-normalized")
        })
        {
            JsonObject? existing = await AtomicJsonFile.ReadObjectAsync(path);
            if (existing is null || !SceneDocumentConverter.IsSceneV2(existing))
                continue;
            JsonObject normalized = SceneDocumentConverter.NormalizeSceneV2(existing);
            if (existing.ToJsonString() != normalized.ToJsonString())
                await AtomicJsonFile.WriteAsync(path, normalized, Paths.BackupsRoot, backupKey);
        }

        if (!Directory.Exists(Paths.CustomThemesRoot))
            return;

        foreach (string directory in Directory.GetDirectories(Paths.CustomThemesRoot))
        {
            string path = Path.Combine(directory, "scene.json");
            if (!File.Exists(path))
                continue;
            try
            {
                JsonObject? existing = await AtomicJsonFile.ReadObjectAsync(path);
                if (existing is null || !SceneDocumentConverter.IsSceneV2(existing))
                    continue;
                JsonObject normalized = SceneDocumentConverter.NormalizeSceneV2(existing);
                if (existing.ToJsonString() != normalized.ToJsonString())
                {
                    string id = Path.GetFileName(directory);
                    await AtomicJsonFile.WriteAsync(path, normalized, Paths.BackupsRoot, $"theme-{id}-normalized");
                }
            }
            catch
            {
                // A broken custom theme must not prevent the application from
                // starting; it remains visible as invalid in the theme list.
            }
        }
    }

    private async Task RewriteBundledDocumentsAsync(JsonObject? legacyConfig)
    {
        Directory.CreateDirectory(Paths.BundledThemesRoot);
        string[] files = Directory.GetFiles(Paths.BundledThemesRoot, "*.json", SearchOption.TopDirectoryOnly);
        var resolvedThemes = new List<(string File, JsonObject Scene)>();
        foreach (string file in files)
        {
            JsonObject source = await AtomicJsonFile.ReadObjectAsync(file)
                ?? throw new InvalidDataException($"Theme is empty: {file}");
            JsonObject scene = SceneDocumentConverter.ThemeToScene(source, ResolveBundledSceneReference);
            resolvedThemes.Add((file, scene));
        }

        JsonObject? classicTemplate = resolvedThemes
            .Select(item => item.Scene)
            .FirstOrDefault(scene => IsClassicTwoStageComposition(scene));
        string scenesRoot = Path.Combine(Paths.OverlayRoot, "scenes");
        string classicTemplatePath = Path.Combine(scenesRoot, "classic-two-stage.scene.json");
        if (classicTemplate is not null)
        {
            JsonObject template = classicTemplate.DeepClone().AsObject();
            template["id"] = "scene-template-classic-two-stage";
            template["metadata"] = new JsonObject
            {
                ["name"] = "Classic two-stage composition",
                ["themeType"] = "builtin",
                ["sourceThemeId"] = null,
                ["migratedFrom"] = "shared-scene-template"
            };
            await AtomicJsonFile.WriteAsync(
                classicTemplatePath,
                template,
                Paths.BackupsRoot,
                "scene-template-classic-two-stage"
            );
        }

        foreach ((string file, JsonObject scene) in resolvedThemes)
        {
            JsonObject output = classicTemplate is not null && HaveSameNodeGraph(classicTemplate, scene)
                ? CreateThemeReference(scene, "/scenes/classic-two-stage.scene.json")
                : scene;
            await AtomicJsonFile.WriteAsync(
                file,
                output,
                Paths.BackupsRoot,
                $"bundled-theme-{Path.GetFileNameWithoutExtension(file)}"
            );
        }

        JsonObject? existingDefault = await TryReadObjectAsync(Paths.BundledDefaultSceneFile);
        JsonObject defaultScene = legacyConfig is not null
            ? SceneDocumentConverter.LegacyConfigToScene(
                legacyConfig,
                "default-scene",
                "Default composition",
                "builtin",
                legacyConfig["theme"]?["preset"]?.GetValue<string>() ?? "Custom"
            )
            : existingDefault is not null && SceneDocumentConverter.IsSceneV2(existingDefault)
                ? SceneDocumentConverter.NormalizeSceneV2(existingDefault)
                : SceneDocumentConverter.LegacyConfigToScene(null, "default-scene", "Default composition", "builtin");
        await AtomicJsonFile.WriteAsync(
            Paths.BundledDefaultSceneFile,
            defaultScene,
            Paths.BackupsRoot,
            "bundled-default-scene"
        );
    }

    private JsonObject? ResolveBundledSceneReference(string reference)
    {
        if (!reference.StartsWith("/scenes/", StringComparison.OrdinalIgnoreCase))
            return null;

        string scenesRoot = Path.GetFullPath(Path.Combine(Paths.OverlayRoot, "scenes"));
        string relative = reference["/scenes/".Length..].Replace('/', Path.DirectorySeparatorChar);
        string candidate = Path.GetFullPath(Path.Combine(scenesRoot, relative));
        if (!candidate.StartsWith(scenesRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            return null;

        JsonObject? scene = AtomicJsonFile.ReadObject(candidate);
        if (scene is not null)
            SceneDocumentConverter.Validate(scene);
        return scene;
    }

    private static bool IsClassicTwoStageComposition(JsonObject scene)
    {
        string[] ids = scene["nodes"]!.AsArray()
            .OfType<JsonObject>()
            .Select(node => node["id"]!.GetValue<string>())
            .ToArray();
        return ids.Contains("full-card-group") &&
            ids.Contains("ticker-group") &&
            ids.Contains("full-cover") &&
            ids.Contains("full-card-shell") &&
            ids.Contains("ticker-title") &&
            ids.Contains("ticker-progress");
    }

    private static bool HaveSameNodeGraph(JsonObject left, JsonObject right) =>
        left["nodes"]!.ToJsonString() == right["nodes"]!.ToJsonString() &&
        left["canvas"]!.ToJsonString() == right["canvas"]!.ToJsonString() &&
        left["timeline"]!.ToJsonString() == right["timeline"]!.ToJsonString() &&
        left["extensions"]!.ToJsonString() == right["extensions"]!.ToJsonString();

    private static JsonObject CreateThemeReference(JsonObject scene, string sceneReference)
    {
        string sourceThemeId = scene["metadata"]?["sourceThemeId"]?.GetValue<string>()
            ?? scene["id"]!.GetValue<string>().Replace("theme-", "", StringComparison.OrdinalIgnoreCase);
        return new JsonObject
        {
            ["$schema"] = "/schemas/theme-v2.schema.json",
            ["schemaVersion"] = 2,
            ["documentType"] = SceneDocumentConverter.ThemeDocumentType,
            ["id"] = sourceThemeId,
            ["revision"] = scene["revision"]?.DeepClone() ?? 1,
            ["metadata"] = scene["metadata"]?.DeepClone(),
            ["scene"] = new JsonObject
            {
                ["ref"] = sceneReference,
                ["overrides"] = new JsonObject
                {
                    ["appearance"] = scene["appearance"]?.DeepClone()
                }
            }
        };
    }

    private async Task MigrateLegacyCustomThemesAsync()
    {
        string legacyCustomRoot = Path.Combine(Paths.BundledThemesRoot, "custom");
        if (!Directory.Exists(legacyCustomRoot))
            return;

        foreach (string file in Directory.GetFiles(legacyCustomRoot, "*.json", SearchOption.TopDirectoryOnly))
        {
            string id = NormalizeThemeId(Path.GetFileNameWithoutExtension(file));
            string targetScene = Path.Combine(Paths.CustomThemesRoot, id, "scene.json");
            if (File.Exists(targetScene))
                continue;

            JsonObject source = await AtomicJsonFile.ReadObjectAsync(file)
                ?? throw new InvalidDataException($"Theme is empty: {file}");
            string name = source["name"]?.GetValue<string>() ?? id;
            await WriteCustomThemeAsync(id, name, source, requireExisting: false);
        }
    }

    private async Task WriteMigrationMarkerAsync(JsonObject? legacyConfig)
    {
        string migrationsRoot = Path.Combine(Paths.DataRoot, "migrations");
        string markerPath = Path.Combine(migrationsRoot, "legacy-to-scene-v2.json");
        if (File.Exists(markerPath))
            return;

        var marker = new JsonObject
        {
            ["schemaVersion"] = 1,
            ["migration"] = "legacy-to-scene-v2",
            ["completedUtc"] = DateTime.UtcNow.ToString("O"),
            ["legacyConfigFound"] = legacyConfig is not null,
            ["draftScene"] = Path.GetRelativePath(Paths.AppRoot, Paths.DraftSceneFile),
            ["publishedScene"] = Path.GetRelativePath(Paths.AppRoot, Paths.PublishedSceneFile)
        };
        await AtomicJsonFile.WriteAsync(markerPath, marker, Paths.BackupsRoot, "migration-marker");
    }

    private async Task ArchiveImportedLegacyConfigAsync()
    {
        if (!File.Exists(Paths.LegacyConfigFile) ||
            !File.Exists(Paths.DraftSceneFile) ||
            !File.Exists(Paths.PublishedSceneFile))
        {
            return;
        }

        // Validate both canonical copies before retiring the one-time import
        // source. The archived file remains directly recoverable by the user.
        SceneDocumentConverter.Validate((await AtomicJsonFile.ReadObjectAsync(Paths.DraftSceneFile))!);
        SceneDocumentConverter.Validate((await AtomicJsonFile.ReadObjectAsync(Paths.PublishedSceneFile))!);

        string archiveRoot = Path.Combine(Paths.BackupsRoot, "migration");
        Directory.CreateDirectory(archiveRoot);
        string archivePath = Path.Combine(
            archiveRoot,
            $"legacy-config-v2.0.1-{DateTime.UtcNow:yyyyMMdd-HHmmssfff}.json"
        );
        File.Move(Paths.LegacyConfigFile, archivePath);
    }

    private static JsonObject CreateWorkspaceCopy(JsonObject source, string id, string name)
    {
        JsonObject copy = source.DeepClone().AsObject();
        copy["id"] = id;
        copy["metadata"] ??= new JsonObject();
        copy["metadata"]!["name"] = name;
        copy["metadata"]!["themeType"] = "workspace";
        return copy;
    }

    private static string ThemeApiPath(string id) => id.StartsWith("custom/", StringComparison.OrdinalIgnoreCase)
        ? $"/api/scene/theme/custom/{Uri.EscapeDataString(id["custom/".Length..])}"
        : $"/api/scene/theme/builtin/{Uri.EscapeDataString(id)}";

    private static async Task<JsonObject?> TryReadObjectAsync(string path)
    {
        try { return await AtomicJsonFile.ReadObjectAsync(path); }
        catch { return null; }
    }

    public static string NormalizeThemeId(string name)
    {
        var builder = new System.Text.StringBuilder();
        foreach (char character in name.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
                builder.Append(character);
            else if (character is ' ' or '-' or '_')
                builder.Append('-');
        }

        string id = builder.ToString();
        while (id.Contains("--", StringComparison.Ordinal))
            id = id.Replace("--", "-", StringComparison.Ordinal);
        id = id.Trim('-');
        return string.IsNullOrWhiteSpace(id) ? $"theme-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}" : id;
    }

    private static string ValidateThemeId(string id)
    {
        string normalized = NormalizeThemeId(id);
        if (string.IsNullOrWhiteSpace(id) || !string.Equals(normalized, id, StringComparison.Ordinal))
            throw new InvalidDataException("Invalid theme id");
        return id;
    }
}

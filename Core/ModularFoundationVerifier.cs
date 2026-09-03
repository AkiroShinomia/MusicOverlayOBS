using System.Text.RegularExpressions;
using System.Text.Json.Nodes;

namespace MusicOverlay.Core;

public sealed record ModularFoundationResult(
    int EditorScripts,
    int ProgramLines,
    int SettingsBootstrapLines,
    int DraftNodes,
    int PublishedNodes,
    int Themes,
    bool NamespaceFirst,
    bool FetchIsolated,
    bool LegacyStateIsolated,
    bool BackendSeparated,
    bool ScriptFilesPresent);

public static class ModularFoundationVerifier
{
    private static readonly string[] RequiredEditorModules =
    {
        "editor/core/namespace.js",
        "editor/core/event-bus.js",
        "editor/core/ui-status.js",
        "editor/core/i18n.js",
        "editor/compat/legacy-editor-state.js",
        "editor/compat/legacy-editor-runtime.js",
        "editor/api/api-client.js",
        "editor/api/scene-api.js",
        "editor/api/theme-api.js",
        "editor/api/live-api.js",
        "editor/inspector/inspector-controller.js",
        "editor/canvas/canvas-editor-controller.js",
        "editor/library/library-controller.js",
        "editor/timeline/timeline-editor-controller.js",
        "editor/themes/theme-controller.js",
        "editor/preview/preview-sync-controller.js",
        "editor/persistence/draft-save-scheduler.js",
        "editor/bootstrap.js"
    };

    public static async Task<ModularFoundationResult> VerifyAsync(PortableDataStore store)
    {
        string root = store.Paths.AppRoot;
        string overlay = store.Paths.OverlayRoot;
        string settingsHtml = await File.ReadAllTextAsync(Path.Combine(overlay, "settings.html"));
        string settingsBootstrap = await File.ReadAllTextAsync(Path.Combine(overlay, "settings.js"));
        string program = await File.ReadAllTextAsync(Path.Combine(root, "Program.cs"));

        MatchCollection scriptMatches = Regex.Matches(settingsHtml, "<script\\s+src=\"([^\"?]+)", RegexOptions.IgnoreCase);
        string[] scripts = scriptMatches.Select(match => match.Groups[1].Value).ToArray();
        bool scriptFilesPresent = scripts.All(script => File.Exists(Path.Combine(overlay, script.Replace('/', Path.DirectorySeparatorChar))));
        bool namespaceFirst = Array.IndexOf(scripts, "editor/core/namespace.js") >= 0 &&
            Array.IndexOf(scripts, "editor/core/namespace.js") < Array.IndexOf(scripts, "editor/bootstrap.js") &&
            Array.IndexOf(scripts, "editor/bootstrap.js") < Array.IndexOf(scripts, "settings.js");

        foreach (string module in RequiredEditorModules)
            if (!File.Exists(Path.Combine(overlay, module.Replace('/', Path.DirectorySeparatorChar))))
                throw new InvalidDataException($"Missing Stage 2E module: {module}");

        string[] editorFiles = Directory.GetFiles(Path.Combine(overlay, "editor"), "*.js", SearchOption.AllDirectories);
        bool fetchIsolated = editorFiles
            .Where(path => !path.Contains($"{Path.DirectorySeparatorChar}api{Path.DirectorySeparatorChar}"))
            .All(path => !File.ReadAllText(path).Contains("fetch(", StringComparison.Ordinal));
        bool legacyStateIsolated = editorFiles
            .Where(path => !path.EndsWith("legacy-editor-state.js", StringComparison.OrdinalIgnoreCase))
            .All(path => !File.ReadAllText(path).Contains("currentConfig", StringComparison.Ordinal));

        string[] backendFiles =
        {
            "Hosting/RouteMap.cs", "Hosting/StaticFileResponder.cs", "Hosting/WebSocketHub.cs",
            "Endpoints/SceneEndpoints.cs", "Endpoints/ThemeEndpoints.cs", "Endpoints/SettingsEndpoints.cs",
            "Endpoints/LiveEndpoints.cs", "Endpoints/SystemEndpoints.cs", "Web/ApiResult.cs"
        };
        bool backendSeparated = backendFiles.All(path => File.Exists(Path.Combine(root, path.Replace('/', Path.DirectorySeparatorChar)))) &&
            CountLines(program) <= 150 && !program.Contains("GetContentType", StringComparison.Ordinal) &&
            !program.Contains("AcceptWebSocketAsync", StringComparison.Ordinal);

        if (CountLines(settingsBootstrap) > 30) throw new InvalidDataException("settings.js is not a small compatibility bootstrap.");
        if (!namespaceFirst || !scriptFilesPresent) throw new InvalidDataException("Editor script dependency order is invalid.");
        if (!fetchIsolated) throw new InvalidDataException("Editor fetch call exists outside editor/api.");
        if (!legacyStateIsolated) throw new InvalidDataException("currentConfig escaped the legacy state adapter.");
        if (!backendSeparated) throw new InvalidDataException("Backend monolith separation is incomplete.");

        JsonObject draft = await store.GetDraftSceneAsync();
        JsonObject published = await store.GetPublishedSceneAsync();
        SceneDocumentConverter.Validate(draft);
        SceneDocumentConverter.Validate(published);

        return new ModularFoundationResult(
            editorFiles.Length,
            CountLines(program),
            CountLines(settingsBootstrap),
            draft["nodes"]!.AsArray().Count,
            published["nodes"]!.AsArray().Count,
            store.GetThemes().Count,
            namespaceFirst,
            fetchIsolated,
            legacyStateIsolated,
            backendSeparated,
            scriptFilesPresent);
    }

    private static int CountLines(string value) => value.Split('\n').Length;
}

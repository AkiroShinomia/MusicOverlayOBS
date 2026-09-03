using System.Text.RegularExpressions;

namespace MusicOverlay.Core;

public sealed record CanonicalEditorStateResult(
    int EditorFiles,
    int LegacyStateReferences,
    bool CanonicalStorePresent,
    bool TypedMutationsPresent,
    bool DuplicateMutationPresent,
    bool ParentGroupInvariantPresent,
    bool StableHashPresent,
    bool CanonicalHistoryPresent,
    bool DirectPublishPresent,
    bool LegacyToSceneRemoved,
    bool LegacyLayoutProjectionIsolated,
    bool LegacyLayoutWritesIsolated,
    bool BuiltinIdsCentralized,
    bool ScriptOrderValid,
    bool CharacterizationTestsPresent);

public static class CanonicalEditorStateVerifier
{
    private static readonly string[] RequiredModules =
    {
        "editor/state/scene-selectors.js",
        "editor/state/scene-mutations.js",
        "editor/state/scene-store.js",
        "editor/state/editor-session-store.js",
        "editor/history/snapshot-history.js",
        "editor/persistence/draft-save-scheduler.js",
        "editor/state/editor-context.js",
        "editor/state/scene-ui-adapters.js",
        "editor/compat/builtin-v2-rules.js",
        "editor/compat/legacy-form-projection.js"
    };

    public static async Task<CanonicalEditorStateResult> VerifyAsync(PortableDataStore store)
    {
        string overlay = store.Paths.OverlayRoot;
        string root = store.Paths.AppRoot;
        string editorRoot = Path.Combine(overlay, "editor");

        foreach (string module in RequiredModules)
        {
            string path = Path.Combine(overlay, module.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(path))
                throw new InvalidDataException($"Missing Stage 2F module: {module}");
        }

        string settingsHtml = await File.ReadAllTextAsync(Path.Combine(overlay, "settings.html"));
        string mutations = await File.ReadAllTextAsync(Path.Combine(editorRoot, "state", "scene-mutations.js"));
        string sceneStore = await File.ReadAllTextAsync(Path.Combine(editorRoot, "state", "scene-store.js"));
        string history = await File.ReadAllTextAsync(Path.Combine(editorRoot, "history", "snapshot-history.js"));
        string context = await File.ReadAllTextAsync(Path.Combine(editorRoot, "state", "editor-context.js"));
        string builtinRules = await File.ReadAllTextAsync(Path.Combine(editorRoot, "compat", "builtin-v2-rules.js"));
        string legacyRuntime = await File.ReadAllTextAsync(Path.Combine(editorRoot, "compat", "legacy-editor-runtime.js"));

        string[] editorFiles = Directory.GetFiles(editorRoot, "*.js", SearchOption.AllDirectories);
        Dictionary<string, string> editorSources = editorFiles.ToDictionary(
            path => path,
            File.ReadAllText,
            StringComparer.OrdinalIgnoreCase);

        int legacyReferences = editorSources.Values.Sum(source =>
            Regex.Matches(source, Regex.Escape("legacyEditorState.value"), RegexOptions.CultureInvariant).Count);

        bool canonicalStorePresent =
            sceneStore.Contains("function load(scene", StringComparison.Ordinal) &&
            sceneStore.Contains("function getSnapshot()", StringComparison.Ordinal) &&
            sceneStore.Contains("function dispatch(mutation)", StringComparison.Ordinal) &&
            sceneStore.Contains("function subscribe(listener)", StringComparison.Ordinal) &&
            sceneStore.Contains("function markDraftSaved(revision)", StringComparison.Ordinal) &&
            sceneStore.Contains("function markPublished(nextHash)", StringComparison.Ordinal);

        string[] requiredMutationTypes =
        {
            "node.add", "node.removeSubtree", "node.duplicate", "node.rename", "node.visibility",
            "node.lock", "node.marker", "node.transform", "node.timing", "node.effects",
            "node.animations", "node.componentProperties", "node.reparent", "node.reorder",
            "scene.canvas", "scene.timeline", "scene.appearance", "scene.metadata",
            "scene.replace", "history.replace"
        };
        bool typedMutationsPresent = requiredMutationTypes.All(type =>
            mutations.Contains($"\"{type}\"", StringComparison.Ordinal));
        bool duplicateMutationPresent = mutations.Contains("case \"node.duplicate\"", StringComparison.Ordinal);
        bool parentGroupInvariantPresent =
            mutations.Contains("must be a group", StringComparison.OrdinalIgnoreCase) &&
            sceneStore.Contains("must be a group", StringComparison.OrdinalIgnoreCase);
        bool stableHashPresent =
            sceneStore.Contains("Object.keys(value)", StringComparison.Ordinal) &&
            sceneStore.Contains(".sort()", StringComparison.Ordinal) &&
            sceneStore.Contains("canonicalize", StringComparison.Ordinal);
        bool canonicalHistoryPresent =
            history.Contains("JSON.stringify(sceneStore.getSnapshot())", StringComparison.Ordinal) &&
            history.Contains("type: \"history.replace\"", StringComparison.Ordinal) &&
            !history.Contains("legacyEditorState", StringComparison.Ordinal);
        bool directPublishPresent =
            context.Contains("const scene = sceneStore.getSnapshot();", StringComparison.Ordinal) &&
            context.Contains("root.api.scenes.publish({ scene, settings })", StringComparison.Ordinal) &&
            context.Contains("appliedRevision", StringComparison.Ordinal) &&
            context.Contains("settingsRevision", StringComparison.Ordinal);

        bool legacyToSceneRemoved = editorSources.Values.All(source =>
            !source.Contains("SceneEditorModel.toScene", StringComparison.Ordinal));

        bool legacyLayoutProjectionIsolated = editorSources.All(entry =>
        {
            string fileName = Path.GetFileName(entry.Key);
            string source = entry.Value;
            if (!source.Contains(".layout.groups", StringComparison.Ordinal) &&
                !source.Contains(".layout.layers", StringComparison.Ordinal)) return true;
            return fileName.Equals("scene-editor-model.js", StringComparison.OrdinalIgnoreCase);
        });

        bool legacyLayoutWritesIsolated = editorSources.All(entry =>
        {
            string fileName = Path.GetFileName(entry.Key);
            string source = entry.Value;
            if (!source.Contains("legacyEditorState", StringComparison.Ordinal)) return true;
            return fileName.Equals("legacy-editor-state.js", StringComparison.OrdinalIgnoreCase) ||
                fileName.Equals("legacy-form-projection.js", StringComparison.OrdinalIgnoreCase);
        });

        string[] forbiddenLegacyRuntimeSessionFields =
        {
            "selection:", "collapsedGroups:", "previewTimeMs:", "timelineDurationMs:",
            "playbackFrame:", "playbackStartedAt:", "playbackOffset:", "canvasScale:",
            "customLibraryAssets:", "availableThemes:", "loadedThemes:",
            "activeThemeId:", "activeThemeType:", "themeDirty:"
        };
        bool legacyRuntimeSessionStateRemoved = forbiddenLegacyRuntimeSessionFields.All(field =>
            !legacyRuntime.Contains(field, StringComparison.Ordinal));

        string[] forbiddenLegacyRuntimeAccesses =
        {
            "editorRuntime.selection", "editorRuntime.collapsedGroups", "editorRuntime.previewTimeMs",
            "editorRuntime.timelineDurationMs", "editorRuntime.playbackFrame", "editorRuntime.playbackStartedAt",
            "editorRuntime.playbackOffset", "editorRuntime.canvasScale", "editorRuntime.customLibraryAssets",
            "editorRuntime.availableThemes", "editorRuntime.loadedThemes", "editorRuntime.activeThemeId",
            "editorRuntime.activeThemeType", "editorRuntime.themeDirty"
        };
        bool legacyRuntimeSessionAccessRemoved = forbiddenLegacyRuntimeAccesses.All(access =>
            editorSources.Values.All(source => !source.Contains(access, StringComparison.Ordinal)));

        bool deadLegacyHistorySnapshotRemoved = editorSources.Values.All(source =>
            !source.Contains("createHistorySnapshot", StringComparison.Ordinal));

        MatchCollection scriptMatches = Regex.Matches(settingsHtml, "<script\\s+src=\"([^\"?]+)", RegexOptions.IgnoreCase);
        string[] scripts = scriptMatches.Select(match => match.Groups[1].Value).ToArray();
        int builtinIndex = Array.IndexOf(scripts, "editor/compat/builtin-v2-rules.js");
        int modelIndex = Array.IndexOf(scripts, "editor/scene-editor-model.js");
        int foundationIndex = Array.IndexOf(scripts, "editor/core/editor-foundation.js");
        int legacyProjectionIndex = Array.IndexOf(scripts, "editor/compat/legacy-form-projection.js");
        int contextIndex = Array.IndexOf(scripts, "editor/state/editor-context.js");
        int bootstrapIndex = Array.IndexOf(scripts, "editor/bootstrap.js");
        bool scriptOrderValid =
            builtinIndex >= 0 && modelIndex >= 0 && foundationIndex >= 0 && legacyProjectionIndex >= 0 && contextIndex >= 0 && bootstrapIndex >= 0 &&
            builtinIndex < modelIndex && modelIndex < foundationIndex && foundationIndex < legacyProjectionIndex && legacyProjectionIndex < contextIndex && contextIndex < bootstrapIndex;

        bool builtinIdsCentralized =
            builtinRules.Contains("fullGroup: \"full-card-group\"", StringComparison.Ordinal) &&
            builtinRules.Contains("tickerGroup: \"ticker-group\"", StringComparison.Ordinal) &&
            editorSources
                .Where(entry => !entry.Key.EndsWith("builtin-v2-rules.js", StringComparison.OrdinalIgnoreCase))
                .All(entry =>
                    !entry.Value.Contains("\"full-card-group\"", StringComparison.Ordinal) &&
                    !entry.Value.Contains("\"ticker-group\"", StringComparison.Ordinal));

        bool characterizationTestsPresent =
            File.Exists(Path.Combine(root, "tests", "scene-store.test.cjs")) &&
            File.Exists(Path.Combine(root, "tests", "editor-context.test.cjs"));

        if (!canonicalStorePresent) throw new InvalidDataException("Canonical Scene Store contract is incomplete.");
        if (!typedMutationsPresent || !duplicateMutationPresent) throw new InvalidDataException("Typed Scene mutation contract is incomplete.");
        if (!parentGroupInvariantPresent) throw new InvalidDataException("Scene parent-group invariant is not enforced.");
        if (!stableHashPresent) throw new InvalidDataException("Scene hash is not canonicalized by object key order.");
        if (!canonicalHistoryPresent) throw new InvalidDataException("History is not Scene-snapshot-only.");
        if (!directPublishPresent) throw new InvalidDataException("Apply does not publish a direct canonical Scene snapshot.");
        if (!legacyToSceneRemoved) throw new InvalidDataException("Runtime still converts legacy layout back into Scene.");
        if (legacyReferences != 0) throw new InvalidDataException("Direct legacyEditorState.value access still exists outside the removed Stage 2E bridge.");
        if (!legacyLayoutProjectionIsolated) throw new InvalidDataException("Legacy layout groups/layers escaped scene-editor-model.js.");
        if (!legacyLayoutWritesIsolated) throw new InvalidDataException("Legacy editor state escaped the compatibility projection boundary.");
        if (!legacyRuntimeSessionStateRemoved || !legacyRuntimeSessionAccessRemoved) throw new InvalidDataException("Legacy editor runtime still duplicates canonical Session Store state.");
        if (!deadLegacyHistorySnapshotRemoved) throw new InvalidDataException("Dead legacy history snapshot helper still exists.");
        if (!builtinIdsCentralized) throw new InvalidDataException("Built-in Scene IDs are duplicated outside builtin-v2-rules.js.");
        if (!scriptOrderValid) throw new InvalidDataException("Stage 2F editor dependency order is invalid.");
        if (!characterizationTestsPresent) throw new InvalidDataException("Stage 2F characterization tests are missing.");

        return new CanonicalEditorStateResult(
            editorFiles.Length,
            legacyReferences,
            canonicalStorePresent,
            typedMutationsPresent,
            duplicateMutationPresent,
            parentGroupInvariantPresent,
            stableHashPresent,
            canonicalHistoryPresent,
            directPublishPresent,
            legacyToSceneRemoved,
            legacyLayoutProjectionIsolated,
            legacyLayoutWritesIsolated,
            builtinIdsCentralized,
            scriptOrderValid,
            characterizationTestsPresent);
    }
}

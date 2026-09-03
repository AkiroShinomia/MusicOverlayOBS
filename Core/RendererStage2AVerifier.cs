using System.Text.Json.Nodes;

namespace MusicOverlay.Core;

public sealed record RendererStage2AResult(
    int Scenes,
    int Nodes,
    int MaxDepth,
    int ComponentKinds,
    int SharedModules,
    bool DraftPublishedSeparated
);

public static class RendererStage2AVerifier
{
    private static readonly HashSet<string> SupportedKinds = new(StringComparer.OrdinalIgnoreCase)
    {
        "block", "container", "image", "disc", "text", "time", "progress",
        "equalizer", "particles", "ticker"
    };

    private static readonly string[] SharedAssets =
    {
        "scene-order.js",
        "layer-renderer.js",
        "scene-timeline.js",
        "component-registry.js",
        "scene-renderer.js",
        "scene-renderer.css"
    };

    public static async Task<RendererStage2AResult> VerifyAsync(PortableDataStore store)
    {
        string sharedRoot = Path.Combine(store.Paths.OverlayRoot, "shared");
        foreach (string asset in SharedAssets)
        {
            string path = Path.Combine(sharedRoot, asset);
            if (!File.Exists(path) || new FileInfo(path).Length == 0)
                throw new InvalidDataException($"Shared renderer asset is missing: {asset}");
        }

        var scenes = new List<(string Source, JsonObject Scene)>
        {
            ("draft", await store.GetDraftSceneAsync()),
            ("published", await store.GetPublishedSceneAsync())
        };
        foreach (ThemeSummary theme in store.GetThemes())
            scenes.Add((theme.id, await store.GetThemeSceneAsync(theme.id)));

        int nodeCount = 0;
        int maxDepth = 0;
        var kinds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach ((string source, JsonObject scene) in scenes)
        {
            SceneDocumentConverter.Validate(scene);
            Dictionary<string, JsonObject> nodes = scene["nodes"]!.AsArray()
                .OfType<JsonObject>()
                .ToDictionary(node => node["id"]!.GetValue<string>(), StringComparer.OrdinalIgnoreCase);
            var siblingOrders = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (JsonObject node in nodes.Values)
            {
                nodeCount++;
                string id = node["id"]!.GetValue<string>();
                string? parentId = node["parentId"]?.GetValue<string>();
                int order = node["order"]?.GetValue<int>() ?? 0;
                if (!siblingOrders.Add($"{parentId ?? "<root>"}\0{order}"))
                    throw new InvalidDataException($"Duplicate sibling order in {source}: {parentId}/{order}");

                int depth = 0;
                string? cursor = parentId;
                while (cursor is not null)
                {
                    depth++;
                    JsonObject parent = nodes[cursor];
                    if (parent["nodeType"]?.GetValue<string>() != "group")
                        throw new InvalidDataException($"Node parent is not a group in {source}: {id}");
                    cursor = parent["parentId"]?.GetValue<string>();
                }
                maxDepth = Math.Max(maxDepth, depth);

                JsonObject timing = node["timing"]?.AsObject()
                    ?? throw new InvalidDataException($"Node timing is missing in {source}: {id}");
                string endMode = timing["endMode"]?.GetValue<string>() ?? "";
                if (endMode is not ("fixed" or "parentEnd" or "trackEnd"))
                    throw new InvalidDataException($"Unsupported endMode in {source}: {id}/{endMode}");
                if (endMode == "fixed" && (timing["durationMs"]?.GetValue<double>() ?? 0) <= 0)
                    throw new InvalidDataException($"Fixed timing has no duration in {source}: {id}");
                if (endMode == "parentEnd" && parentId is null)
                    throw new InvalidDataException($"Root node cannot inherit parent end in {source}: {id}");

                if (node["nodeType"]?.GetValue<string>() != "component")
                    continue;
                string kind = node["component"]?["kind"]?.GetValue<string>() ?? "";
                if (!SupportedKinds.Contains(kind))
                    throw new InvalidDataException($"Renderer kind is unsupported in {source}: {id}/{kind}");
                kinds.Add(kind);
            }
        }

        JsonObject draft = scenes[0].Scene;
        JsonObject published = scenes[1].Scene;
        bool separated = draft["id"]?.GetValue<string>() != published["id"]?.GetValue<string>() &&
            store.Paths.DraftSceneFile != store.Paths.PublishedSceneFile;
        if (!separated)
            throw new InvalidDataException("Draft and Published renderer sources are not separated.");

        return new RendererStage2AResult(
            scenes.Count,
            nodeCount,
            maxDepth,
            kinds.Count,
            SharedAssets.Length,
            separated
        );
    }
}

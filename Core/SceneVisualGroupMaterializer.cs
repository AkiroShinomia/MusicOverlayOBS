using System.Text.Json.Nodes;

namespace MusicOverlay.Core;

/// <summary>
/// Migrates legacy visual group surfaces into ordinary block components.
/// Groups are structural only; every visible shape must be a scene node so it
/// appears in Layers/Timeline and can be edited like an object from Library.
/// </summary>
public static class SceneVisualGroupMaterializer
{
    public static JsonObject Materialize(JsonObject source)
    {
        JsonObject scene = source.DeepClone().AsObject();
        if (scene["nodes"] is not JsonArray nodes)
            return scene;

        JsonObject[] groups = nodes
            .OfType<JsonObject>()
            .Where(node => Text(node, "nodeType", "component") == "group")
            .ToArray();
        var ids = nodes
            .OfType<JsonObject>()
            .Select(node => Text(node, "id", ""))
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (JsonObject group in groups)
        {
            JsonObject component = group["component"] as JsonObject ?? new JsonObject();
            JsonObject properties = component["properties"] as JsonObject ?? new JsonObject();
            if (properties["surface"]?.GetValue<bool>() != true)
                continue;

            string groupId = Text(group, "id", "group");
            string id = UniqueId($"{groupId}-background", ids);
            int order = nodes
                .OfType<JsonObject>()
                .Where(node => Text(node, "parentId", "") == groupId)
                .Select(node => Integer(node, "order", -1))
                .DefaultIfEmpty(-1)
                .Max() + 1;
            string style = Text(properties, "style", "solid");
            string background = Text(properties, "background", Text(properties, "color", "transparent"));
            JsonObject groupAnimations = group["animations"] as JsonObject ?? new JsonObject();

            nodes.Add(new JsonObject
            {
                ["id"] = id,
                ["nodeType"] = "component",
                ["name"] = $"{Text(group, "name", groupId)} · Background",
                ["parentId"] = groupId,
                ["order"] = order,
                ["visible"] = true,
                ["locked"] = false,
                ["marker"] = group["marker"]?.DeepClone() ?? "#8b5cf6",
                ["transform"] = new JsonObject
                {
                    ["x"] = 0,
                    ["y"] = 0,
                    ["scaleX"] = 1,
                    ["scaleY"] = 1,
                    ["rotation"] = 0,
                    ["anchorX"] = 0.5,
                    ["anchorY"] = 0.5
                },
                ["timing"] = new JsonObject
                {
                    ["startMs"] = 0,
                    ["endMode"] = "trackEnd",
                    ["durationMs"] = null
                },
                ["effects"] = new JsonArray
                {
                    new JsonObject { ["type"] = "opacity", ["enabled"] = true, ["value"] = 100 },
                    new JsonObject { ["type"] = "blur", ["enabled"] = false, ["value"] = 0 },
                    new JsonObject { ["type"] = "glow", ["enabled"] = false, ["value"] = 0 }
                },
                ["animations"] = new JsonObject
                {
                    // The old surface visually belonged to the group. Once it becomes
                    // an explicit layer it keeps that entrance/exit instead of popping in.
                    ["in"] = groupAnimations["in"]?.DeepClone()
                        ?? new JsonObject { ["type"] = "none", ["durationMs"] = 0, ["easing"] = "linear" },
                    ["out"] = groupAnimations["out"]?.DeepClone()
                        ?? new JsonObject { ["type"] = "none", ["durationMs"] = 0, ["easing"] = "linear" }
                },
                ["component"] = new JsonObject
                {
                    ["kind"] = "block",
                    ["templateId"] = style.Equals("glass", StringComparison.OrdinalIgnoreCase)
                        ? "block-glass"
                        : "block-solid",
                    ["properties"] = new JsonObject
                    {
                        ["width"] = Math.Max(1, Number(properties, "width", 1)),
                        ["height"] = Math.Max(1, Number(properties, "height", 1)),
                        ["borderRadius"] = Math.Max(0, Number(properties, "borderRadius", 0)),
                        ["color"] = background,
                        ["style"] = style
                    }
                }
            });

            // Width and height remain on the group as its structural frame.
            // Everything that can paint pixels belongs to the new block node.
            foreach (string key in new[] { "surface", "background", "color", "borderRadius", "style" })
                properties.Remove(key);
            component["properties"] = properties;
            group["component"] = component;
        }

        return scene;
    }

    private static string UniqueId(string candidate, HashSet<string> ids)
    {
        string result = candidate;
        int suffix = 2;
        while (!ids.Add(result))
            result = $"{candidate}-{suffix++}";
        return result;
    }

    private static string Text(JsonNode? node, string key, string fallback)
    {
        try { return node?[key]?.GetValue<string>() ?? fallback; }
        catch { return fallback; }
    }

    private static int Integer(JsonNode? node, string key, int fallback)
    {
        try { return node?[key]?.GetValue<int>() ?? fallback; }
        catch { return fallback; }
    }

    private static double Number(JsonNode? node, string key, double fallback)
    {
        try { return node?[key]?.GetValue<double>() ?? fallback; }
        catch { return fallback; }
    }
}

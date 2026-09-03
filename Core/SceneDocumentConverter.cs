using System.Text.Json.Nodes;

namespace MusicOverlay.Core;

public static class SceneDocumentConverter
{
    public const int CurrentSchemaVersion = 2;
    public const string DocumentType = "music-overlay.scene";
    public const string ThemeDocumentType = "music-overlay.theme";

    private static readonly string[] AppearanceSections =
    [
        "colors", "font", "albumArt", "ticker", "fullCard", "vinyl", "particles", "equalizer"
    ];

    private static readonly JsonObject DefaultLegacyConfig = JsonNode.Parse(
        """
        {
          "position": { "left": 70, "fullBottom": 80, "tickerBottom": 44 },
          "sizes": { "fullCardWidth": 430, "tickerWidth": 500, "tickerHeight": 42, "coverSize": 92, "vinylSize": 108 },
          "colors": { "background": "rgba(10, 10, 14, 0.80)", "text": "#ffffff", "progress": "#ffffff", "progressBackground": "rgba(255, 255, 255, 0.18)" },
          "timings": { "fullVisibleMs": 10000, "coverDelayMs": 500, "cardDelayMs": 850, "exitMs": 600, "marqueeDelayMs": 2000, "marqueeSpeedSec": 10 },
          "animations": { "fullEnter": "slideRight", "fullExit": "slideDown", "tickerEnter": "slideUp", "tickerExit": "none" },
          "albumArt": { "useWindowsThumbnail": false, "defaultCover": "/assets/default-cover.png" },
          "theme": { "preset": "Custom" },
          "font": { "family": "Arial", "titleSize": 25, "artistSize": 16, "tickerSize": 14 },
          "ticker": { "style": "pill" },
          "fullCard": { "style": "glass" },
          "vinyl": { "style": "classic" },
          "particles": { "enabled": true, "style": "notes", "count": 20, "size": 18, "durationMs": 2200, "color": "#ffffff" },
          "equalizer": {
            "enabled": true, "style": "solid", "barCount": 64, "barWidth": 5, "gap": 3, "height": 86,
            "offsetY": 0, "sidePadding": 14, "preset": "dynamicBars", "sensitivity": 1.12,
            "smoothing": 0.28, "autoGain": true, "outputGain": 1.0, "spectralContrast": 1.0,
            "visualCurvePower": 1.0, "glow": true, "glowPower": 18, "colorMode": "progress", "color": "#ffffff"
          },
          "audio": { "sourceMode": "auto" }
        }
        """
    )!.AsObject();

    public static bool IsSceneV2(JsonObject value) =>
        value["documentType"]?.GetValue<string>() == DocumentType &&
        value["schemaVersion"]?.GetValue<int>() == CurrentSchemaVersion;

    public static bool IsThemeV2(JsonObject value) =>
        value["documentType"]?.GetValue<string>() == ThemeDocumentType &&
        value["schemaVersion"]?.GetValue<int>() == CurrentSchemaVersion;

    public static JsonObject CreateGlobalSettings(JsonObject? legacyConfig = null)
    {
        JsonObject legacy = NormalizeLegacyConfig(legacyConfig);
        string sourceMode = legacy["audio"]?["sourceMode"]?.GetValue<string>() ?? "auto";
        if (sourceMode is not ("auto" or "process" or "system"))
            sourceMode = "auto";

        return new JsonObject
        {
            ["schemaVersion"] = 1,
            ["documentType"] = "music-overlay.settings",
            ["audio"] = new JsonObject { ["sourceMode"] = sourceMode },
            ["preview"] = new JsonObject
            {
                ["dataSource"] = "live",
                ["syncWithWebSocket"] = true
            },
            ["editor"] = new JsonObject
            {
                ["language"] = "ru"
            }
        };
    }

    public static JsonObject LegacyConfigToScene(
        JsonObject? legacyInput,
        string id,
        string name,
        string themeType,
        string? sourceThemeId = null
    )
    {
        JsonObject legacy = NormalizeLegacyConfig(legacyInput);
        JsonObject layout = legacy["layout"] as JsonObject ?? CreateDefaultLayout(legacy);
        JsonObject canvas = CloneObject(layout["canvas"] as JsonObject);
        canvas["width"] ??= 1920;
        canvas["height"] ??= 1080;
        canvas["backgroundColor"] ??= "#00a84f";
        canvas["frameRate"] ??= 60;
        canvas["scaleMode"] ??= "contain";

        var appearance = new JsonObject();
        foreach (string section in AppearanceSections)
            appearance[section] = CloneNode(legacy[section]);

        var nodes = new JsonArray();
        var groupStarts = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
        JsonArray groups = layout["groups"] as JsonArray ?? [];
        JsonArray layers = layout["layers"] as JsonArray ?? [];

        for (int index = 0; index < groups.Count; index++)
        {
            if (groups[index] is not JsonObject group)
                continue;

            string groupId = GetString(group, "id", $"group-{index + 1}");
            groupStarts[groupId] = GetDouble(group["timing"], "startMs", 0);
            nodes.Add(LegacyItemToNode(group, "group", null, index, 0));
        }

        var childOrders = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        int rootLayerOrder = groups.Count;
        for (int index = 0; index < layers.Count; index++)
        {
            if (layers[index] is not JsonObject layer)
                continue;

            string? parentId = GetNullableString(layer, "groupId");
            int order;
            double parentStart = 0;
            if (!string.IsNullOrWhiteSpace(parentId))
            {
                childOrders.TryGetValue(parentId, out order);
                childOrders[parentId] = order + 1;
                groupStarts.TryGetValue(parentId, out parentStart);
            }
            else
            {
                order = rootLayerOrder++;
            }

            nodes.Add(LegacyItemToNode(layer, "component", parentId, order, parentStart));
        }

        string migratedFrom = IsSceneV2(legacy) ? "scene-v2" : "legacy-config-v1";
        var scene = new JsonObject
        {
            ["$schema"] = "/schemas/scene-v2.schema.json",
            ["schemaVersion"] = CurrentSchemaVersion,
            ["documentType"] = DocumentType,
            ["id"] = id,
            ["revision"] = 1,
            ["metadata"] = new JsonObject
            {
                ["name"] = name,
                ["themeType"] = themeType,
                ["sourceThemeId"] = sourceThemeId,
                ["migratedFrom"] = migratedFrom
            },
            ["canvas"] = canvas,
            ["timeline"] = new JsonObject
            {
                ["durationMs"] = GetDouble(layout, "compositionDurationMs", 30000),
                ["restartOnPublish"] = true
            },
            ["appearance"] = appearance,
            ["nodes"] = nodes,
            ["extensions"] = new JsonObject
            {
                // Removed when the shared renderer lands. These two token sets
                // are needed only to project Scene v2 into the 2.0 renderer.
                ["musicOverlay.runtime.v1"] = new JsonObject
                {
                    ["position"] = CloneNode(legacy["position"]),
                    ["sizes"] = CloneNode(legacy["sizes"])
                }
            }
        };

        return NormalizeSceneV2(scene);
    }

    public static JsonObject ThemeToScene(
        JsonObject theme,
        Func<string, JsonObject?>? resolveSceneReference = null
    )
    {
        if (IsSceneV2(theme))
        {
            return NormalizeSceneV2(theme);
        }

        if (IsThemeV2(theme))
        {
            string reference = theme["scene"]?["ref"]?.GetValue<string>()
                ?? throw new InvalidDataException("Theme scene reference is required.");
            JsonObject baseScene = resolveSceneReference?.Invoke(reference)
                ?? throw new InvalidDataException($"Theme scene reference cannot be resolved: {reference}");
            JsonObject scene = CloneObject(baseScene);
            JsonObject? overrides = theme["scene"]?["overrides"] as JsonObject;
            if (overrides is not null)
                DeepMerge(scene, overrides);

            string referencedThemeId = GetString(theme, "id", "custom-theme");
            JsonObject metadata = theme["metadata"] as JsonObject ?? new JsonObject();
            scene["id"] = $"theme-{referencedThemeId}";
            scene["revision"] = theme["revision"]?.DeepClone() ?? 1;
            scene["metadata"] = new JsonObject
            {
                ["name"] = GetString(metadata, "name", referencedThemeId),
                ["themeType"] = GetString(metadata, "themeType", "builtin"),
                ["sourceThemeId"] = GetString(metadata, "sourceThemeId", referencedThemeId),
                ["migratedFrom"] = GetString(metadata, "migratedFrom", "theme-v2-reference")
            };
            return NormalizeSceneV2(scene);
        }

        string id = GetString(theme, "id", "custom-theme");
        string name = GetString(theme, "name", id);
        string type = GetString(theme, "type", "builtin");
        JsonObject merged = NormalizeLegacyConfig(theme);
        merged["theme"] = new JsonObject { ["preset"] = id };
        return LegacyConfigToScene(merged, $"theme-{id}", name, type, id);
    }

    public static JsonObject NormalizeSceneV2(JsonObject scene)
    {
        JsonObject normalized = SceneVisualGroupMaterializer.Materialize(
            SceneGeometryMaterializer.Materialize(scene)
        );
        if (normalized["nodes"] is JsonArray nodes)
        {
            string defaultFftPreset = GetString(normalized["appearance"]?["equalizer"], "preset", "balanced");
            foreach (JsonObject node in nodes.OfType<JsonObject>())
            {
                NormalizeAnimationPolicy(node);
                NormalizeComponentSemantics(node, defaultFftPreset);
                if (node["timing"] is not JsonObject timing)
                    continue;
                string endMode = GetString(timing, "endMode", "fixed");
                if (endMode != "fixed")
                    timing["durationMs"] = null;
            }
        }
        Validate(normalized);
        return normalized;
    }

    public static JsonObject SceneToLegacyConfig(
        JsonObject scene,
        JsonObject? globalSettings,
        bool includeAudio
    )
    {
        Validate(scene);
        JsonObject result = NormalizeLegacyConfig(null);
        JsonObject appearance = scene["appearance"] as JsonObject ?? new JsonObject();
        foreach (string section in AppearanceSections)
            result[section] = CloneNode(appearance[section] ?? result[section]);

        JsonObject? runtime = scene["extensions"]?["musicOverlay.runtime.v1"] as JsonObject;
        result["position"] = CloneNode(runtime?["position"] ?? result["position"]);
        result["sizes"] = CloneNode(runtime?["sizes"] ?? result["sizes"]);

        JsonObject layout = SceneNodesToLegacyLayout(scene);
        result["layout"] = layout;

        string preset = scene["metadata"]?["sourceThemeId"]?.GetValue<string>() ?? "Custom";
        result["theme"] = new JsonObject { ["preset"] = preset };

        JsonObject? fullGroup = FindRuntimeGroup(scene, "full");
        JsonObject? tickerGroup = FindRuntimeGroup(scene, "ticker");
        JsonObject timings = result["timings"]!.AsObject();
        JsonObject animations = result["animations"]!.AsObject();
        if (fullGroup is not null)
        {
            timings["fullVisibleMs"] = GetAbsoluteEnd(fullGroup, 10000);
            animations["fullEnter"] = GetAnimationType(fullGroup, "in", "slideRight");
            animations["fullExit"] = GetAnimationType(fullGroup, "out", "slideDown");
        }
        if (tickerGroup is not null)
        {
            animations["tickerEnter"] = GetAnimationType(tickerGroup, "in", "slideUp");
            animations["tickerExit"] = GetAnimationType(tickerGroup, "out", "none");
        }

        if (includeAudio)
        {
            string sourceMode = globalSettings?["audio"]?["sourceMode"]?.GetValue<string>() ?? "auto";
            result["audio"] = new JsonObject { ["sourceMode"] = sourceMode };
        }
        else
        {
            result.Remove("audio");
        }

        return result;
    }

    public static JsonObject UpdateGlobalSettingsFromLegacy(JsonObject current, JsonObject legacy)
    {
        JsonObject next = CloneObject(current);
        string sourceMode = legacy["audio"]?["sourceMode"]?.GetValue<string>() ??
            next["audio"]?["sourceMode"]?.GetValue<string>() ?? "auto";
        if (sourceMode is not ("auto" or "process" or "system"))
            sourceMode = "auto";
        next["audio"] = new JsonObject { ["sourceMode"] = sourceMode };
        return next;
    }

    public static void Validate(JsonObject scene)
    {
        if (!IsSceneV2(scene))
            throw new InvalidDataException("Unsupported scene document version.");

        if (scene["id"] is null || string.IsNullOrWhiteSpace(scene["id"]!.GetValue<string>()))
            throw new InvalidDataException("Scene id is required.");
        if (scene["nodes"] is not JsonArray nodes)
            throw new InvalidDataException("Scene nodes must be an array.");

        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var parents = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (JsonNode? value in nodes)
        {
            if (value is not JsonObject node)
                throw new InvalidDataException("Every scene node must be an object.");
            string id = GetString(node, "id", "");
            if (string.IsNullOrWhiteSpace(id) || !ids.Add(id))
                throw new InvalidDataException($"Duplicate or empty scene node id: {id}");
            parents[id] = GetNullableString(node, "parentId");
        }

        foreach ((string id, string? parentId) in parents)
        {
            if (parentId is not null && !ids.Contains(parentId))
                throw new InvalidDataException($"Node '{id}' refers to missing parent '{parentId}'.");

            var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { id };
            string? cursor = parentId;
            while (cursor is not null)
            {
                if (!visited.Add(cursor))
                    throw new InvalidDataException($"Scene node cycle detected at '{cursor}'.");
                parents.TryGetValue(cursor, out cursor);
            }
        }
    }

    private static JsonObject NormalizeLegacyConfig(JsonObject? incoming)
    {
        JsonObject result = CloneObject(DefaultLegacyConfig);
        if (incoming is null)
            return result;

        foreach ((string key, JsonNode? value) in incoming)
        {
            if (value is JsonObject incomingSection && result[key] is JsonObject resultSection)
            {
                foreach ((string childKey, JsonNode? childValue) in incomingSection)
                    resultSection[childKey] = CloneNode(childValue);
            }
            else
            {
                result[key] = CloneNode(value);
            }
        }
        return result;
    }

    private static void DeepMerge(JsonObject target, JsonObject source)
    {
        foreach ((string key, JsonNode? sourceValue) in source)
        {
            if (sourceValue is JsonObject sourceObject && target[key] is JsonObject targetObject)
                DeepMerge(targetObject, sourceObject);
            else
                target[key] = CloneNode(sourceValue);
        }
    }

    private static JsonObject CreateDefaultLayout(JsonObject config)
    {
        double fullEnd = Math.Max(1000, GetDouble(config["timings"], "fullVisibleMs", 10000));
        double coverStart = Math.Max(0, GetDouble(config["timings"], "coverDelayMs", 500));
        double cardStart = Math.Max(0, GetDouble(config["timings"], "cardDelayMs", 850));
        double duration = Math.Max(0, GetDouble(config["timings"], "exitMs", 600));
        string fullEnter = GetString(config["animations"], "fullEnter", "slideRight");
        string fullExit = GetString(config["animations"], "fullExit", "slideDown");
        string tickerEnter = GetString(config["animations"], "tickerEnter", "slideUp");
        string tickerExit = GetString(config["animations"], "tickerExit", "none");

        JsonObject Group(string id, string name, string target, string marker, double start, double? end, bool infinite, string enter, string exit) => new()
        {
            ["id"] = id, ["name"] = name, ["runtimeTarget"] = target,
            ["visible"] = true, ["locked"] = false, ["marker"] = marker,
            ["x"] = 0, ["y"] = 0, ["scale"] = 100,
            ["effects"] = Effects(), ["animation"] = Animation(enter, exit, duration),
            ["timing"] = Timing(start, end, infinite)
        };

        JsonObject Layer(string id, string name, string kind, string groupId, string marker, double start, double? end, bool infinite, string enter, string exit, double animationDuration, bool locked = false) => new()
        {
            ["id"] = id, ["name"] = name, ["kind"] = kind, ["groupId"] = groupId,
            ["marker"] = marker, ["timing"] = Timing(start, end, infinite),
            ["visible"] = true, ["locked"] = locked, ["x"] = 0, ["y"] = 0, ["scale"] = 100,
            ["effects"] = Effects(), ["animation"] = Animation(enter, exit, animationDuration)
        };

        return new JsonObject
        {
            ["version"] = 1,
            ["canvas"] = new JsonObject { ["width"] = 1920, ["height"] = 1080, ["backgroundColor"] = "#00a84f" },
            ["compositionDurationMs"] = 30000,
            ["groups"] = new JsonArray
            {
                Group("full-card-group", "Full Card", "full", "#8b5cf6", 0, fullEnd, false, fullEnter, fullExit),
                Group("ticker-group", "Ticker / Until next track", "ticker", "#35d0ba", fullEnd, null, true, tickerEnter, tickerExit)
            },
            ["layers"] = new JsonArray
            {
                Layer("full-particles", "Particles", "particles", "full-card-group", "#e879f9", 0, fullEnd, false, "fade", "fade", 350),
                Layer("full-cover", "Cover", "image", "full-card-group", "#fb7185", coverStart, fullEnd, false, "scale", "fade", 450),
                Layer("full-vinyl", "Vinyl", "disc", "full-card-group", "#ff9f43", coverStart, fullEnd, false, "slideLeft", "fade", 500),
                Layer("full-title", "Title", "text", "full-card-group", "#4da3ff", cardStart, fullEnd, false, "slideLeft", "fade", 450),
                Layer("full-artist", "Artist", "text", "full-card-group", "#4da3ff", cardStart, fullEnd, false, "slideLeft", "fade", 450),
                Layer("full-time", "Time", "time", "full-card-group", "#35d0ba", cardStart, fullEnd, false, "fade", "fade", 350),
                Layer("full-progress", "Progress", "progress", "full-card-group", "#35d0ba", cardStart, fullEnd, false, "fade", "fade", 350),
                Layer("full-card-shell", "Card container", "container", "full-card-group", "#8b5cf6", cardStart, fullEnd, false, "fade", "fade", 350, true),
                Layer("ticker-equalizer", "Equalizer", "equalizer", "ticker-group", "#e879f9", fullEnd, null, true, "slideUp", "fade", 500),
                Layer("ticker-title", "Ticker title", "text", "ticker-group", "#4da3ff", fullEnd, null, true, "slideUp", "fade", 500),
                Layer("ticker-time", "Ticker time", "time", "ticker-group", "#35d0ba", fullEnd, null, true, "fade", "fade", 350),
                Layer("ticker-progress", "Ticker progress", "progress", "ticker-group", "#35d0ba", fullEnd, null, true, "fade", "fade", 350)
            }
        };
    }

    private static JsonObject LegacyItemToNode(JsonObject item, string nodeType, string? parentId, int order, double parentStart)
    {
        string itemId = GetString(item, "id", Guid.NewGuid().ToString("N"));
        double x = GetDouble(item, "x", 0);
        double y = GetDouble(item, "y", 0);
        double scale = GetDouble(item, "scale", 100) / 100.0;
        JsonObject timing = item["timing"] as JsonObject ?? new JsonObject();
        double absoluteStart = GetDouble(timing, "startMs", parentStart);
        bool untilNextTrack = GetBool(timing, "untilNextTrack", false);
        bool untilGroupEnd = GetBool(timing, "untilGroupEnd", false);
        double? absoluteEnd = GetNullableDouble(timing, "endMs");
        string endMode = untilNextTrack ? "trackEnd" : untilGroupEnd ? "parentEnd" : "fixed";

        JsonObject properties = CloneObject(item["properties"] as JsonObject);
        string kind = nodeType == "group"
            ? "group"
            : GetSemanticKind(itemId, GetString(item, "kind", "block"), properties);
        JsonObject component = new()
        {
            ["kind"] = kind,
            ["templateId"] = CloneNode(item["templateId"]),
            ["runtimeTarget"] = CloneNode(item["runtimeTarget"]),
            ["properties"] = properties
        };
        if (item["assetData"] is not null)
            component["properties"]!["legacyAssetData"] = CloneNode(item["assetData"]);

        return new JsonObject
        {
            ["id"] = itemId,
            ["nodeType"] = nodeType,
            ["name"] = GetString(item, "name", "Object"),
            ["parentId"] = parentId,
            ["order"] = order,
            ["visible"] = GetBool(item, "visible", true),
            ["locked"] = GetBool(item, "locked", false),
            ["marker"] = GetString(item, "marker", "#8b5cf6"),
            ["transform"] = new JsonObject
            {
                ["x"] = x, ["y"] = y,
                ["scaleX"] = scale, ["scaleY"] = scale,
                ["rotation"] = 0, ["anchorX"] = 0.5, ["anchorY"] = 0.5
            },
            ["timing"] = new JsonObject
            {
                ["startMs"] = Math.Max(0, absoluteStart - parentStart),
                ["endMode"] = endMode,
                ["durationMs"] = endMode == "fixed" && absoluteEnd.HasValue
                    ? Math.Max(50, absoluteEnd.Value - absoluteStart)
                    : null
            },
            ["effects"] = EffectsToArray(item["effects"] as JsonObject),
            ["animations"] = AnimationToTracks(item["animation"] as JsonObject, nodeType == "group"),
            ["component"] = component
        };
    }

    private static JsonObject SceneNodesToLegacyLayout(JsonObject scene)
    {
        var groups = new JsonArray();
        var layers = new JsonArray();
        JsonArray nodes = scene["nodes"]!.AsArray();
        var groupBoundaries = nodes
            .OfType<JsonObject>()
            .Where(node => GetString(node, "nodeType", "component") == "group")
            .ToDictionary(
                node => GetString(node, "id", ""),
                node =>
                {
                    JsonObject timing = node["timing"] as JsonObject ?? new JsonObject();
                    double startMs = GetDouble(timing, "startMs", 0);
                    string endMode = GetString(timing, "endMode", "fixed");
                    double? endMs = endMode == "fixed"
                        ? startMs + (GetNullableDouble(timing, "durationMs") ?? 1000)
                        : null;
                    return (StartMs: startMs, EndMs: endMs);
                },
                StringComparer.OrdinalIgnoreCase
            );

        foreach (JsonObject node in nodes.OfType<JsonObject>().OrderBy(node => GetDouble(node, "order", 0)))
        {
            string nodeType = GetString(node, "nodeType", "component");
            string? parentId = GetNullableString(node, "parentId");
            (double StartMs, double? EndMs) parentBoundary =
                parentId is not null && groupBoundaries.TryGetValue(parentId, out var value)
                    ? value
                    : (0, null);
            JsonObject legacy = NodeToLegacyItem(node, parentBoundary.StartMs, parentBoundary.EndMs);
            if (nodeType == "group")
                groups.Add(legacy);
            else
            {
                legacy["groupId"] = parentId;
                layers.Add(legacy);
            }
        }

        JsonObject canvas = CloneObject(scene["canvas"] as JsonObject);
        canvas.Remove("frameRate");
        canvas.Remove("scaleMode");
        return new JsonObject
        {
            ["version"] = 2,
            ["replaceDefaults"] = true,
            ["canvas"] = canvas,
            ["compositionDurationMs"] = GetDouble(scene["timeline"], "durationMs", 30000),
            ["groups"] = groups,
            ["layers"] = layers
        };
    }

    private static JsonObject NodeToLegacyItem(JsonObject node, double parentStart, double? parentEnd)
    {
        JsonObject transform = node["transform"] as JsonObject ?? new JsonObject();
        JsonObject timing = node["timing"] as JsonObject ?? new JsonObject();
        JsonObject component = node["component"] as JsonObject ?? new JsonObject();
        double localStart = GetDouble(timing, "startMs", 0);
        double absoluteStart = parentStart + localStart;
        string endMode = GetString(timing, "endMode", "fixed");
        double? duration = GetNullableDouble(timing, "durationMs");
        bool inheritsInfiniteParent = endMode == "parentEnd" && !parentEnd.HasValue;
        double? absoluteEnd = endMode switch
        {
            "fixed" => absoluteStart + (duration ?? 1000),
            "parentEnd" => parentEnd,
            _ => null
        };

        var result = new JsonObject
        {
            ["id"] = CloneNode(node["id"]),
            ["name"] = CloneNode(node["name"]),
            ["visible"] = CloneNode(node["visible"]),
            ["locked"] = CloneNode(node["locked"]),
            ["marker"] = CloneNode(node["marker"]),
            ["x"] = GetDouble(transform, "x", 0),
            ["y"] = GetDouble(transform, "y", 0),
            ["scale"] = GetDouble(transform, "scaleX", 1) * 100,
            ["effects"] = EffectsFromArray(node["effects"] as JsonArray),
            ["animation"] = TracksToAnimation(node["animations"] as JsonObject, GetString(node, "nodeType", "component") == "group"),
            ["timing"] = new JsonObject
            {
                ["startMs"] = absoluteStart,
                ["endMs"] = absoluteEnd,
                ["untilNextTrack"] = endMode == "trackEnd" || inheritsInfiniteParent,
                ["untilGroupEnd"] = endMode == "parentEnd"
            }
        };

        string nodeType = GetString(node, "nodeType", "component");
        if (nodeType == "group")
        {
            result["runtimeTarget"] = CloneNode(component["runtimeTarget"]);
        }
        else
        {
            result["kind"] = CloneNode(component["kind"]);
            result["templateId"] = CloneNode(component["templateId"]);
            result["properties"] = CloneNode(component["properties"] ?? new JsonObject());
            if (result["properties"]?["legacyAssetData"] is JsonNode assetData)
            {
                result["assetData"] = CloneNode(assetData);
                result["properties"]!.AsObject().Remove("legacyAssetData");
            }
        }
        return result;
    }

    private static JsonObject? FindRuntimeGroup(JsonObject scene, string target) =>
        scene["nodes"]!.AsArray().OfType<JsonObject>().FirstOrDefault(node =>
            GetString(node, "nodeType", "") == "group" &&
            GetString(node["component"], "runtimeTarget", "") == target
        );

    private static double GetAbsoluteEnd(JsonObject node, double fallback)
    {
        JsonObject timing = node["timing"] as JsonObject ?? new JsonObject();
        return GetDouble(timing, "startMs", 0) + (GetNullableDouble(timing, "durationMs") ?? fallback);
    }

    private static string GetAnimationType(JsonObject node, string track, string fallback) =>
        GetString(node["animations"]?[track], "type", fallback);

    private static JsonArray EffectsToArray(JsonObject? effects) =>
    [
        new JsonObject { ["type"] = "opacity", ["enabled"] = true, ["value"] = GetDouble(effects, "opacity", 100) },
        new JsonObject { ["type"] = "blur", ["enabled"] = GetDouble(effects, "blur", 0) > 0, ["value"] = GetDouble(effects, "blur", 0) },
        new JsonObject { ["type"] = "glow", ["enabled"] = GetDouble(effects, "glow", 0) > 0, ["value"] = GetDouble(effects, "glow", 0) }
    ];

    private static JsonObject EffectsFromArray(JsonArray? effects)
    {
        double Find(string type, double fallback) => effects?.OfType<JsonObject>()
            .FirstOrDefault(effect => GetString(effect, "type", "") == type)?["value"]?.GetValue<double>() ?? fallback;
        return new JsonObject
        {
            ["opacity"] = Find("opacity", 100),
            ["blur"] = Find("blur", 0),
            ["glow"] = Find("glow", 0)
        };
    }

    private static JsonObject AnimationToTracks(JsonObject? animation, bool isGroup = false)
    {
        double legacyDuration = GetDouble(animation, "durationMs", 600);
        string legacyEasing = GetString(animation, "easing", "ease-out");
        JsonObject tracks = new()
        {
            ["in"] = new JsonObject
            {
                ["type"] = GetString(animation, "enter", "fade"),
                ["durationMs"] = GetDouble(animation, "enterDurationMs", legacyDuration),
                ["easing"] = GetString(animation, "enterEasing", legacyEasing)
            },
            ["out"] = new JsonObject
            {
                ["type"] = GetString(animation, "exit", "fade"),
                ["durationMs"] = GetDouble(animation, "exitDurationMs", legacyDuration),
                ["easing"] = GetString(animation, "exitEasing", legacyEasing)
            }
        };
        if (isGroup) tracks["overrideChildren"] = GetBool(animation, "overrideChildren", false);
        return tracks;
    }

    private static JsonObject TracksToAnimation(JsonObject? animations, bool isGroup = false)
    {
        JsonObject input = animations?["in"] as JsonObject ?? new JsonObject();
        JsonObject output = animations?["out"] as JsonObject ?? new JsonObject();
        double inDuration = GetDouble(input, "durationMs", 600);
        string inEasing = GetString(input, "easing", "ease-out");
        JsonObject animation = new()
        {
            ["enter"] = GetString(input, "type", "fade"),
            ["exit"] = GetString(output, "type", "fade"),
            ["enterDurationMs"] = inDuration,
            ["enterEasing"] = inEasing,
            ["exitDurationMs"] = GetDouble(output, "durationMs", 600),
            ["exitEasing"] = GetString(output, "easing", "ease-out"),
            ["durationMs"] = inDuration,
            ["easing"] = inEasing
        };
        if (isGroup) animation["overrideChildren"] = GetBool(animations, "overrideChildren", false);
        return animation;
    }

    private static JsonObject Effects() => new() { ["opacity"] = 100, ["blur"] = 0, ["glow"] = 0 };

    private static JsonObject Animation(string enter, string exit, double duration) => new()
    {
        ["enter"] = enter, ["exit"] = exit,
        ["enterDurationMs"] = duration, ["enterEasing"] = "ease-out",
        ["exitDurationMs"] = duration, ["exitEasing"] = "ease-out",
        ["durationMs"] = duration, ["easing"] = "ease-out"
    };

    private static JsonObject Timing(double start, double? end, bool untilNextTrack) => new()
    {
        ["startMs"] = start,
        ["endMs"] = end,
        ["untilNextTrack"] = untilNextTrack,
        ["untilGroupEnd"] = false
    };

    private static void NormalizeAnimationPolicy(JsonObject node)
    {
        JsonObject animations = node["animations"] as JsonObject ?? new JsonObject();
        foreach (string trackName in new[] { "in", "out" })
        {
            if (animations[trackName] is not JsonObject track)
                continue;
            if (GetString(track, "type", "none") != "none" && GetDouble(track, "durationMs", 0) <= 0)
                track["durationMs"] = 600;
        }
        if (GetString(node, "nodeType", "component") == "group" && animations["overrideChildren"] is null)
            animations["overrideChildren"] = false;
        node["animations"] = animations;
    }

    private static void NormalizeComponentSemantics(JsonObject node, string defaultFftPreset)
    {
        if (GetString(node, "nodeType", "component") != "component")
            return;
        JsonObject component = node["component"] as JsonObject ?? new JsonObject();
        JsonObject properties = component["properties"] as JsonObject ?? new JsonObject();
        string id = GetString(node, "id", "");
        string kind = GetSemanticKind(id, GetString(component, "kind", "block"), properties);
        if (kind == "equalizer" && properties["fftPreset"] is null)
            properties["fftPreset"] = defaultFftPreset;
        component["kind"] = kind;
        component["properties"] = properties;
        node["component"] = component;
    }

    private static string GetSemanticKind(string id, string kind, JsonObject properties)
    {
        string normalized = kind.Trim().ToLowerInvariant();
        if (normalized == "data")
        {
            string binding = GetString(properties, "binding", "").ToLowerInvariant();
            normalized = binding == "progress" || id.Contains("progress", StringComparison.OrdinalIgnoreCase)
                ? "progress"
                : "time";
            properties["binding"] = normalized;
        }
        else if (normalized == "effect")
        {
            if (id.Contains("equalizer", StringComparison.OrdinalIgnoreCase))
                normalized = "equalizer";
            else if (id.Contains("particle", StringComparison.OrdinalIgnoreCase))
                normalized = "particles";
        }
        return normalized;
    }

    private static JsonObject CloneObject(JsonObject? value) =>
        value?.DeepClone().AsObject() ?? new JsonObject();

    private static JsonNode? CloneNode(JsonNode? value) => value?.DeepClone();

    private static string GetString(JsonNode? node, string name, string fallback) =>
        node?[name]?.GetValue<string>() ?? fallback;

    private static string? GetNullableString(JsonNode? node, string name)
    {
        JsonNode? value = node?[name];
        return value is null ? null : value.GetValue<string>();
    }

    private static double GetDouble(JsonNode? node, string name, double fallback)
    {
        JsonNode? value = node?[name];
        if (value is null)
            return fallback;
        try { return value.GetValue<double>(); }
        catch { return fallback; }
    }

    private static double? GetNullableDouble(JsonNode? node, string name)
    {
        JsonNode? value = node?[name];
        if (value is null)
            return null;
        try { return value.GetValue<double>(); }
        catch { return null; }
    }

    private static bool GetBool(JsonNode? node, string name, bool fallback)
    {
        JsonNode? value = node?[name];
        if (value is null)
            return fallback;
        try { return value.GetValue<bool>(); }
        catch { return fallback; }
    }
}

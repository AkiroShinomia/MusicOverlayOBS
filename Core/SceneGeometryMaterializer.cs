using System.Text.Json.Nodes;

namespace MusicOverlay.Core;

/// <summary>
/// One-time compatibility migration for the classic two-stage composition.
/// Runtime geometry used to live in global position/sizes fields. Scene v2
/// owns geometry per node, so this class moves those values into transforms
/// and component properties before a scene is stored or rendered.
/// </summary>
public static class SceneGeometryMaterializer
{
    private const string LegacyRuntimeExtension = "musicOverlay.runtime.v1";

    public static JsonObject Materialize(JsonObject source)
    {
        JsonObject scene = source.DeepClone().AsObject();
        if (scene["extensions"] is not JsonObject extensions ||
            extensions[LegacyRuntimeExtension] is not JsonObject runtime ||
            scene["nodes"] is not JsonArray nodes)
        {
            return scene;
        }

        if (!IsClassicTwoStage(nodes))
        {
            extensions.Remove(LegacyRuntimeExtension);
            extensions["musicOverlay.geometry"] = new JsonObject
            {
                ["schemaVersion"] = 1,
                ["coordinateSpace"] = "canvas",
                ["materializedFrom"] = "already-native-v2"
            };
            return scene;
        }

        JsonObject position = runtime["position"] as JsonObject ?? new JsonObject();
        JsonObject sizes = runtime["sizes"] as JsonObject ?? new JsonObject();
        JsonObject appearance = scene["appearance"] as JsonObject ?? new JsonObject();
        JsonObject colors = appearance["colors"] as JsonObject ?? new JsonObject();
        JsonObject font = appearance["font"] as JsonObject ?? new JsonObject();
        JsonObject ticker = appearance["ticker"] as JsonObject ?? new JsonObject();
        JsonObject fullCard = appearance["fullCard"] as JsonObject ?? new JsonObject();
        JsonObject vinyl = appearance["vinyl"] as JsonObject ?? new JsonObject();
        JsonObject particles = appearance["particles"] as JsonObject ?? new JsonObject();
        JsonObject equalizer = appearance["equalizer"] as JsonObject ?? new JsonObject();

        double canvasWidth = Math.Max(1, Number(scene["canvas"], "width", 1920));
        double canvasHeight = Math.Max(1, Number(scene["canvas"], "height", 1080));
        double left = Number(position, "left", 70);
        double coverSize = Math.Max(10, Number(sizes, "coverSize", 92));
        double discSize = Math.Max(10, Number(sizes, "vinylSize", 108));
        double cardWidth = Math.Max(80, Number(sizes, "fullCardWidth", 430));
        double titleSize = Number(font, "titleSize", 25);
        double artistSize = Number(font, "artistSize", 16);
        double cardHeight = Math.Max(108, 68 + titleSize + artistSize);
        double fullHeight = Math.Max(150, Math.Max(cardHeight, Math.Max(coverSize + 30, discSize + 30)));
        double cardX = coverSize + 18;
        double cardY = (fullHeight - cardHeight) / 2;
        double contentX = cardX + 34;
        double contentWidth = Math.Max(40, cardWidth - 58);
        double titleY = cardY + 18;
        double artistY = titleY + titleSize + 7;
        double timeY = artistY + artistSize + 16;
        double progressY = timeY + 22;
        double tickerWidth = Math.Max(80, Number(sizes, "tickerWidth", 500));
        double tickerHeight = Math.Max(20, Number(sizes, "tickerHeight", 42));
        double equalizerHeight = Math.Max(4, Number(equalizer, "height", 86));
        double sidePadding = Number(equalizer, "sidePadding", 14);
        string textColor = Text(colors, "text", "#ffffff");
        string progressColor = Text(colors, "progress", "#ffffff");
        string progressBackground = Text(colors, "progressBackground", "rgba(255,255,255,.18)");
        string background = Text(colors, "background", "rgba(10,10,14,.8)");
        string tickerStyle = Text(ticker, "style", "pill");

        foreach (JsonObject node in nodes.OfType<JsonObject>())
        {
            string id = Text(node, "id", "");
            switch (id)
            {
                case "full-card-group":
                    Move(node, left, canvasHeight - Number(position, "fullBottom", 80) - fullHeight);
                    Properties(node, new JsonObject { ["width"] = cardX + cardWidth, ["height"] = fullHeight });
                    break;
                case "ticker-group":
                    Move(node, left, canvasHeight - Number(position, "tickerBottom", 44) - tickerHeight);
                    Properties(node, new JsonObject
                    {
                        ["width"] = tickerWidth, ["height"] = tickerHeight, ["surface"] = true,
                        ["background"] = background, ["color"] = textColor,
                        ["borderRadius"] = tickerStyle is "thin" or "compact" ? 8 : tickerStyle == "glass" ? 18 : 999,
                        ["style"] = tickerStyle
                    });
                    break;
                case "full-particles":
                    Move(node, 22, 0);
                    Properties(node, new JsonObject
                    {
                        ["width"] = 260, ["height"] = 120,
                        ["count"] = Clone(particles["count"]), ["color"] = Clone(particles["color"]),
                        ["style"] = Clone(particles["style"]), ["size"] = Clone(particles["size"]),
                        ["durationMs"] = Clone(particles["durationMs"])
                    });
                    if (particles["enabled"]?.GetValue<bool>() == false) node["visible"] = false;
                    break;
                case "full-cover":
                    Move(node, 0, (fullHeight - coverSize) / 2);
                    Properties(node, new JsonObject { ["width"] = coverSize, ["height"] = coverSize, ["borderRadius"] = 14, ["source"] = "track" });
                    break;
                case "full-vinyl":
                    Move(node, coverSize * .2, (fullHeight - discSize) / 2);
                    Properties(node, new JsonObject { ["size"] = discSize, ["style"] = Text(vinyl, "style", "classic"), ["speedSec"] = 2.8 });
                    break;
                case "full-card-shell":
                    Move(node, cardX, cardY);
                    Properties(node, new JsonObject
                    {
                        ["width"] = cardWidth, ["height"] = cardHeight, ["borderRadius"] = 18,
                        ["color"] = Text(fullCard, "style", "glass") == "minimal" ? "transparent" : background,
                        ["style"] = Text(fullCard, "style", "glass")
                    });
                    break;
                case "full-title":
                    Move(node, contentX, titleY);
                    TextProperties(node, "title", contentWidth, titleSize, 800, textColor);
                    break;
                case "full-artist":
                    Move(node, contentX, artistY);
                    TextProperties(node, "artist", contentWidth, artistSize, 400, textColor);
                    break;
                case "full-time":
                    Move(node, contentX, timeY);
                    TextProperties(node, "time", contentWidth, 13, null, textColor);
                    break;
                case "full-progress":
                    Move(node, contentX, progressY);
                    Properties(node, new JsonObject
                    {
                        ["binding"] = "progress", ["width"] = contentWidth, ["height"] = 6,
                        ["borderRadius"] = 999, ["color"] = progressColor, ["background"] = progressBackground
                    });
                    break;
                case "ticker-equalizer":
                    Move(node, sidePadding, -equalizerHeight - 1 + Number(equalizer, "offsetY", 0));
                    Properties(node, new JsonObject
                    {
                        ["width"] = tickerWidth - sidePadding * 2, ["height"] = equalizerHeight,
                        ["barCount"] = Clone(equalizer["barCount"]), ["gap"] = Clone(equalizer["gap"]),
                        ["style"] = Clone(equalizer["style"]),
                        ["color"] = Text(equalizer, "colorMode", "progress") == "custom" ? Text(equalizer, "color", progressColor) : progressColor,
                        ["glow"] = Clone(equalizer["glow"]), ["glowPower"] = Clone(equalizer["glowPower"])
                    });
                    if (equalizer["enabled"]?.GetValue<bool>() == false) node["visible"] = false;
                    break;
                case "ticker-title":
                    Move(node, 16, 6);
                    TextProperties(node, "ticker", Math.Max(40, tickerWidth - 150), Number(font, "tickerSize", 14), 800, textColor);
                    break;
                case "ticker-time":
                    Move(node, Math.Max(16, tickerWidth - 116), 7);
                    TextProperties(node, "time", 100, 12, null, textColor);
                    break;
                case "ticker-progress":
                    Move(node, 16, Math.Max(0, tickerHeight - 10));
                    Properties(node, new JsonObject
                    {
                        ["binding"] = "progress", ["width"] = Math.Max(20, tickerWidth - 32), ["height"] = 4,
                        ["borderRadius"] = 999, ["color"] = progressColor, ["background"] = progressBackground
                    });
                    break;
            }
        }

        extensions.Remove(LegacyRuntimeExtension);
        extensions["musicOverlay.geometry"] = new JsonObject
        {
            ["schemaVersion"] = 1,
            ["coordinateSpace"] = "canvas",
            ["materializedFrom"] = "classic-two-stage-v1"
        };
        return scene;
    }

    private static bool IsClassicTwoStage(JsonArray nodes)
    {
        HashSet<string> ids = nodes.OfType<JsonObject>()
            .Select(node => Text(node, "id", ""))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        return ids.Contains("full-card-group") && ids.Contains("ticker-group") &&
               ids.Contains("full-cover") && ids.Contains("full-title") && ids.Contains("ticker-title");
    }

    private static void Move(JsonObject node, double x, double y)
    {
        JsonObject transform = node["transform"] as JsonObject ?? new JsonObject();
        transform["x"] = Number(transform, "x", 0) + x;
        transform["y"] = Number(transform, "y", 0) + y;
        node["transform"] = transform;
    }

    private static void Properties(JsonObject node, JsonObject values)
    {
        JsonObject component = node["component"] as JsonObject ?? new JsonObject();
        JsonObject properties = component["properties"] as JsonObject ?? new JsonObject();
        foreach ((string key, JsonNode? value) in values)
            if (value is not null) properties[key] = value.DeepClone();
        component["properties"] = properties;
        node["component"] = component;
    }

    private static void TextProperties(JsonObject node, string binding, double width, double fontSize, int? fontWeight, string color)
    {
        var values = new JsonObject
        {
            ["binding"] = binding, ["width"] = width, ["fontSize"] = fontSize, ["color"] = color
        };
        if (fontWeight.HasValue) values["fontWeight"] = fontWeight.Value;
        Properties(node, values);
    }

    private static double Number(JsonNode? node, string key, double fallback)
    {
        try { return node?[key]?.GetValue<double>() ?? fallback; }
        catch { return fallback; }
    }

    private static string Text(JsonNode? node, string key, string fallback)
    {
        try { return node?[key]?.GetValue<string>() ?? fallback; }
        catch { return fallback; }
    }

    private static JsonNode? Clone(JsonNode? node) => node?.DeepClone();
}

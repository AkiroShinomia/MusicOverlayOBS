using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using MusicOverlay.Application.Abstractions;
using MusicOverlay.Core;
using MusicOverlay.Hosting;
using MusicOverlay.Web;

namespace MusicOverlay.Endpoints;

public sealed class ThemeEndpoints(IThemeStore themes, WebSocketHub sockets)
{
    public Task ListAsync(HttpListenerContext context) => ApiResult.JsonAsync(context, themes.GetThemes());

    public async Task GetSceneAsync(HttpListenerContext context, string routeId)
    {
        string id = ParseThemeId(routeId);
        if (string.IsNullOrWhiteSpace(id))
        {
            await ApiResult.ErrorAsync(context, 400, "Theme id is required");
            return;
        }
        try { await ApiResult.JsonAsync(context, await themes.GetThemeSceneAsync(id)); }
        catch (FileNotFoundException) { await ApiResult.ErrorAsync(context, 404, "Theme not found"); }
    }

    public async Task GetLegacyAsync(HttpListenerContext context, string routeId)
    {
        string id = ParseThemeId(routeId);
        if (string.IsNullOrWhiteSpace(id))
        {
            await ApiResult.ErrorAsync(context, 400, "Theme id is required");
            return;
        }
        try { await ApiResult.JsonAsync(context, await themes.GetThemeLegacyAsync(id)); }
        catch (FileNotFoundException) { await ApiResult.ErrorAsync(context, 404, "Theme not found"); }
    }

    public async Task CreateAsync(HttpListenerContext context)
    {
        try
        {
            JsonObject root = await ReadObjectAsync(context);
            string name = root["name"]?.GetValue<string>()?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(name)) throw new InvalidDataException("Theme name is empty");
            JsonObject scene = ReadScene(root);
            ThemeSummary saved = await themes.SaveCustomThemeAsync(name, scene);
            await sockets.BroadcastAsync("themesChanged");
            await ApiResult.JsonAsync(context, new { ok = true, saved.id, saved.name, saved.type, saved.path });
        }
        catch (Exception ex) { await ApiResult.JsonAsync(context, ApiError.From(ex)); }
    }

    public async Task UpdateAsync(HttpListenerContext context, string routeId)
    {
        try
        {
            string id = Uri.UnescapeDataString(routeId).Trim();
            ThemeSummary saved = await themes.UpdateCustomThemeAsync(id, ReadScene(await ReadObjectAsync(context)));
            await sockets.BroadcastAsync("themesChanged");
            await ApiResult.JsonAsync(context, new { ok = true, saved.id, saved.name });
        }
        catch (Exception ex) { await ApiResult.JsonAsync(context, ApiError.From(ex)); }
    }

    public async Task DeleteCustomAsync(HttpListenerContext context, string routeId)
    {
        try
        {
            string id = Uri.UnescapeDataString(routeId).Trim();
            await themes.DeleteCustomThemeAsync(id);
            await sockets.BroadcastAsync("themesChanged");
            await ApiResult.JsonAsync(context, new { ok = true, id = $"custom/{id}" });
        }
        catch (Exception ex) { await ApiResult.JsonAsync(context, ApiError.From(ex)); }
    }

    public async Task DeleteByBodyAsync(HttpListenerContext context)
    {
        try
        {
            JsonObject root = await ReadObjectAsync(context);
            string id = root["id"]?.GetValue<string>()?.Trim() ?? "";
            if (!id.StartsWith("custom/", StringComparison.OrdinalIgnoreCase))
            {
                await ApiResult.JsonAsync(context, new { ok = false, error = "System themes are protected" });
                return;
            }
            await themes.DeleteCustomThemeAsync(id["custom/".Length..]);
            await sockets.BroadcastAsync("themesChanged");
            await ApiResult.JsonAsync(context, new { ok = true, id });
        }
        catch (Exception ex) { await ApiResult.JsonAsync(context, ApiError.From(ex)); }
    }

    private static string ParseThemeId(string routeId)
    {
        string id = Uri.UnescapeDataString(routeId).Trim();
        return id.StartsWith("custom/", StringComparison.OrdinalIgnoreCase)
            ? id
            : id.StartsWith("builtin/", StringComparison.OrdinalIgnoreCase) ? id["builtin/".Length..] : "";
    }

    private static JsonObject ReadScene(JsonObject root) =>
        root["scene"] as JsonObject ?? root["theme"] as JsonObject
        ?? throw new InvalidDataException("Scene data is required");

    private static async Task<JsonObject> ReadObjectAsync(HttpListenerContext context)
    {
        using var reader = new StreamReader(context.Request.InputStream, context.Request.ContentEncoding);
        return JsonNode.Parse(await reader.ReadToEndAsync()) as JsonObject
            ?? throw new JsonException("Request root must be an object");
    }
}

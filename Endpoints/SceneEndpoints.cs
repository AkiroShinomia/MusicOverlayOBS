using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MusicOverlay.Application.Abstractions;
using MusicOverlay.Hosting;
using MusicOverlay.Web;

namespace MusicOverlay.Endpoints;

public sealed class SceneEndpoints(ISceneStore scenes, WebSocketHub sockets)
{
    public Task GetDraftAsync(HttpListenerContext context) =>
        SendAsync(context, scenes.GetDraftSceneAsync());

    public Task GetPublishedAsync(HttpListenerContext context) =>
        SendAsync(context, scenes.GetPublishedSceneAsync());

    public async Task SaveDraftAsync(HttpListenerContext context)
    {
        using var reader = new StreamReader(context.Request.InputStream, Encoding.UTF8);
        string body = await reader.ReadToEndAsync();
        try
        {
            JsonObject root = JsonNode.Parse(body) as JsonObject
                ?? throw new JsonException("Request root must be an object");
            JsonObject scene = root["scene"] as JsonObject
                ?? throw new InvalidDataException("Scene document is required");
            long revision = await scenes.SaveDraftSceneAsync(scene, root["settings"] as JsonObject);
            await ApiResult.JsonAsync(context, new { ok = true, revision });
        }
        catch (Exception ex)
        {
            await ApiResult.ErrorAsync(context, 400, ex.Message);
        }
    }

    public async Task PublishAsync(HttpListenerContext context)
    {
        using var reader = new StreamReader(context.Request.InputStream, Encoding.UTF8);
        string body = await reader.ReadToEndAsync();
        try
        {
            JsonObject root = JsonNode.Parse(body) as JsonObject
                ?? throw new JsonException("Request root must be an object");
            JsonObject scene = root["scene"] as JsonObject
                ?? throw new InvalidDataException("Scene document is required");
            long revision = await scenes.SaveDraftAndPublishSceneAsync(scene, root["settings"] as JsonObject);
            await sockets.BroadcastAsync("configChanged");
            await ApiResult.JsonAsync(context, new { ok = true, revision });
        }
        catch (Exception ex)
        {
            await ApiResult.ErrorAsync(context, 400, ex.Message);
        }
    }

    private static async Task SendAsync(HttpListenerContext context, Task<JsonObject> operation) =>
        await ApiResult.JsonAsync(context, await operation);
}

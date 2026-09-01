using System.Net;
using MusicOverlay.Endpoints;

namespace MusicOverlay.Hosting;

public sealed class RouteMap(
    SceneEndpoints scenes,
    ThemeEndpoints themes,
    SettingsEndpoints settings,
    LiveEndpoints live,
    SystemEndpoints system,
    WebSocketHub sockets)
{
    public async Task<bool> TryHandleAsync(HttpListenerContext context)
    {
        string path = context.Request.Url?.AbsolutePath ?? "/";
        string method = context.Request.HttpMethod;

        if (path == "/api/version") await system.GetVersionAsync(context);
        else if (path == "/api/nowplaying") await live.GetNowPlayingAsync(context);
        else if (path == "/api/audiolevel") await live.GetAudioLevelAsync(context);
        else if (path == "/api/themes") await themes.ListAsync(context);
        else if (path == "/api/scene/draft" && method == "GET") await scenes.GetDraftAsync(context);
        else if (path == "/api/scene/published" && method == "GET") await scenes.GetPublishedAsync(context);
        else if (path == "/api/settings" && method == "GET") await settings.GetAsync(context);
        else if (path == "/api/scene/publish" && method == "POST") await scenes.PublishAsync(context);
        else if (path.StartsWith("/api/scene/theme/", StringComparison.OrdinalIgnoreCase) && method == "GET")
            await themes.GetSceneAsync(context, path["/api/scene/theme/".Length..]);
        else if (path.StartsWith("/api/theme/", StringComparison.OrdinalIgnoreCase) && method == "GET")
            await themes.GetLegacyAsync(context, path["/api/theme/".Length..]);
        else if (path == "/api/themes/custom" && method == "POST") await themes.CreateAsync(context);
        else if (path == "/api/themes/delete" && method == "POST") await themes.DeleteByBodyAsync(context);
        else if (path.StartsWith("/api/themes/custom/", StringComparison.OrdinalIgnoreCase) && method == "PUT")
            await themes.UpdateAsync(context, path["/api/themes/custom/".Length..]);
        else if (path.StartsWith("/api/themes/custom/", StringComparison.OrdinalIgnoreCase) && method == "DELETE")
            await themes.DeleteCustomAsync(context, path["/api/themes/custom/".Length..]);
        else if (path == "/ws") await sockets.AcceptAsync(context);
        else return false;

        return true;
    }
}

using System.Net;
using MusicOverlay.Web;

namespace MusicOverlay.Endpoints;

public sealed class SystemEndpoints(string version)
{
    public Task GetVersionAsync(HttpListenerContext context) =>
        ApiResult.JsonAsync(context, new { version });
}

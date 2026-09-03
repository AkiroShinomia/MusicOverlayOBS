using System.Net;
using MusicOverlay.Application.Abstractions;
using MusicOverlay.Web;

namespace MusicOverlay.Endpoints;

public sealed class SettingsEndpoints(ISettingsStore settings)
{
    public async Task GetAsync(HttpListenerContext context) =>
        await ApiResult.JsonAsync(context, await settings.GetGlobalSettingsAsync());
}

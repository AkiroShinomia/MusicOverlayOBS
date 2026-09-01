using System.Net;
using System.Text.Json.Nodes;
using Windows.Media.Control;
using Windows.Storage.Streams;
using MusicOverlay.Application.Abstractions;
using MusicOverlay.Web;

namespace MusicOverlay.Endpoints;

public sealed class LiveEndpoints(ISettingsStore settings, IAudioLevelSource audio)
{
    public async Task GetAudioLevelAsync(HttpListenerContext context)
    {
        audio.SetAudioSourceMode(settings.GetAudioSourceMode());
        FftSettings fft = GetFftSettings();
        audio.SetFftSettings(fft.AutoGain, fft.OutputGain, fft.SpectralContrast, fft.VisualCurvePower);
        await ApiResult.JsonAsync(context, audio.GetAudioLevel("mediaSession"));
    }

    public async Task GetNowPlayingAsync(HttpListenerContext context)
    {
        GlobalSystemMediaTransportControlsSessionManager manager =
            await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
        GlobalSystemMediaTransportControlsSession? session = manager.GetCurrentSession();
        if (session is null)
        {
            audio.SetMediaSource("");
            await ApiResult.JsonAsync(context, new
            {
                hasTrack = false, title = "", artist = "", albumTitle = "", position = 0,
                duration = 0, isPlaying = false, thumbnail = "", sourceAppId = ""
            });
            return;
        }

        string sourceAppId = session.SourceAppUserModelId ?? "";
        audio.SetMediaSource(sourceAppId);
        GlobalSystemMediaTransportControlsSessionMediaProperties media = await session.TryGetMediaPropertiesAsync();
        GlobalSystemMediaTransportControlsSessionTimelineProperties timeline = session.GetTimelineProperties();
        GlobalSystemMediaTransportControlsSessionPlaybackInfo playback = session.GetPlaybackInfo();
        await ApiResult.JsonAsync(context, new
        {
            hasTrack = true,
            title = media.Title ?? "",
            artist = media.Artist ?? "",
            albumTitle = media.AlbumTitle ?? "",
            position = Math.Max(0, timeline.Position.TotalSeconds),
            duration = Math.Max(0, (timeline.EndTime - timeline.StartTime).TotalSeconds),
            isPlaying = playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,
            thumbnail = await GetThumbnailBase64Async(media.Thumbnail),
            sourceAppId
        });
    }

    private FftSettings GetFftSettings()
    {
        try
        {
            JsonObject equalizer = settings.GetEqualizerSettings();
            return new FftSettings(
                equalizer["autoGain"]?.GetValue<bool>() ?? true,
                equalizer["outputGain"]?.GetValue<double>() ?? 1.0,
                equalizer["spectralContrast"]?.GetValue<double>() ?? 1.0,
                equalizer["visualCurvePower"]?.GetValue<double>() ?? 1.0);
        }
        catch { return new FftSettings(true, 1.0, 1.0, 1.0); }
    }

    private static async Task<string> GetThumbnailBase64Async(IRandomAccessStreamReference? thumbnail)
    {
        if (thumbnail is null) return "";
        try
        {
            using IRandomAccessStreamWithContentType stream = await thumbnail.OpenReadAsync();
            using var reader = new DataReader(stream);
            uint size = (uint)stream.Size;
            await reader.LoadAsync(size);
            byte[] buffer = new byte[size];
            reader.ReadBytes(buffer);
            return $"data:image/png;base64,{Convert.ToBase64String(buffer)}";
        }
        catch { return ""; }
    }

    private sealed record FftSettings(bool AutoGain, double OutputGain, double SpectralContrast, double VisualCurvePower);
}

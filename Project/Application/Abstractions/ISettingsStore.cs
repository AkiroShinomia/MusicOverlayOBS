using System.Text.Json.Nodes;

namespace MusicOverlay.Application.Abstractions;

public interface ISettingsStore
{
    Task<JsonObject> GetGlobalSettingsAsync();
    string GetAudioSourceMode();
    JsonObject GetEqualizerSettings();
}

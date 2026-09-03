using System.Text.Json.Nodes;

namespace MusicOverlay.Application.Abstractions;

public interface ISceneStore
{
    Task<JsonObject> GetDraftSceneAsync();
    Task<JsonObject> GetPublishedSceneAsync();
    Task<long> SaveDraftSceneAsync(JsonObject sceneInput, JsonObject? settingsPatch);
    Task<long> SaveDraftAndPublishSceneAsync(JsonObject sceneInput, JsonObject? settingsPatch);
}

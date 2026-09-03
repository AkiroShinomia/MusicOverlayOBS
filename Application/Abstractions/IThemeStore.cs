using System.Text.Json.Nodes;
using MusicOverlay.Core;

namespace MusicOverlay.Application.Abstractions;

public interface IThemeStore
{
    IReadOnlyList<ThemeSummary> GetThemes();
    Task<JsonObject> GetThemeLegacyAsync(string id);
    Task<JsonObject> GetThemeSceneAsync(string id);
    Task<ThemeSummary> SaveCustomThemeAsync(string name, JsonObject scene);
    Task<ThemeSummary> UpdateCustomThemeAsync(string id, JsonObject scene);
    Task DeleteCustomThemeAsync(string id);
}

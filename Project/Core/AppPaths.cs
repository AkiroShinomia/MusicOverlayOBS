namespace MusicOverlay.Core;

public sealed record AppPaths(
    string AppRoot,
    string OverlayRoot,
    string DataRoot,
    string SettingsFile,
    string DraftSceneFile,
    string PublishedSceneFile,
    string CustomThemesRoot,
    string AssetsRoot,
    string CompositionsRoot,
    string BackupsRoot,
    string LegacyConfigFile,
    string BundledDefaultSceneFile,
    string BundledThemesRoot
)
{
    public static AppPaths Discover()
    {
        string executableRoot = Path.GetFullPath(AppContext.BaseDirectory);
        string workingRoot = Path.GetFullPath(Directory.GetCurrentDirectory());

        // Published builds keep overlay/ beside the executable. During local
        // development dotnet places the executable in bin/, so use the project
        // directory when that is the directory that actually owns overlay/.
        static bool HasApplicationOverlay(string root) =>
            File.Exists(Path.Combine(root, "overlay", "index.html")) &&
            File.Exists(Path.Combine(root, "overlay", "settings.html"));

        string appRoot = HasApplicationOverlay(workingRoot)
            ? workingRoot
            : HasApplicationOverlay(executableRoot)
                ? executableRoot
                : executableRoot;

        string overlayRoot = Path.Combine(appRoot, "overlay");
        string dataRoot = Path.Combine(appRoot, "data");

        return new AppPaths(
            appRoot,
            overlayRoot,
            dataRoot,
            Path.Combine(dataRoot, "settings.json"),
            Path.Combine(dataRoot, "workspace", "draft.scene.json"),
            Path.Combine(dataRoot, "workspace", "published.scene.json"),
            Path.Combine(dataRoot, "themes", "custom"),
            Path.Combine(dataRoot, "library", "assets"),
            Path.Combine(dataRoot, "library", "compositions"),
            Path.Combine(dataRoot, "backups"),
            Path.Combine(overlayRoot, "config.json"),
            Path.Combine(overlayRoot, "default.scene.json"),
            Path.Combine(overlayRoot, "themes")
        );
    }

    public void EnsurePortableDirectories()
    {
        Directory.CreateDirectory(DataRoot);
        Directory.CreateDirectory(Path.GetDirectoryName(DraftSceneFile)!);
        Directory.CreateDirectory(CustomThemesRoot);
        Directory.CreateDirectory(AssetsRoot);
        Directory.CreateDirectory(CompositionsRoot);
        Directory.CreateDirectory(BackupsRoot);
    }
}

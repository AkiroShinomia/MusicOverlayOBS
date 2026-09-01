using System.Net;
using System.Text.Json;
using MusicOverlay.Core;
using MusicOverlay.Endpoints;
using MusicOverlay.Hosting;
using MusicOverlay.Web;

const string CurrentVersion = "2.1.0";
const string GitHubOwner = "AkiroShinomia";
const string GitHubRepo = "MusicOverlayOBS";
const string ReleaseAssetName = "MusicOverlayReady.zip";
const string Url = "http://localhost:8799/";

AppPaths appPaths = AppPaths.Discover();
var updateService = new AppBootstrap(appPaths, CurrentVersion, GitHubOwner, GitHubRepo, ReleaseAssetName);
if (!args.Contains("--skip-update") && await updateService.CheckAndRunAsync()) return;

var store = new PortableDataStore(appPaths);
bool migrateStage2D = args.Contains("--migrate-stage2d");
bool migrateBundledDocuments = args.Contains("--migrate-stage1") || migrateStage2D;
await store.InitializeAsync(migrateBundledDocuments);

if (migrateBundledDocuments)
{
    Console.WriteLine(migrateStage2D
        ? "Scene v2 native geometry migration completed."
        : "Scene v2 migration completed.");
    return;
}

if (args.Contains("--verify-stage1"))
{
    await PrintAndExitAsync(SceneMigrationVerifier.VerifyAsync(store));
    return;
}
if (args.Contains("--verify-stage2a"))
{
    await PrintAndExitAsync(RendererStage2AVerifier.VerifyAsync(store));
    return;
}
if (args.Contains("--verify-stage2c"))
{
    await PrintAndExitAsync(RendererStage2CVerifier.VerifyAsync(store));
    return;
}
if (args.Contains("--verify-stage2d"))
{
    await PrintAndExitAsync(RendererStage2DVerifier.VerifyAsync(store));
    return;
}
if (args.Contains("--verify-stage2e"))
{
    await PrintAndExitAsync(ModularFoundationVerifier.VerifyAsync(store));
    return;
}

var audio = new AudioLevelService();
audio.Start();
var sockets = new WebSocketHub();
var routes = new RouteMap(
    new SceneEndpoints(store, sockets),
    new ThemeEndpoints(store, sockets),
    new SettingsEndpoints(store),
    new LiveEndpoints(store, audio),
    new SystemEndpoints(CurrentVersion),
    sockets);
var staticFiles = new StaticFileResponder(appPaths.OverlayRoot);

Console.Title = $"Music Overlay v{CurrentVersion}";
Console.WriteLine($"MusicOverlay v{CurrentVersion} запущен");
Console.WriteLine($"OBS Overlay: {Url}");
Console.WriteLine($"Settings:    {Url}settings.html");
Console.WriteLine("Для выхода закрой это окно.");

using var listener = new HttpListener();
listener.Prefixes.Add(Url);
listener.Start();
while (true)
{
    HttpListenerContext context = await listener.GetContextAsync();
    _ = Task.Run(async () =>
    {
        try
        {
            if (!await routes.TryHandleAsync(context))
                await staticFiles.RespondAsync(context);
        }
        catch (Exception ex)
        {
            string correlationId = Guid.NewGuid().ToString("N")[..10];
            Console.Error.WriteLine($"[{correlationId}] {ex}");
            try { await ApiResult.ErrorAsync(context, 500, $"Internal server error ({correlationId})"); }
            catch { }
        }
    });
}

static async Task PrintAndExitAsync<T>(Task<T> operation)
{
    T result = await operation;
    Console.WriteLine(JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
}

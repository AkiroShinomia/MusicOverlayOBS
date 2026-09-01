using System.Diagnostics;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using MusicOverlay.Application.Abstractions;
using MusicOverlay.Core;

namespace MusicOverlay.Hosting;

public sealed class AppBootstrap(
    AppPaths paths,
    string currentVersion,
    string gitHubOwner,
    string gitHubRepo,
    string releaseAssetName) : IUpdateService
{
    public async Task<bool> CheckAndRunAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            Console.WriteLine("Проверка обновлений...");
            using var http = new HttpClient();
            http.DefaultRequestHeaders.UserAgent.ParseAdd("MusicOverlayOBS");
            string json = await http.GetStringAsync(
                $"https://api.github.com/repos/{gitHubOwner}/{gitHubRepo}/releases/latest",
                cancellationToken);
            using JsonDocument doc = JsonDocument.Parse(json);
            string latestVersionText = (doc.RootElement.GetProperty("tag_name").GetString() ?? "")
                .Trim().TrimStart('v', 'V');

            if (!Version.TryParse(latestVersionText, out Version? latestVersion) ||
                !Version.TryParse(currentVersion, out Version? installedVersion))
            {
                Console.WriteLine("Не удалось прочитать версию релиза.");
                return false;
            }
            if (latestVersion <= installedVersion)
            {
                Console.WriteLine("Обновления не найдены.");
                return false;
            }

            string? downloadUrl = doc.RootElement.GetProperty("assets").EnumerateArray()
                .FirstOrDefault(asset => string.Equals(
                    asset.GetProperty("name").GetString(), releaseAssetName, StringComparison.OrdinalIgnoreCase))
                .GetProperty("browser_download_url").GetString();
            if (string.IsNullOrWhiteSpace(downloadUrl))
            {
                Console.WriteLine($"В релизе не найден файл {releaseAssetName}.");
                return false;
            }

            Console.WriteLine($"Найдена новая версия: {latestVersion}");
            string tempDir = Path.Combine(Path.GetTempPath(), "MusicOverlayUpdate");
            string zipPath = Path.Combine(tempDir, releaseAssetName);
            string extractDir = Path.Combine(tempDir, "extract");
            string backupConfigPath = Path.Combine(tempDir, "config.backup.json");
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
            Directory.CreateDirectory(extractDir);
            await File.WriteAllBytesAsync(zipPath, await http.GetByteArrayAsync(downloadUrl, cancellationToken), cancellationToken);
            ZipFile.ExtractToDirectory(zipPath, extractDir, true);

            string currentConfigPath = Path.Combine(paths.AppRoot, "overlay", "config.json");
            if (File.Exists(currentConfigPath)) File.Copy(currentConfigPath, backupConfigPath, true);
            string psPath = Path.Combine(tempDir, "update.ps1");
            string exePath = Environment.ProcessPath ?? Path.Combine(paths.AppRoot, "MusicOverlay.exe");
            string script = BuildUpdateScript(Environment.ProcessId, paths.AppRoot, extractDir, backupConfigPath, exePath);
            await File.WriteAllTextAsync(psPath, script, Encoding.UTF8, cancellationToken);
            Process.Start(new ProcessStartInfo
            {
                FileName = "powershell",
                Arguments = $"-ExecutionPolicy Bypass -File \"{psPath}\"",
                UseShellExecute = false,
                CreateNoWindow = true
            });
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine("Ошибка проверки обновлений:");
            Console.WriteLine(ex.Message);
            return false;
        }
    }

    private static string BuildUpdateScript(int pid, string appDir, string extractDir, string backupConfig, string exePath) => $$"""
$ErrorActionPreference = "Stop"
$pidToWait = {{pid}}
$appDir = "{{EscapePowerShell(appDir)}}"
$extractDir = "{{EscapePowerShell(extractDir)}}"
$backupConfigPath = "{{EscapePowerShell(backupConfig)}}"
$exePath = "{{EscapePowerShell(exePath)}}"
Wait-Process -Id $pidToWait -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Copy-Item -Path (Join-Path $extractDir "*") -Destination $appDir -Recurse -Force
$configPath = Join-Path $appDir "overlay\config.json"
if (Test-Path $backupConfigPath) { Copy-Item -Path $backupConfigPath -Destination $configPath -Force }
Start-Process -FilePath $exePath -ArgumentList "--skip-update" -WorkingDirectory $appDir
""";

    private static string EscapePowerShell(string value) =>
        value.Replace("'", "''").Replace("\"", "`\"");
}

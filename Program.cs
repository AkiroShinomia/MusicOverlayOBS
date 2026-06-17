using System.Diagnostics;
using System.IO.Compression;
using System.Net;
using System.Text;
using System.Text.Json;
using Windows.Media.Control;
using Windows.Storage.Streams;
using NAudio.Wave;

const string CurrentVersion = "1.1.3";
const string GitHubOwner = "AkiroShinomia";
const string GitHubRepo = "MusicOverlayOBS";
const string ReleaseAssetName = "MusicOverlayReady.zip";

const string Url = "http://localhost:8799/";

if (!args.Contains("--skip-update"))
{
    bool updateStarted = await CheckForUpdatesAndRun();
    if (updateStarted)
        return;
}

string overlayDir = Path.Combine(Directory.GetCurrentDirectory(), "overlay");
string configPath = Path.Combine(overlayDir, "config.json");
AudioLevelService audioLevelService = new();
audioLevelService.Start();

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
    var context = await listener.GetContextAsync();
    _ = Task.Run(() => HandleRequest(context));
}

async Task<bool> CheckForUpdatesAndRun()
{
    try
    {
        Console.WriteLine("Проверка обновлений...");

        using var http = new HttpClient();
        http.DefaultRequestHeaders.UserAgent.ParseAdd("MusicOverlayOBS");

        string apiUrl = $"https://api.github.com/repos/{GitHubOwner}/{GitHubRepo}/releases/latest";
        string json = await http.GetStringAsync(apiUrl);

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        string tagName = root.GetProperty("tag_name").GetString() ?? "";
        string latestVersionText = tagName.Trim().TrimStart('v', 'V');

        if (!Version.TryParse(latestVersionText, out var latestVersion))
        {
            Console.WriteLine("Не удалось прочитать версию релиза.");
            return false;
        }

        if (!Version.TryParse(CurrentVersion, out var currentVersion))
        {
            Console.WriteLine("Не удалось прочитать текущую версию.");
            return false;
        }

        if (latestVersion <= currentVersion)
        {
            Console.WriteLine("Обновления не найдены.");
            return false;
        }

        string? downloadUrl = null;

        foreach (var asset in root.GetProperty("assets").EnumerateArray())
        {
            string name = asset.GetProperty("name").GetString() ?? "";

            if (name.Equals(ReleaseAssetName, StringComparison.OrdinalIgnoreCase))
            {
                downloadUrl = asset.GetProperty("browser_download_url").GetString();
                break;
            }
        }

        if (string.IsNullOrWhiteSpace(downloadUrl))
        {
            Console.WriteLine($"В релизе не найден файл {ReleaseAssetName}.");
            return false;
        }

        Console.WriteLine($"Найдена новая версия: {latestVersion}");
        Console.WriteLine("Скачивание обновления...");

        string appDir = Directory.GetCurrentDirectory();
        string tempDir = Path.Combine(Path.GetTempPath(), "MusicOverlayUpdate");
        string zipPath = Path.Combine(tempDir, ReleaseAssetName);
        string extractDir = Path.Combine(tempDir, "extract");
        string backupConfigPath = Path.Combine(tempDir, "config.backup.json");

        if (Directory.Exists(tempDir))
            Directory.Delete(tempDir, true);

        Directory.CreateDirectory(tempDir);
        Directory.CreateDirectory(extractDir);

        byte[] zipBytes = await http.GetByteArrayAsync(downloadUrl);
        await File.WriteAllBytesAsync(zipPath, zipBytes);

        ZipFile.ExtractToDirectory(zipPath, extractDir, true);

        string currentConfigPath = Path.Combine(appDir, "overlay", "config.json");

        if (File.Exists(currentConfigPath))
        {
            File.Copy(currentConfigPath, backupConfigPath, true);
        }

        string psPath = Path.Combine(tempDir, "update.ps1");
        int pid = Environment.ProcessId;
        string exePath = Environment.ProcessPath ?? Path.Combine(appDir, "MusicOverlay.exe");

        string ps = $$"""
$ErrorActionPreference = "Stop"

$pidToWait = {{pid}}
$appDir = "{{EscapePowerShell(appDir)}}"
$extractDir = "{{EscapePowerShell(extractDir)}}"
$backupConfigPath = "{{EscapePowerShell(backupConfigPath)}}"
$exePath = "{{EscapePowerShell(exePath)}}"

Write-Host "Waiting for MusicOverlay to close..."
Wait-Process -Id $pidToWait -ErrorAction SilentlyContinue

Start-Sleep -Milliseconds 500

Write-Host "Copying update files..."
Copy-Item -Path (Join-Path $extractDir "*") -Destination $appDir -Recurse -Force

$configPath = Join-Path $appDir "overlay\config.json"
if (Test-Path $backupConfigPath) {
    Copy-Item -Path $backupConfigPath -Destination $configPath -Force
}

Write-Host "Starting MusicOverlay..."
Start-Process -FilePath $exePath -ArgumentList "--skip-update" -WorkingDirectory $appDir
""";

        await File.WriteAllTextAsync(psPath, ps, Encoding.UTF8);

        Console.WriteLine("Запуск обновлятора...");

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

string EscapePowerShell(string value)
{
    return value.Replace("'", "''").Replace("\"", "`\"");
}

async Task HandleRequest(HttpListenerContext context)
{
    try
    {
        string path = context.Request.Url?.AbsolutePath ?? "/";

        if (path == "/api/nowplaying")
        {
            var data = await GetNowPlaying();
            await SendJson(context, data);
            return;
        }

        if (path == "/api/audiolevel")
        {
            await SendJson(context, audioLevelService.GetAudioLevel());
            return;
        }

        if (path == "/api/config" && context.Request.HttpMethod == "GET")
        {
            await SendConfig(context);
            return;
        }

        if (path == "/api/config" && context.Request.HttpMethod == "POST")
        {
            await SaveConfig(context);
            return;
        }

        if (path == "/")
            path = "/index.html";

        string filePath = Path.Combine(overlayDir, path.TrimStart('/'));

        if (!File.Exists(filePath))
        {
            context.Response.StatusCode = 404;
            await WriteText(context, "Not found", "text/plain");
            return;
        }

        string contentType = GetContentType(filePath);
        byte[] bytes = await File.ReadAllBytesAsync(filePath);

        context.Response.ContentType = contentType;
        context.Response.ContentLength64 = bytes.Length;
        await context.Response.OutputStream.WriteAsync(bytes);
        context.Response.Close();
    }
    catch (Exception ex)
    {
        try
        {
            context.Response.StatusCode = 500;
            await WriteText(context, ex.Message, "text/plain");
        }
        catch { }
    }
}

async Task<object> GetNowPlaying()
{
    var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
    var session = manager.GetCurrentSession();

    if (session == null)
    {
        return new
        {
            hasTrack = false,
            title = "",
            artist = "",
            albumTitle = "",
            position = 0,
            duration = 0,
            isPlaying = false,
            thumbnail = ""
        };
    }

    var media = await session.TryGetMediaPropertiesAsync();
    var timeline = session.GetTimelineProperties();
    var playback = session.GetPlaybackInfo();

    double position = Math.Max(0, timeline.Position.TotalSeconds);
    double duration = Math.Max(0, (timeline.EndTime - timeline.StartTime).TotalSeconds);

    string thumbnail = await GetThumbnailBase64(media.Thumbnail);

    return new
    {
        hasTrack = true,
        title = media.Title ?? "",
        artist = media.Artist ?? "",
        albumTitle = media.AlbumTitle ?? "",
        position,
        duration,
        isPlaying = playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,
        thumbnail
    };
}

async Task<string> GetThumbnailBase64(IRandomAccessStreamReference? thumbnail)
{
    if (thumbnail == null)
        return "";

    try
    {
        using var stream = await thumbnail.OpenReadAsync();
        using var reader = new DataReader(stream);

        uint size = (uint)stream.Size;
        await reader.LoadAsync(size);

        byte[] buffer = new byte[size];
        reader.ReadBytes(buffer);

        string base64 = Convert.ToBase64String(buffer);
        return $"data:image/png;base64,{base64}";
    }
    catch
    {
        return "";
    }
}

async Task SendConfig(HttpListenerContext context)
{
    if (!File.Exists(configPath))
    {
        string defaultConfig = GetDefaultConfig();
        Directory.CreateDirectory(overlayDir);
        await File.WriteAllTextAsync(configPath, defaultConfig, Encoding.UTF8);
    }

    string json = await File.ReadAllTextAsync(configPath, Encoding.UTF8);
    byte[] bytes = Encoding.UTF8.GetBytes(json);

    context.Response.ContentType = "application/json; charset=utf-8";
    context.Response.ContentLength64 = bytes.Length;
    await context.Response.OutputStream.WriteAsync(bytes);
    context.Response.Close();
}

async Task SaveConfig(HttpListenerContext context)
{
    using var reader = new StreamReader(context.Request.InputStream, Encoding.UTF8);
    string body = await reader.ReadToEndAsync();

    try
    {
        using var doc = JsonDocument.Parse(body);
        string formatted = JsonSerializer.Serialize(doc.RootElement, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        await File.WriteAllTextAsync(configPath, formatted, Encoding.UTF8);

        await SendJson(context, new { ok = true });
    }
    catch
    {
        context.Response.StatusCode = 400;
        await SendJson(context, new { ok = false, error = "Invalid JSON" });
    }
}

string GetDefaultConfig()
{
    return """
{
  "position": {
    "left": 70,
    "fullBottom": 80,
    "tickerBottom": 44
  },
  "sizes": {
    "fullCardWidth": 430,
    "tickerWidth": 500,
    "tickerHeight": 42,
    "coverSize": 92,
    "vinylSize": 108
  },
  "colors": {
    "background": "rgba(10, 10, 14, 0.80)",
    "text": "#ffffff",
    "progress": "#ffffff",
    "progressBackground": "rgba(255, 255, 255, 0.18)"
  },
  "timings": {
    "fullVisibleMs": 10000,
    "coverDelayMs": 500,
    "cardDelayMs": 850,
    "exitMs": 600,
    "marqueeDelayMs": 2000,
    "marqueeSpeedSec": 10
  },
  "albumArt": {
    "useWindowsThumbnail": false,
    "defaultCover": "/assets/default-cover.png"
  }
}
""";
}

async Task SendJson(HttpListenerContext context, object data)
{
    string json = JsonSerializer.Serialize(data);
    byte[] bytes = Encoding.UTF8.GetBytes(json);

    context.Response.ContentType = "application/json; charset=utf-8";
    context.Response.ContentLength64 = bytes.Length;
    await context.Response.OutputStream.WriteAsync(bytes);
    context.Response.Close();
}

async Task WriteText(HttpListenerContext context, string text, string contentType)
{
    byte[] bytes = Encoding.UTF8.GetBytes(text);
    context.Response.ContentType = contentType;
    context.Response.ContentLength64 = bytes.Length;
    await context.Response.OutputStream.WriteAsync(bytes);
    context.Response.Close();
}

string GetContentType(string path)
{
    return Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".html" => "text/html; charset=utf-8",
        ".css" => "text/css; charset=utf-8",
        ".js" => "application/javascript; charset=utf-8",
        ".json" => "application/json; charset=utf-8",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".svg" => "image/svg+xml",
        _ => "application/octet-stream"
    };
}

class AudioLevelService
{
    private WasapiLoopbackCapture? capture;
    private double level = 0;

    public void Start()
    {
        try
        {
            capture = new WasapiLoopbackCapture();

            capture.DataAvailable += OnDataAvailable;
            capture.RecordingStopped += (_, _) =>
            {
                level = 0;
            };

            capture.StartRecording();

            Console.WriteLine("Audio level capture запущен.");
        }
        catch (Exception ex)
        {
            Console.WriteLine("Audio level capture не запущен:");
            Console.WriteLine(ex.Message);
            level = 0;
        }
    }

    public object GetAudioLevel()
    {
        return new
        {
            level = Math.Clamp(level, 0, 1)
        };
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        if (e.BytesRecorded <= 0)
        {
            level = 0;
            return;
        }

        int bytesPerSample = 4;
        int sampleCount = e.BytesRecorded / bytesPerSample;

        if (sampleCount <= 0)
        {
            level = 0;
            return;
        }

        double sum = 0;

        for (int i = 0; i < e.BytesRecorded; i += bytesPerSample)
        {
            float sample = BitConverter.ToSingle(e.Buffer, i);
            sum += sample * sample;
        }

        double rms = Math.Sqrt(sum / sampleCount);

        double boosted = rms * 8.0;
        level = level * 0.72 + boosted * 0.28;

        level = Math.Clamp(level, 0, 1);
    }
}
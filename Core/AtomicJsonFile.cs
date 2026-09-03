using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace MusicOverlay.Core;

public static class AtomicJsonFile
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    private static readonly UTF8Encoding Utf8WithoutBom = new(false);

    public static async Task<JsonObject?> ReadObjectAsync(string path)
    {
        if (!File.Exists(path))
            return null;

        string json = await File.ReadAllTextAsync(path, Encoding.UTF8);
        return JsonNode.Parse(json) as JsonObject
            ?? throw new InvalidDataException($"JSON root must be an object: {path}");
    }

    public static JsonObject? ReadObject(string path)
    {
        if (!File.Exists(path))
            return null;

        string json = File.ReadAllText(path, Encoding.UTF8);
        return JsonNode.Parse(json) as JsonObject
            ?? throw new InvalidDataException($"JSON root must be an object: {path}");
    }

    public static async Task WriteAsync(
        string path,
        JsonObject value,
        string? backupsRoot = null,
        string? backupKey = null
    )
    {
        string directory = Path.GetDirectoryName(path)
            ?? throw new InvalidOperationException($"File has no parent directory: {path}");
        Directory.CreateDirectory(directory);

        string tempPath = Path.Combine(
            directory,
            $".{Path.GetFileName(path)}.{Guid.NewGuid():N}.tmp"
        );

        string json = value.ToJsonString(JsonOptions) + Environment.NewLine;

        try
        {
            await using (var stream = new FileStream(
                tempPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                64 * 1024,
                FileOptions.Asynchronous | FileOptions.WriteThrough
            ))
            {
                byte[] bytes = Utf8WithoutBom.GetBytes(json);
                await stream.WriteAsync(bytes);
                await stream.FlushAsync();
                stream.Flush(true);
            }

            if (File.Exists(path))
            {
                string? backupPath = null;
                if (!string.IsNullOrWhiteSpace(backupsRoot))
                {
                    string stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff");
                    string safeKey = string.Join(
                        "_",
                        (backupKey ?? Path.GetFileName(path))
                            .Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries)
                    );
                    string backupDirectory = Path.Combine(backupsRoot, "automatic");
                    Directory.CreateDirectory(backupDirectory);
                    backupPath = Path.Combine(backupDirectory, $"{stamp}-{safeKey}.bak.json");
                }

                File.Replace(tempPath, path, backupPath, true);
            }
            else
            {
                File.Move(tempPath, path);
            }
        }
        finally
        {
            if (File.Exists(tempPath))
                File.Delete(tempPath);
        }
    }
}

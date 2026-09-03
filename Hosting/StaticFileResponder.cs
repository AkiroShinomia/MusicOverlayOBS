using System.Net;
using MusicOverlay.Web;

namespace MusicOverlay.Hosting;

public sealed class StaticFileResponder(string overlayRoot)
{
    public async Task RespondAsync(HttpListenerContext context)
    {
        string path = context.Request.Url?.AbsolutePath ?? "/";
        if (path == "/") path = "/index.html";
        string filePath = Path.Combine(overlayRoot, path.TrimStart('/'));

        if (!File.Exists(filePath))
        {
            context.Response.StatusCode = 404;
            await ApiResult.TextAsync(context, "Not found", "text/plain");
            return;
        }

        string contentType = GetContentType(filePath);
        byte[] bytes = await File.ReadAllBytesAsync(filePath);
        context.Response.ContentType = contentType;
        if (IsSourceAsset(contentType))
        {
            context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
            context.Response.Headers["Pragma"] = "no-cache";
            context.Response.Headers["Expires"] = "0";
        }
        context.Response.ContentLength64 = bytes.Length;
        await context.Response.OutputStream.WriteAsync(bytes);
        context.Response.Close();
    }

    private static bool IsSourceAsset(string contentType) =>
        contentType.StartsWith("text/html", StringComparison.OrdinalIgnoreCase) ||
        contentType.StartsWith("text/css", StringComparison.OrdinalIgnoreCase) ||
        contentType.StartsWith("application/javascript", StringComparison.OrdinalIgnoreCase) ||
        contentType.StartsWith("text/javascript", StringComparison.OrdinalIgnoreCase);

    private static string GetContentType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
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

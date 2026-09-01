using System.Net;
using System.Text;
using System.Text.Json;

namespace MusicOverlay.Web;

public static class ApiResult
{
    public static async Task JsonAsync(HttpListenerContext context, object data)
    {
        string json = JsonSerializer.Serialize(data);
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.ContentLength64 = bytes.Length;
        await context.Response.OutputStream.WriteAsync(bytes);
        context.Response.Close();
    }

    public static async Task TextAsync(HttpListenerContext context, string text, string contentType)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(text);
        context.Response.ContentType = contentType;
        context.Response.ContentLength64 = bytes.Length;
        await context.Response.OutputStream.WriteAsync(bytes);
        context.Response.Close();
    }

    public static async Task ErrorAsync(HttpListenerContext context, int statusCode, string message)
    {
        context.Response.StatusCode = statusCode;
        await JsonAsync(context, new { ok = false, error = message });
    }
}

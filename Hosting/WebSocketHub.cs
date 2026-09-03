using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace MusicOverlay.Hosting;

public sealed class WebSocketHub
{
    private readonly ConcurrentDictionary<Guid, WebSocket> clients = new();

    public async Task AcceptAsync(HttpListenerContext context)
    {
        if (!context.Request.IsWebSocketRequest)
        {
            context.Response.StatusCode = 400;
            context.Response.Close();
            return;
        }

        WebSocket socket = (await context.AcceptWebSocketAsync(null)).WebSocket;
        Guid id = Guid.NewGuid();
        clients[id] = socket;
        Console.WriteLine($"WebSocket connected: {id}");
        byte[] buffer = new byte[1024];

        try
        {
            while (socket.State == WebSocketState.Open)
            {
                WebSocketReceiveResult result = await socket.ReceiveAsync(buffer, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                    break;
            }
        }
        catch { }
        finally
        {
            clients.TryRemove(id, out _);
            try
            {
                if (socket.State == WebSocketState.Open)
                    await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
            }
            catch { }
            socket.Dispose();
            Console.WriteLine($"WebSocket disconnected: {id}");
        }
    }

    public async Task BroadcastAsync(string type)
    {
        byte[] data = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            type,
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        }));

        foreach ((Guid id, WebSocket socket) in clients.ToArray())
        {
            if (socket.State != WebSocketState.Open)
            {
                clients.TryRemove(id, out _);
                continue;
            }
            try
            {
                await socket.SendAsync(data, WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch
            {
                clients.TryRemove(id, out _);
            }
        }
    }
}

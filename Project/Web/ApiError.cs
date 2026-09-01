namespace MusicOverlay.Web;

public sealed record ApiError(bool ok, string error, string? correlationId = null)
{
    public static ApiError From(Exception exception, string? correlationId = null) =>
        new(false, exception.Message, correlationId);
}

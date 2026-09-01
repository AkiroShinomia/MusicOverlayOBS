namespace MusicOverlay.Application.Abstractions;

public interface IUpdateService
{
    Task<bool> CheckAndRunAsync(CancellationToken cancellationToken = default);
}

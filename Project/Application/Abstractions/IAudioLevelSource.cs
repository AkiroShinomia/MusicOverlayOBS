namespace MusicOverlay.Application.Abstractions;

public interface IAudioLevelSource
{
    void Start();
    void SetAudioSourceMode(string mode);
    void SetMediaSource(string sourceAppId);
    void SetFftSettings(bool autoGain, double outputGain, double spectralContrast, double visualCurvePower);
    object GetAudioLevel(string mode = "mediaSession");
}

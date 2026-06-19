using NAudio.Wave;

public class AudioLevelService
{
    private WasapiLoopbackCapture? systemCapture;
    private ProcessLoopbackCapture? processCapture;

    private readonly FftProcessor fftProcessor = new();

    private double systemLevel = 0;
    private double mediaSessionLevel = 0;

    private string currentSourceAppId = "";
    private int currentProcessId = 0;
    private int activeProcessCaptureId = 0;

    private int lastFailedProcessId = 0;
    private DateTime processRetryAfterUtc = DateTime.MinValue;
    private string lastProcessCaptureError = "";
    private string sourceMode = "auto";

    private readonly object lockObj = new();

    public void Start()
    {
        StartSystemFallbackCapture();
    }

    private void StartSystemFallbackCapture()
    {
        try
        {
            systemCapture = new WasapiLoopbackCapture();
            fftProcessor.SetWaveFormat(systemCapture.WaveFormat);

            systemCapture.DataAvailable += OnSystemDataAvailable;
            systemCapture.RecordingStopped += (_, _) =>
            {
                lock (lockObj)
                {
                    systemLevel = 0;
                    mediaSessionLevel = 0;
                    fftProcessor.Reset();
                }
            };

            systemCapture.StartRecording();
            Console.WriteLine("System audio fallback capture запущен.");
        }
        catch (Exception ex)
        {
            Console.WriteLine("System audio fallback capture не запущен:");
            Console.WriteLine(ex.Message);

            lock (lockObj)
            {
                systemLevel = 0;
                mediaSessionLevel = 0;
                fftProcessor.Reset();
            }
        }
    }

    public void SetAudioSourceMode(string mode)
    {
        sourceMode = mode switch
        {
            "process" => "process",
            "system" => "system",
            _ => "auto"
        };

        if (sourceMode == "system")
        {
            StopProcessCapture();

            // Переключаем FFT-процессор на системный формат, если он есть
            if (systemCapture != null)
            {
                fftProcessor.SetWaveFormat(systemCapture.WaveFormat);
            }
        }
    }

    public void SetMediaSource(string sourceAppId)
    {
        currentSourceAppId = sourceAppId ?? "";

        if (sourceMode == "system")
        {
            currentProcessId = 0;
            return;
        }

        int processId = AudioSessionHelper.GetCurrentMediaProcessId(currentSourceAppId);
        if (processId <= 0)
        {
            currentProcessId = 0;
            return;
        }

        currentProcessId = processId;

        // Уже захватываем нужный процесс
        if (activeProcessCaptureId == currentProcessId)
            return;

        // Ещё не вышел таймаут повторной попытки для этого процесса
        if (lastFailedProcessId == currentProcessId &&
            DateTime.UtcNow < processRetryAfterUtc)
        {
            return;
        }

        RestartProcessCapture(currentProcessId);
    }

    private void RestartProcessCapture(int processId)
    {
        try
        {
            StopProcessCapture();

            processCapture = new ProcessLoopbackCapture(processId);
            processCapture.DataAvailable += OnProcessDataAvailable;

            processCapture.Start();

            fftProcessor.SetWaveFormat(processCapture.WaveFormat);

            activeProcessCaptureId = processId;
            lastFailedProcessId = 0;
            lastProcessCaptureError = "";

            lock (lockObj)
            {
                fftProcessor.Reset();
            }

            Console.WriteLine($"Process audio capture запущен для PID {processId}.");
        }
        catch (Exception ex)
        {
            lastFailedProcessId = processId;
            processRetryAfterUtc = DateTime.UtcNow.AddSeconds(15);
            lastProcessCaptureError = $"{ex.Message} / HRESULT: 0x{ex.HResult:X8}";

            Console.WriteLine($"Process audio capture не запущен для PID {processId}:");
            Console.WriteLine(lastProcessCaptureError);
            Console.WriteLine("Переключение на system fallback на 15 секунд.");

            StopProcessCapture();

            // Возвращаем FFT на системный захват
            if (systemCapture != null)
            {
                fftProcessor.SetWaveFormat(systemCapture.WaveFormat);
                fftProcessor.SetOutputGain(1.0);
                fftProcessor.SetSpectralContrast(1.0);
                fftProcessor.SetVisualCurvePower(1.0);
            }
        }
    }

    public object GetAudioLevel(string mode = "mediaSession")
    {
        mediaSessionLevel = AudioSessionHelper.GetMediaSessionLevel(
            currentSourceAppId,
            systemLevel,
            mediaSessionLevel
        );

        double selectedLevel = mode switch
        {
            "system" => systemLevel,
            "mediaSession" => mediaSessionLevel,
            _ => mediaSessionLevel
        };

        string captureMode = DetermineCaptureMode();

        return new
        {
            level = Math.Clamp(selectedLevel, 0, 1),
            bands = fftProcessor.GetBands(),
            mode,
            sourceAppId = currentSourceAppId,
            processId = currentProcessId,
            captureMode,
            processCaptureError = lastProcessCaptureError,
            requestedSourceMode = sourceMode
        };
    }

    private string DetermineCaptureMode()
    {
        if (sourceMode == "system")
            return "system";

        if (activeProcessCaptureId > 0)
            return "process";

        if (currentProcessId > 0)
        {
            return sourceMode == "auto"
                ? "processFailedSystemFallback"
                : "processFailed";
        }

        return "systemFallback";
    }

    private void OnSystemDataAvailable(object? sender, WaveInEventArgs e)
    {
        bool allowFft = sourceMode == "system" ||
                        (sourceMode == "auto" && activeProcessCaptureId <= 0);

        ProcessAudioBuffer(
            e,
            systemCapture?.WaveFormat,
            allowFft: allowFft,
            inputGain: 4.0
        );
    }

    private void OnProcessDataAvailable(object? sender, WaveInEventArgs e)
    {
        ProcessAudioBuffer(
            e,
            processCapture?.WaveFormat,
            allowFft: true,
            inputGain: 4.0
        );
    }

    public void SetFftSettings(
        bool autoGain,
        double outputGain,
        double spectralContrast,
        double visualCurvePower
    )
    {
        fftProcessor.SetAutoGain(autoGain);
        fftProcessor.SetOutputGain(outputGain);
        fftProcessor.SetSpectralContrast(spectralContrast);
        fftProcessor.SetVisualCurvePower(visualCurvePower);
    }

    private void ProcessAudioBuffer(
        WaveInEventArgs e,
        WaveFormat? waveFormat,
        bool allowFft = true,
        double inputGain = 1.0
    )
    {
        if (e.BytesRecorded <= 0 || waveFormat == null)
            return;

        int bytesPerSample = waveFormat.BitsPerSample / 8;
        int channels = waveFormat.Channels;

        // Поддерживаем только 16- и 32-битные сэмплы
        if (bytesPerSample != 2 && bytesPerSample != 4)
            return;

        int frameSize = bytesPerSample * channels;
        int frameCount = e.BytesRecorded / frameSize;

        if (frameCount <= 0)
            return;

        double sum = 0;
        int validSamples = 0;

        for (int frame = 0; frame < frameCount; frame++)
        {
            float mixedSample = 0;

            for (int ch = 0; ch < channels; ch++)
            {
                int offset = frame * frameSize + ch * bytesPerSample;
                float sample;

                if (bytesPerSample == 4)
                {
                    sample = BitConverter.ToSingle(e.Buffer, offset);
                }
                else
                {
                    short s = BitConverter.ToInt16(e.Buffer, offset);
                    sample = s / 32768f;
                }

                mixedSample += sample;
            }

            mixedSample /= channels;
            mixedSample = Math.Clamp(mixedSample * (float)inputGain, -1f, 1f);

            sum += mixedSample * mixedSample;
            validSamples++;

            if (allowFft)
            {
                fftProcessor.PushSample(mixedSample);
            }
        }

        if (validSamples > 0)
        {
            double rms = Math.Sqrt(sum / validSamples);
            double boosted = rms * 8.0;

            lock (lockObj)
            {
                systemLevel = systemLevel * 0.72 + boosted * 0.28;
                systemLevel = Math.Clamp(systemLevel, 0, 1);
            }
        }
    }

    private void StopProcessCapture()
    {
        if (processCapture != null)
        {
            processCapture.Stop();
            processCapture.Dispose();
            processCapture = null;
            activeProcessCaptureId = 0;
        }
    }
}
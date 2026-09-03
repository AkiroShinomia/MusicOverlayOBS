using System.Diagnostics;
using NAudio.CoreAudioApi;

public static class AudioSessionHelper
{
    public static int GetCurrentMediaProcessId(string sourceAppId)
    {
        if (string.IsNullOrWhiteSpace(sourceAppId))
            return 0;

        var firstMatch = FindFirstMatchingSession(sourceAppId);
        return firstMatch?.ProcessId ?? 0;
    }

    public static double GetMediaSessionLevel(
        string sourceAppId,
        double fallbackLevel,
        double previousLevel)
    {
        if (string.IsNullOrWhiteSpace(sourceAppId))
            return fallbackLevel;

        try
        {
            using var enumerator = new MMDeviceEnumerator();
            using var device = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
            var sessions = device.AudioSessionManager.Sessions;

            double bestPeak = 0;
            bool found = false;

            for (int i = 0; i < sessions.Count; i++)
            {
                var session = sessions[i];

                // Пытаемся безопасно получить PID и имя процесса
                var sessionInfo = TryGetSessionInfo(session);
                if (sessionInfo == null)
                    continue;

                if (!IsMatchingSource(sessionInfo.ProcessName, sourceAppId))
                    continue;

                double peak = session.AudioMeterInformation.MasterPeakValue;
                if (peak > bestPeak)
                    bestPeak = peak;

                found = true;
            }

            if (!found)
                return fallbackLevel;

            double smoothed = previousLevel * 0.72 + bestPeak * 0.28;
            return Math.Clamp(smoothed, 0, 1);
        }
        catch
        {
            return fallbackLevel;
        }
    }

    public static bool IsMatchingSource(string processName, string sourceAppId)
    {
        if (string.IsNullOrWhiteSpace(processName) || string.IsNullOrWhiteSpace(sourceAppId))
            return false;

        string process = processName.ToLowerInvariant();
        string source = sourceAppId.ToLowerInvariant();

        return source.Contains(process) || source.Contains(process + ".exe");
    }


    private static SessionInfo? FindFirstMatchingSession(string sourceAppId)
    {
        try
        {
            using var enumerator = new MMDeviceEnumerator();
            using var device = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
            var sessions = device.AudioSessionManager.Sessions;

            for (int i = 0; i < sessions.Count; i++)
            {
                var info = TryGetSessionInfo(sessions[i]);
                if (info != null && IsMatchingSource(info.ProcessName, sourceAppId))
                    return info;
            }
        }
        catch
        {
            // Игнорируем ошибки получения списка сессий
        }

        return null;
    }

    private static SessionInfo? TryGetSessionInfo(AudioSessionControl session)
    {
        try
        {
            int processId = (int)session.GetProcessID;
            if (processId <= 0)
                return null;

            string processName;
            try
            {
                using var process = Process.GetProcessById(processId);
                processName = process.ProcessName;
            }
            catch
            {
                return null;
            }

            if (string.IsNullOrEmpty(processName))
                return null;

            return new SessionInfo(processId, processName);
        }
        catch
        {
            return null;
        }
    }

    private sealed class SessionInfo
    {
        public int ProcessId { get; }
        public string ProcessName { get; }

        public SessionInfo(int processId, string processName)
        {
            ProcessId = processId;
            ProcessName = processName;
        }
    }
}
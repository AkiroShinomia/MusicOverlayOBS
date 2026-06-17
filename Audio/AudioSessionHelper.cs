using System.Diagnostics;
using NAudio.CoreAudioApi;

public static class AudioSessionHelper
{
    public static int GetCurrentMediaProcessId(string sourceAppId)
    {
        if (string.IsNullOrWhiteSpace(sourceAppId))
            return 0;

        try
        {
            using var enumerator = new MMDeviceEnumerator();
            using var device = enumerator.GetDefaultAudioEndpoint(
                DataFlow.Render,
                Role.Multimedia
            );

            var sessions = device.AudioSessionManager.Sessions;

            for (int i = 0; i < sessions.Count; i++)
            {
                var session = sessions[i];

                int processId;

                try
                {
                    processId = (int)session.GetProcessID;
                }
                catch
                {
                    continue;
                }

                if (processId <= 0)
                    continue;

                string processName;

                try
                {
                    using var process = Process.GetProcessById(processId);
                    processName = process.ProcessName;
                }
                catch
                {
                    continue;
                }

                if (IsMatchingSource(processName, sourceAppId))
                    return processId;
            }
        }
        catch
        {
            return 0;
        }

        return 0;
    }

    public static double GetMediaSessionLevel(string sourceAppId, double fallbackLevel, double previousLevel)
    {
        if (string.IsNullOrWhiteSpace(sourceAppId))
            return fallbackLevel;

        try
        {
            using var enumerator = new MMDeviceEnumerator();
            using var device = enumerator.GetDefaultAudioEndpoint(
                DataFlow.Render,
                Role.Multimedia
            );

            var sessions = device.AudioSessionManager.Sessions;

            double bestLevel = 0;

            for (int i = 0; i < sessions.Count; i++)
            {
                var session = sessions[i];

                int processId;

                try
                {
                    processId = (int)session.GetProcessID;
                }
                catch
                {
                    continue;
                }

                if (processId <= 0)
                    continue;

                string processName;

                try
                {
                    using var process = Process.GetProcessById(processId);
                    processName = process.ProcessName;
                }
                catch
                {
                    continue;
                }

                if (!IsMatchingSource(processName, sourceAppId))
                    continue;

                double level = session.AudioMeterInformation.MasterPeakValue;

                if (level > bestLevel)
                    bestLevel = level;
            }

            double smoothed =
                previousLevel * 0.72 +
                bestLevel * 0.28;

            return Math.Clamp(smoothed, 0, 1);
        }
        catch
        {
            return fallbackLevel;
        }
    }

    public static bool IsMatchingSource(string processName, string sourceAppId)
    {
        if (string.IsNullOrWhiteSpace(processName))
            return false;

        if (string.IsNullOrWhiteSpace(sourceAppId))
            return false;

        string process = processName.ToLowerInvariant();
        string source = sourceAppId.ToLowerInvariant();

        if (source.Contains(process))
            return true;

        if (source.Contains(process + ".exe"))
            return true;

        return false;
    }
}
using System.Runtime.InteropServices;
using NAudio.Wave;

public sealed class ProcessLoopbackCapture : IDisposable
{
    private const string VirtualAudioDeviceProcessLoopback = "VAD\\Process_Loopback";

    private const int S_OK = 0;
    private const int AUDCLNT_SHAREMODE_SHARED = 0;
    private const int AUDCLNT_STREAMFLAGS_EVENTCALLBACK = 0x00040000;
    private const int AUDCLNT_STREAMFLAGS_NOPERSIST = 0x00080000;
    private const int AUDCLNT_BUFFERFLAGS_SILENT = 0x00000002;
    private const int AUDCLNT_STREAMFLAGS_LOOPBACK = 0x00020000;
    private const int AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM = unchecked((int)0x80000000);

    private static Guid IID_IAudioClient = new("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2");
    private static Guid IID_IAudioCaptureClient = new("C8ADBD64-E71E-48a0-A4DE-185C395CD317");

    private readonly int processId;

    private IAudioClient? audioClient;
    private IAudioCaptureClient? captureClient;
    private EventWaitHandle? sampleReadyEvent;
    private Thread? captureThread;

    private volatile bool running;

    public int ProcessId => processId;

    public WaveFormat WaveFormat { get; private set; } = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);

    public event EventHandler<WaveInEventArgs>? DataAvailable;

    public ProcessLoopbackCapture(int processId)
    {
        if (processId <= 0)
            throw new ArgumentOutOfRangeException(nameof(processId));

        this.processId = processId;
    }

    public void Start()
    {
        if (running)
            return;

        audioClient = ActivateAudioClient(processId);
        WaveFormat = new WaveFormat(44100, 16, 2);

        IntPtr waveFormatPtr = CreateWaveFormatExPtr(WaveFormat);

        try
        {
            int hr = audioClient.Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_LOOPBACK |
                AUDCLNT_STREAMFLAGS_EVENTCALLBACK |
                AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM,
                0,
                0,
                waveFormatPtr,
                IntPtr.Zero
            );

            Marshal.ThrowExceptionForHR(hr);
        }
        finally
        {
            Marshal.FreeHGlobal(waveFormatPtr);
        }

        int serviceHr = audioClient.GetService(
            ref IID_IAudioCaptureClient,
            out object captureService
        );

        Marshal.ThrowExceptionForHR(serviceHr);

        captureClient = (IAudioCaptureClient)captureService;

        sampleReadyEvent = new EventWaitHandle(false, EventResetMode.AutoReset);

        int eventHr = audioClient.SetEventHandle(
            sampleReadyEvent.SafeWaitHandle.DangerousGetHandle()
        );

        Marshal.ThrowExceptionForHR(eventHr);

        running = true;

        int startHr = audioClient.Start();
        Marshal.ThrowExceptionForHR(startHr);

        captureThread = new Thread(CaptureLoop)
        {
            IsBackground = true,
            Name = $"ProcessLoopbackCapture-{processId}"
        };

        captureThread.Start();
    }

    public void Stop()
    {
        running = false;

        try
        {
            captureThread?.Join(500);
        }
        catch
        {
        }

        try
        {
            audioClient?.Stop();
        }
        catch
        {
        }
    }

    public void Dispose()
    {
        Stop();

        if (captureClient != null)
        {
            Marshal.ReleaseComObject(captureClient);
            captureClient = null;
        }

        if (audioClient != null)
        {
            Marshal.ReleaseComObject(audioClient);
            audioClient = null;
        }

        sampleReadyEvent?.Dispose();
        sampleReadyEvent = null;
    }

    private void CaptureLoop()
    {
        if (sampleReadyEvent == null || captureClient == null)
            return;

        while (running)
        {
            sampleReadyEvent.WaitOne(100);

            if (!running)
                break;

            ReadAvailablePackets();
        }
    }

    private void ReadAvailablePackets()
    {
        if (captureClient == null)
            return;

        int packetHr = captureClient.GetNextPacketSize(out uint packetFrames);

        if (packetHr != S_OK)
            return;

        while (packetFrames > 0)
        {
            int bufferHr = captureClient.GetBuffer(
                out IntPtr data,
                out uint frames,
                out uint flags,
                out _,
                out _
            );

            if (bufferHr != S_OK)
                break;

            int bytesPerFrame = WaveFormat.BlockAlign;
            int bytesRecorded = checked((int)(frames * bytesPerFrame));

            byte[] buffer = new byte[bytesRecorded];

            if ((flags & AUDCLNT_BUFFERFLAGS_SILENT) == 0 && data != IntPtr.Zero)
            {
                Marshal.Copy(data, buffer, 0, bytesRecorded);
            }

            captureClient.ReleaseBuffer(frames);

            if (bytesRecorded > 0)
            {
                DataAvailable?.Invoke(
                    this,
                    new WaveInEventArgs(buffer, bytesRecorded)
                );
            }

            int nextHr = captureClient.GetNextPacketSize(out packetFrames);

            if (nextHr != S_OK)
                break;
        }
    }

    private static IAudioClient ActivateAudioClient(int processId)
    {
        AUDIOCLIENT_ACTIVATION_PARAMS activationParams = new()
        {
            ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
            ProcessLoopbackParams = new AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS
            {
                TargetProcessId = (uint)processId,
                ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE
            }
        };

        IntPtr activationParamsPtr = Marshal.AllocHGlobal(
            Marshal.SizeOf<AUDIOCLIENT_ACTIVATION_PARAMS>()
        );

        IntPtr blobDataPtr = IntPtr.Zero;

        try
        {
            Marshal.StructureToPtr(
                activationParams,
                activationParamsPtr,
                false
            );

            PROPVARIANT propVariant = PROPVARIANT.FromBlob(
                activationParamsPtr,
                Marshal.SizeOf<AUDIOCLIENT_ACTIVATION_PARAMS>()
            );

            blobDataPtr = propVariant.blob.pBlobData;

            CompletionHandler completionHandler = new();

            int hr = ActivateAudioInterfaceAsync(
                VirtualAudioDeviceProcessLoopback,
                ref IID_IAudioClient,
                ref propVariant,
                completionHandler,
                out IActivateAudioInterfaceAsyncOperation operation
            );

            Marshal.ThrowExceptionForHR(hr);

            IAudioClient audioClient = completionHandler.WaitForAudioClient();

            Marshal.ReleaseComObject(operation);

            return audioClient;
        }
        finally
        {
            if (blobDataPtr != IntPtr.Zero)
                Marshal.FreeHGlobal(blobDataPtr);

            Marshal.FreeHGlobal(activationParamsPtr);
        }
    }

    private static IntPtr CreateWaveFormatExPtr(WaveFormat format)
    {
        WAVEFORMATEX waveFormat = new()
        {
            wFormatTag = 1,
            nChannels = (ushort)format.Channels,
            nSamplesPerSec = (uint)format.SampleRate,
            wBitsPerSample = (ushort)format.BitsPerSample,
            nBlockAlign = (ushort)format.BlockAlign,
            nAvgBytesPerSec = (uint)format.AverageBytesPerSecond,
            cbSize = 0
        };

        IntPtr ptr = Marshal.AllocHGlobal(Marshal.SizeOf<WAVEFORMATEX>());
        Marshal.StructureToPtr(waveFormat, ptr, false);

        return ptr;
    }

    [DllImport("Mmdevapi.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    private static extern int ActivateAudioInterfaceAsync(
        string deviceInterfacePath,
        ref Guid riid,
        ref PROPVARIANT activationParams,
        IActivateAudioInterfaceCompletionHandler completionHandler,
        out IActivateAudioInterfaceAsyncOperation activationOperation
    );

    private sealed class CompletionHandler : IActivateAudioInterfaceCompletionHandler
    {
        private readonly ManualResetEventSlim completed = new(false);
        private int activateResult;
        private object? activatedInterface;

        public int ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation)
        {
            int hr = operation.GetActivateResult(
                out activateResult,
                out activatedInterface
            );

            if (hr != S_OK)
                activateResult = hr;

            completed.Set();

            return S_OK;
        }

        public IAudioClient WaitForAudioClient()
        {
            if (!completed.Wait(TimeSpan.FromSeconds(5)))
                throw new TimeoutException("Process loopback activation timeout.");

            Marshal.ThrowExceptionForHR(activateResult);

            if (activatedInterface == null)
                throw new InvalidOperationException("Activated audio interface is null.");

            return (IAudioClient)activatedInterface;
        }
    }

    private const int AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK = 1;
    private const int PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE = 0;

    [StructLayout(LayoutKind.Sequential)]
    private struct AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS
    {
        public uint TargetProcessId;
        public int ProcessLoopbackMode;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct AUDIOCLIENT_ACTIVATION_PARAMS
    {
        public int ActivationType;
        public AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS ProcessLoopbackParams;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BLOB
    {
        public int cbSize;
        public IntPtr pBlobData;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROPVARIANT
    {
        public ushort vt;
        public ushort wReserved1;
        public ushort wReserved2;
        public ushort wReserved3;
        public BLOB blob;

        public static PROPVARIANT FromBlob(IntPtr data, int size)
        {
            IntPtr copy = Marshal.AllocHGlobal(size);

            byte[] temp = new byte[size];
            Marshal.Copy(data, temp, 0, size);
            Marshal.Copy(temp, 0, copy, size);

            return new PROPVARIANT
            {
                vt = 65,
                blob = new BLOB
                {
                    cbSize = size,
                    pBlobData = copy
                }
            };
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WAVEFORMATEX
    {
        public ushort wFormatTag;
        public ushort nChannels;
        public uint nSamplesPerSec;
        public uint nAvgBytesPerSec;
        public ushort nBlockAlign;
        public ushort wBitsPerSample;
        public ushort cbSize;
    }

    [ComImport]
    [Guid("41D949AB-9862-444A-80F6-C261334DA5EB")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IActivateAudioInterfaceCompletionHandler
    {
        [PreserveSig]
        int ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation);
    }

    [ComImport]
    [Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IActivateAudioInterfaceAsyncOperation
    {
        [PreserveSig]
        int GetActivateResult(
            out int activateResult,
            [MarshalAs(UnmanagedType.IUnknown)] out object activatedInterface
        );
    }

    [ComImport]
    [Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioClient
    {
        [PreserveSig]
        int Initialize(
            int shareMode,
            int streamFlags,
            long hnsBufferDuration,
            long hnsPeriodicity,
            IntPtr pFormat,
            IntPtr audioSessionGuid
        );

        [PreserveSig]
        int GetBufferSize(out uint bufferSize);

        [PreserveSig]
        int GetStreamLatency(out long latency);

        [PreserveSig]
        int GetCurrentPadding(out uint padding);

        [PreserveSig]
        int IsFormatSupported(
            int shareMode,
            IntPtr pFormat,
            IntPtr closestMatch
        );

        [PreserveSig]
        int GetMixFormat(out IntPtr deviceFormat);

        [PreserveSig]
        int GetDevicePeriod(
            out long defaultDevicePeriod,
            out long minimumDevicePeriod
        );

        [PreserveSig]
        int Start();

        [PreserveSig]
        int Stop();

        [PreserveSig]
        int Reset();

        [PreserveSig]
        int SetEventHandle(IntPtr eventHandle);

        [PreserveSig]
        int GetService(
            ref Guid riid,
            [MarshalAs(UnmanagedType.IUnknown)] out object service
        );
    }

    [ComImport]
    [Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioCaptureClient
    {
        [PreserveSig]
        int GetBuffer(
            out IntPtr data,
            out uint numFramesToRead,
            out uint flags,
            out ulong devicePosition,
            out ulong qpcPosition
        );

        [PreserveSig]
        int ReleaseBuffer(uint numFramesRead);

        [PreserveSig]
        int GetNextPacketSize(out uint numFramesInNextPacket);
    }
}
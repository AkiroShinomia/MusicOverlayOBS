using NAudio.Dsp;
using NAudio.Wave;

public class FftProcessor
{
    private const int FftLength = 1024;
    private const int BandCount = 64;

    private readonly Complex[] fftBuffer = new Complex[FftLength];
    private readonly float[] sampleBuffer = new float[FftLength];
    private readonly double[] bands = new double[BandCount];
    private readonly double[] smoothedBands = new double[BandCount];
    private readonly double[] bandPeaks = new double[BandCount];
    private readonly object lockObj = new();

    private int sampleBufferPosition = 0;
    private int sampleRate = 48000;
    private double outputGain = 1.0;
    private double spectralContrast = 1.0;
    private double visualCurvePower = 1.0;
    private bool autoGainEnabled = true;
    private double autoGain = 1.0;

    public void SetWaveFormat(WaveFormat waveFormat)
    {
        sampleRate = waveFormat.SampleRate;
    }

    public void SetOutputGain(double gain)
    {
        outputGain = Math.Clamp(gain, 0.1, 4.0);
    }

    public void SetAutoGain(bool enabled)
    {
        autoGainEnabled = enabled;
    }

    public void SetSpectralContrast(double contrast)
    {
        spectralContrast = Math.Clamp(contrast, 0.5, 3.0);
    }

    public void SetVisualCurvePower(double power)
    {
        visualCurvePower = Math.Clamp(power, 0.6, 2.0);
    }

    public void PushSample(float sample)
    {
        sampleBuffer[sampleBufferPosition] = sample;
        sampleBufferPosition++;

        if (sampleBufferPosition >= FftLength)
        {
            CalculateFftBands();
            sampleBufferPosition = 0;
        }
    }

    public double[] GetBands()
    {
        lock (lockObj)
        {
            return smoothedBands.ToArray();
        }
    }

    public void Reset()
    {
        lock (lockObj)
        {
            Array.Clear(bands);
            Array.Clear(smoothedBands);
            Array.Clear(bandPeaks);
        }

        sampleBufferPosition = 0;
    }

    private void CalculateFftBands()
    {
        for (int i = 0; i < FftLength; i++)
        {
            float window = (float)FastFourierTransform.HammingWindow(i, FftLength);
            fftBuffer[i].X = sampleBuffer[i] * window;
            fftBuffer[i].Y = 0;
        }

        FastFourierTransform.FFT(true, (int)Math.Log2(FftLength), fftBuffer);

        double[] tempBands = new double[BandCount];
        double binHz = (double)sampleRate / FftLength;
        double minFreq = 60.0;
        double maxFreq = 12000.0;
        int usefulBins = FftLength / 2;

        for (int band = 0; band < BandCount; band++)
        {
            double startNorm = (double)band / BandCount;
            double endNorm = (double)(band + 1) / BandCount;
            double startFreq = minFreq * Math.Pow(maxFreq / minFreq, startNorm);
            double endFreq = minFreq * Math.Pow(maxFreq / minFreq, endNorm);

            int startBin = (int)(startFreq / binHz);
            int endBin = (int)(endFreq / binHz);
            startBin = Math.Clamp(startBin, 1, usefulBins - 1);
            endBin = Math.Clamp(endBin, startBin + 1, usefulBins);

            double sum = 0;
            double peak = 0;
            int count = 0;

            for (int bin = startBin; bin < endBin; bin++)
            {
                double real = fftBuffer[bin].X;
                double imag = fftBuffer[bin].Y;
                double magnitude = Math.Sqrt(real * real + imag * imag);
                sum += magnitude;
                if (magnitude > peak)
                    peak = magnitude;
                count++;
            }

            double avg = count > 0 ? sum / count : 0;
            double energy = avg * 0.35 + peak * 0.65;
            double compressed = Math.Log10(1 + energy * 120.0);

            double bandNorm = (double)band / Math.Max(1, BandCount - 1);
            double presenceBoost = 1.0 + Math.Sin(bandNorm * Math.PI) * 0.35;
            double highBoost = 1.0 + bandNorm * 0.9;

            double value = compressed * presenceBoost * highBoost;
            value = Math.Max(0, value - 0.01);
            tempBands[band] = Math.Clamp(value, 0, 10);
        }

        double[] spreadBands = ApplySpectralSpread(tempBands);
        double spectrumAverage = spreadBands.Average();

        if (autoGainEnabled)
        {
            double targetLevel = 0.22;
            double calculatedGain = targetLevel / Math.Max(0.02, spectrumAverage);
            autoGain = autoGain * 0.96 + calculatedGain * 0.04;
            autoGain = Math.Clamp(autoGain, 0.35, 1.0);
        }
        else
        {
            autoGain = outputGain;
        }

        lock (lockObj)
        {
            for (int i = 0; i < BandCount; i++)
            {
                double value = spreadBands[i];
                double bandPosition = (double)i / Math.Max(1, BandCount - 1);

                double lowMidShape = 1.0 + Math.Exp(-Math.Pow((bandPosition - 0.18) / 0.18, 2)) * 0.55;
                double midShape = 1.0 + Math.Exp(-Math.Pow((bandPosition - 0.52) / 0.22, 2)) * 0.35;
                double highDamping = 1.0 - Math.Pow(bandPosition, 1.7) * 0.28;
                double shape = lowMidShape * midShape * highDamping;

                if (value > bandPeaks[i])
                {
                    bandPeaks[i] = value;
                }
                else
                {
                    bandPeaks[i] *= 0.992;
                }

                bandPeaks[i] = Math.Max(bandPeaks[i], 0.03);

                double globalNormalized = Math.Log10(1 + value * 2.8);
                globalNormalized = Math.Clamp(globalNormalized, 0, 1);

                double adaptiveNormalized = value / bandPeaks[i];
                adaptiveNormalized = Math.Clamp(adaptiveNormalized, 0, 1);

                double normalized = globalNormalized * 0.72 + adaptiveNormalized * 0.28;
                normalized = Math.Clamp(normalized * autoGain, 0, 1);
                normalized = Math.Pow(normalized, spectralContrast);
                normalized = Math.Pow(normalized, visualCurvePower);

                double highPresence = 1.0 + Math.Pow(bandPosition, 1.35) * 0.85;
                normalized *= shape * highPresence;

                bands[i] = Math.Clamp(normalized, 0, 1);
                smoothedBands[i] = smoothedBands[i] * 0.58 + bands[i] * 0.42;
                smoothedBands[i] = Math.Clamp(smoothedBands[i], 0, 1);
            }
        }
    }

    private static double[] ApplySpectralSpread(double[] inputBands)
    {
        double[] spreadBands = new double[BandCount];

        for (int i = 0; i < BandCount; i++)
        {
            double bandNorm = (double)i / Math.Max(1, BandCount - 1);
            int radius = bandNorm < 0.18 ? 3 :
                         bandNorm < 0.38 ? 2 :
                         1;

            double weightedSum = 0;
            double weightTotal = 0;

            for (int j = i - radius; j <= i + radius; j++)
            {
                if (j < 0 || j >= BandCount)
                    continue;

                int distance = Math.Abs(i - j);
                double weight = distance switch
                {
                    0 => 1.0,
                    1 => 0.55,
                    2 => 0.28,
                    3 => 0.14,
                    _ => 0.0
                };

                weightedSum += inputBands[j] * weight;
                weightTotal += weight;
            }

            double spread = weightTotal > 0
                ? weightedSum / weightTotal
                : inputBands[i];

            double mix = bandNorm < 0.18 ? 0.55 :
                         bandNorm < 0.38 ? 0.35 :
                         0.18;

            spreadBands[i] = inputBands[i] * (1.0 - mix) + spread * mix;
        }

        return spreadBands;
    }
}
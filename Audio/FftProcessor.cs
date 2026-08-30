using NAudio.Dsp;
using NAudio.Wave;

public class FftProcessor
{
    private const int FftLength = 8192;
    private const int HopLength = 1024;
    private const int BandCount = 64;
    private const double MinimumFrequency = 30.0;
    private const double MaximumFrequency = 16000.0;
    private const double SilenceFloorDb = -78.0;
    private const double FullScaleBandDb = -8.0;
    private const double RelativeGateRangeDb = 40.0;
    private const double GateKneeDb = 10.0;

    private readonly Complex[] leftFftBuffer = new Complex[FftLength];
    private readonly Complex[] rightFftBuffer = new Complex[FftLength];
    private readonly float[] leftRingBuffer = new float[FftLength];
    private readonly float[] rightRingBuffer = new float[FftLength];
    private readonly double[] window = new double[FftLength];
    private readonly double[] magnitudes = new double[FftLength / 2];
    private readonly double[] bands = new double[BandCount];
    private readonly double[] smoothedBands = new double[BandCount];
    private readonly double[] energyBands = new double[BandCount];
    private readonly double[] dynamicBarBands = new double[BandCount];
    private readonly double[] previousTargets = new double[BandCount];
    private readonly double[] bandPeaks = new double[BandCount];
    private readonly object resultLock = new();
    private readonly object inputLock = new();

    private int ringWritePosition;
    private int bufferedSamples;
    private int samplesSinceAnalysis;
    private int sampleRate = 48000;
    private double windowSum;
    private double outputGain = 1.0;
    private double spectralContrast = 1.0;
    private double visualCurvePower = 1.0;
    private bool autoGainEnabled = true;
    private double autoGain = 1.0;

    public FftProcessor()
    {
        for (int i = 0; i < FftLength; i++)
        {
            double phase = 2.0 * Math.PI * i / (FftLength - 1);
            window[i] = 0.35875
                - 0.48829 * Math.Cos(phase)
                + 0.14128 * Math.Cos(phase * 2.0)
                - 0.01168 * Math.Cos(phase * 3.0);
            windowSum += window[i];
        }
    }

    public void SetWaveFormat(WaveFormat waveFormat)
    {
        int nextSampleRate = Math.Max(8000, waveFormat.SampleRate);
        lock (inputLock)
        {
            if (sampleRate == nextSampleRate)
                return;

            sampleRate = nextSampleRate;
            ResetInputState();
        }
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

    public void PushStereoSample(float left, float right)
    {
        if (!float.IsFinite(left) || !float.IsFinite(right))
            return;

        lock (inputLock)
        {
            leftRingBuffer[ringWritePosition] = Math.Clamp(left, -4f, 4f);
            rightRingBuffer[ringWritePosition] = Math.Clamp(right, -4f, 4f);
            ringWritePosition = (ringWritePosition + 1) % FftLength;
            bufferedSamples = Math.Min(FftLength, bufferedSamples + 1);
            samplesSinceAnalysis++;

            if (bufferedSamples == FftLength && samplesSinceAnalysis >= HopLength)
            {
                CalculateFftBands();
                samplesSinceAnalysis = 0;
            }
        }
    }

    public double[] GetBands()
    {
        lock (resultLock)
        {
            return smoothedBands.ToArray();
        }
    }

    public double[] GetEnergyBands()
    {
        lock (resultLock)
        {
            return energyBands.ToArray();
        }
    }

    public double[] GetDynamicBarBands()
    {
        lock (resultLock)
        {
            return dynamicBarBands.ToArray();
        }
    }

    public void Reset()
    {
        lock (inputLock)
        {
            ResetInputState();
        }

        lock (resultLock)
        {
            Array.Clear(bands);
            Array.Clear(smoothedBands);
            Array.Clear(energyBands);
            Array.Clear(dynamicBarBands);
            Array.Clear(previousTargets);
            Array.Clear(bandPeaks);
            autoGain = 1.0;
        }
    }

    private void ResetInputState()
    {
        Array.Clear(leftRingBuffer);
        Array.Clear(rightRingBuffer);
        ringWritePosition = 0;
        bufferedSamples = 0;
        samplesSinceAnalysis = 0;
    }

    private void CalculateFftBands()
    {
        for (int i = 0; i < FftLength; i++)
        {
            int sourceIndex = (ringWritePosition + i) % FftLength;
            float multiplier = (float)window[i];
            leftFftBuffer[i].X = leftRingBuffer[sourceIndex] * multiplier;
            leftFftBuffer[i].Y = 0;
            rightFftBuffer[i].X = rightRingBuffer[sourceIndex] * multiplier;
            rightFftBuffer[i].Y = 0;
        }

        int fftExponent = (int)Math.Log2(FftLength);
        FastFourierTransform.FFT(true, fftExponent, leftFftBuffer);
        FastFourierTransform.FFT(true, fftExponent, rightFftBuffer);

        // NAudio's FFT already includes 1/N normalization. Compensate only for
        // the Hamming coherent gain and the discarded negative spectrum half.
        double coherentWindowGain = windowSum / FftLength;
        double magnitudeScale = 2.0 / Math.Max(0.01, coherentWindowGain);
        for (int bin = 1; bin < magnitudes.Length; bin++)
        {
            double leftReal = leftFftBuffer[bin].X;
            double leftImaginary = leftFftBuffer[bin].Y;
            double rightReal = rightFftBuffer[bin].X;
            double rightImaginary = rightFftBuffer[bin].Y;
            double leftMagnitude = Math.Sqrt(leftReal * leftReal + leftImaginary * leftImaginary) * magnitudeScale;
            double rightMagnitude = Math.Sqrt(rightReal * rightReal + rightImaginary * rightImaginary) * magnitudeScale;

            // RMS energy across channels prevents opposite-phase stereo from cancelling bass.
            magnitudes[bin] = Math.Sqrt((leftMagnitude * leftMagnitude + rightMagnitude * rightMagnitude) * 0.5);
        }

        double[] rawTargets = BuildBandTargets();
        double[] spreadTargets = ApplyLightSpectralSmoothing(rawTargets);
        double[] dynamicTargets = BuildDynamicBarTargets();
        double spectrumRms = Math.Sqrt(spreadTargets.Select(value => value * value).Average());

        double requestedGain = !autoGainEnabled || spectrumRms < 0.012
            ? 1.0
            : Math.Clamp(0.40 / spectrumRms, 0.70, 2.2);
        double gainMix = requestedGain > autoGain ? 0.10 : 0.035;
        autoGain += (requestedGain - autoGain) * gainMix;
        autoGain = Math.Clamp(autoGain, 0.70, 2.2);

        lock (resultLock)
        {
            for (int i = 0; i < BandCount; i++)
            {
                double position = (double)i / Math.Max(1, BandCount - 1);
                double target = spreadTargets[i];
                target *= outputGain * (autoGainEnabled ? autoGain : 1.0);
                target = 1.0 - Math.Exp(-Math.Max(0, target) * 1.05);
                target = Math.Clamp(target, 0, 1);

                if (target > bandPeaks[i])
                    bandPeaks[i] = target;
                else
                    bandPeaks[i] *= 0.996;

                bandPeaks[i] = Math.Max(0.08, bandPeaks[i]);
                double adaptive = Math.Clamp(target / bandPeaks[i], 0, 1);
                target = target * 0.88 + adaptive * target * 0.12;
                target = ApplyVisualControls(target);
                if (target < 0.008)
                    target = 0;

                bands[i] = target;
                double balancedMix = target > smoothedBands[i] ? 0.64 : 0.22;
                smoothedBands[i] += (target - smoothedBands[i]) * balancedMix;
                smoothedBands[i] = Math.Clamp(smoothedBands[i], 0, 1);

                double positiveDelta = Math.Max(0, target - previousTargets[i]);
                double energyShape = 0.96 + position * 0.08;
                double energyTarget = Math.Pow(target, 0.82) * 0.94 * energyShape + positiveDelta * 0.16;
                energyTarget = Math.Clamp(energyTarget, 0, 1);
                double energyMix = energyTarget > energyBands[i] ? 0.84 : 0.28;
                energyBands[i] += (energyTarget - energyBands[i]) * energyMix;
                energyBands[i] = Math.Clamp(energyBands[i], 0, 1);

                // Dynamic Bars deliberately avoids per-band peak normalization and
                // spectral spreading. Fast attack plus a shorter release preserves
                // the isolated peaks and deep valleys of the actual process stream.
                double dynamicTarget = Math.Clamp(dynamicTargets[i] * outputGain, 0, 1);
                double dynamicMix = dynamicTarget > dynamicBarBands[i] ? 0.82 : 0.16;
                dynamicBarBands[i] += (dynamicTarget - dynamicBarBands[i]) * dynamicMix;
                if (dynamicBarBands[i] < 0.006)
                    dynamicBarBands[i] = 0;
                dynamicBarBands[i] = Math.Clamp(dynamicBarBands[i], 0, 1);
                previousTargets[i] = target;
            }
        }
    }

    private double[] BuildDynamicBarTargets()
    {
        double[] bandDecibels = new double[BandCount];
        double binHz = (double)sampleRate / FftLength;
        double maxFrequency = Math.Min(MaximumFrequency, sampleRate * 0.48);

        for (int band = 0; band < BandCount; band++)
        {
            double startNorm = (double)band / BandCount;
            double endNorm = (double)(band + 1) / BandCount;
            double startFrequency = MinimumFrequency * Math.Pow(maxFrequency / MinimumFrequency, startNorm);
            double endFrequency = MinimumFrequency * Math.Pow(maxFrequency / MinimumFrequency, endNorm);
            int startBin = Math.Clamp((int)Math.Floor(startFrequency / binHz), 1, magnitudes.Length - 1);
            int endBin = Math.Clamp((int)Math.Ceiling(endFrequency / binHz), startBin + 1, magnitudes.Length);

            double powerSum = 0;
            double peak = 0;
            int count = 0;
            for (int bin = startBin; bin < endBin; bin++)
            {
                double magnitude = magnitudes[bin];
                powerSum += magnitude * magnitude;
                peak = Math.Max(peak, magnitude);
                count++;
            }

            double rms = count > 0 ? Math.Sqrt(powerSum / count) : 0;
            // A peak-heavy blend keeps transients visible without becoming a
            // one-bin peak meter. This is intentionally different from Balanced.
            double amplitude = rms * 0.34 + peak * 0.66;
            double centerFrequency = Math.Sqrt(startFrequency * endFrequency);
            double visualTiltDb = centerFrequency <= 80.0
                ? -1.5 * (1.0 - centerFrequency / 80.0)
                : Math.Min(11.0, 1.55 * Math.Log2(centerFrequency / 80.0));
            bandDecibels[band] = 20.0 * Math.Log10(Math.Max(1e-9, amplitude)) + visualTiltDb;
        }

        double framePeakDb = bandDecibels.Max();
        if (framePeakDb <= SilenceFloorDb)
            return new double[BandCount];

        // Spectral unsharp masking increases local contrast without moving
        // energy into neighbouring bands. Broad tonal shapes stay intact while
        // peaks separate from the surrounding floor.
        double[] contrastedDecibels = new double[BandCount];
        for (int band = 0; band < BandCount; band++)
        {
            double neighbourSum = 0;
            int neighbourCount = 0;
            for (int offset = -2; offset <= 2; offset++)
            {
                if (offset == 0)
                    continue;

                int neighbour = band + offset;
                if (neighbour < 0 || neighbour >= BandCount)
                    continue;

                neighbourSum += bandDecibels[neighbour];
                neighbourCount++;
            }

            double localAverage = neighbourCount > 0
                ? neighbourSum / neighbourCount
                : bandDecibels[band];
            double localDetail = Math.Clamp((bandDecibels[band] - localAverage) * 0.42, -4.5, 6.5);
            contrastedDecibels[band] = bandDecibels[band] + localDetail;
        }

        double contrastedPeakDb = contrastedDecibels.Max();
        double relativeFloorDb = Math.Max(SilenceFloorDb, contrastedPeakDb - 34.0);
        double[] result = new double[BandCount];

        for (int band = 0; band < BandCount; band++)
        {
            double normalized = Math.Clamp(
                (contrastedDecibels[band] - relativeFloorDb) /
                Math.Max(12.0, contrastedPeakDb - relativeFloorDb),
                0,
                1
            );

            // A short soft knee removes the captured process noise floor, while
            // the power curve restores the deep valleys visible in Musicvid bars.
            double gate = Math.Clamp(normalized / 0.18, 0, 1);
            gate = gate * gate * (3.0 - 2.0 * gate);
            result[band] = Math.Pow(normalized, 1.32) * gate;
        }

        return result;
    }

    private double[] BuildBandTargets()
    {
        double[] bandDecibels = new double[BandCount];
        double binHz = (double)sampleRate / FftLength;
        double maxFrequency = Math.Min(MaximumFrequency, sampleRate * 0.48);

        for (int band = 0; band < BandCount; band++)
        {
            double startNorm = (double)band / BandCount;
            double endNorm = (double)(band + 1) / BandCount;
            double startFrequency = MinimumFrequency * Math.Pow(maxFrequency / MinimumFrequency, startNorm);
            double endFrequency = MinimumFrequency * Math.Pow(maxFrequency / MinimumFrequency, endNorm);
            int startBin = Math.Clamp((int)Math.Floor(startFrequency / binHz), 1, magnitudes.Length - 1);
            int endBin = Math.Clamp((int)Math.Ceiling(endFrequency / binHz), startBin + 1, magnitudes.Length);

            double powerSum = 0;
            double peak = 0;
            int count = 0;
            for (int bin = startBin; bin < endBin; bin++)
            {
                double magnitude = magnitudes[bin];
                powerSum += magnitude * magnitude;
                peak = Math.Max(peak, magnitude);
                count++;
            }

            double rms = count > 0 ? Math.Sqrt(powerSum / count) : 0;
            double amplitude = rms * 0.76 + peak * 0.24;
            double centerFrequency = Math.Sqrt(startFrequency * endFrequency);
            double visualTiltDb = centerFrequency <= 80.0
                ? -2.0 * (1.0 - centerFrequency / 80.0)
                : Math.Min(16.5, 2.25 * Math.Log2(centerFrequency / 80.0));
            bandDecibels[band] = 20.0 * Math.Log10(Math.Max(1e-9, amplitude)) + visualTiltDb;
        }

        double framePeakDb = bandDecibels.Max();
        if (framePeakDb <= SilenceFloorDb)
            return new double[BandCount];

        double relativeFloorDb = Math.Max(SilenceFloorDb, framePeakDb - RelativeGateRangeDb);
        double relativeFullDb = relativeFloorDb + GateKneeDb;
        double[] result = new double[BandCount];

        for (int band = 0; band < BandCount; band++)
        {
            double decibels = bandDecibels[band];
            double absoluteLevel = Math.Clamp((decibels - SilenceFloorDb) / (FullScaleBandDb - SilenceFloorDb), 0, 1);
            double gatePosition = Math.Clamp((decibels - relativeFloorDb) / Math.Max(1.0, relativeFullDb - relativeFloorDb), 0, 1);
            double smoothGate = gatePosition * gatePosition * (3.0 - 2.0 * gatePosition);
            result[band] = absoluteLevel * smoothGate;
        }

        return result;
    }

    private double ApplyVisualControls(double value)
    {
        double contrasted = Math.Pow(Math.Clamp(value, 0, 1), spectralContrast);
        return Math.Pow(contrasted, visualCurvePower);
    }

    private static double[] ApplyLightSpectralSmoothing(double[] input)
    {
        double[] output = new double[BandCount];
        for (int i = 0; i < BandCount; i++)
        {
            double left = input[Math.Max(0, i - 1)];
            double right = input[Math.Min(BandCount - 1, i + 1)];
            output[i] = input[i] * 0.82 + (left + right) * 0.09;
        }

        return output;
    }
}

(() => {
  "use strict";

  const presets = Object.freeze({
    balanced: Object.freeze({ sensitivity: 1.15, smoothing: 0.65, autoGain: true, outputGain: 1, spectralContrast: 1, visualCurvePower: 1 }),
    smooth: Object.freeze({ sensitivity: 1.05, smoothing: 0.82, autoGain: true, outputGain: 0.95, spectralContrast: 0.85, visualCurvePower: 1.15 }),
    punchy: Object.freeze({ sensitivity: 1.35, smoothing: 0.48, autoGain: true, outputGain: 1.15, spectralContrast: 1.45, visualCurvePower: 0.9 }),
    vocal: Object.freeze({ sensitivity: 1.2, smoothing: 0.62, autoGain: true, outputGain: 1.05, spectralContrast: 1.25, visualCurvePower: 1.05 }),
    bass: Object.freeze({ sensitivity: 1.3, smoothing: 0.58, autoGain: true, outputGain: 1.2, spectralContrast: 1.15, visualCurvePower: 0.95 }),
    orchestra: Object.freeze({ sensitivity: 1.1, smoothing: 0.74, autoGain: true, outputGain: 1, spectralContrast: 1.35, visualCurvePower: 1.2 }),
    energy: Object.freeze({ sensitivity: 1.35, smoothing: 0.38, autoGain: true, outputGain: 1.1, spectralContrast: 1, visualCurvePower: 1 }),
    dynamicBars: Object.freeze({ sensitivity: 1.12, smoothing: 0.28, autoGain: true, outputGain: 1, spectralContrast: 1, visualCurvePower: 1 })
  });

  const options = Object.freeze([
    Object.freeze({ value: "balanced", label: "Balanced" }),
    Object.freeze({ value: "smooth", label: "Smooth" }),
    Object.freeze({ value: "punchy", label: "Punchy" }),
    Object.freeze({ value: "vocal", label: "Vocal" }),
    Object.freeze({ value: "bass", label: "Bass" }),
    Object.freeze({ value: "orchestra", label: "Orchestra" }),
    Object.freeze({ value: "energy", label: "Energy" }),
    Object.freeze({ value: "dynamicBars", label: "Dynamic Bars (Musicvid)" }),
    Object.freeze({ value: "custom", label: "Custom / Global" })
  ]);

  function normalize(value, fallback = "balanced") {
    const name = String(value || "");
    return name === "custom" || Object.hasOwn(presets, name) ? name : fallback;
  }

  function settings(value, custom = {}) {
    const name = normalize(value, "custom");
    return { ...custom, ...(name === "custom" ? {} : presets[name]), preset: name };
  }

  window.MusicOverlayFftPresets = Object.freeze({ presets, options, normalize, settings });
})();

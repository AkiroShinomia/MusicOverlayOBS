((root, factory) => {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MusicOverlayPlaybackClock = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const finiteNonNegative = value => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  };

  class PlaybackClock {
    constructor(now = Date.now()) {
      this.reset({ position: 0, duration: 0, isPlaying: false }, now);
    }

    reset(sample = {}, now = Date.now()) {
      const position = finiteNonNegative(sample.position) ?? 0;
      this.duration = finiteNonNegative(sample.duration) ?? 0;
      this.position = this.#limit(position);
      this.isPlaying = Boolean(sample.isPlaying);
      this.anchorAt = now;
      this.lastApiPosition = position;
      return this.position;
    }

    positionAt(now = Date.now()) {
      const elapsed = this.isPlaying
        ? Math.max(0, (now - this.anchorAt) / 1000)
        : 0;
      return this.#limit(this.position + elapsed);
    }

    update(sample = {}, now = Date.now()) {
      const apiPosition = finiteNonNegative(sample.position);
      const apiDuration = finiteNonNegative(sample.duration);
      const nextPlaying = Boolean(sample.isPlaying);
      const predicted = this.positionAt(now);
      const playbackChanged = nextPlaying !== this.isPlaying;

      if (apiDuration !== null && apiDuration > 0) this.duration = apiDuration;

      if (apiPosition === null) {
        if (playbackChanged) this.#anchor(predicted, nextPlaying, now);
        return this.positionAt(now);
      }

      const apiMovedBack = this.lastApiPosition !== null && apiPosition < this.lastApiPosition - 0.75;
      const apiMovedFarAhead = apiPosition > predicted + 1.5;

      if (playbackChanged || !nextPlaying || apiMovedBack || apiMovedFarAhead) {
        // Playback transitions and explicit seeks are authoritative. A real
        // backward seek is detected against the previous API sample, not the
        // locally interpolated position.
        this.#anchor(apiPosition, nextPlaying, now);
      } else if (apiPosition > predicted) {
        // Correct forward drift, but never rewind a running clock to an old,
        // rounded Windows Media timeline sample.
        this.#anchor(apiPosition, true, now);
      }

      this.lastApiPosition = apiPosition;
      return this.positionAt(now);
    }

    snapshot(now = Date.now()) {
      return {
        position: this.positionAt(now),
        duration: this.duration,
        isPlaying: this.isPlaying
      };
    }

    #anchor(position, isPlaying, now) {
      this.position = this.#limit(position);
      this.isPlaying = Boolean(isPlaying);
      this.anchorAt = now;
    }

    #limit(position) {
      const safe = Math.max(0, Number(position) || 0);
      return this.duration > 0 ? Math.min(safe, this.duration) : safe;
    }
  }

  return Object.freeze({ PlaybackClock });
});

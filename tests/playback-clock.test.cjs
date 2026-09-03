"use strict";

const assert = require("node:assert/strict");
const { PlaybackClock } = require("../overlay/shared/playback-clock.js");

const clock = new PlaybackClock(0);
clock.reset({ position: 10, duration: 180, isPlaying: true }, 0);

assert.equal(clock.positionAt(1000), 11);
clock.update({ position: 10, duration: 180, isPlaying: true }, 1000);
assert.equal(clock.positionAt(1500), 11.5, "stale API samples must not rewind or re-anchor playback");

clock.update({ position: 12, duration: 180, isPlaying: true }, 2000);
assert.equal(clock.positionAt(2250), 12.25, "forward API samples may correct clock drift");

clock.update({ position: 5, duration: 180, isPlaying: true }, 2500);
assert.equal(clock.positionAt(2750), 5.25, "an explicit backward seek must be accepted");

clock.update({ position: 6, duration: 180, isPlaying: false }, 3000);
assert.equal(clock.positionAt(6000), 6, "paused playback must remain stationary");

clock.update({ position: 6, duration: 180, isPlaying: true }, 6000);
assert.equal(clock.positionAt(7000), 7, "resume must start from the authoritative API position");

console.log("PlaybackClock: 6/6 checks passed");

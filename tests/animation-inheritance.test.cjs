"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const browserWindow = {};
const source = fs.readFileSync(path.join(__dirname, "..", "overlay", "shared", "scene-timeline.js"), "utf8");
vm.runInNewContext(source, { window: browserWindow });
const Timeline = browserWindow.MusicOverlaySceneTimeline;

const group = {
  id: "group",
  nodeType: "group",
  parentId: null,
  animations: {
    overrideChildren: true,
    in: { type: "slideRight", durationMs: 500, easing: "linear", distance: 180 },
    out: { type: "slideDown", durationMs: 500, easing: "linear", distance: 180 }
  }
};
const delayedChild = {
  id: "child",
  nodeType: "component",
  parentId: "group",
  animations: {
    in: { type: "scale", durationMs: 250, easing: "linear" },
    out: { type: "fade", durationMs: 250, easing: "linear" }
  }
};
const byId = new Map([[group.id, group], [delayedChild.id, delayedChild]]);
const groupWindow = { startMs: 0, endMs: 5000 };
const childWindow = { startMs: 500, endMs: 4000 };

const inherited = Timeline.resolveAnimations(delayedChild, byId);
assert.equal(inherited, group.animations, "child must inherit tracks from the overriding group");
assert.equal(Timeline.resolveAnimations(group, byId), null, "group container must remain animation-neutral");

assert.equal(Timeline.getFrame(delayedChild, childWindow, 499, inherited).visible, false);
assert.equal(Timeline.getFrame(delayedChild, childWindow, 500, inherited).x, -180,
  "inherited In must begin when the child begins, not when its group begins");
assert.equal(Timeline.getFrame(delayedChild, childWindow, 750, inherited).x, -90);
assert.equal(Timeline.getFrame(delayedChild, childWindow, 1000, inherited).x, 0);
assert.equal(Timeline.getFrame(delayedChild, childWindow, 3750, inherited).y, 90,
  "inherited Out must be evaluated relative to the child's own end");

group.animations.overrideChildren = false;
assert.equal(Timeline.resolveAnimations(delayedChild, byId), delayedChild.animations,
  "disabling group override must restore the child's own animation tracks");
assert.equal(Timeline.getFrame(delayedChild, childWindow, 500, delayedChild.animations).scale, 0.72);

const groupFrame = Timeline.getFrame(group, groupWindow, 0, Timeline.resolveAnimations(group, byId));
assert.deepEqual(
  JSON.parse(JSON.stringify(groupFrame)),
  { visible: true, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }
);

console.log("Animation inheritance: 10/10 checks passed");

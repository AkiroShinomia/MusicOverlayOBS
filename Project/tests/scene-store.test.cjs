"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const browserWindow = { MusicOverlay: { editor: { state: {}, history: {} } } };
const context = { window: browserWindow, structuredClone, performance, console };

for (const relative of [
  "overlay/editor/state/scene-mutations.js",
  "overlay/editor/state/scene-store.js"
]) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", relative), "utf8"), context);
}

const Store = browserWindow.MusicOverlay.editor.state.sceneStore;
const scene = {
  schemaVersion: 2,
  documentType: "music-overlay.scene",
  id: "test",
  revision: 1,
  metadata: { name: "Test" },
  canvas: { width: 1920, height: 1080 },
  timeline: { durationMs: 30000 },
  appearance: {},
  nodes: [
    {
      id: "g", nodeType: "group", parentId: null, order: 7, visible: true, locked: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: .5, anchorY: .5 },
      timing: { startMs: 0, endMode: "fixed", durationMs: 10000 },
      component: { kind: "group", properties: {} }, effects: [], animations: {}
    },
    {
      id: "c", nodeType: "component", parentId: "g", order: 9, visible: true, locked: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 13, anchorX: .2, anchorY: .8 },
      timing: { startMs: 0, endMode: "parentEnd", durationMs: null },
      component: { kind: "future-kind", version: 7, properties: { unicode: "Привет", future: { keep: true } } },
      effects: [], animations: {}, extensions: { future: { keep: true } }
    }
  ],
  extensions: { future: { keep: true } }
};

const store = Store.create();
store.load(scene, "test");
let first = store.getSnapshot();
assert.equal(first.nodes.find(node => node.id === "g").order, 0, "load must normalize root order");
assert.equal(first.nodes.find(node => node.id === "c").order, 0, "load must normalize child order");
first.nodes[0].name = "mutated outside";
assert.equal(store.getSnapshot().nodes[0].name, undefined, "snapshot must be isolated from Store internals");
assert.equal(store.getRevision(), 0);

store.dispatch({ type: "node.rename", payload: { id: "g", name: "Group" } });
assert.equal(store.getRevision(), 1);
store.dispatch({ type: "node.rename", payload: { id: "g", name: "Group" } });
assert.equal(store.getRevision(), 1, "no-op mutation must not increase revision");

store.dispatch({ type: "node.transform", payload: { id: "c", patch: { x: 42 } } });
const after = store.getSnapshot();
const component = after.nodes.find(node => node.id === "c");
assert.equal(component.transform.rotation, 13);
assert.equal(component.transform.anchorX, .2);
assert.equal(component.component.version, 7);
assert.equal(component.component.properties.future.keep, true);
assert.equal(after.extensions.future.keep, true);

assert.throws(
  () => store.dispatch({
    type: "node.add",
    payload: {
      node: {
        id: "bad-child", nodeType: "component", parentId: "c", order: 0,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: .5, anchorY: .5 },
        timing: { startMs: 0, endMode: "fixed", durationMs: 1000 },
        component: { kind: "block", properties: {} }, effects: [], animations: {}
      }
    }
  }),
  /must be a group/i
);

assert.throws(
  () => store.dispatch({ type: "node.reparent", payload: { id: "g", parentId: "c" } }),
  /must be a group|cycle/i
);
assert.equal(store.getSnapshot().nodes.find(node => node.id === "g").parentId, null);

const duplicateStore = Store.create();
duplicateStore.load(scene, "duplicate-test");
duplicateStore.dispatch({ type: "node.duplicate", payload: { id: "g", newId: "g-copy" } });
const duplicated = duplicateStore.getSnapshot();
const copiedGroup = duplicated.nodes.find(node => node.id === "g-copy");
const copiedChild = duplicated.nodes.find(node => node.id === "c-copy");
assert.ok(copiedGroup, "duplicate must create root copy");
assert.ok(copiedChild, "duplicate must create descendant copy");
assert.equal(copiedChild.parentId, "g-copy", "duplicate must remap descendant parent ids");
assert.equal(copiedChild.component.properties.future.keep, true, "duplicate must preserve unknown component data");
assert.equal(duplicated.nodes.find(node => node.id === "g").order, 0);
assert.equal(copiedGroup.order, 1, "duplicate should be inserted after source by default");
assert.equal(duplicateStore.getRevision(), 1, "duplicate subtree must commit as one revision");

const hashStore = Store.create();
assert.equal(
  hashStore.hashSnapshot({ b: 1, a: { d: 2, c: 3 } }),
  hashStore.hashSnapshot({ a: { c: 3, d: 2 }, b: 1 }),
  "hash must not depend on object key insertion order"
);

const invalidParentScene = structuredClone(scene);
invalidParentScene.nodes.push({
  id: "nested-under-component", nodeType: "component", parentId: "c", order: 0,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: .5, anchorY: .5 },
  timing: { startMs: 0, endMode: "fixed", durationMs: 1000 },
  component: { kind: "block", properties: {} }, effects: [], animations: {}
});
assert.throws(() => Store.create().load(invalidParentScene, "invalid"), /must be a group/i);

const replaceScene = structuredClone(scene);
replaceScene.nodes[0].order = 30;
replaceScene.nodes[1].order = 40;
duplicateStore.dispatch({ type: "history.replace", payload: { scene: replaceScene } });
const replaced = duplicateStore.getSnapshot();
assert.equal(replaced.nodes.find(node => node.id === "g").order, 0, "replace must normalize root order");
assert.equal(replaced.nodes.find(node => node.id === "c").order, 0, "replace must normalize child order");

store.dispatch({ type: "node.removeSubtree", payload: { id: "g" } });
assert.equal(store.getSnapshot().nodes.length, 0, "removeSubtree must remove descendants atomically");

console.log("SceneStore Stage 2F foundation: extended checks passed");

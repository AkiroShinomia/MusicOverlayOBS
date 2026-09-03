"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const draftCalls = [];
const publishCalls = [];
let publishGate = null;

const browserWindow = {
  MusicOverlay: {
    editor: { state: {}, history: {}, persistence: {} },
    core: { events: { emit() {} } },
    api: {
      scenes: {
        async saveDraft(payload) {
          draftCalls.push(structuredClone(payload));
          return {
            ok: true,
            async json() { return { ok: true, revision: draftCalls.length }; }
          };
        },
        async publish(payload) {
          publishCalls.push(structuredClone(payload));
          if (publishGate) await publishGate.promise;
          return {
            ok: true,
            async json() { return { ok: true, revision: 100 + publishCalls.length }; }
          };
        }
      }
    }
  }
};

const context = {
  window: browserWindow,
  structuredClone,
  performance,
  console,
  setTimeout,
  clearTimeout,
  Promise,
  Map,
  Set
};

for (const relative of [
  "overlay/shared/scene-timeline.js",
  "overlay/editor/state/scene-selectors.js",
  "overlay/editor/state/scene-mutations.js",
  "overlay/editor/state/scene-store.js",
  "overlay/editor/state/editor-session-store.js",
  "overlay/editor/history/snapshot-history.js",
  "overlay/editor/persistence/draft-save-scheduler.js",
  "overlay/editor/state/editor-context.js"
]) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", relative), "utf8"), context, { filename: relative });
}

const Editor = browserWindow.MusicOverlay.editor.context;

function makeScene(name = "Draft") {
  return {
    schemaVersion: 2,
    documentType: "music-overlay.scene",
    id: "workspace-draft",
    revision: 1,
    metadata: { name },
    canvas: { width: 1920, height: 1080 },
    timeline: { durationMs: 30000 },
    appearance: { albumArt: { defaultCover: "/assets/default-cover.png" } },
    nodes: [
      {
        id: "group",
        nodeType: "group",
        parentId: null,
        order: 0,
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: .5, anchorY: .5 },
        timing: { startMs: 0, endMode: "trackEnd", durationMs: null },
        component: { kind: "group", properties: {} },
        effects: [],
        animations: {}
      }
    ]
  };
}

(async () => {
  const draft = makeScene();
  const published = makeScene("Published");
  Editor.initialize(draft, published, { audio: { sourceMode: "auto" } });

  assert.equal(Editor.sceneStore.getRevision(), 0, "initialize must start local Scene revision at zero");
  assert.equal(Editor.sessionStore.getSnapshot().persistence.pending, false);

  Editor.commit({ type: "node.rename", payload: { id: "group", name: "Renamed" } });
  assert.equal(Editor.sceneStore.getRevision(), 1, "Scene commit must increment revision once");
  assert.equal(Editor.sessionStore.getSnapshot().persistence.pending, true, "Scene mutation must mark draft pending");

  await Editor.flushDraft();
  assert.equal(draftCalls.length, 1, "Scene mutation must produce one draft save");
  assert.equal(draftCalls[0].scene.nodes[0].name, "Renamed");
  assert.equal(Editor.sessionStore.getSnapshot().persistence.pending, false, "successful draft save must clear pending state");

  const settingsChanged = Editor.updateSettings({ audio: { sourceMode: "system" } });
  assert.equal(settingsChanged, true, "settings mutation must report a real change");
  assert.equal(Editor.updateSettings({ audio: { sourceMode: "system" } }), false, "settings no-op must not create a new revision");
  await Editor.flushDraft();
  assert.equal(draftCalls.length, 2, "settings-only change must produce a draft save");
  assert.equal(draftCalls[1].settings.audio.sourceMode, "system");
  assert.equal(Editor.sessionStore.getSnapshot().persistence.pending, false);

  publishGate = deferred();
  const applyPromise = Editor.apply();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(publishCalls.length, 1, "apply must publish exactly one captured snapshot");
  assert.equal(publishCalls[0].scene.nodes[0].name, "Renamed");
  assert.equal(publishCalls[0].settings.audio.sourceMode, "system");

  Editor.commit({ type: "node.rename", payload: { id: "group", name: "Changed during publish" } });
  Editor.updateSettings({ audio: { sourceMode: "process" } });

  publishGate.resolve();
  await applyPromise;
  await Editor.flushDraft();

  assert.equal(Editor.sceneStore.getSnapshot().nodes[0].name, "Changed during publish");
  assert.equal(Editor.getSettings().audio.sourceMode, "process");
  assert.ok(draftCalls.length >= 3, "changes made during publish must be followed by another draft save");
  const lastDraft = draftCalls.at(-1);
  assert.equal(lastDraft.scene.nodes[0].name, "Changed during publish");
  assert.equal(lastDraft.settings.audio.sourceMode, "process");
  assert.equal(Editor.sessionStore.getSnapshot().persistence.pending, false, "post-publish draft must settle cleanly");

  const publishedHash = Editor.sceneStore.getState().publishedHash;
  const currentHash = Editor.sceneStore.getState().currentHash;
  assert.notEqual(publishedHash, currentHash, "newer Scene edits must remain not-applied after an older snapshot was published");

  console.log("EditorContext Stage 2F persistence/race checks passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

# Stage 2F — Canonical Editor Scene State

Status: implemented.

Stage 2F makes `SceneDocument` the sole persistent composition state of the editor. Runtime editing no longer performs the permanent Scene → legacy layout → Scene round-trip. Legacy structures remain only at explicit migration/form-projection compatibility boundaries.

## Canonical Scene state

`editor/state/scene-store.js` owns the current Scene document and exposes load, snapshot, revision, dispatch, validation, subscription, draft-save and published-hash state. Snapshots are clone-isolated and committed Scene documents are recursively frozen.

Every persistent composition edit is expressed as a typed Scene mutation. Supported mutations include add/remove/duplicate subtree, rename, visibility, lock, marker, transform, timing, effects, animations, component properties, reparent/reorder, canvas, timeline, appearance, metadata, full Scene replacement and history restoration.

Sibling order is normalized after load/replace and structural edits. Parent references are restricted to group nodes. Scene hashing canonicalizes object-key ordering so equivalent Scenes receive stable hashes.

`SceneEditorModel.toScene` has no editor runtime callers.

## Canonical session state

Non-persistent editor interaction state is owned by `EditorSessionStore`, separately from the Scene document.

This includes selection, expanded groups, viewport/canvas scale, playhead, playback, panels, transient interaction state, persistence state, theme UI state and custom library session data.

The former duplicate compatibility fields for selection, collapsed groups, preview/playhead time, playback bookkeeping, timeline duration, canvas scale, custom library assets and theme state have been removed from `editorRuntime`.

`editorRuntime` is therefore no longer a second source of truth for those values. Remaining entries are temporary runtime/presentation compatibility handles that are not persistent Scene composition state.

## History

Undo/redo stores committed Scene snapshots only. Restoration uses the typed `history.replace` mutation and repairs Session Store selection only when the selected node no longer exists.

Selection and playhead are not serialized into history snapshots. The obsolete legacy `createHistorySnapshot()` helper has been removed. Theme replacement resets history.

## Persistence and Apply

Draft saves consume direct canonical Scene snapshots plus global settings. Saves are debounced and serialized.

Apply captures a specific Scene revision and settings revision before publishing. If the user edits while publish is in flight, only the captured revisions are marked saved/published and newer edits remain dirty and are queued for a later Draft save.

OBS continues to consume Published Scene only.

## Compatibility boundary

`editor/compat/legacy-form-projection.js` is the sole application-level projection boundary around `legacyEditorState`.

Direct `legacyEditorState` references are restricted to:

- `editor/compat/legacy-editor-state.js`
- `editor/compat/legacy-form-projection.js`

There is no `legacyEditorState.value` bridge.

Legacy `.layout.groups` / `.layout.layers` access is restricted to `editor/scene-editor-model.js`, where it exists for migration/legacy input interpretation only.

Built-in Stage 2 compatibility IDs are centralized in `editor/compat/builtin-v2-rules.js` and referenced by migration/default code through the centralized ID constants.

## Verification

Run:

```powershell
dotnet build MusicOverlay.csproj -c Release --no-restore
dotnet run --no-build -c Release --project MusicOverlay.csproj -- --skip-update --verify-stage2f
node tests/scene-store.test.cjs
node tests/editor-context.test.cjs
```

The .NET verifier statically checks the canonical Scene Store contract, typed mutations, Scene-only history, direct publish path, legacy projection isolation, centralized built-in IDs, dependency order and the absence of removed `editorRuntime` second-source fields.

The CommonJS characterization tests cover Scene Store mutation/invariant behavior and editor persistence race semantics.

The LocalTool environment used during implementation does not permit arbitrary `run_process`, so the JavaScript tests and `--verify-stage2f` executable invocation must be run externally or in CI when that restriction applies.

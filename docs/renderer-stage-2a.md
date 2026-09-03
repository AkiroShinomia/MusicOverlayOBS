# Scene Renderer — Stage 2A

Stage 2A introduces a renderer that consumes `music-overlay.scene` schema version 2 directly. It is intentionally mounted only by `renderer-test.html`; the production Preview and OBS renderer are switched in stages 2B and 2C.

## Runtime boundary

- `SceneRenderer` accepts a validated Scene v2 snapshot.
- Legacy `layout`, legacy object ids, and legacy runtime targets are not interpreted by the renderer.
- `SceneDocumentConverter` is the compatibility boundary. It converts legacy `data` and `effect` objects into semantic component kinds before a scene reaches the renderer.
- Draft and Published scenes have separate read-only API endpoints.

## Shared modules

- `scene-order.js` — parent-aware ordering and tree construction.
- `layer-renderer.js` — shared DOM stacking invariant.
- `scene-timeline.js` — absolute timing windows and animation frames.
- `component-registry.js` — extensible component factories.
- `scene-renderer.js` — tree mounting, state updates, effects, transforms, and diagnostics.
- `scene-renderer.css` — renderer primitives only; theme values remain scene data.

## Component contract

A registry definition provides `create(node, context)` and may provide `update(element, node, state)` and `destroy(element, node)`. New user-defined component editors can later register a new kind without adding branches to `SceneRenderer`.

Supported built-in kinds: `block`, `container`, `image`, `disc`, `text`, `time`, `progress`, `equalizer`, `particles`, and `ticker`.

## Verification

Run backend verification:

```powershell
MusicOverlay.exe --skip-update --verify-stage2a
```

Run visual verification while MusicOverlay is running:

```text
http://localhost:8799/renderer-test.html
```

The visual harness checks Draft, Published, the default scene, a synthetic two-level nested composition, and every installed theme. A passing run reports `PASS` and zero unsupported component kinds.

## Next stages

- 2B mounts Draft in the editor Preview (completed; see `renderer-stage-2b.md`).
- 2C mounts Published in OBS and reloads only on a published revision.
- 2D removes the legacy Preview/OBS paths and the compatibility projection.

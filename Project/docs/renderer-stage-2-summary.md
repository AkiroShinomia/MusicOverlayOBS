# Renderer Migration — Stage 2 Summary

Stage 2 replaced two independent, hard-coded renderers with one extensible Scene v2 engine.

| Stage | Result |
|---|---|
| 2A | Shared renderer, component registry, hierarchy, timing, effects and diagnostics introduced behind a test harness. |
| 2B | Editor Preview moved to the shared renderer while Draft remained isolated from OBS. |
| 2C | OBS moved to the same renderer and became a Published-only consumer with live track/FFT/WebSocket inputs. |
| 2D | Native per-node geometry and native Scene read/write completed; legacy Preview/OBS runtimes and compatibility projection removed. |

## Architecture after Stage 2

```text
Overlay Editor ── in-memory Draft ──► shared SceneRenderer
      │
      └─ Apply ──► POST /api/scene/publish
                         │
                         ├─► data/workspace/draft.scene.json
                         ├─► data/workspace/published.scene.json
                         └─► WebSocket configChanged
                                      │
OBS page ── GET /api/scene/published ──┴─► shared SceneRenderer
```

Editor and OBS share rendering code but own separate renderer instances and scene snapshots. Editing is immediate only in Preview; OBS changes only after Apply.

## Foundation now available

- Arbitrary nested groups and components without renderer ID branches.
- Per-node transforms, timing, effects, and In/Out animations.
- Draft/Published isolation and revisioned publication.
- Extensible component registry for future user-created objects/compositions.
- Portable global settings independent from composition data.
- One rendering behavior to test and optimize for both Editor and OBS.
- One monotonic playback clock for both time labels and progress components, isolated from the scene renderer itself.
- Per-equalizer FFT preset selection without extra audio-capture requests.
- Explicit group/child animation ownership: inherited tracks run on every child's local timing without double animation transforms.

Stage 3 can now focus on editor/domain improvements without maintaining two visual engines or adding fields to a monolithic legacy config.

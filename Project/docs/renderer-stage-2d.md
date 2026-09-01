# Scene Renderer — Stage 2D

Stage 2D completes the Scene v2 renderer migration. Editor Preview, OBS, built-in themes, custom themes, and the portable workspace now share one native scene contract.

## Canonical data flow

- Editor reads `GET /api/scene/draft` plus `GET /api/settings`.
- Editor Preview renders its in-memory Scene v2 document.
- Apply sends Scene v2 to `POST /api/scene/publish`; the server creates matching Draft and Published revisions.
- OBS reads only `GET /api/scene/published` and reloads that snapshot after `configChanged`.
- Theme reads and writes use Scene v2. Global audio source selection remains in `data/settings.json`.
- OBS track time and progress share `PlaybackClock`: it interpolates between Windows Media samples, ignores stale rounded samples, and still accepts seek, pause, and resume transitions.
- Every equalizer component owns an `fftPreset`; one audio request is processed into the preset outputs required by the active scene.
- Group animation policy is explicit through `animations.overrideChildren`: disabled groups leave child animations independent; enabled groups provide the In/Out tracks for their descendants. Each descendant evaluates those inherited tracks against its own local timing window, so delayed objects still play the full animation instead of appearing abruptly. The group container remains neutral to avoid applying the same transform twice.
- Groups are structural and never paint pixels. Legacy group surfaces are materialized as ordinary bottom-layer Block components, so every visible shape is represented in Layers/Timeline.

Unsaved editor changes therefore remain local to Preview. Sharing the renderer does not share renderer state or automatically mutate OBS.

## Native geometry migration

Classic themes previously kept base coordinates and sizes in `musicOverlay.runtime.v1`. `SceneGeometryMaterializer` moves those values into each node's `transform` and `component.properties`, adds a `musicOverlay.geometry` marker, and removes the runtime extension. The migration is idempotent and preserves user offsets.

Run the physical document migration from `Project`:

```powershell
dotnet run --no-restore --project MusicOverlay.csproj -- --skip-update --migrate-stage2d
```

The command rewrites the bundled themes/default and normalizes Draft/Published. Existing `overlay/config.json` remains supported only as a one-time import source on an upgrade; it is not a runtime or editor API.

## Removed paths

- `overlay/app.js` and `overlay/style.css` (legacy OBS runtime)
- `overlay/shared/legacy-scene-adapter.js`
- hard-coded Full/Ticker Preview DOM and its fallback renderer/CSS
- active `/api/config` read/write routes
- OBS compatibility fetch and per-page geometry materialization

## Verification

```powershell
dotnet run --no-restore --project MusicOverlay.csproj -- --skip-update --verify-stage2a
dotnet run --no-restore --project MusicOverlay.csproj -- --skip-update --verify-stage2c
dotnet run --no-restore --project MusicOverlay.csproj -- --skip-update --verify-stage2d
```

Acceptance results on the completed workspace:

- 15 scenes / 203 nodes validated.
- 14 classic compositions use native geometry.
- `renderer-test.html`: `PASS · 17/17 scenes`.
- Editor: 14 rendered nodes, theme switching works, no console warnings/errors.
- OBS: 14 rendered nodes, zero unsupported nodes, Published-only, WebSocket connected.
- Apply increments the Published revision and refreshes OBS through WebSocket.
- Playback clock: 6/6 deterministic checks pass (advance, stale sample, forward correction, backward seek, pause, resume).
- Now Playing equalizer exposes all FFT presets; changing the object preset updates the shared renderer immediately.
- Group override on/off, inherited disabled controls, delayed-child local timing, and independent child animation restoration passed deterministic and browser interaction checks.

# Scene Renderer — Stage 2C

Stage 2C switches the OBS page to the shared Scene v2 renderer.

## Source isolation

- Editor Preview renders its in-memory Draft projection.
- OBS loads only `GET /api/scene/published`.
- Theme selection and editing cannot affect OBS before Apply publishes a new revision.
- A `configChanged` WebSocket message reloads Published Scene and restarts its timeline when a track is active.

## Runtime pipeline

`index.html` mounts `scene-runtime.js`; the legacy `app.js` and hard-coded Full/Ticker DOM are no longer loaded.

The runtime has four inputs:

1. Published Scene v2 for hierarchy, transforms, timing, effects and animations.
2. Published legacy projection only at the compatibility boundary for geometry absent from old themes.
3. `/api/nowplaying` for title, artist, cover, position, duration and playback state.
4. `/api/audiolevel` for process/system capture FFT bands.

All inputs meet in `SceneRenderer.setFrame()`, producing one render pass at up to 30 FPS. Audio and Now Playing polling are self-scheduled, so a slow request cannot create overlapping request chains.

## Timeline lifecycle

- A new track starts the composition once.
- A fixed final group leaves a clean frame after its end.
- A `trackEnd` group remains visible until the track changes.
- Pausing audio does not restart the composition.
- A brief missing media session is tolerated for 2.5 seconds without treating the same track as new.
- Publishing through WebSocket intentionally restarts the active composition.

## Legacy removal

`app.js` and `style.css` are retained on disk for rollback during the staged migration, but `index.html` does not load them. They can be removed after the 2C acceptance pass.

## Verification

Run from `Project`:

```powershell
dotnet run --no-restore --project MusicOverlay.csproj -- --skip-update --verify-stage2c
```

The verifier asserts that OBS is Published-only, Draft/Published remain separated, legacy runtime DOM is detached, live Now Playing/FFT/WebSocket inputs are connected, and all required runtime assets exist.

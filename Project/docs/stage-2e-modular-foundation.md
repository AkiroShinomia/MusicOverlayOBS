# Stage 2E — Modular Foundation implementation

Status: implemented in `Project` on 2026-08-31.

Stage 2E changes code ownership and dependency boundaries only. Scene schema, persisted files, endpoint URLs, transform/timing semantics and UI layout are unchanged.

## Frontend

`settings.js` is a seven-line compatibility entry point. `editor/bootstrap.js` is the composition root. Classic scripts register their public API under the single `window.MusicOverlay` namespace.

- `editor/core`: namespace, event bus, i18n/status primitives and shared legacy helpers.
- `editor/api`: the only editor code allowed to call `fetch` or create the editor WebSocket.
- `editor/inspector`, `canvas`, `library`, `timeline`, `themes`, `preview`: extracted feature controllers.
- `editor/persistence`: the single debounce scheduler contract for future Draft autosave.
- `editor/compat`: temporary state bridges required until Stage 2F.

The script order is explicit in `settings.html` and verified by `--verify-stage2e`. No bundler, native ESM or framework was introduced.

## Backend

`Program.cs` owns bootstrap, composition, route registration and lifecycle only.

- `Hosting/RouteMap.cs`: stable URL/method dispatch.
- `Hosting/StaticFileResponder.cs`: overlay/static responses and cache policy.
- `Hosting/WebSocketHub.cs`: connections and broadcasts.
- `Hosting/AppBootstrap.cs`: existing update workflow behind `IUpdateService`.
- `Endpoints`: scenes, themes, settings, live media/audio and system handlers.
- `Application/Abstractions`: current storage/audio/update boundaries.
- `Web`: shared JSON/text/error serialization.

Current algorithms remain in `PortableDataStore` and `AudioLevelService`; Stage 2E only makes their boundaries explicit.

## Temporary adapters owned by Stage 2F

1. `compat/legacy-editor-state.js`: owns `currentConfig`; its `value` property is an explicitly unsafe bridge for mechanically extracted controllers. Stage 2F replaces it with canonical `SceneStore` selectors and commands.
2. `compat/legacy-editor-runtime.js`: owns session-only selection, playback, theme and controller handles previously declared in the monolith. Stage 2F replaces it with `EditorSessionStore` and focused controller state.
3. `SceneEditorModel.toScene/fromScene`: remains the conversion boundary while the editor uses the legacy layout working model. It becomes import-only in Stage 2F.
4. Extracted classic-script functions retain their legacy names for behavioural compatibility. Their supported public entry points are the objects registered under `MusicOverlay`; Stage 2F removes direct cross-feature calls as each feature moves to Scene selectors/commands.

These adapters must not receive new product behaviour.

## Verification evidence

- Clean Release build: zero warnings and zero errors.
- Stage 1, 2A, 2C, 2D and 2E verifiers pass.
- API/static contract: version, themes, Draft, Published, settings, audiolevel, nowplaying, editor, runtime and module assets return HTTP 200.
- Invalid publish returns HTTP 400.
- Builtin theme delete remains protected.
- Browser smoke: editor and OBS runtime load without errors; theme switching, RU/EN, visibility and Undo work; Published SHA-256 remains unchanged before Apply.
- Baseline fixtures and checksums are stored in `tests/fixtures/stage-2e-baseline`.

## Gate 0 limitation

The active `Project/` directory is still reported as untracked by the top-level repository. The baseline, build command, fixtures and smoke checklist are now reproducible, but the Git portion of Gate 0 is not considered closed until the owner explicitly stages/commits the active source tree.

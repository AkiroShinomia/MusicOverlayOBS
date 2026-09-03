# Test commands

Run from `Project`.

## Build and architecture contracts

```powershell
dotnet build MusicOverlay.csproj -c Release --no-restore
dotnet run --no-build -c Release --project MusicOverlay.csproj -- --skip-update --verify-stage1
dotnet run --no-build -c Release --project MusicOverlay.csproj -- --skip-update --verify-stage2a
dotnet run --no-build -c Release --project MusicOverlay.csproj -- --skip-update --verify-stage2c
dotnet run --no-build -c Release --project MusicOverlay.csproj -- --skip-update --verify-stage2d
dotnet run --no-build -c Release --project MusicOverlay.csproj -- --skip-update --verify-stage2e
dotnet run --no-build -c Release --project MusicOverlay.csproj -- --skip-update --verify-stage2f
```

`--verify-stage2e` checks script order, file presence, API/fetch isolation, legacy state ownership, backend extraction and baseline Scene documents.

`--verify-stage2f` checks the canonical Scene Store contract, typed mutations, subtree duplication, parent-group validation, stable Scene hashing, Scene-only history, direct publish semantics, built-in ID centralization, compatibility-boundary isolation and Stage 2F characterization tests.

## Pure JavaScript characterization

The existing CommonJS tests cover the playback clock and animation inheritance:

```powershell
node tests/playback-clock.test.cjs
node tests/animation-inheritance.test.cjs
node tests/scene-store.test.cjs
node tests/editor-context.test.cjs
```

When Node is not on the system PATH, run these tests with the bundled workspace Node runtime used by Codex/CI.

## Manual browser smoke

1. Open `/settings.html` and confirm there are no console errors.
2. Select an object from Layers and change visibility; Undo must restore it.
3. Switch RU → EN → RU.
4. Switch Anime Pink → Cyberpunk → Anime Pink.
5. Confirm Draft editing does not change the Published file before Apply.
6. Open `/index.html`; the Published scene must render without editor handles or console errors.

The Stage 2E implementation run passed this checklist with 15 Timeline rows and 14 theme-select options.

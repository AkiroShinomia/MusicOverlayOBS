# MusicOverlay 2.1 — remaining architecture scope

## Stage 3 — Scene Renderer

- Scene tree, local transform and timing.
- Before implementation, agree on the object rotation model: Canvas rotation handles, angle units and limits, anchor/pivot behavior, optional snapping, and how parent-group rotation composes with child transforms.
- Persist rotation as part of each node's local transform in the Scene document/config, including Draft, Published, themes, undo/redo and migration of existing scenes. Preview and OBS must interpret the stored value identically.
- One renderer for Preview and OBS, with separate renderer instances and Draft/Published state.
- Editor handles live in `PreviewHost`, outside runtime scene markup.
- Remove special position maps and page-specific runtime markup.
- Verify visual parity between Preview and OBS.

## Stage 4 — Timeline and Animation Engine

- One timeline state and one time calculation path.
- In/Out, infinity and parent timing use the same rules.
- Composition completion does not restart automatically.
- All slide directions have one semantic for In and Out.

## Stage 5 — Component Registry and assets

The first task of this stage is to design the category and capability model before extending the UI:

- Every object has a stable Library category; the category selects the base Inspector schema.
- A component definition may enable, disable or make individual schema capabilities read-only.
- Unique composed objects can share a category and its common properties without pretending every property is supported. For example, CD disc and cassette objects may share a media-object schema while an assembled CD can explicitly disable color editing.
- Category, component kind and visual variant remain separate concepts so new objects do not require `if/else` branches in Inspector or Library.
- Inspector and Library are generated from registry schemas only after category/capability semantics are agreed and documented.
- Add PNG/JPG/GIF import; store assets as files and keep references in the scene.
- Reserve `compositionRef` for the future nested object/composition editor.

## Stage 6 — Editor and backend boundaries

- Frontend: store and commands/undo, canvas, Inspector, Library, Timeline, theme manager, shared renderer and data sources.
- Backend: paths/storage, migrations, themes/assets, media session, audio capture, spectrum analyzer, WebSocket/API and updater.

## Stage 7 — Audio and WebSocket optimization

- Batch audio buffers and calculate one base FFT.
- Limit spectrum WebSocket frequency.
- Event-driven metadata with slow polling fallback.
- Immediate process-to-system fallback.
- Compare CPU, memory and latency before and after.

## Stage 8 — cleanup and release

- Remove the legacy adapter and double model.
- Test clean install and update from 2.0.1.
- Test all system themes, arbitrary Canvas sizes and non-standard bar counts.
- Test damaged Draft recovery from backup.
- Update documentation and release 2.1.0.

# Scene Renderer — Stage 2B

Stage 2B mounts the shared `music-overlay.scene` schema version 2 renderer in the production editor Canvas/Preview.

## Runtime boundary

- Editor controls continue to edit the current legacy projection during this stage.
- `shared/legacy-scene-adapter.js` is the only compatibility boundary between that projection and Scene v2.
- `shared/scene-renderer.js` consumes Scene v2 only and contains no legacy object IDs or theme-specific layout rules.
- Unsaved editor changes are rendered from the in-memory Draft projection only. They are not sent to the OBS page.
- The existing Preview DOM remains as a hidden fallback and is not part of the active rendering path.

## Live update behavior

`SceneRenderer.updateScene()` patches an already mounted scene when its structural signature is unchanged. Transform, timing, visibility, effects, animation, component properties and track data therefore update without rebuilding the DOM. Adding, deleting, regrouping, changing component kind or changing sibling order intentionally performs a structural remount.

Editor-mode nodes expose stable `data-layer-id` and `data-group-id` attributes. Canvas selection, group bounds, dragging and resize controls use these semantic IDs rather than renderer-specific element names.

## Classic theme compatibility

The legacy two-stage themes stored their geometry in global runtime fields rather than in each node. The adapter materializes that geometry while producing Scene v2:

- Full Card and Ticker receive explicit canvas positions.
- Cover, disc, card surface, title, artist, time and progress receive local component geometry.
- Ticker surface and equalizer geometry are represented as group/component properties.
- User offsets and scale remain additive, so existing Inspector and Canvas editing continue to work.

This compatibility recipe is intentionally isolated and can be removed after bundled themes and user themes have native per-node geometry.

## Verification performed

- Production editor mounted all 13 bundled themes.
- No unsupported component kinds were produced.
- Classic theme components occupied distinct positions instead of collapsing to `(0, 0)`.
- Now Playing Rollout produced a blank frame after its fixed end.
- Classic themes switched from the fixed Full Card group to the infinite Ticker group.
- Canvas object dragging updated the Inspector and Ctrl+Z restored the previous scene.
- Browser console contained no warnings or errors.
- Stage 1 and Stage 2A automated verification remained green.

## Next stage

Stage 2C switches the OBS/Published page to the same shared Scene Renderer (completed; see `renderer-stage-2c.md`). The Published endpoint remains the only scene source for that mode, preserving Draft/Published isolation.

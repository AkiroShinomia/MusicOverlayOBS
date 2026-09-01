# Music Overlay OBS v2.1.0 — Development

## Renderer refactor progress

- Split the editor and backend monoliths into explicit Stage 2E modules without changing Scene, API or UI behaviour.
- Added editor API/state boundaries, endpoint handlers, static/WebSocket adapters and automated Stage 2E dependency verification.
- Converted legacy visual group surfaces into ordinary Block objects so every visible shape appears in Layers/Timeline and can be edited like a Library object.
- Unified Editor Preview and OBS on the native Scene v2 renderer while keeping Draft and Published snapshots isolated.
- Added explicit group animation ownership: groups can override every descendant animation, or leave child animations independent.
- Fixed zero-duration animation changes and added immediate In/Out audition in Preview.
- Added per-equalizer FFT presets, including the Now Playing waveform object.
- Added a monotonic playback clock so stale media-session samples cannot rewind time and progress.

## Прогресс рефакторинга renderer

- Монолиты редактора и backend разделены на модули Stage 2E без изменения Scene, API и поведения интерфейса.
- Добавлены границы editor API/state, endpoint handlers, static/WebSocket adapters и автоматическая проверка зависимостей Stage 2E.
- Визуальные поверхности групп перенесены в обычные объекты Block: теперь каждая видимая фигура присутствует в Layers/Timeline и редактируется как объект из Library.
- Preview редактора и OBS переведены на общий нативный Scene v2 renderer с раздельными Draft и Published.
- Добавлено явное управление анимациями группы: группа либо затирает анимации всех дочерних объектов, либо оставляет их независимыми.
- Исправлена смена анимации после `None` с длительностью 0 ms, добавлен мгновенный предпросмотр In/Out.
- Добавлены FFT-пресеты для каждого объекта-эквалайзера, включая waveform темы Now Playing.
- Добавлены монотонные часы воспроизведения без откатов времени и progress bar на устаревших данных media session.

---

# Music Overlay OBS v2.0.1

## Patch update

- Added timeline reconciliation so the next group or object reliably appears after a finite group ends, including throttled OBS browser sources.
- Added runtime/server version checks and disabled caching for editor and overlay scripts/styles.
- Fixed the live overlay applying legacy card movement on top of Timeline animations.
- Updated application and assembly version to 2.0.1.

## Патч 2.0.1

- Добавлена контрольная синхронизация Timeline: следующая группа или объект гарантированно появляется после завершения предыдущей, включая фоновые OBS Browser Source.
- Добавлена сверка версии страницы с программой и отключено кеширование скриптов/стилей редактора и оверлея.
- Исправлено одновременное применение старого смещения карточки и новой Timeline-анимации.
- Версия программы и сборки обновлена до 2.0.1.

---

# Music Overlay OBS v2.0.0

## Overlay Editor Update

Version 2.0.0 replaces the previous settings page with a visual composition editor while preserving the existing overlay/config model wherever possible.

### Added

- Added a four-zone Overlay Editor with Inspector, Canvas, Object Library, and Layers/Timeline.
- Added movable and resizable objects and groups on the Canvas.
- Added cursor-centered Canvas zoom, virtual camera panning, and persistent preview background color.
- Added resizable editor panels and persistent workspace dimensions.
- Added layer Z-order, visibility, locking, color markers, deletion, and `Ctrl+Z` history.
- Added groups with shared transforms, effects, animation, and parent timing boundaries.
- Added standalone timeline objects and drag-and-drop movement between groups and the root timeline.
- Added timeline snapping, draggable timing blocks and edges, a wider playhead grab area, and ruler seeking.
- Added configurable composition duration from 1 to 180 seconds.
- Added **Infinity recording** / until-next-track timing for groups and objects.
- Added separate In and Out animation sections with Slide Left/Right/Up/Down, Scale, Fade, and rollout animation.
- Added a drag-and-drop object library with blocks, artwork, vinyl/CD discs, custom text, track data, equalizers, tickers, animations, and effects.
- Added editable plain-text and Now Playing objects.
- Added Anime glossy CD and restored the Anime Pink built-in theme.
- Added the **Now Playing Rollout** theme.
- Added Russian and English editor languages.
- Added dynamic WebSocket state and live-cover information to Global Settings.
- Added the **Dynamic Bars (Musicvid)** FFT preset.

### Changed

- Renamed Blueprint Editor to **Overlay Editor**.
- Split object-specific Inspector controls from Global Settings.
- Moved theme selection, Apply, Save Theme, and connection status to the editor header.
- Built-in themes are now protected from deletion; custom themes remain manageable.
- Theme selection now loads immediately and Apply broadcasts the active configuration through WebSocket.
- Reworked theme loading to avoid duplicates and preserve layout compositions correctly.
- Rebuilt FFT analysis around an 8192-sample stereo window with calibrated logarithmic bands.
- Equalizer data now follows the selected process stream and exposes separate balanced, energy, and dynamic bar outputs.
- Updated every built-in theme and the default configuration to use Dynamic Bars.
- Track time is now displayed consistently as `elapsed / total`.
- Updated application and assembly version to 2.0.0.

### Fixed

- Fixed zoom origin and Canvas camera movement.
- Fixed object/group resizing and cover/disc rotation around the wrong transform origin.
- Fixed timeline playhead dragging, grabbing, shortening, group movement, snapping, and parent timing constraints.
- Fixed animation direction semantics for In and Out slide presets.
- Fixed finite compositions looping after their end.
- Fixed two-group layouts after live WebSocket configuration updates.
- Fixed theme switching after creating or saving a theme.
- Fixed duplicate themes and restored Anime Pink.
- Fixed system-theme deletion.
- Fixed dynamic equalizers not using live process FFT data.
- Fixed frequency localization, stereo phase cancellation, low/high-band distribution, and excessive FFT spectral spreading.
- Fixed false track restarts when Chromium temporarily reports playback position as zero.
- Fixed track time order and alignment in the overlay, ticker, dynamic objects, and editor preview.

### Technical

- Split editor behavior into Canvas, Timeline, and Workspace controllers.
- Added a versioned layout schema with legacy config normalization.
- Added process-capture diagnostics, source/PID reporting, and current-cover state.
- Added cache-versioned editor and overlay assets.
- Preserved the WebSocket live-update and OBS Lua autostart workflows from v1.4.2.

---

# Music Overlay OBS v2.0.0 — русский патчноут

## Обновление Overlay Editor

Версия 2.0.0 заменяет прежнюю страницу настроек визуальным редактором композиций, сохраняя совместимость со старым форматом конфигов и тем насколько это возможно.

### Добавлено

- Четырёхзонный редактор: Inspector, Canvas, библиотека объектов и Layers/Timeline.
- Свободное перемещение и изменение размеров объектов и групп.
- Масштабирование Canvas к курсору, перемещение виртуальной камеры и запоминание фонового цвета.
- Изменяемые размеры всех панелей редактора.
- Z-order, видимость, блокировка, цветовые маркеры, удаление и отмена через `Ctrl+Z`.
- Групповые преобразования, эффекты, анимации и ограничение времени дочерних объектов границами группы.
- Размещение объектов внутри групп и отдельно на общем Timeline.
- Привязка соседних блоков, перемещение и изменение границ тайминга.
- Длительность композиции от 1 до 180 секунд и режим **Infinity recording**.
- Раздельные In/Out-анимации: Slide Left/Right/Up/Down, Scale, Fade и rollout.
- Drag-and-drop библиотека блоков, обложек, пластинок/CD, текста, данных трека, эквалайзеров, тикеров, анимаций и эффектов.
- Обычный редактируемый текст, объект Now Playing, Anime glossy CD и тема Now Playing Rollout.
- Русский и английский языки интерфейса.
- Динамический статус WebSocket, источника звука и текущей обложки.
- Новый FFT-пресет **Dynamic Bars (Musicvid)**.

### Изменено

- Blueprint Editor переименован в **Overlay Editor**.
- Inspector отделён от Global Settings.
- Управление темами и статус подключения перенесены в верхнюю панель.
- Системные темы защищены от удаления.
- Выбор темы загружает её сразу, а Apply обновляет оверлей через WebSocket.
- FFT переведён на стереоанализ с окном 8192 сэмпла и калиброванными логарифмическими полосами.
- Все встроенные темы и основной конфиг переведены на Dynamic Bars.
- Время трека везде отображается как `прошло / общее время`.
- Версия программы и сборки обновлена до 2.0.0.

### Исправлено

- Исправлены zoom, перемещение Canvas, resize объектов и центр вращения обложек/дисков.
- Исправлены перетаскивание, захват, обрезка, привязка и ограничения блоков Timeline.
- Исправлены направления In/Out-анимаций.
- Исправлено зацикливание конечных композиций.
- Исправлена загрузка двух групп после обновления конфигурации через WebSocket.
- Исправлены переключение, дублирование и удаление тем; восстановлена Anime Pink.
- Исправлено подключение реального FFT к динамическим объектам эквалайзера.
- Исправлены локализация частот, стереофазовое подавление и чрезмерное размазывание спектра.
- Устранён ложный перезапуск анимации при временном сбросе позиции Chromium в ноль.
- Исправлены порядок и выравнивание времени во всех видах оверлея и предпросмотра.

### Для обновления

Распакуйте `MusicOverlayReady.zip` с заменой файлов. Если конфигурация переносится вручную, сохраните резервную копию папки `overlay` перед обновлением.

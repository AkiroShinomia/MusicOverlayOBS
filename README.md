# Music Overlay OBS 2.1

A Windows **Now Playing** overlay for OBS Studio with process-specific audio capture, a real FFT equalizer, themes, animations, and a visual composition editor.

[Русская версия](#русский) · [Releases](https://github.com/AkiroShinomia/MusicOverlayOBS/releases)

## Highlights

- Four-zone **Overlay Editor**: Inspector, Canvas, Object Library, and Layers/Timeline.
- Movable and resizable objects, groups, snapping, Z-order, visibility, locking, and color markers.
- Timeline timing, draggable edges, composition duration up to 180 seconds, and **Infinity recording** / until-next-track mode.
- Separate In/Out animations with slide, scale, fade, and rollout presets.
- Drag-and-drop library with blocks, artwork, vinyl/CD discs, custom text, track data, equalizers, tickers, animations, and effects.
- Process Loopback Capture for the application currently playing music, with system fallback and diagnostics.
- Accurate stereo FFT analysis and the new **Dynamic Bars (Musicvid)** preset.
- Built-in and custom themes with instant WebSocket updates.
- Russian and English editor interface, persistent workspace layout, and `Ctrl+Z` undo.

## Requirements

- Windows 10 or Windows 11
- OBS Studio with Browser Source support
- A media application exposed through Windows Media Session, such as Spotify or a Chromium browser

The downloadable release is self-contained and does not require a separate .NET installation.

## Installation

1. Download `MusicOverlayReady.zip` from the [latest release](https://github.com/AkiroShinomia/MusicOverlayOBS/releases/latest).
2. Extract the archive to a directory whose path contains only Latin characters when OBS autostart is required.
3. Run `MusicOverlay.exe`.
4. Add a Browser Source in OBS:

```text
URL: http://localhost:8799/
Width: 1920
Height: 1080
FPS: 60
```

5. Open the editor:

```text
http://localhost:8799/settings.html
```

## Overlay Editor

### Canvas

- Drag an object or group to change its position.
- Drag selection handles to resize an object without scaling the whole group.
- Pan the virtual camera by dragging an empty canvas area.
- Zoom toward the mouse cursor with the wheel.
- Choose a preview background color; the editor remembers it locally.

### Layers and Timeline

- Layers are rendered from top to bottom according to their Z-order.
- Objects may live inside a group or directly on the composition timeline.
- Groups define the maximum timing range of their child objects.
- Drag objects and groups between layers or into/out of groups.
- Drag either edge of a timeline block to shorten or extend it.
- Nearby timing boundaries snap together.
- Enable **Infinity recording** to keep an item visible until the next track.

### Inspector and Global Settings

- Inspector fields change according to the selected object type.
- Global Settings contains audio-source and composition-wide options.
- The source status, process name, PID, capture errors, and current cover update dynamically.

### Themes

- Selecting a theme loads it immediately.
- **Apply** updates the live overlay through WebSocket.
- Built-in themes are protected; custom themes can be created, overwritten, and deleted.
- The included **Now Playing Rollout** theme demonstrates grouped rollout animation and a compact waveform layout.

## Audio and Equalizer

Music Overlay detects the active Windows Media Session and captures the corresponding process audio stream. If process capture is unavailable, the configured fallback mode is used.

The API exposes capture diagnostics at:

```text
http://localhost:8799/api/audiolevel
```

Available FFT controls include sensitivity, smoothing, auto gain, output gain, spectral contrast, visual curve, and presets. Version 2.0 adds stereo FFT processing, improved logarithmic band separation, frequency calibration, and **Dynamic Bars (Musicvid)** for stronger local peaks and deeper spectral valleys.

## OBS Autostart

Keep these files together:

```text
MusicOverlay/
├── MusicOverlay.exe
├── obs-autostart.lua
└── overlay/
```

In OBS, open `Tools → Scripts`, add `obs-autostart.lua`, and restart OBS. Avoid Cyrillic or other non-ASCII characters in the installation path when using the Lua autostart script.

## Build from Source

Requirements: .NET SDK 8.0 or newer and Git.

```powershell
git clone https://github.com/AkiroShinomia/MusicOverlayOBS.git
cd MusicOverlayOBS\Project
dotnet restore
dotnet run
```

Create the large self-contained Windows build and place it directly in `Project`:

```powershell
.\build-project.ps1
```

The script intentionally disables single-file compression. The resulting `MusicOverlay.exe` is normally 170–190 MB and includes the .NET runtime, so users do not need to install .NET separately. A SHA-256 file is generated beside it.

Architecture and regression checks are documented in [tests/README.md](tests/README.md). The Stage 2E module split and its temporary Stage 2F adapters are documented in [docs/stage-2e-modular-foundation.md](docs/stage-2e-modular-foundation.md).

## Configuration

```text
data/settings.json                       Global application and audio settings
data/workspace/draft.scene.json          Editor workspace
data/workspace/published.scene.json      Configuration currently used by OBS
data/themes/custom/<theme-id>/            User-created theme packages
data/library/assets/                      Imported PNG, JPG, and GIF assets
overlay/default.scene.json                Bundled default composition
overlay/scenes/                           Shared built-in scene templates
overlay/themes/                           Built-in themes
```

Scene Document v2 stores a versioned node tree with local transforms, timing, effects, and separate In/Out animation tracks. Themes describe complete compositions and may reuse a shared scene template while overriding their visual appearance. Portable user data stays beside the executable in `data/` and is not overwritten by application updates.

On the first launch after upgrading, an existing `overlay/config.json` and legacy custom themes are imported once. The validated source config is then moved to `data/backups/migration/`; all subsequent writes use Scene v2 only.

Editor Preview and OBS use the same Scene Renderer but separate snapshots: Preview edits an in-memory Draft, while OBS reads only Published. Nothing changes in OBS until **Apply** publishes a new revision. See [Stage 2 architecture summary](docs/renderer-stage-2-summary.md).

## Русский

**Music Overlay OBS 2.1** — локальный Now Playing оверлей для OBS Studio с захватом звука конкретного процесса, настоящим FFT-эквалайзером, темами, анимациями и визуальным редактором композиций.

### Основные возможности

- Четырёхзонный **Overlay Editor**: Inspector, Canvas, библиотека объектов и Layers/Timeline.
- Свободное перемещение и изменение размера объектов и групп.
- Z-order, видимость, блокировка, цветовые маркеры и групповые преобразования.
- Timeline с привязкой соседних блоков, изменяемыми границами и длительностью композиции до 180 секунд.
- Режим **Infinity recording** — отображение объекта или группы до следующего трека.
- Отдельные In/Out-анимации: slide, scale, fade и rollout.
- Drag-and-drop библиотека блоков, обложек, пластинок/CD, текста, данных трека, эквалайзеров, тикеров, анимаций и эффектов.
- Захват звукового потока приложения, которое воспроизводит музыку, с системным fallback.
- Переработанный стерео FFT и пресет **Dynamic Bars (Musicvid)**.
- Мгновенное применение настроек через WebSocket.
- Русский и английский интерфейс, сохранение размеров панелей и отмена через `Ctrl+Z`.

### Системные требования

- Windows 10 или Windows 11.
- OBS Studio с поддержкой Browser Source.
- Приложение, которое передаёт данные в Windows Media Session: например, Spotify или браузер на Chromium.

Готовый релиз является автономным: отдельно устанавливать .NET не требуется.

### Установка

1. Скачайте `MusicOverlayReady.zip` из [последнего релиза](https://github.com/AkiroShinomia/MusicOverlayOBS/releases/latest).
2. Распакуйте архив в удобную папку. Если планируется автозапуск через OBS, используйте путь без кириллицы.
3. Запустите `MusicOverlay.exe`.
4. Добавьте новый Browser Source в OBS:

```text
URL: http://localhost:8799/
Ширина: 1920
Высота: 1080
FPS: 60
```

5. Откройте редактор в браузере:

```text
http://localhost:8799/settings.html
```

### Overlay Editor

#### Canvas и Preview

- Выберите объект или группу кликом по Preview либо в списке Layers.
- Перетаскивайте выбранный элемент мышью для изменения его положения.
- Используйте маркер выделения, чтобы менять размер отдельного объекта без масштабирования всей группы.
- Тяните пустую область Preview, чтобы перемещать виртуальную камеру.
- Вращайте колесо мыши для масштабирования относительно положения курсора.
- Цвет фона Preview можно изменить в верхней панели; выбранное значение сохраняется локально.

#### Layers и Timeline

- Слои отображаются сверху вниз в соответствии с Z-order: верхняя строка рисуется поверх нижних.
- Объекты могут находиться внутри группы или непосредственно на общем Timeline.
- Граница группы ограничивает максимальное время всех вложенных объектов.
- Объекты и группы можно перетаскивать между слоями, помещать в группы и извлекать обратно.
- Перетаскивание самого блока изменяет его положение по времени.
- Перетаскивание левого или правого края изменяет начало либо окончание тайминга.
- Близкие временные границы автоматически примагничиваются друг к другу.
- Красную стрелку воспроизведения можно захватывать расширенной областью или перемещать кликом по шкале времени.
- Длина композиции настраивается от 1 до 180 секунд.
- Флажок **Infinity recording** отключает поле окончания и оставляет элемент видимым до следующего трека.

#### Inspector

Inspector показывает только свойства выбранного элемента. Набор параметров зависит от типа объекта:

- у текста доступны содержимое, привязка к названию/артисту, шрифт, цвет и размеры;
- у обложки и диска — положение, размер, форма, стиль и визуальные параметры;
- у эквалайзера — количество полос, высота, расстояние, стиль и настройки FFT;
- у группы — общие координаты, эффекты, анимации и тайминг вложенной композиции.

Блок настроек объекта расположен первым, а разделы анимации разделены на **In** и **Out** с отдельными длительностью и easing.

#### Global Settings

В Global Settings находятся параметры, которые относятся ко всему оверлею:

- режим источника звука: Auto, Process или System;
- текущее приложение-источник и PID;
- фактический режим захвата и сообщение об ошибке;
- текущая обложка трека;
- общие настройки цветов, размеров, темы, частиц и эквалайзера.

Статус источника и обложка обновляются автоматически.

#### Библиотека объектов

Объект из библиотеки можно перетащить на общий Timeline или непосредственно внутрь группы. Доступны:

- блоки и базовые примитивы;
- квадратные и скруглённые обложки;
- виниловые пластинки, CD и Anime glossy CD;
- обычный текст, Now Playing, название трека и исполнитель;
- текущее/общее время и прогресс трека;
- несколько вариантов эквалайзеров и waveform;
- компактные тикеры;
- In/Out-анимации;
- эффекты Blur и Glow.

Анимации и эффекты перетаскиваются на конкретный объект или группу и затем редактируются через Inspector.

#### Темы

- Выбор темы в верхней панели сразу загружает её в редактор.
- Кнопка **Применить** отправляет конфигурацию в рабочий оверлей через WebSocket.
- Встроенные темы защищены от удаления.
- Пользовательскую тему можно сохранить как новую, перезаписать или удалить.
- В комплект входит тема **Now Playing Rollout** с выезжающей обложкой, текстом и компактным waveform-эквалайзером.
- Старая тема **Anime Pink** сохранена и использует Anime glossy CD.

### Захват звука и FFT

Music Overlay получает данные активной Windows Media Session и пытается захватить звуковой поток именно того процесса, который воспроизводит музыку. Это позволяет эквалайзеру не реагировать на Discord, игру и остальные системные звуки. Если захват процесса недоступен, используется настроенный fallback-режим.

Диагностика доступна через API:

```text
http://localhost:8799/api/audiolevel
```

Ответ содержит выбранный режим, фактический режим захвата, приложение, PID, ошибку и массивы FFT-полос.

В версии 2.0 FFT переведён на стереоанализ с окном 8192 сэмпла, логарифмическим распределением частот и защитой от взаимного подавления каналов. Доступны sensitivity, smoothing, auto gain, output gain, spectral contrast, visual curve и набор FFT-пресетов. Новый **Dynamic Bars (Musicvid)** сохраняет локальные пики и более глубокие провалы между частотными диапазонами.

### Автозапуск вместе с OBS

Файлы должны находиться рядом:

```text
MusicOverlay/
├── MusicOverlay.exe
├── obs-autostart.lua
└── overlay/
```

1. Откройте в OBS меню `Инструменты → Скрипты` (`Tools → Scripts`).
2. Нажмите `+` и выберите `obs-autostart.lua`.
3. Перезапустите OBS.

Из-за ограничений OBS Lua путь к программе может не работать при наличии кириллицы и других не-ASCII символов. Рекомендуемые варианты:

```text
C:\MusicOverlay\
C:\Tools\MusicOverlay\
D:\Applications\MusicOverlay\
```

### Сборка из исходного кода

Для разработки требуются .NET SDK 8.0 или новее и Git:

```powershell
git clone https://github.com/AkiroShinomia/MusicOverlayOBS.git
cd MusicOverlayOBS\Project
dotnet restore
dotnet run
```

Большая автономная Windows-сборка с размещением EXE прямо в `Project`:

```powershell
.\build-project.ps1
```

Скрипт намеренно отключает сжатие single-file. Получившийся `MusicOverlay.exe` обычно занимает 170–190 МБ и уже содержит .NET runtime, поэтому пользователю не требуется отдельно устанавливать .NET. Рядом создаётся файл SHA-256.

### Конфигурация и темы

```text
data/settings.json                       Глобальные настройки программы и аудио
data/workspace/draft.scene.json          Черновик редактора
data/workspace/published.scene.json      Композиция, которую использует OBS
data/themes/custom/<theme-id>/            Пользовательские пакеты тем
data/library/assets/                      Импортированные PNG, JPG и GIF
overlay/default.scene.json                Встроенная композиция по умолчанию
overlay/scenes/                           Общие шаблоны встроенных композиций
overlay/themes/                           Встроенные темы
```

Scene Document v2 хранит версионируемое дерево объектов с локальными transform, timing, эффектами и раздельными In/Out-анимациями. Тема описывает полную композицию, но может переиспользовать общий scene-template и хранить только собственные визуальные отличия. Portable-данные находятся рядом с EXE в папке `data/` и не перезаписываются обновлениями программы.

При первом запуске после обновления существующие `overlay/config.json` и старые пользовательские темы импортируются один раз. После проверки исходный config переносится в `data/backups/migration/`, а дальнейшая запись идёт только в Scene v2.

Editor Preview и OBS используют один Scene Renderer, но разные снимки сцены: Preview редактирует Draft в памяти, а OBS читает только Published. До нажатия **«Применить»** изменения в OBS не попадают. Подробности — в [итогах второго этапа](docs/renderer-stage-2-summary.md).

## История релизов

Подробный список изменений находится в [CHANGELOG.md](CHANGELOG.md) и на странице [GitHub Releases](https://github.com/AkiroShinomia/MusicOverlayOBS/releases).

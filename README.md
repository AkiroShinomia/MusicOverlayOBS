# Music Overlay OBS 2.0

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
cd MusicOverlayOBS
dotnet restore
dotnet run
```

Create the self-contained Windows release:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true `
  /p:PublishSingleFile=true `
  /p:IncludeNativeLibrariesForSelfExtract=true `
  /p:EnableCompressionInSingleFile=true `
  /p:DebugType=None `
  /p:DebugSymbols=false `
  -o publish
```

## Configuration

```text
overlay/config.json          Current configuration
overlay/themes/              Built-in themes
overlay/themes/custom/       User-created themes
```

The 2.0 layout schema extends the previous theme/config format. Legacy settings are still read where possible and converted into the default composition model by the editor.

## Русский

**Music Overlay OBS 2.0** — локальный Now Playing оверлей для OBS Studio с захватом звука конкретного процесса, настоящим FFT-эквалайзером, темами, анимациями и визуальным редактором композиций.

### Главное в версии 2.0

- Четырёхзонный **Overlay Editor**: Inspector, Canvas, библиотека объектов и Layers/Timeline.
- Свободное перемещение и изменение размера объектов и групп.
- Z-order, видимость, блокировка, цветовые маркеры и групповые преобразования.
- Timeline с привязкой соседних блоков, изменением границ и длительностью композиции до 180 секунд.
- Режим **Infinity recording** — отображение до следующего трека.
- Отдельные In/Out-анимации: slide, scale, fade и rollout.
- Drag-and-drop библиотека блоков, обложек, пластинок/CD, текста, данных трека, эквалайзеров, тикеров, анимаций и эффектов.
- Захват звукового потока приложения, которое воспроизводит музыку, с системным fallback.
- Переработанный стерео FFT и пресет **Dynamic Bars (Musicvid)**.
- Мгновенное применение настроек через WebSocket.
- Русский и английский интерфейс, сохранение размеров панелей и отмена через `Ctrl+Z`.

### Быстрый старт

1. Скачайте `MusicOverlayReady.zip` из [последнего релиза](https://github.com/AkiroShinomia/MusicOverlayOBS/releases/latest).
2. Распакуйте архив и запустите `MusicOverlay.exe`.
3. Добавьте в OBS Browser Source с адресом `http://localhost:8799/`, размером 1920×1080 и частотой 60 FPS.
4. Откройте редактор: `http://localhost:8799/settings.html`.

Для автозапуска через OBS добавьте `obs-autostart.lua` в `Tools → Scripts`. Путь к программе рекомендуется указывать без кириллицы.

### Управление редактором

- Колесо мыши масштабирует Canvas относительно курсора.
- Перетаскивание пустой области двигает виртуальную камеру.
- Объекты и группы можно перемещать и изменять по размеру.
- Границы блоков на Timeline меняют время начала и окончания.
- Объекты можно переносить между группами и размещать отдельно на Timeline.
- Клик по шкале времени перемещает курсор; красную стрелку можно захватывать расширенной областью.
- Все раскрывающиеся разделы изначально закрыты, чтобы не перегружать интерфейс.

### Сборка

Для разработки нужен .NET SDK 8.0 или новее:

```powershell
dotnet restore
dotnet run
```

Команда публикации приведена в английском разделе выше.

## Release history

See [CHANGELOG.md](CHANGELOG.md) and the [GitHub Releases page](https://github.com/AkiroShinomia/MusicOverlayOBS/releases).

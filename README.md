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
cd MusicOverlayOBS
dotnet restore
dotnet run
```

Автономная Windows-сборка:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true `
  /p:PublishSingleFile=true `
  /p:IncludeNativeLibrariesForSelfExtract=true `
  /p:EnableCompressionInSingleFile=true `
  /p:DebugType=None `
  /p:DebugSymbols=false `
  -o publish
```

Готовый `MusicOverlay.exe` появится в папке `publish`.

### Конфигурация и темы

```text
overlay/config.json          Текущая конфигурация
overlay/themes/              Встроенные темы
overlay/themes/custom/       Пользовательские темы
```

Схема layout версии 2.0 расширяет старый формат конфигурации. Прежние параметры по возможности продолжают читаться и преобразуются редактором в стандартную композицию.

## История релизов

Подробный список изменений находится в [CHANGELOG.md](CHANGELOG.md) и на странице [GitHub Releases](https://github.com/AkiroShinomia/MusicOverlayOBS/releases).

# Целевая архитектура 2.1

## Архитектурная цель

Система должна иметь одну модель композиции и несколько независимых способов с ней работать:

- редактор изменяет Scene командами;
- Preview показывает Draft через общий renderer;
- OBS показывает Published через тот же renderer;
- backend хранит и проверяет документы, но не содержит UI-правил;
- live-данные о треке и аудио поступают отдельным потоком и не записываются в Scene.

## Общая схема

```text
                              +----------------------+
                              | Global Settings      |
                              +----------+-----------+
                                         |
Editor UI -> Commands -> Scene Store -> Scene snapshot
    |                       |                  |
    +-> Editor Session -----+                  v
                                      Shared Renderer <--- Component Registry
                                         ^       ^
                                         |       |
                                  PreviewHost   ObsHost
                                         |       |
                                      demo/live  Published + live media/audio

HTTP/WS -> Application Services -> Domain validation -> Repositories -> portable data
```

Ни Inspector, ни Canvas, ни Timeline не владеют своей копией композиции. Они читают проекции Scene Store и отправляют команды.

## Основные архитектурные принципы

### Один источник состояния композиции

В памяти редактора хранится один `SceneDocument`. `currentConfig`, отдельные массивы layout и специальные state-объекты не являются вторым источником истины.

Legacy-форматы разрешены только на границе импорта:

```text
legacy input -> migrator -> validated Scene -> остальная программа
```

Обратного постоянного преобразования Scene в legacy layout нет.

### Общий renderer, разные host-окружения

Shared Renderer отвечает только за видимую сцену. Он не знает о выделении, resize handles, API endpoints, polling и OBS.

PreviewHost отвечает за:

- камеру и zoom редактора;
- рамку выделения и handles;
- hit testing;
- подстановку demo или live data;
- playhead и режим предпросмотра.

ObsHost отвечает за:

- загрузку Published;
- подключение метаданных трека и audio frames;
- реакцию на `configChanged`;
- прозрачный фон и runtime lifecycle.

Оба host передают renderer-у одинаковые `SceneDocument`, `FrameState` и `LiveMediaState`.

### Направленные зависимости

- UI зависит от application-команд и selectors.
- Application зависит от domain-контрактов.
- Infrastructure реализует нужные application-интерфейсы.
- Domain не зависит от HTTP, файловой системы, DOM и OBS.
- Shared Renderer зависит от Scene-контракта, Registry и Timeline Evaluator, но не от Editor UI и backend.
- Компоненты не обращаются друг к другу напрямую.

Циклическая зависимость является дефектом архитектуры и не принимается как временное решение без ADR.

## Целевая структура репозитория

Top-level Git-репозиторий остаётся источником истины. `Project/` может оставаться обычной отслеживаемой папкой приложения, но не становится отдельным репозиторием.

Рекомендуемое логическое разбиение:

```text
Project/
  Program.cs                    # только bootstrap/composition root
  Domain/
    Scenes/
    Themes/
    Assets/
    Media/
  Application/
    Scenes/
    Themes/
    Assets/
    Settings/
    Media/
  Infrastructure/
    Storage/
    Audio/
    MediaSessions/
    Updates/
  Contracts/
    Dtos/
    Validation/
    Migration/
  overlay/
    shared/
      scene/
      renderer/
      timeline/
      components/
    editor/
      app/
      state/
      commands/
      inspector/
      canvas/
      library/
      timeline/
      themes/
      api/
    runtime/
    schemas/
  Tests/
    Unit/
    Contract/
    Migration/
    Integration/
    Visual/
docs/
  architecture/
main/                           # read-only reference 2.0.1, не build input
```

Физическое перемещение всех файлов не выполняется одним коммитом. Сначала создаются границы и characterization tests, затем код переносится небольшими проверяемыми шагами.

## Frontend

### Composition root

`editor/app/bootstrap` создаёт Store, Command Bus, History, API client, PreviewHost и UI controllers. Это единственное место, где допустимо связывать конкретные реализации.

### Scene Store

Scene Store:

- хранит канонический SceneDocument;
- применяет только валидные команды;
- увеличивает локальную ревизию;
- создаёт immutable snapshot для подписчиков;
- не содержит DOM и сетевые вызовы;
- не сохраняет сам себя на диск.

### Commands и history

Каждое пользовательское изменение описывается командой: `MoveNode`, `ResizeNode`, `ReparentNode`, `SetProperty`, `AddNode`, `RemoveSubtree`, `ReorderNode`, `SetTiming`, `ApplyTheme`.

Drag генерирует много preview-изменений, но фиксируется в history как одна команда от начального к конечному состоянию. Несколько логически связанных действий оформляются compound command.

### Selectors

Selectors вычисляют:

- выделенный node;
- детей и предков;
- плоский список строк Timeline;
- world transform;
- effective timing;
- доступные Inspector-поля;
- наличие несохранённых изменений.

UI не должен повторно реализовывать эти вычисления.

### Component Registry

Для каждого `component.kind` Registry хранит:

- стабильный идентификатор;
- отображаемое имя и категорию Library;
- default properties;
- JSON schema properties;
- capabilities: resize, rotate, bindable, audio-reactive и другие;
- Inspector field definitions;
- geometry resolver;
- renderer factory/update adapter;
- migrator версии properties.

Категория не записывается в Scene: объект может быть перенесён в другую категорию Library без миграции пользовательских файлов.

### Совместимость браузера

В 2E код разделяется на отдельные classic-script файлы с одним контролируемым namespace и явным порядком загрузки. Это не мешает тестированию и изоляции модулей.

Переход на native ES modules допускается отдельным ADR после проверки минимально поддерживаемого OBS. Bundler не вводится без измеримой необходимости.

## Backend

### Program.cs

После рефакторинга `Program.cs` должен:

- разобрать параметры запуска;
- создать каталоги и конфигурацию;
- зарегистрировать сервисы;
- настроить HTTP/WS routes;
- запустить host;
- корректно остановить сервисы.

Он не должен содержать бизнес-правила тем, JSON-миграцию, FFT-математику и большие обработчики endpoints.

### Application services

- `SceneService` — Draft, Published, validation, apply.
- `ThemeService` — список, загрузка, копирование, сохранение и удаление тем.
- `AssetService` — импорт, metadata, чтение, references и безопасное удаление.
- `SettingsService` — глобальные настройки.
- `MediaSessionService` — текущее название, исполнитель, прогресс и обложка.
- `AudioFrameService` — актуальный нормализованный audio frame.
- `UpdateService` — проверка и применение обновления с сохранением portable data.

### Infrastructure

- JSON repositories ничего не знают о HTTP.
- Atomic writer ничего не знает о Scene.
- Audio capture implementations ничего не знают о renderer.
- WebSocket broadcaster получает готовые domain events.
- Все пути строятся через `AppPaths` и проверяются на выход за разрешённый корень.

## Хранилище

```text
data/
  settings.json
  workspace/
    draft.scene.json
    published.scene.json
  themes/
    builtin/        # поставляется приложением или читается из ресурсов
    custom/
  assets/
    objects/
    catalog.json
  backups/
    automatic/
```

Требуется атомарность отдельного конечного файла, а не общая транзакция settings + Draft + Published. `Применить` сначала полностью валидирует и сериализует новую Scene во временный файл, затем атомарно заменяет только Published и после успеха отправляет WS-событие.

## Ошибки и восстановление

- Domain validation возвращает список ошибок с кодом и путём до поля.
- API использует единый JSON error envelope.
- Неизвестный компонент сохраняется в редакторе как placeholder без потери исходных properties; публикация блокируется понятной ошибкой.
- Повреждённый Draft переносится в quarantine, затем восстанавливается последний валидный automatic backup. Если backup нет, создаётся стартовый Draft, а пользователь получает предупреждение.
- Повреждённый Published не заменяется Draft автоматически. OBS получает последний валидный backup либо безопасную пустую сцену и диагностическое сообщение в приложении.

## Безопасность локального web-host

- Static file handler обязан нормализовать путь и проверять, что итоговый путь остаётся внутри overlay/assets root.
- Asset API выдаёт только известные catalog entries, а не произвольный путь файловой системы.
- Идентификаторы не используются как путь без нормализации.
- JSON имеет лимиты размера, количества nodes, глубины дерева и длины строк.
- Пользовательские HTML и JavaScript не являются допустимым component content в 2.1.

## Наблюдаемость

Минимальные диагностические события:

- startup version и data root;
- результат миграции каждого документа;
- recovery из backup;
- Draft save и Published apply с revision;
- смена media/audio source;
- WS clients connect/disconnect;
- ошибки renderer неизвестного kind;
- усреднённые audio processing time и dropped frames в debug-режиме.

Логи не должны включать полный base64 assets или полный Scene без явного debug-флага.

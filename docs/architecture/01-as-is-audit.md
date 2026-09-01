# AS-IS-аудит

## Статус и ограничения аудита

Аудит выполнен 2026-08-31 без изменения файлов.

Проверены:

- Git worktree, находящийся на теге `v2.0.1`;
- рабочая копия с папками `Project/`, `main/` и `backups/`;
- C# backend, HTML/CSS/JavaScript редактора и runtime;
- JSON-схемы, portable data, темы, Draft/Published;
- собранные EXE и контрольные суммы;
- существующие verifier- и Node-тесты.

Node.js не был доступен в PATH, поэтому Node-тесты в рамках аудита не запускались. EXE не запускался, потому что startup может нормализовать и перезаписать portable data. Выводы о поведении, не подтверждённые запуском, помечаются как вывод из кода.

## Состояние репозитория

- Git-история подтверждает релизы только до `v2.0.1`, commit `7a74f9e`.
- Код 2.1 в `Project/` не добавлен в Git.
- Старые отслеживаемые файлы в исходной рабочей копии отмечены как удалённые.
- `main/` и `backups/` игнорируются Git.
- `main/SOURCE_COMMIT.txt` указывает на `7a74f9e`.
- Собранный `Project/MusicOverlayOBS.exe` имеет file version `2.1.0.0`; его SHA-256 совпадает с сопроводительным checksum-файлом.

Следствие: текущий `Project/` нельзя считать воспроизводимым релизным исходником, пока его состояние не перенесено под обычный Git-контроль.

## Наблюдаемая структура 2.1

Backend в основном сосредоточен в:

- `Project/Program.cs` — bootstrap, HTTP/WS endpoints, static files, update flow;
- `Project/Core/PortableDataStore.cs` — settings, Draft/Published, themes и нормализация;
- `Project/Core/SceneDocumentConverter.cs` — Scene v2, legacy-конвертация и базовая валидация;
- `Project/Core/AudioLevelService.cs` и `FftProcessor.cs` — выбор источника, fallback и FFT.

Frontend в основном сосредоточен в:

- `Project/overlay/settings.js` — состояние, UI, Canvas, Timeline, темы, Preview и API;
- `scene-editor-model.js` — переход Scene v2 ↔ legacy-подобная layout-модель;
- `scene-renderer.js`, `layer-renderer.js`, `scene-order.js` — общий renderer;
- `scene-timeline.js` — вычисление времени кадра;
- `component-registry.js` — создание DOM для известных типов компонентов;
- `scene-runtime.js` — Published runtime и подключение live-данных.

## Что уже реализовано

| Область | Подтверждённое состояние |
|---|---|
| Portable data | Settings, Workspace, Themes, Assets, Compositions и Backups имеют каталоги рядом с EXE |
| Atomic JSON | Отдельный JSON записывается через временный файл и replace |
| Draft/Published | Есть раздельные endpoints загрузки, сохранения и применения |
| OBS isolation | Runtime загружает Published, но не Draft |
| Preview | Редактор загружает Draft и отправляет Scene v2 в Preview |
| Shared Renderer | Preview и OBS создают отдельные экземпляры одного renderer-кода |
| Scene graph | Renderer рекурсивно строит вложенные группы и компоненты |
| Timing | Shared evaluator поддерживает local start, fixed/parentEnd/trackEnd и clipping родителем |
| Z-order | Меньший `order` считается визуально верхним |
| Visual group | Фон визуальной группы материализуется как обычный block-компонент |
| Undo/redo | Есть история полных JSON-снимков, лимит и debounce |
| Themes | Встроенные и пользовательские темы загружаются и сохраняются |
| Audio | Есть process/system/auto, временный fallback и FFT bands |
| WS | Есть уведомления `configChanged` и `themesChanged` |

## Главная архитектурная проблема

Внешний контракт редактора уже называется Scene v2, но внутренним источником состояния остаётся `currentConfig` с моделью `layout.groups` и `layout.layers`.

Текущий поток выглядит так:

```text
Draft Scene v2
    -> SceneEditorModel.fromScene()
    -> currentConfig/layout
    -> множество прямых изменений UI
    -> SceneEditorModel.toScene()
    -> Preview или Published Scene v2
```

Это создаёт два представления одной композиции. Новое поле может сохраниться в Scene, но исчезнуть при проходе через legacy-проекцию. Специальные проверки ID `full-card-group`, `ticker-*` дополнительно связывают общую модель с конкретной стандартной темой.

## Расхождения между заявленным и фактическим поведением

### Вложенные группы

Renderer умеет отображать дерево любой глубины. Редактор отображает группы в Timeline плоско, работает преимущественно с непосредственными слоями и не реализует полноценный reparent. Удаление группы и временные ограничения не гарантируют корректную обработку всех вложенных потомков.

Вывод: arbitrary nesting реализован как runtime-возможность, но не как завершённая продуктовая функция.

### Transform

Scene v2 содержит `x`, `y`, `scaleX`, `scaleY`, `rotation`, `anchorX`, `anchorY`. Renderer применяет их. Inspector и Canvas редактируют только X, Y и единый Scale; resize использует одну ручку, rotation UI отсутствует. Legacy-конвертация теряет часть transform-данных.

### Timeline

Runtime использует `scene-timeline.js` и локальное время относительно родителя. Редактор имеет отдельную систему абсолютных start/end и отдельные ограничения drag/resize. Одинаковая сцена может интерпретироваться двумя алгоритмами.

### Component Registry

Registry регистрирует фабрику DOM по `kind`. Категории Library, доступные настройки Inspector, значения по умолчанию и capabilities хранятся в других местах и частично hardcoded.

### Assets

Backend создаёт каталог Assets, но импорт изображения читает файл как base64, хранит его в `localStorage`, а затем встраивает data URL в Scene. Это ограничено квотой браузера, раздувает JSON и дублирует одно изображение между темами.

### Themes

В комплекте найдено 13 тем: одна использует `music-overlay.theme` с `ref + overrides`, остальные являются полными `music-overlay.scene`. Схема и реальные данные не задают один устойчивый контракт.

### Validation

JSON Schema-файлы присутствуют, но полная проверка по ним в рабочих путях не выполняется. C# проверяет версию, ID, отсутствующих родителей и циклы, но не все обязательные поля, типы, диапазоны, order, timing и component props. Схемы оставляют много `additionalProperties: true`, а transform-поля не имеют типов.

### Publish

Settings, Draft и Published записываются последовательно. Atomic writer защищает каждый файл отдельно, но не всю последовательность. История Published отсутствует, что соответствует продуктовым требованиям; при этом предыдущий Published должен оставаться пригодным, если новая сцена не прошла проверку или запись.

### Recovery

Backup-файлы создаются, но автоматический сценарий запуска при повреждённом Draft не подтверждён. Чтение повреждённого текущего файла может сорвать startup до выбора backup.

### Live transport

WS используется как уведомление об изменении конфигурации и тем. Метаданные в OBS опрашиваются примерно каждые 750 мс, audiolevel — примерно каждые 50 мс. Настройка `preview.syncWithWebSocket` хранится, но не управляет фактическим поведением.

### Audio

System capture запускается при старте. Process capture может работать параллельно; при его активности system FFT игнорируется как fallback. Источник пересматривается во время запросов `/api/audiolevel`, а не по событию. Один FFT processor и общие поля состояния обслуживают несколько путей захвата.

Измерений CPU, RAM, end-to-end latency и frame time не найдено. `Замеры.txt` содержит преимущественно спектральные ответы на тестовые частоты и не является performance baseline.

### Canvas

Scene хранит произвольные размеры, но editor controller и runtime CSS ориентированы на 1920×1080. `scaleMode` сохраняется, однако его полное применение renderer-ом не подтверждено.

## Состояние тестов

Имеются:

- два Node-теста shared-модулей;
- четыре C# verifier-набора;
- проверки наличия отдельных строк и файлов в исходниках.

Не хватает:

- фиксации поведения legacy 2.0.1;
- round-trip Scene без потери данных;
- глубоких деревьев групп;
- parity Preview/OBS;
- миграционных fixture;
- отказов записи и повреждённых JSON;
- пользовательских сценариев тем;
- измерений производительности;
- длительного аудио-теста с переключением источников.

## Итог AS-IS

2.1 уже содержит полезный фундамент: Scene v2, Draft/Published и общий renderer. Главный риск — продолжить наращивать функции поверх двойной модели редактора и нескольких независимых алгоритмов. Без промежуточных этапов 2E и 2F Stage 3–5 увеличат монолит и стоимость каждой следующей доработки.

# ТЗ Stage 2E — Modular Foundation

Статус: готово к декомпозиции на задачи после Gate 0.

## 1. Цель

Без изменения поведения разделить frontend- и backend-монолиты на модули с явными обязанностями и зависимостями. Подготовить код к переходу на каноническую Scene-модель в Stage 2F.

Продуктовый результат: приложение выглядит и работает так же, но каждую следующую функцию можно менять в ограниченной части кода.

## 2. Prerequisites

- Gate 0 закрыт.
- Активные исходники 2.1 находятся под Git-контролем top-level репозитория.
- Документирована команда build.
- Сохранены baseline Draft, Published, минимум три темы и legacy 2.0.1 config fixture.
- Выполнен и записан baseline smoke-checklist.

## 3. Scope

### Frontend

- Ввести один composition root редактора.
- Создать единый namespace `MusicOverlay` согласно ADR-0005.
- Выделить API client, event bus, i18n, UI status и persistence scheduler.
- Выделить controllers Inspector, Canvas, Library, Layers/Timeline, Themes и Preview sync.
- Изолировать `currentConfig` и legacy converters в `compat/legacy-editor-state`.
- Перенести чистые функции order, geometry helpers, timing formatting и validation helpers в отдельно тестируемые модули.
- Устранить прямое обращение одного controller к приватным DOM/state полям другого.
- Сохранить существующий shared renderer без изменения semantics.

### Backend

- Оставить в `Program.cs` bootstrap, DI/composition, route registration и lifecycle.
- Выделить endpoint handlers по областям scenes, themes, settings, media/audio и system/update.
- Выделить static file responder и WebSocket connection/broadcast adapter.
- Обернуть текущие storage/audio/update implementations в интерфейсы, не переписывая алгоритмы.
- Централизовать API response/error serialization.
- Сохранить текущие endpoint URL и payload.

### Tests и инструменты

- Добавить characterization tests текущих contracts.
- Добавить browser smoke harness либо эквивалентный автоматизируемый DOM harness.
- Добавить dependency rules и test на неожиданные globals.
- Документировать команды test по категориям.

## 4. Non-goals

- Не менять JSON schema или формат существующих файлов.
- Не удалять legacy layout-модель.
- Не вводить Scene Store из Stage 2F.
- Не менять внешний вид, размеры зон и тексты интерфейса, кроме исправления явной регрессии этапа.
- Не менять transform/timing/animation semantics.
- Не добавлять новые components, assets, WS audio или FFT-оптимизации.
- Не вводить native ESM, bundler или frontend framework.
- Не проводить массовое переименование пользовательских сущностей.

## 5. Целевая frontend-структура этапа

Имена могут уточняться без изменения обязанностей:

```text
overlay/editor/
  bootstrap.js
  core/
    namespace.js
    event-bus.js
    ui-status.js
    i18n.js
  compat/
    legacy-editor-state.js
    legacy-scene-adapter.js
  api/
    api-client.js
    scene-api.js
    theme-api.js
    live-api.js
  inspector/
    inspector-controller.js
  canvas/
    canvas-controller.js
  library/
    library-controller.js
  timeline/
    timeline-controller.js
  themes/
    theme-controller.js
  preview/
    preview-sync-controller.js
  persistence/
    draft-save-scheduler.js
  history/
    snapshot-history.js
```

### Public API модулей

Каждый модуль регистрирует один объект в `MusicOverlay.<area>` и экспортирует только функции, необходимые composition root или явно указанному потребителю.

Запрещено:

- создавать новый global вне `MusicOverlay`;
- читать `currentConfig` вне compat/state-модуля;
- использовать DOM query для управления чужой зоной;
- вызывать `fetch` вне API-модулей;
- записывать Draft из UI controller напрямую;
- копировать transform/timing формулы.

### LegacyEditorState

На этом этапе он является временным фасадом над `currentConfig`:

- `getSnapshot()`;
- `replace(snapshot, reason)`;
- узкие mutation methods, соответствующие существующим операциям;
- change event с revision и reason;
- conversion to/from Scene через существующий adapter.

Сам `currentConfig` не экспортируется. Все новые файлы используют фасад, что создаёт одну точку замены в Stage 2F.

## 6. Целевая backend-структура этапа

```text
Project/
  Program.cs
  Hosting/
    AppBootstrap.cs
    RouteMap.cs
    StaticFileResponder.cs
    WebSocketHub.cs
  Endpoints/
    SceneEndpoints.cs
    ThemeEndpoints.cs
    SettingsEndpoints.cs
    LiveEndpoints.cs
    SystemEndpoints.cs
  Application/Abstractions/
    ISceneStore.cs
    ISettingsStore.cs
    IThemeStore.cs
    IAudioLevelSource.cs
    IUpdateService.cs
  Web/
    ApiResult.cs
    ApiError.cs
```

На 2E существующие классы могут напрямую реализовать интерфейсы. Domain services и полная repository-модель являются Stage 6.

Endpoint handler:

- разбирает и ограничивает input;
- вызывает одну application/storage operation;
- переводит результат в единый response;
- не содержит файловых путей, JSON normalization и FFT logic.

## 7. Поведение, которое обязано сохраниться

- загрузка Draft при открытии редактора;
- четыре зоны UI;
- выбор через Canvas/Layers;
- drag, Inspector X/Y/Scale;
- visibility, lock, marker и reorder;
- group movement;
- timing fields и Timeline bars;
- undo/redo snapshot history;
- Preview update;
- сохранение Draft;
- Apply в Published;
- OBS reload по `configChanged`;
- builtin/custom themes lifecycle;
- RU/EN текущего объёма;
- process/system/auto audio и текущий fallback;
- update/startup behavior.

Любое намеренное исправление существующего дефекта выносится в отдельный commit с отдельным test и пометкой, что это не механическое перемещение.

## 8. Порядок реализации

1. Создать characterization tests до переноса кода.
2. Ввести namespace, composition root и event bus.
3. Обернуть API calls без изменения callers.
4. Изолировать legacy state и conversion.
5. По одному переносить UI controllers; после каждого переноса запускать smoke subset.
6. Выделить persistence и preview sync.
7. Ввести backend abstractions.
8. По одной области переносить endpoints.
9. Выделить static/WS/update hosting adapters.
10. Удалить только доказанно недостижимый duplicate code.
11. Выполнить полный regression и сравнить baseline.

Не допускается один commit «переписать settings.js» без промежуточно запускаемого состояния.

## 9. Migration и совместимость

Persisted data migration отсутствует. Stage 2E обязан читать и писать byte/semantic-compatible документы текущей версии.

Если serializer меняет порядок/форматирование JSON, semantic equality должна быть доказана. Автоматическая normalization пользовательских файлов не добавляется как побочный эффект module split.

Endpoint URL, request/response fields и WS event names сохраняются.

## 10. UX

- Layout, controls, hotkeys и сообщения сохраняются.
- Допускается единый компонент статуса, если тексты и моменты появления эквивалентны.
- Новая техническая ошибка не показывается пользователю stack trace; используется существующий понятный текст плюс correlation ID в логах.
- Loading и failed states не должны ухудшиться при переносе API.

## 11. Acceptance criteria

- `settings.js` больше не реализует домены Inspector, Canvas, Timeline, Themes, API и Preview; он удалён либо является небольшим compatibility bootstrap.
- `Program.cs` не содержит больших endpoint bodies и низкоуровневой static/WS логики.
- Только compat-модуль владеет `currentConfig`.
- Только API client вызывает `fetch` для editor domain.
- Только Draft scheduler инициирует debounce-save.
- Нет новых произвольных globals.
- Dependency graph не содержит циклов между feature-модулями.
- Все characterization, build и smoke tests зелёные.
- Manual baseline checklist не обнаруживает визуального или поведенческого изменения.
- Документация содержит список временных adapters для Stage 2F.

## 12. Обязательные test cases

### Frontend characterization

1. Открыть валидный Draft и выбрать каждый тип node.
2. Изменить X/Y/Scale через Inspector; проверить Scene payload Preview.
3. Перетащить node и group; проверить undo/redo.
4. Toggle visibility и lock.
5. Reorder siblings и проверить порядок.
6. Изменить timing каждого endMode.
7. Загрузить builtin theme, сохранить custom copy, обновить и удалить её.
8. Изменить Draft без Apply; Published endpoint не меняется.
9. Apply; OBS runtime получает новую Published revision.
10. Переключить RU/EN и проверить ключевые зоны.

### Backend contracts

1. Snapshot всех существующих routes и status codes.
2. Invalid JSON и отсутствующий документ.
3. Draft save, Published load/apply.
4. Builtin delete запрещён, custom delete разрешён.
5. WS connect, configChanged и themesChanged.
6. Static overlay/assets paths.
7. Audiolevel response shape во всех sourceMode.

### Build

1. Clean build.
2. Portable launch layout без user data в artifact.
3. Overlay loads all scripts в поддерживаемом OBS/browser harness.

## 13. Риски и меры

| Риск | Мера |
|---|---|
| Потеря скрытой инициализации из-за порядка scripts | dependency manifest + startup smoke |
| Двойные event listeners после переноса | один lifecycle owner + listener count tests |
| Auto-save race | один scheduler + fake clock tests |
| Endpoint response drift | contract snapshots до переноса |
| Слишком большой commit | вертикальные переносы по feature, каждый buildable |
| «Временный» adapter останется навсегда | owner и обязательное удаление в exit gate 2F |

## 14. Rollback

- Каждый feature переносится отдельным commit без изменения данных.
- Persisted schema не меняется, поэтому rollback binary совместим с файлами этапа.
- При regression откатывается конкретный feature extraction, а не весь набор.

## 15. Зависимости и traceability

- ADR-0001, ADR-0005.
- Roadmap Gate 0 и Stage 2E.
- Требования P-01, P-02, P-06, P-07, P-14–P-18, A-06, Q-01.

## 16. Открытые вопросы

Продуктовых вопросов нет. Названия каталогов могут быть уточнены при Gate 0, но границы обязанностей не меняются.

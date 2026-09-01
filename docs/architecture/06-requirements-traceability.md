# Матрица требований

Статусы:

- `AS-IS` — существует полностью или частично до рефакторинга;
- `Planned` — предусмотрено roadmap;
- `Deferred` — не входит в 2.1;
- `Decision` — архитектурное правило, а не отдельная функция.

| ID | Требование | Статус | Этап | Основное доказательство приёмки |
|---|---|---|---|---|
| P-01 | Четыре зоны редактора | AS-IS | 2E regression | UI smoke + screenshot |
| P-02 | Выбор объекта через Canvas и Layers | AS-IS | 2F/3 | interaction tests |
| P-03 | Позиция X/Y объекта | AS-IS | 3 | transform fixture |
| P-04 | Resize и rotation | Planned | 3 | handle + matrix tests |
| P-05 | Вложенные группы | Partial | 3 | deep-tree scenarios |
| P-06 | Z-order сверху вниз | AS-IS | 2F/3 | sibling ordering tests |
| P-07 | Visibility, lock, marker | AS-IS | 2E/2F | command/UI tests |
| P-08 | Group effects/animations | Partial | 3/4 | group-child visual fixtures |
| P-09 | Fixed/parentEnd/trackEnd | Partial | 4 | evaluator truth table |
| P-10 | Timeline соответствует фактической видимости | Partial | 4 | Timeline/runtime parity |
| P-11 | Undo/redo пользовательских действий | Partial | 4 | command history suite |
| P-12 | Library по категориям | Partial | 5 | Registry-driven UI test |
| P-13 | Inspector зависит от типа объекта | Partial | 5 | schema-driven fields test |
| P-14 | Встроенные готовые темы | AS-IS | 5 regression | bundled theme suite |
| P-15 | Пользовательские темы CRUD | AS-IS | 5 regression | theme lifecycle tests |
| P-16 | Builtin theme нельзя удалить | AS-IS | 5 regression | API/UI permission tests |
| P-17 | Draft не влияет на OBS до Apply | AS-IS | 2E/6 | integration test |
| P-18 | Preview и OBS одинаковы | Partial | 3 | DOM/screenshot parity |
| P-19 | Импорт локальных изображений | Partial | 5 | portable asset scenario |
| P-20 | RU/EN | Partial | 8 | localization audit |
| A-01 | Одна каноническая Scene | Planned | 2F | no legacy projection + round-trip |
| A-02 | Shared Renderer | Partial | 3 | both hosts use one renderer package |
| A-03 | PreviewHost/ObsHost separation | Planned | 3 | dependency tests |
| A-04 | Единый timing evaluator | Partial | 4 | no duplicate timing math |
| A-05 | Registry owns component metadata | Planned | 5 | add-component conformance test |
| A-06 | Backend services separated | Partial | 2E/6 | endpoint dependency review |
| A-07 | Settings separate from Scene | AS-IS | 2F/6 | schema/flow tests |
| A-08 | Theme is full Scene snapshot | Planned | 5 | ref-theme migration fixture |
| A-09 | Latest-only Published | Decision | 6 | apply/recovery tests |
| A-10 | compositionRef absent in 2.1 | Deferred | post-2.1 | future ADR |
| Q-01 | Git-reproducible source/build | Missing | Gate 0 | clean checkout build |
| Q-02 | Legacy 2.0.1 migration | Partial | 2F/8 | golden fixtures |
| Q-03 | Atomic single-file writes | AS-IS | 6 | fault injection |
| Q-04 | Recovery from corrupt Draft | Missing | 6/8 | corruption fixtures |
| Q-05 | Static path containment | Missing | 6 | security tests |
| Q-06 | Performance budgets | Missing | 7 | benchmark report |
| Q-07 | Audio source fallback | Partial | 7 | long-running source tests |
| Q-08 | WebSocket resynchronization | Partial | 7 | disconnect/drop tests |
| Q-09 | No embedded base64 assets | Missing | 5 | schema/storage tests |
| Q-10 | Round-trip preserves unknown extensions | Missing | 2F | property-based/fixture tests |

## Требование к доказательствам

Для каждого ID перед релизом указывается ссылка на одно или несколько доказательств:

- automated test name и результат;
- migration fixture;
- screenshot/visual baseline;
- performance report;
- manual checklist с версией build;
- ADR для решения, не проверяемого тестом.

Фраза «проверено вручную» без сценария, версии build и результата не считается достаточным доказательством release gate.

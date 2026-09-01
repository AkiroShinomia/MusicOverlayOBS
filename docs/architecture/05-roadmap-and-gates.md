# Roadmap 2.1 и контрольные точки

## Почему порядок важен

Текущий прототип уже работает, но хранит одну композицию в двух формах и повторяет часть логики между UI и runtime. Если сразу добавлять rotation, новые компоненты, assets и сложный Timeline, каждую функцию придётся реализовать несколько раз.

Roadmap сначала уменьшает неопределённость и фиксирует поведение, затем меняет фундамент, и только потом расширяет продукт.

## Общие правила этапов

- Один этап имеет ограниченную цель и отдельный exit gate.
- Большой перенос файлов не смешивается с новым пользовательским поведением.
- Каждый этап начинается с зелёных тестов предыдущего этапа.
- Совместимость проверяется реальными fixture 2.0.1 и 2.1, а не только новым документом.
- Временный adapter имеет владельца, срок удаления и тест. Adapter без плана удаления считается долгом этапа.
- Нельзя объявить этап завершённым по наличию файлов или строк в исходнике; требуется поведенческая проверка.

## Gate 0 — воспроизводимый baseline

### Цель

Сделать текущее состояние 2.1 доступным для контроля изменений до архитектурного рефакторинга.

### Работы

- Добавить активные исходники 2.1 под контроль top-level Git-репозитория.
- Не создавать отдельный Git внутри `Project/`.
- Зафиксировать назначение `main/` как read-only reference 2.0.1.
- Убрать build outputs, portable user data и ручные backups из исходников; хранить только специально выбранные test fixtures.
- Зафиксировать единственную команду build и команды проверок.
- Сохранить контрольные суммы baseline EXE и набора эталонных Scene/theme fixture.
- Создать smoke-checklist текущего UI и OBS output.

### Exit gate

- Чистый checkout собирает приложение по документированной команде.
- `git status` после build/test не содержит неожиданных файлов.
- Baseline smoke-checklist выполнен и приложен к этапу.
- Есть явное различие между source, fixture, user data, backup и artifact.

## Stage 2E — Modular Foundation

### Цель

Разделить монолитные файлы и определить зависимости без изменения видимого поведения и persisted-форматов.

### Основные работы

- Добавить characterization tests для текущих пользовательских сценариев.
- Создать frontend composition root и единый контролируемый namespace.
- Выделить API client, i18n, status, theme UI, Inspector, Canvas, Timeline, Preview sync и shared utilities из `settings.js`.
- Выделить route mapping, static files, WS, update flow и bootstrap из `Program.cs`.
- Ввести интерфейсы repositories/services без одновременной переписи бизнес-логики.
- Сохранить текущий `currentConfig` и converters как временный adapter.
- Добавить dependency rules и циклическую проверку модулей.

### Не входит

- изменение Scene semantics;
- новый дизайн UI;
- rotation handles;
- новый timeline engine;
- asset system;
- изменение аудио-алгоритма.

### Exit gate

- Все baseline-сценарии визуально и функционально эквивалентны.
- `settings.js` и `Program.cs` перестали быть местом реализации всех подсистем.
- Модули имеют один явный public API и не читают чужие приватные переменные.
- Legacy adapter перечислен и изолирован.
- Build, contract и smoke tests зелёные.

Подробное ТЗ: [Stage 2E](specs/stage-2e-modular-foundation.md).

## Stage 2F — Canonical Editor Scene State

### Цель

Убрать двойную модель композиции. Scene v2 становится единственным persisted и runtime-состоянием редактора.

### Основные работы

- Ввести Scene Store и Editor Session Store.
- Перевести Inspector, Canvas, Layers, Timeline, Preview и Themes на selectors и единый mutation/command facade.
- Сохранить snapshot history через adapter до Stage 4, но запретить прямые мутации.
- Перевести special-ID поведение в component capabilities, theme data или compatibility adapter.
- Сделать legacy converter только импортом 2.0.1 → Scene.
- Добавить strict round-trip tests каждого поля Scene.
- Ввести dirty/saving/applied state по revisions и content hash.

### Exit gate

- В редакторе нет `currentConfig.layout` как второго источника истины.
- Preview получает snapshot из Scene Store без обратной legacy-конвертации.
- Неизвестные extensions и component properties сохраняются при edit/save round-trip.
- Все действия UI изменяют Scene через один facade.
- Существующие темы и legacy config проходят migration fixtures.

Подробное ТЗ: [Stage 2F](specs/stage-2f-canonical-scene-state.md).

## Stage 3 — Shared Scene Renderer Completion

### Цель

Довести существующий shared renderer до единственного механизма отображения Scene в Preview и OBS.

### Основные работы

- Зафиксировать renderer input/output и lifecycle.
- Разделить PreviewHost и ObsHost.
- Ввести общую affine transform/world matrix реализацию.
- Реализовать полноценное дерево групп в Canvas и Layers.
- Добавить resize/rotation/anchor и hit testing только в PreviewHost.
- Применить canvas dimensions и scaleMode.
- Удалить остаточные legacy render paths.
- Добавить DOM snapshot и screenshot parity suite.

### Exit gate

- Одна Scene при одинаковом времени и live data создаёт эквивалентный scene DOM/style в Preview и OBS.
- Вложенные группы корректно двигаются, масштабируются, вращаются, скрываются и удаляются.
- Editor handles отсутствуют в OBS DOM.
- Renderer не содержит API polling, selection и theme storage.

Подробное ТЗ: [Stage 3](specs/stage-3-shared-renderer.md).

## Stage 4 — Timeline and Animation Engine

### Цель

Использовать один алгоритм времени и анимаций во всех частях приложения и заменить snapshot undo/redo на команды.

### Основные работы

- Один evaluator local/effective timing для Timeline, Preview и OBS.
- Поддержка fixed, parentEnd и trackEnd с parent clipping.
- Timeline zoom, scroll, drag, resize и snapping как UI над evaluator.
- Animation registry и предсказуемая композиция group/child анимаций.
- Command history, compound commands и coalescing drag.
- Deterministic playback clock и тесты коротких/граничных интервалов.

### Exit gate

- Timeline bar и фактическая видимость совпадают на всех fixture.
- Undo/redo корректно восстанавливает add/remove subtree, reparent, reorder, drag и timing.
- Нет отдельной формулы времени в `settings` UI.
- Один и тот же evaluator используется обоими host.

## Stage 5 — Component, Theme and Asset Platform

### Цель

Сделать добавление компонентов и пользовательского контента системным.

### Основные работы

- Расширенный Component Registry: schema, defaults, category, capabilities, Inspector fields, renderer и migrations.
- Library строится из Registry, а не hardcoded-массива.
- Inspector строит общие и component-specific секции из metadata.
- Themes нормализуются к полному Scene snapshot.
- Builtin read-only, custom CRUD и `Save as copy`.
- Asset Service и Asset Catalog.
- Импорт PNG/JPEG/WebP; решение по анимированным изображениям принимается до старта asset implementation.
- Миграция data URL в content-addressed assets.
- Reference checks перед удалением asset.

### Exit gate

- Тестовый компонент добавляется одной registration unit без правки Library/Inspector switch-блоков.
- Все bundled themes проходят registry validation.
- Пользовательская тема переносима вместе с portable data.
- Scene JSON не содержит новых embedded base64 assets.

## Stage 6 — Backend and Storage Hardening

### Цель

Завершить логические границы backend и сделать работу с данными предсказуемой при ошибках.

### Основные работы

- Application services и repository interfaces вместо логики в endpoints.
- Строгая schema + domain validation.
- Версионированные migrations.
- Единый error envelope.
- Atomic Draft/Published/theme writes.
- Recovery/quarantine повреждённых документов.
- Static-path containment и asset access security.
- Update policy, которая никогда не перезаписывает portable user data.

### Exit gate

- Endpoint handlers только переводят HTTP в application calls.
- Fault-injection тесты не повреждают предыдущий валидный файл.
- Startup восстанавливается после каждого подготовленного corruption fixture.
- Path traversal и oversized document tests отклоняются.

## Stage 7 — Live Metadata, Audio and Performance

### Цель

Снизить лишний polling и нагрузку без изменения качества визуализатора на глаз.

### Порядок

1. Измерить текущий baseline.
2. Определить бюджеты производительности.
3. Разделить capture, source selection, FFT analysis и transport.
4. Перевести metadata на push/WS snapshot + event.
5. Оценить audio WS frames относительно HTTP polling.
6. Оптимизировать FFT только по профилю.

### Exit gate

- Источник process/system переключается событиями и имеет наблюдаемый статус.
- Нет параллельной бессмысленной тяжёлой FFT-обработки неактивного источника.
- Пропуск WS восстанавливается snapshot-запросом.
- CPU, RAM, update latency и dropped frames находятся в утверждённом бюджете.
- Визуальный FFT regression suite не ухудшился.

## Stage 8 — Migration, Localization and Release

### Цель

Сделать 2.1 безопасным обновлением для реального пользователя.

### Основные работы

- Golden migration fixtures 2.0.1 → current Scene.
- Миграция существующего прототипа 2.1 без потери новых полей.
- Recovery UI и понятные ошибки.
- Полная ревизия RU/EN строк.
- Portable update/rollback rehearsal.
- Чистая установка и обновление поверх реальных копий data.
- Полный automated/manual/visual/performance regression.
- Release notes и известные ограничения.

### Release gate

- Ни один пользовательский файл не теряется в rehearsal.
- Builtin themes работают, custom themes и assets сохраняются.
- Preview/OBS parity подтверждён.
- Все обязательные требования из traceability имеют доказательство.
- Release build воспроизводим из чистого Git checkout.

## Зависимости этапов

```text
Gate 0 -> 2E -> 2F -> 3 -> 4 -> 5 -> 6 -> 7 -> 8
```

Некоторые подготовительные работы могут идти параллельно:

- performance harness можно начать в 2E, но оптимизации остаются в Stage 7;
- migration fixtures создаются в Gate 0/2E и расширяются до Stage 8;
- backend mechanical split идёт в 2E, semantic hardening — в Stage 6;
- schemas уточняются в 2F/5, enforcement завершается в Stage 6.

Параллельность не допускается для двух задач, одновременно меняющих Scene semantics или один migration path.

## Оценка сложности

Без данных о команде и скорости корректные календарные даты невозможны. Относительная сложность:

| Этап | Сложность | Основной риск |
|---|---:|---|
| Gate 0 | S | потерять или смешать source/user data |
| 2E | L | незаметно изменить монолитное поведение |
| 2F | XL | потеря полей при отказе от двойной модели |
| 3 | XL | несовпадение геометрии Preview/OBS |
| 4 | XL | timing edge cases и undo transactions |
| 5 | XL | миграция тем и embedded assets |
| 6 | L | ошибки recovery и update |
| 7 | L | оптимизация без корректного baseline |
| 8 | L | реальные пользовательские данные |

После Gate 0 можно оценить этапы в календаре по двум небольшим вертикальным задачам и фактической скорости команды.

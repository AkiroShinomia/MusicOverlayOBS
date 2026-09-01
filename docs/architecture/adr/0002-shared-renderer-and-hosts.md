# ADR-0002: один renderer и два host-окружения

Статус: принято.

Дата: 2026-08-31.

## Контекст

Общий renderer уже существует, но editor и OBS имеют разные lifecycle, DOM-инструменты и источники данных. Смешивание этих обязанностей создаёт editor-only элементы в runtime и расхождения отображения.

## Решение

- Shared Renderer создаёт и обновляет только scene DOM.
- PreviewHost владеет selection, handles, viewport, hit testing и playhead.
- ObsHost владеет Published loading, live media/audio transport и runtime recovery.
- Timeline Evaluator и Component Registry являются общими зависимостями renderer-а.
- Parity проверяется при одинаковых Scene, времени, viewport и live data.

## Последствия

- Новая визуальная функция реализуется один раз.
- Editor interaction может развиваться независимо.
- Для тестов нужны deterministic clock и fixed live fixture.
- Существующий shared renderer расширяется; второй renderer не создаётся.

## Отклонённые варианты

- Отдельные Preview и OBS renderer — неизбежный drift.
- Помещать handles внутрь component renderer — загрязняет OBS DOM и API компонентов.
- Делать screenshot Preview единственным OBS output — несовместимо с live data и прозрачностью.

## Проверка

- Dependency test запрещает shared renderer импортировать editor/runtime modules.
- OBS DOM не содержит editor handles.
- Parity suite проходит на встроенных темах и вложенной тестовой сцене.

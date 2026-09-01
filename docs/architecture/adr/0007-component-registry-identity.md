# ADR-0007: component.kind — стабильный идентификатор типа

Статус: принято.

Дата: 2026-08-31.

## Контекст

Текущая Scene использует `component.kind`, тогда как будущий Registry требует стабильную identity, category, schema, defaults и renderer. Добавление параллельного `typeId` без отдельного смысла создаст ещё одно дублирование.

## Решение

- `component.kind` остаётся единственным стабильным ID типа в Scene v2.
- `component.version` версионирует properties; отсутствие означает 1.
- `templateId` обозначает preset, но не тип.
- Registry выводит category, capabilities, Inspector fields, defaults, validation, geometry и renderer.
- Category не сохраняется в Scene.
- Group остаётся `nodeType: group`; legacy `component.kind: group` читается migrator-ом только для bounds/runtime compatibility до нормализации контракта.

## Последствия

- Не требуется массовая миграция ID только ради переименования поля.
- Тип можно перемещать между Library-категориями без изменения файлов.
- Registry становится обязательным для полноценной validation и geometry.

## Отклонённые варианты

- Одновременно хранить `componentId`, `typeId` и `kind` — неоднозначность без пользы.
- Использовать отображаемое имя как ID — ломает локализацию и переименование.
- Хранить category в node — создаёт лишние миграции UI-классификации.

## Проверка

- Один registration unit достаточен, чтобы компонент появился в Library, Inspector и renderer.
- Unknown kind сохраняется placeholder-ом и блокирует Apply.
- Category change не меняет serialized Scene.

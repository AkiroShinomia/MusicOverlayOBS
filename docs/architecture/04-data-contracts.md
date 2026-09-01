# Контракты данных

## Общие правила

- Все persisted JSON имеют `schemaVersion` и `documentType`.
- Core-поля валидируются строго. Дополнительные данные разрешены только в namespaced `extensions` или в properties известного компонента.
- Migrator работает до domain validation.
- Сериализация детерминирована: одинаковое содержание даёт одинаковый content hash.
- Неизвестное поле старой версии не должно молча исчезать при round-trip.
- Размер документа, количество nodes и глубина дерева ограничиваются конфигурацией безопасности.

## Scene Document v2

В 2.1 сохраняется `schemaVersion: 2`, чтобы не создавать искусственную миграцию уже внедрённого формата. Семантика и schema становятся строгими.

Обязательные разделы:

```text
schemaVersion, documentType, id, revision,
metadata, canvas, timeline, appearance, nodes, extensions
```

### Identity

- `id` идентифицирует документ на диске, но не отдельный node.
- `revision` увеличивается при успешной persisted-записи данного документа.
- При загрузке темы в Draft создаётся workspace identity; ID темы не используется как Draft ID.
- `metadata.sourceThemeId` хранит происхождение только для информации и не создаёт наследование.

### Node

Общие поля node:

- `id` — стабильный уникальный ID внутри Scene;
- `nodeType` — `group` или `component`;
- `name` — имя пользователя;
- `parentId` — ID группы или `null`;
- `order` — порядок среди siblings, где 0 визуально выше 1;
- `visible`, `locked`, `marker`;
- `transform`, `timing`, `effects`, `animations`;
- `component` — обязателен только при `nodeType: component`; для legacy group payload временно читается migrator-ом.

Условия валидности:

- все ID уникальны;
- parent существует и имеет `nodeType: group`;
- циклов нет;
- глубина не превышает установленный лимит;
- order уникален и последователен внутри каждого parent после normalization;
- `locked` влияет только на редактирование и не меняет OBS output;
- невидимая группа делает невидимым всё поддерево.

### Z-order

`order` сравнивается только между детьми одного родителя. Группа образует единое stacking subtree. Ребёнок одной top-level группы не может перескочить поверх другой top-level группы без reparent/reorder самой группы.

После add/remove/reorder siblings нормализуются к `0..n-1` без изменения взаимного порядка.

### Transform

```text
x, y             local position top-left относительно родителя
scaleX, scaleY   конечные положительные множители
rotation         градусы по часовой стрелке
anchorX, anchorY нормализованная точка 0..1
```

Размер компонента вычисляется Registry geometry resolver-ом из его properties. Размер группы в Scene v2 берётся из совместимых group bounds, которые migrator извлекает из текущего `component.properties.width/height`.

Матрица локального преобразования:

```text
T(x + anchorX*width, y + anchorY*height)
* R(rotation)
* S(scaleX, scaleY)
* T(-anchorX*width, -anchorY*height)
```

World matrix равна `parentWorld * localMatrix`. Это вычисление является общим для renderer, Canvas overlay и hit testing.

### Timing

- `startMs` — локальное время начала относительно старта родителя.
- `endMode: fixed` требует `durationMs >= 0`.
- `parentEnd` означает до конца родителя; у root — до timeline horizon.
- `trackEnd` означает до смены текущего трека.
- Реальный интервал ребёнка всегда обрезается реальным интервалом родителя.
- `timeline.durationMs` задаёт горизонт редактирования и Preview, но не превращает `trackEnd` в конечный момент OBS.

У ребёнка конечной группы `trackEnd` фактически заканчивается вместе с родителем. UI обязан показывать effective end и объяснять причину, а не создавать визуально бесконечный bar за границей родителя.

### Animations

Анимация node выполняется внутри его effective timing window.

- Group transform/effect естественно применяется ко всему DOM-поддереву.
- При `overrideChildren: false` group и child анимации композируются.
- При `overrideChildren: true` child enter/out временно подавляются, но их данные не удаляются.
- Duration enter + out не может создавать отрицательную стабильную фазу; evaluator определяет поведение короткого интервала и тестируется отдельно.
- Неизвестный animation type блокирует публикацию, но сохраняется placeholder-ом в редакторе.

## Component Registry contract

Стабильным идентификатором типа остаётся существующее `component.kind`. Второй идентификатор `typeId` в 2.1 не добавляется.

```text
component.kind       stable type id
component.version    версия properties; отсутствие означает 1
component.templateId необязательный preset, не identity типа
component.properties данные конкретного экземпляра
```

Registry определяет category. `categoryId` не сохраняется в Scene.

Каждый зарегистрированный kind обязан предоставить:

- default properties;
- validation schema;
- geometry resolver;
- renderer create/update;
- Inspector fields;
- capabilities;
- properties migrator при повышении `component.version`.

Общие базовые виды 2.1: group bounds, block/container, image, disc, text, time, progress, equalizer, particles. Точный список сверяется с реальными встроенными темами до закрытия Stage 5.

## Theme contract

Отдельный reference/override `music-overlay.theme` выводится из целевой модели 2.1.

Тема хранится как полный `music-overlay.scene`:

- `metadata.themeType` равно `builtin` или `custom`;
- `metadata.sourceThemeId` может указывать, из какой темы сделана копия;
- это поле не создаёт live-связь;
- builtin определяется также доверенным storage location и остаётся read-only;
- сохранённая custom theme не меняется при обновлении исходной builtin theme.

Единственная существующая ref-theme должна быть разрешена в полный snapshot в migration fixture. Исходный файл сохраняется в backup до завершения миграции.

## Asset contract

Base64/data URL не является постоянным форматом ресурса Scene.

Asset имеет:

- `assetId` — content-addressed ID, полученный из SHA-256;
- оригинальное безопасное имя для UI;
- media type;
- byte size;
- width/height и дополнительные metadata после декодирования;
- относительный internal path, который формирует только Asset Service.

Image source в component properties является discriminated value:

```json
{ "type": "track-cover" }
```

или

```json
{ "type": "asset", "assetId": "sha256-..." }
```

Legacy-значения `track`, URL и data URL принимает только migrator. Внешние HTTP URL как постоянный пользовательский asset не входят в 2.1.

Удаление asset блокируется, пока на него ссылается Draft, Published или custom theme. UI показывает список ссылок. Garbage collection допускается позднее отдельным ADR.

## Settings contract

Settings не содержит данные композиции.

Разделы:

- `audio` — выбранная стратегия источника;
- `preview` — demo/live и разрешённый способ live sync;
- `editor` — язык, UI preferences и последние открытые панели;
- `diagnostics` — opt-in debug options.

Неиспользуемое поле либо внедряется в поведение и тестируется, либо удаляется migrator-ом. Хранить «на будущее» неработающий toggle нельзя.

## Draft/Published contract

Draft и Published используют один Scene schema, но разные identity и lifecycle.

- Draft можно часто перезаписывать с debounce.
- Published заменяется только явной Apply operation.
- Published хранит одну актуальную версию.
- Safety backup перед replace разрешён и не считается пользовательской историей версий.
- Failed apply не отправляет `configChanged`.
- Published endpoint возвращает ETag/content hash или revision для cache control.

## API errors

Единый error envelope:

```json
{
  "error": {
    "code": "scene.validation_failed",
    "message": "Композиция содержит ошибки",
    "details": [
      { "path": "nodes[3].parentId", "code": "parent.missing", "message": "Группа не найдена" }
    ],
    "correlationId": "..."
  }
}
```

HTTP status отражает класс ошибки: invalid input, conflict, not found или internal failure. Пользовательский текст локализуется UI; стабильный `code` не локализуется.

## WebSocket contract

Каждое сообщение имеет:

- `type`;
- `sequence`;
- `timestamp`;
- payload, зависящий от типа.

События конфигурации содержат минимум Published revision/hash. Metadata и audio frames не должны включать всю Scene. Потеря WS не делает систему необратимо рассинхронизированной: клиент повторно получает snapshot через HTTP.

## compositionRef

Вложение одной Scene в другую не входит в 2.1. Поле `compositionRef` не добавляется в schema, Registry или UI.

Существующая архитектура должна лишь избегать предположения, что все будущие component kinds обязательно имеют простой DOM leaf. Если появится подтверждённый пользовательский сценарий, он будет спроектирован отдельным ADR с правилами циклов, revision pinning и assets.

# Данные и владельцы состояния

## Зачем фиксировать владельца

Большая часть текущей сложности появилась из-за того, что одно значение хранится одновременно в Scene, `currentConfig`, DOM-полях и локальных UI-переменных. Для каждого типа данных должен существовать один владелец, а остальные части получают только read-only представление или событие.

## Таблица владельцев

| Данные | Единственный владелец | Хранение | Кто может менять |
|---|---|---|---|
| Композиция Draft | Scene Store редактора | `draft.scene.json` | Scene commands |
| Применённая композиция | Scene repository | `published.scene.json` | `Apply Draft` после validation |
| Выделение | Editor Session Store | только память | Selection controller |
| Zoom, pan, размеры панелей | Editor Session Store | память; пользовательские предпочтения отдельно | Editor UI commands |
| Playhead и playback mode | Editor Session Store | память | Timeline controls |
| Undo/redo | Command History | память текущей сессии | Command Bus |
| Глобальные настройки | Settings Service/Store | `settings.json` | Settings commands/API |
| Каталог тем | Theme Service | builtin + custom theme files | Theme operations |
| Каталог ресурсов | Asset Service | asset catalog + files | Asset operations |
| Текущий трек | Media Session Service | память | media provider |
| Текущий audio frame | Audio Frame Service | кольцевой/последний буфер памяти | capture/analyzer pipeline |
| DOM сцены | Renderer instance | DOM | только renderer |

## Scene Store

Scene Store хранит документ целиком, но не разрешает произвольную мутацию извне.

Публичные возможности:

- получить immutable snapshot;
- подписаться на новую revision;
- отправить команду;
- заменить всю Scene только через `LoadScene` после migration и validation;
- получить validation result.

Запрещено:

- отдавать наружу изменяемую ссылку на `nodes`;
- хранить отдельную mutable layout-копию;
- искать особое поведение по ID стандартной темы;
- менять DOM вместо Scene;
- выполнять HTTP внутри reducer/command.

## Editor Session State

Не всё состояние редактора является частью композиции. В отдельной структуре хранятся:

- `selectedNodeIds`;
- `hoveredNodeId`;
- `expandedGroupIds`;
- `activeInspectorSection`;
- `viewport.zoom`, `viewport.panX`, `viewport.panY`;
- `playheadMs`, `isPlaying`, `previewDataMode`;
- временное drag-состояние;
- статус загрузки/сохранения и последнее понятное пользователю сообщение.

Эти поля не должны попадать в тему и Published. Сохраняемые предпочтения интерфейса могут находиться в `settings.editor`, но не смешиваются со Scene.

## LiveMediaState

Renderer получает отдельный объект live-данных:

- title;
- artist;
- album;
- position/duration;
- cover URL/reference;
- playback state;
- track/session ID;
- audio spectrum/energy bands;
- timestamp и sequence.

`binding` компонента указывает, какое поле использовать. Текущее название песни, прогресс и FFT никогда не записываются в Draft или тему.

## Поток пользовательского изменения

Пример перемещения объекта:

```text
pointerdown
  -> PreviewHost фиксирует start position
pointermove
  -> transient preview command
  -> Scene Store snapshot
  -> Renderer update
pointerup
  -> одна MoveNode command попадает в History
  -> Draft save scheduler получает новую revision
```

Inspector, Canvas и Timeline используют один и тот же command. Поэтому ввод X вручную, drag на Canvas и последующий undo дают одинаковый результат.

## Command Bus

Каждая команда содержит:

- тип;
- параметры;
- целевую Scene revision либо precondition;
- `execute` или reducer;
- данные, достаточные для undo;
- человекочитаемое имя для диагностики.

Минимальный набор:

- `AddNode`;
- `RemoveSubtree`;
- `DuplicateSubtree`;
- `MoveNode`;
- `ResizeNode`;
- `RotateNode`;
- `ReparentNode`;
- `ReorderNode`;
- `RenameNode`;
- `SetVisibility`;
- `SetLocked`;
- `SetMarker`;
- `SetTiming`;
- `SetAnimation`;
- `SetEffect`;
- `SetComponentProperty`;
- `ReplaceScene` для явной загрузки темы.

`RemoveSubtree` удаляет группу и всех потомков атомарно. `ReparentNode` сохраняет визуальное world-положение: перед сменой родителя рассчитываются новые local X/Y.

## Dirty state и сохранение

Scene Store имеет monotonically increasing local revision. Отдельно хранятся:

- revision последнего успешного Draft save;
- revision последнего Published apply;
- in-flight save revision.

Состояния интерфейса:

- `Saved` — текущая revision записана в Draft;
- `Saving` — запись идёт;
- `Unsaved` — есть более новая revision;
- `Save failed` — Draft на диске старее, в памяти изменения сохранены до закрытия;
- `Published` — текущий content hash совпадает с применённой Scene;
- `Not applied` — Draft отличается от Published.

Content hash используется только для сравнения содержания, а не для истории Published.

## Theme flow

### Открыть тему

1. Theme Service читает полную Scene.
2. Migrator приводит её к текущей версии.
3. Validator проверяет структуру и Registry properties.
4. Создаётся workspace-копия с новым Draft ID и metadata provenance.
5. `ReplaceScene` очищает command history и selection.
6. Draft сохраняется; Published не меняется.

### Сохранить как пользовательскую тему

1. Текущий Draft валидируется.
2. Live и editor session data исключаются.
3. Scene клонируется с custom theme ID/name/revision.
4. Файл атомарно записывается в custom themes.
5. Отправляется `themesChanged`.

### Обновить пользовательскую тему

Разрешено только для custom theme. Builtin всегда read-only; команда обновления встроенной темы автоматически превращается в `Save as copy` либо блокируется с понятным предложением.

## Publish flow

1. Редактор отправляет текущую Scene и ожидаемую Draft revision.
2. Backend мигрирует и валидирует payload.
3. Backend присваивает Published identity/revision и сериализует временный файл.
4. Временный файл повторно читается и валидируется.
5. `published.scene.json` атомарно заменяется.
6. Только после успеха отправляется `configChanged` с новой revision.

Settings и Draft не являются частью этой операции. Предыдущий Published остаётся доступным при любой ошибке до пункта 5.

## Правила синхронизации

- Renderer получает snapshot, но не меняет Store.
- WS-событие содержит sequence/revision; получатель игнорирует устаревшее.
- При пропущенном WS-событии host может перечитать актуальный endpoint.
- HTTP остаётся способом получить полный документ; WS передаёт события и небольшие live frames.
- Повтор события безопасен и не меняет результат.

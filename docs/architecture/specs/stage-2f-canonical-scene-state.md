# ТЗ Stage 2F — Canonical Editor Scene State

Статус: архитектурно готово; декомпозиция начинается после exit gate 2E.

## 1. Цель

Сделать SceneDocument единственным состоянием композиции в редакторе и удалить постоянный цикл Scene ↔ legacy layout.

Продуктовый результат: существующий редактор ведёт себя так же, но больше не теряет новые поля и получает надёжную основу для вложенных групп, transform и Timeline следующих этапов.

## 2. Prerequisites

- Stage 2E закрыт, characterization suite зелёный.
- `currentConfig` доступен только через compat facade.
- UI controllers и API отделены от state implementation.
- Есть fixture каждой bundled theme, актуальных Draft/Published и config 2.0.1.
- Приняты ADR-0001, ADR-0006 и ADR-0007.

## 3. Scope

- Ввести Scene Store с immutable snapshots и revision.
- Ввести Editor Session Store.
- Ввести Scene selectors для tree/order/selection/world/effective timing read models, не меняя timing semantics.
- Ввести единый Scene mutation facade.
- Перевести все editor controllers с LegacyEditorState на Scene Store.
- Перевести Preview sync на прямой Scene snapshot.
- Перевести Draft save/Apply/theme save на прямой Scene snapshot.
- Оставить legacy converter только для импорта 2.0.1 и специально помеченных старых файлов.
- Сохранить текущую snapshot history через adapter над Scene snapshots.
- Ввести строгий round-trip и migration test suite.
- Удалить special-ID ветвления либо локализовать остаточные compatibility rules с явным сроком удаления.

## 4. Non-goals

- Не вводить новый renderer и новые handles.
- Не включать rotation/anchor UI.
- Не менять текущий вид Timeline.
- Не менять animation/timing результат.
- Не вводить command-based history полностью; это Stage 4.
- Не менять theme contract на диске массово; normalization выполняется Stage 5.
- Не внедрять Asset Service.
- Не усиливать backend schema enforcement до уровня Stage 6, кроме минимального, необходимого для безопасной migration.

## 5. State model

### SceneState

```text
document             immutable SceneDocument snapshot
localRevision        revision каждой принятой mutation
savedDraftRevision   последняя успешно записанная localRevision
publishedHash        hash последнего известного Published
validation           latest validation result
```

### EditorSessionState

```text
selection
expanded groups
viewport zoom/pan
playhead/playback
active panels
transient drag
pending/saving/error statuses
```

Session state не сериализуется в Scene. Сохраняемые UI preferences проходят Settings Store отдельно.

## 6. Scene Store API

Минимальный public API:

```text
load(scene, source)
getSnapshot()
getRevision()
dispatch(mutation)
subscribe(listener)
validate()
markDraftSaved(revision)
markPublished(hash)
```

`getSnapshot()` не возвращает изменяемые внутренние коллекции. Реализация может использовать structural sharing или controlled cloning; выбор подтверждается performance test, а не предположением.

`dispatch`:

1. проверяет preconditions;
2. создаёт следующее состояние;
3. нормализует затронутый участок;
4. запускает дешёвую domain validation;
5. увеличивает revision ровно один раз;
6. уведомляет подписчиков после commit.

Если mutation не меняет содержание, revision не увеличивается.

## 7. Mutation facade

До полного Command Bus Stage 4 поддерживаются типизированные mutations:

- node add/remove subtree/duplicate;
- node rename/visibility/lock/marker;
- transform partial update;
- reparent/reorder;
- timing update;
- effect/animation update;
- component property update;
- scene canvas/timeline/appearance update;
- replace scene.

Mutation не должна принимать произвольную функцию изменения JSON. Набор операций является будущей границей Commands.

Snapshot History слушает committed mutations:

- coalesces существующие drag/input серии так же, как до этапа;
- undo загружает предыдущий Scene snapshot через специальную history mutation;
- session state не откатывается, кроме selection, ставшей недействительной;
- полная замена темы очищает history.

## 8. Selectors

Обязательные чистые selectors:

- `nodeById`;
- `childrenOf(parentId)`;
- `ancestorsOf(id)`;
- `descendantsOf(id)`;
- `rootNodes`;
- `orderedSiblings`;
- `flattenedLayerRows(expandedIds)`;
- `isEffectivelyVisible`;
- `effectiveLock` для editor interaction;
- `worldTransform` с текущей совместимой geometry;
- `effectiveTiming` через существующий shared evaluator;
- `selectedNodeViewModel`;
- `draftDirty` и `notApplied`.

Selectors не мутируют Scene и не кэшируют результат вне контролируемого revision cache.

## 9. Удаление двойной модели

### До

```text
Scene -> fromScene -> currentConfig/layout -> UI -> toScene -> Preview/save
```

### После

```text
input -> migrate/validate -> Scene Store
UI -> mutations -> Scene Store snapshot -> Preview/save
```

`SceneEditorModel.fromScene/toScene` удаляется из обычного editor flow. Допустимые остатки:

- `LegacyConfigImporter` читает 2.0.1;
- migration fixture вызывает importer напрямую;
- rollback/export legacy не реализуется, если это не отдельное подтверждённое требование.

## 10. Special-ID migration

Для каждого branch по `full-card-group`, `ticker-group`, `full-*`, `ticker-*` создаётся таблица:

| Текущее правило | Новое место |
|---|---|
| Runtime binding full/ticker | component binding/properties или compatibility metadata |
| Скрытие Inspector fields | Registry capability/schema, Stage 5; до него generic nodeType/kind rule |
| Timing special cases | общий timing selector |
| Group background | обычный block component |
| Theme default behavior | данные builtin Scene |

Если правило невозможно убрать без Stage 5, оно размещается в одном `compat/builtin-v2-rules` с тестом и удалением как обязательным пунктом Stage 5. Нельзя распределять special IDs по новым controllers.

## 11. Revision и persistence

- Local revision не обязана совпадать с persisted `revision` файла.
- Draft save scheduler фиксирует snapshot и local revision начала записи.
- Если во время записи появились изменения, успешный ответ отмечает сохранённой только отправленную revision и планирует следующую запись.
- Более старый ответ не может пометить новую revision как сохранённую.
- Apply работает с явным snapshot/hash; ответ связывается с ним.
- UI состояния `Сохранено` и `Применено` вычисляются, а не устанавливаются случайными controllers.

## 12. Validation уровня Stage 2F

При `load` обязательно проверяются:

- document type и schema version;
- unique node IDs;
- существующие group parents;
- отсутствие cycles;
- допустимая глубина;
- nodeType/component shape;
- transform numbers finite;
- timing basic invariants;
- order normalization;
- наличие обязательных верхнеуровневых разделов.

Component-specific строгая validation вводится Registry в Stage 5. Неизвестные kind и extensions сохраняются без потери, а UI показывает placeholder/diagnostic.

## 13. Migration

### Legacy 2.0.1

1. Определить format по документу, не по имени файла.
2. Сохранить исходник в backup.
3. Выполнить importer в памяти.
4. Валидировать Scene.
5. Записать новый Draft атомарно.
6. Повторный startup читает Scene напрямую и не мигрирует снова.

Migration должна быть idempotent.

### Прототип Scene v2

Текущие документы загружаются без legacy projection. Missing optional defaults добавляются normalizer-ом. Unknown extensions сохраняются.

`revision: 0`, если такое значение создавал старый editor, принимается только migration input и нормализуется к 1 перед persisted write.

## 14. UX

- Пользователь не видит изменения интерфейса как цель этапа.
- При неизвестном component kind показывается объект-заглушка с именем и типом; данные сохраняются.
- Apply неизвестного/невалидного компонента блокируется сообщением с конкретным объектом.
- При ошибке Draft save редактор не теряет in-memory изменения и явно показывает несохранённое состояние.
- Переключение темы предупреждает о несохранённых изменениях только согласно текущему продуктовому поведению; новый modal не вводится без отдельного решения.

## 15. Acceptance criteria

- В memory editor существует один SceneDocument composition state.
- Ни один UI controller не читает и не пишет `currentConfig`/legacy layout.
- Preview, Draft save, Apply и theme save получают Scene Store snapshot без обратной конвертации.
- Legacy importer не импортируется обычным editor runtime после успешной загрузки Scene.
- Round-trip всех bundled Scene сохраняет semantic equality, unknown extensions и unknown properties.
- Глубокое дерево не теряет descendants при выборке, remove и save.
- Autosave race tests подтверждают корректные revisions.
- Existing characterization suite остаётся зелёным.
- Документирован список оставшихся compatibility rules; нет распределённых special-ID branches.

## 16. Обязательные test cases

### Store

1. Load valid Scene и immutable snapshot.
2. No-op mutation не увеличивает revision.
3. Mutation увеличивает revision один раз и уведомляет после commit.
4. Invalid parent/cycle/NaN отклоняются без частичного изменения.
5. Remove group удаляет всё поддерево атомарно.
6. Reorder нормализует sibling order.
7. Unknown extension сохраняется после нескольких mutations.

### Round-trip

1. Каждая bundled theme.
2. Draft/Published audit fixture.
3. Deep nesting минимум 5 уровней.
4. Non-uniform scale, rotation и anchors, даже если UI пока их не редактирует.
5. Все timing modes.
6. Unknown component kind/version/properties.
7. Unicode names и RU text.

### Persistence races

1. Revision N save медленный, N+1 появляется до ответа.
2. Ответ N приходит после ответа N+1.
3. Save N падает, in-memory N+1 остаётся.
4. Apply старого snapshot не помечает новый Draft applied.

### Migration

1. Чистый config 2.0.1.
2. Уже мигрированный Scene повторно не меняется.
3. Повреждённый legacy input не перезаписывается.
4. `revision: 0` нормализуется.
5. Unknown legacy field либо отображается в documented extension, либо перечислено как намеренно неподдерживаемое.

### UI regression

Повторить весь Stage 2E characterization suite и сравнить Preview payload semantic equality.

## 17. Риски и меры

| Риск | Мера |
|---|---|
| Потеря полей converter-ом | прямой Scene round-trip + golden fixtures |
| Скрытые special-ID side effects | branch inventory до миграции controllers |
| Большая стоимость cloning | benchmark realistic 15/100/500 nodes |
| Save race | revision-aware scheduler и fake delays |
| Неизвестный component ломает editor | lossless placeholder path |
| Snapshot history расходует память | зафиксировать baseline; полная замена Commands в Stage 4 |

## 18. Rollback

- До удаления compat adapter новая Store-цепочка включается внутренним development flag для fixture comparison.
- Dual write не используется: он создаст третью точку истины. Допускается только сравнение результатов в тестах.
- Persisted Scene остаётся v2; rollback на предыдущий 2.1 build возможен, если он терпимо читает сохранённые extensions.
- Перед первой normalization реальных файлов создаётся automatic backup.

## 19. Зависимости и traceability

- Stage 2E exit gate.
- ADR-0001, ADR-0006, ADR-0007.
- Контракты `03-domain-and-state-ownership.md` и `04-data-contracts.md`.
- P-02, P-03, P-05–P-10, P-17, A-01, A-07, Q-02, Q-10.

## 20. Открытые вопросы

Продуктовых вопросов нет. Вопрос производительности cloning решается измерением на этапе и не передаётся владельцу продукта.

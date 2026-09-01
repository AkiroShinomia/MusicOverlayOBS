# ТЗ Stage 3 — Shared Scene Renderer Completion

Статус: архитектурно готово; финальная декомпозиция после Stage 2F.

## 1. Цель

Довести существующий shared renderer до единственного механизма отображения Scene в Preview и OBS, реализовать полноценные локальные/world transforms и настоящее дерево групп.

Продуктовый результат: пользователь видит в OBS ровно ту композицию, которую настроил в Preview, включая вложенные группы, масштаб и вращение.

## 2. Prerequisites

- Stage 2F закрыт.
- Scene Store выдаёт прямой Scene snapshot.
- Shared component kinds инвентаризированы.
- Текущие builtin themes имеют visual baseline.
- Доступен deterministic playback clock и fixed live-data fixture.
- Приняты ADR-0002, ADR-0006 и ADR-0007.

## 3. Scope

- Зафиксировать public API и lifecycle Shared Renderer.
- Разделить PreviewHost и ObsHost.
- Ввести единую 2D transform library и world matrix selectors.
- Ввести Registry geometry resolver для каждого существующего kind.
- Поддержать arbitrary nested groups в renderer, Canvas overlay и Layers tree.
- Реализовать selection bounds, resize, rotation и anchor-aware transforms в PreviewHost.
- Реализовать reparent с сохранением world-положения.
- Реализовать canvas dimensions и scaleMode.
- Исключить editor-only DOM из OBS.
- Удалить остаточные legacy render paths.
- Добавить DOM/style и screenshot parity suite.

## 4. Non-goals

- Не переписывать timing/animation engine целиком; Stage 3 использует существующий shared evaluator через чёткий interface.
- Не вводить keyframes и новый animation editor.
- Не заменять snapshot history на command history.
- Не создавать новые component kinds кроме технического placeholder, если требуется.
- Не внедрять Asset Service.
- Не изменять FFT mathematics или transport.
- Не менять дизайн встроенных тем.

## 5. Renderer contract

Shared Renderer создаётся с зависимостями:

```text
rootElement
componentRegistry
timelineEvaluator
diagnostics
```

Public operations:

```text
mount(sceneSnapshot)
updateScene(sceneSnapshot, changeSet?)
renderFrame(frameState, liveMediaState)
resizeViewport(viewport)
unmount()
```

### Обязанности renderer

- построить scene DOM по node tree;
- создать component DOM через Registry;
- применить node visibility/order/transform/effects;
- применить frame result timing/animations;
- передать live bindings component adapters;
- переиспользовать DOM при обновлениях, где безопасно;
- удалить listeners/resources при unmount.

### Не входит в renderer

- selection и handles;
- pointer/keyboard interaction;
- Draft/Published fetch;
- WS/polling;
- theme CRUD;
- API URLs;
- history;
- editor panels;
- решение, использовать demo или live data.

## 6. FrameState

```text
sceneTimeMs
trackSessionId
trackElapsedMs
trackDurationMs
isPlaying
viewport
```

Timeline Evaluator возвращает для каждого node:

- active/visible;
- local time;
- effective interval;
- enter/stable/out phase;
- animation progress/easing result;
- effective opacity/effect inputs.

Stage 3 не дублирует эти формулы. Если существующий evaluator не предоставляет нужные данные, расширяется его interface с characterization tests; изменение semantics откладывается до Stage 4.

## 7. DOM model

- Один scene root соответствует canvas coordinate system.
- Каждый group создаёт DOM container и stacking subtree.
- Каждый component создаёт DOM node через Registry.
- `data-node-id` допускается для диагностики и host overlay mapping.
- Editor classes/handles не добавляются внутрь scene nodes.
- DOM order следует shared order comparator; CSS z-index не переопределяет контракт случайными kind-правилами.
- Group background является обычным block component в поддереве, а не скрытым CSS background группы.

## 8. Transform model

Используется ADR-0006.

### Geometry

Каждый component registration предоставляет:

```text
getLocalBounds(properties, liveMediaState?) -> { x: 0, y: 0, width, height }
```

Bounds не должны зависеть от текущего layout DOM measurement для основных компонентов. Dynamic text может иметь deterministic configured width и calculated/declared height; фактический DOM measurement допускается как уточнение, но не меняет serialized X/Y.

Для group bounds используются сохранённые width/height. Auto-fit groups не входят в Stage 3.

### World matrix

Одна transform library используется:

- renderer style generation;
- selection box;
- hit testing;
- resize/rotation math;
- reparent conversion;
- parity/unit tests.

Запрещено независимо составлять CSS transform string в component adapters.

### Resize

- Component capabilities определяют доступные axes и aspect lock.
- Resize меняет component size properties и при необходимости local X/Y, но не заменяет размер произвольным scale.
- Scale остаётся отдельным transform-параметром.
- Для `disc` Registry переводит generic bounds в `size`.
- Shift/Alt modifiers и точный набор handles фиксируются в UX subsection до реализации; базовый resize должен работать мышью и Inspector width/height там, где capability разрешает.

### Rotation

- Rotation хранится в градусах по часовой стрелке.
- Rotation handle находится вне bounds и принадлежит PreviewHost.
- Inspector получает числовое поле Rotation.
- Drag rotation использует anchor world position.
- Значение может выходить за 0..360 во время операции, но normalizer сохраняет эквивалент в согласованном диапазоне.

### Reparent

При переносе node в другую группу:

1. фиксируется текущая world matrix;
2. проверяется отсутствие cycle;
3. вычисляется inverse нового parent world matrix;
4. получается новый local transform;
5. sibling order нормализуется;
6. операция фиксируется одной mutation/history entry.

Если матрица родителя необратима из-за scale 0, reparent блокируется. Domain validation не допускает scale 0 в persisted Scene.

## 9. PreviewHost

Владеет:

- viewport camera и canvas-to-screen matrix;
- pointer normalization;
- selection overlay вне scene DOM;
- hover outline;
- resize/rotation handles;
- hit testing с учётом lock/visibility;
- keyboard nudge/delete/escape;
- transient drag lifecycle;
- playhead connection.

Selection overlay подписывается на Scene revision и viewport changes. Он не читает computed CSS как основной источник transform.

Locked node не выбирается прямым drag по Canvas, если продуктовый UI не предусматривает явный override, но остаётся выбираемым через Layers для unlock. Effective lock родительской группы блокирует interaction детей.

## 10. ObsHost

Владеет:

- initial Published fetch;
- cache/revision handling;
- `configChanged` subscription;
- повторным snapshot fetch после reconnect;
- live metadata/audio adapters;
- transparent body/root;
- safe fallback при invalid Published;
- renderer lifecycle.

ObsHost не знает Draft и editor session. При временной сетевой ошибке текущая отрисованная Published остаётся на экране до успешной загрузки новой.

## 11. Canvas и scaleMode

Поддерживаются canvas width/height из Scene.

- `contain` — весь canvas виден, возможны поля;
- `cover` — viewport заполнен, края могут быть обрезаны;
- `stretch` — независимое растяжение axes;
- `1:1` — один scene pixel равен одному CSS pixel, camera/host решает overflow.

Preview camera zoom/pan применяется поверх scaleMode и не записывается в Scene.

OBS viewport берётся из browser source size. Тесты включают 1920×1080, 1280×720 и нестандартное отношение сторон.

## 12. Layers tree

- Layers показывает реальную иерархию Scene.
- Expand/collapse хранится в Editor Session.
- Drag reorder различает reorder среди siblings и reparent внутрь group.
- Недопустимый drop на своего descendant визуально блокируется.
- Удаление group использует `RemoveSubtree`.
- `Разгруппировать` перемещает детей к parent группы с сохранением world-положения и удаляет только группу.
- Порядок строк и Canvas stacking используют один order selector.

Продуктовый текст подтверждается OQ-02 до реализации удаления.

## 13. Compatibility

- Existing 2.1 Scene координаты должны визуально совпасть с baseline при rotation 0 и uniform scale.
- Legacy converter остаётся только на import boundary из Stage 2F.
- Group legacy bounds извлекаются без изменения положения children.
- Unsupported/unknown kind отображается Preview placeholder-ом; OBS не публикует такую Scene после validation.
- Никакая автоматическая normalization не должна сдвигать объекты без migration report.

## 14. UX

- X/Y остаются понятным положением объекта.
- Width/Height показываются только поддерживающим resize компонентам.
- Rotation показывается объектам и группам, где capability разрешает.
- Anchor можно начать с предустановок 3×3 и числовых advanced fields; изменение anchor по умолчанию не должно визуально сдвигать объект — X/Y пересчитываются для сохранения world appearance.
- Выделение и handles не попадают в OBS.
- При nested selection первый click выбирает визуально верхний leaf; Layers позволяет выбрать group. Повторный modifier-click может поднимать выбор к parent, если это зафиксировано UX tests.
- Ошибка reparent/cycle объясняется коротким сообщением и не меняет Scene.

## 15. Parity definition

Preview и OBS считаются эквивалентными, если при одинаковых inputs:

- совпадает нормализованное scene DOM tree;
- совпадают computed transforms, visibility, opacity и component properties;
- screenshot diff находится ниже утверждённого порога после исключения platform font anti-aliasing;
- различия ограничены PreviewHost overlay, camera chrome и диагностикой.

Один только screenshot недостаточен: DOM/style comparison локализует причину расхождения.

## 16. Acceptance criteria

- PreviewHost и ObsHost используют один Shared Renderer package.
- Нет отдельного legacy Preview renderer.
- Arbitrary nested groups отображаются и редактируются минимум до поддерживаемого depth limit.
- Move/scale/rotation группы корректно воздействуют на всё поддерево.
- Reparent и ungroup сохраняют world-положение в пределах epsilon.
- Selection/hit testing совпадает с transformed bounds.
- Canvas scaleMode работает в Preview и OBS.
- OBS DOM не содержит handles, selection state и editor listeners.
- Все bundled themes проходят parity suite.
- Stage 2F regression и round-trip tests остаются зелёными.

## 17. Обязательные test cases

### Transform unit tests

1. Root translate.
2. Anchor 0/0, 0.5/0.5 и 1/1.
3. Non-uniform scale.
4. Rotation 0, 90, -45, 360.
5. Три уровня nested translate/scale/rotation.
6. World-to-local inverse.
7. Reparent между transformed groups.
8. Rejection non-finite/zero scale.

### Scene tree

1. Root components и groups.
2. Five-level nesting.
3. Visibility parent off.
4. Locked parent interaction.
5. Remove subtree.
6. Ungroup with world preservation.
7. Reorder within siblings.
8. Invalid cycle/drop.

### Renderer lifecycle

1. Mount/unmount без оставшихся listeners/timers.
2. Scene update add/remove/reparent/kind change.
3. Live media update без rebuild всей Scene.
4. Unknown kind placeholder diagnostics.
5. Config reload failure сохраняет текущий DOM.

### Parity fixtures

1. Все builtin themes.
2. Current audit Draft.
3. Deep nested synthetic Scene.
4. Every component kind.
5. Every scaleMode and viewport combination.
6. Fixed times enter/stable/out.
7. Demo and deterministic live media/audio frames.

### Interaction

1. Select leaf/group.
2. Drag at zoom 50/100/200%.
3. Resize rotated node.
4. Rotate group with children.
5. Change anchor without visual jump.
6. Reparent by Layers drag.
7. Undo текущим Stage 2F history adapter.

## 18. Performance budgets этапа

До реализации измеряется baseline на 15, 100 и 500 nodes. Stage 3 не утверждает произвольные числа без hardware profile.

Минимальное требование:

- interaction не создаёт полный DOM rebuild на каждом pointermove;
- live metadata/audio update не пересоздаёт статическое дерево;
- frame work имеет измеряемые counters;
- 15-node bundled themes не хуже baseline за пределами согласованной погрешности.

Окончательные release budgets фиксируются Stage 7.

## 19. Риски и меры

| Риск | Мера |
|---|---|
| CSS transform и matrix math расходятся | одна transform library + computed-style tests |
| Text bounds нестабильны | configured geometry + deterministic fonts/fixtures |
| Большой renderer rewrite ломает темы | расширять существующий renderer по контрактам |
| Reparent с rotation и non-uniform scale даёт skew | явно определить поддержку decomposition; блокировать непредставимый результат с диагностикой |
| Screenshot flaky | DOM/style parity как основной сигнал, screenshot как дополнительный |
| OBS compatibility | test matrix на реальном embedded browser |

## 20. Непредставимые transform

Комбинация reparent между неодинаково масштабированными и вращёнными группами может потребовать skew, которого нет в Scene v2. Алгоритм обязан:

- определить, можно ли разложить новую local matrix в translate/scale/rotation без значимого skew;
- выполнить операцию только в допустимом epsilon;
- иначе блокировать drop с понятным сообщением, а не незаметно искажать объект.

Добавление skew в 2.1 не входит в scope.

## 21. Rollback

- Shared Renderer contract внедряется на fixtures до удаления старого path.
- Preview и OBS переключаются на новый host по отдельности только в development comparison build.
- В production не поддерживаются два долгоживущих renderer path.
- Scene schema остаётся v2; rollback не требует обратной миграции, если Stage 3 не записывает недоступные старому build поля автоматически.

## 22. Зависимости и traceability

- Stage 2F exit gate.
- ADR-0002, ADR-0006, ADR-0007.
- P-02–P-08, P-18, A-02–A-04.
- OQ-02 и OQ-04 должны быть решены до финального UX acceptance.

## 23. Открытые вопросы

- Продуктовое поведение удаления группы — OQ-02.
- Доступность ручного размера холста — OQ-04.
- Точный modifier UX resize/selection может быть принят архитектором на основе стандартных редакторов и usability smoke; он не меняет data contract.

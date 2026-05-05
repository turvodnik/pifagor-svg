# Pifagor SVG

Pifagor SVG — macOS-приложение и Finder Quick Action для очистки SVG-иконок под Bricks Builder, WordPress и обычную HTML-вставку.

Публичный репозиторий: https://github.com/turvodnik/pifagor-svg

## Что делает

- Чистит SVG от безопасно удаляемого мусора: comments, metadata, пустые группы, лишние `defs`, безопасные `clipPath`.
- Переводит outline-иконки на `stroke="currentColor"` и выносит `stroke-width` на корневой `<svg>`.
- Переводит одноцветные filled-иконки на `fill="currentColor"`.
- Позволяет выбирать несколько SVG, листать их в приложении через горизонтальную ленту, видеть оригинал/результат и одной кнопкой применить текущие настройки ко всем выбранным файлам.
- Использует собственную macOS-иконку приложения из `Sources/PifagorSVG/Resources/AppIcon.icns`.
- Удаляет внешние ссылки, `<script>`, `<a>`, `onload`, `onclick` и другие `on*`-атрибуты.
- Удаляет безопасные `url(#clip...)`; сложные `mask`, `filter`, `gradient` не ломает и помечает как требующие ручного решения.
- Сохраняет результат рядом с оригиналом как `имя-opt.svg`, затем `имя-opt-2.svg`.

## Запуск приложения

```bash
swift run PifagorSVG
```

Для сборки `.app`:

```bash
./scripts/build-app-bundle.sh
open "dist/Pifagor SVG.app"
```

## CLI

```bash
swift run pifagor-svg-cli -- icon.svg
swift run pifagor-svg-cli -- --stroke-width 1.25 icons/
swift run pifagor-svg-cli -- --profile inline icon.svg
swift run pifagor-svg-cli -- --profile fixed --fixed-size 24 icon.svg
```

## Finder Quick Action

Установка:

```bash
./scripts/install-quick-action.sh
```

После установки:

1. Выберите один или несколько `.svg` файлов или папку в Finder.
2. Правая кнопка.
3. `Quick Actions`.
4. `Optimize with Pifagor SVG`.

Quick Action использует `~/.local/bin/pifagor-svg-cli`, создает `-opt.svg` рядом с оригиналами и пропускает SVG, где сложные внутренние ссылки нельзя безопасно убрать.

## Профили

- `Bricks currentColor`: профиль по умолчанию. Убирает `width/height`, оставляет `viewBox`, делает цвет управляемым через `color` в Bricks/CSS.
- `Inline 1em`: добавляет `width="1em"` и `height="1em"` для прямой HTML-вставки.
- `Fixed 24px`: выставляет фиксированный размер.

## Проверка

В этом окружении нет стандартных Swift `XCTest`/`Testing`, поэтому тесты ядра запускаются собственным runner:

```bash
swift run PifagorSVGCoreTestRunner
swift build --product pifagor-svg-cli
swift build --product PifagorSVG
```

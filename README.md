# Pifagor SVG

Pifagor SVG — macOS-приложение и Finder Quick Action для очистки SVG-иконок под Bricks Builder, WordPress и обычную HTML-вставку.

Публичный репозиторий: https://github.com/turvodnik/pifagor-svg

## Что делает

- Чистит SVG от безопасно удаляемого мусора: comments, metadata, пустые группы, лишние `defs`, безопасные `clipPath`.
- Переводит outline-иконки на `stroke="currentColor"` и выносит `stroke-width` на корневой `<svg>`.
- Переводит одноцветные filled-иконки на `fill="currentColor"`.
- Хранит профили оптимизации в `~/Library/Application Support/Pifagor SVG/profiles.json`.
- Позволяет создавать, дублировать, редактировать, удалять и сбрасывать профили с собственными размерами, цветами, stroke/fill и правилами очистки.
- В каждом профиле можно настроить сохранение: префикс, суффикс, перезапись существующего файла и папку вывода.
- Встроенный профиль `Рекомендованный` нельзя удалить; он рассчитан на Bricks Builder, WordPress и управление через `currentColor`, но его можно изменить и сбросить к заводским настройкам.
- Есть шаблон профиля `Логотипы`: он сохраняет фирменные цвета и фон, очищая только безопасный мусор.
- Позволяет выбирать несколько SVG, листать их в приложении через горизонтальную ленту, видеть оригинал/результат и одной кнопкой применить текущие настройки ко всем выбранным файлам.
- Позволяет очистить загруженный набор без перезапуска приложения и сразу выбрать новые SVG.
- Показывает мини-превью выбранных SVG прямо в ленте файлов.
- Позволяет отдельно менять и сбрасывать цвета предпросмотра: stroke, fill и фон. Эти цвета не записываются в SVG.
- Копирует компактный SVG для прямой вставки в HTML без лишнего `xmlns`; полный SVG и сохраненные `.svg` файлы сохраняют `xmlns`.
- Возле основных кнопок и настроек есть русские подсказки через значок `i`; подсказка открывается при наведении и по клику.
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
swift run pifagor-svg-cli -- --profile-name "Рекомендованный" icon.svg
swift run pifagor-svg-cli -- --profile inline icon.svg
swift run pifagor-svg-cli -- --profile fixed --fixed-size 24 icon.svg
```

Если `--profile` или `--profile-name` не передан, CLI использует активный профиль из приложения. Поэтому Finder Quick Action через правую кнопку работает с тем же профилем, который выбран в Pifagor SVG.

## Finder Quick Action

Установка:

```bash
./scripts/install-quick-action.sh
```

После установки:

1. Выберите один или несколько `.svg` файлов или папку в Finder.
2. Правая кнопка.
3. `Быстрые действия` / `Quick Actions`.
4. `Очистить SVG в Pifagor SVG`.

Quick Action использует `~/.local/bin/pifagor-svg-cli`, читает активный профиль приложения, создает `-opt.svg` рядом с оригиналами и пропускает SVG, где сложные внутренние ссылки нельзя безопасно убрать.

## Профили

- `Рекомендованный`: профиль по умолчанию для Bricks Builder. Убирает `width/height`, оставляет `viewBox`, делает цвет управляемым через `color` в Bricks/CSS и включает полную безопасную очистку.
- `Логотипы`: шаблон для создания пользовательского профиля. Сохраняет исходные цвета и фон, не переводит логотип в `currentColor`.
- Пользовательские профили могут задавать `px`, `em`, `rem`, `%`, stroke/fill, толщину stroke, удаление фона, очистку `defs`, safe `clipPath`, `style`, `id`, пустых групп, простых `<use>` и внутренних `url(#...)`, а также правила сохранения файлов.

## Проверка

В этом окружении нет стандартных Swift `XCTest`/`Testing`, поэтому тесты ядра запускаются собственным runner:

```bash
swift run PifagorSVGCoreTestRunner
swift build --product pifagor-svg-cli
swift build --product PifagorSVG
```

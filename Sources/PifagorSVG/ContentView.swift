import AppKit
import PifagorSVGCore
import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @StateObject private var viewModel = AppViewModel()
    @State private var isShowingProfileManager = false

    var body: some View {
        VStack(spacing: 0) {
            ToolbarView(
                viewModel: viewModel,
                isShowingProfileManager: $isShowingProfileManager
            )
            Divider()
            FileNavigatorView(viewModel: viewModel)
            Divider()
            HSplitView {
                CodeColumn(
                    title: "Оригинал: \(viewModel.currentFileName)",
                    code: $viewModel.originalCode,
                    previewSVG: viewModel.originalCode,
                    previewColors: viewModel.previewColors
                )
                CodeColumn(
                    title: "Результат",
                    code: $viewModel.optimizedCode,
                    previewSVG: viewModel.optimizedCode,
                    previewColors: viewModel.previewColors
                )
            }
            Divider()
            StatusView(viewModel: viewModel)
        }
        .onDrop(
            of: [UTType.fileURL.identifier, UTType.utf8PlainText.identifier, UTType.plainText.identifier],
            isTargeted: $viewModel.isDropTargeted,
            perform: viewModel.handleDrop(providers:)
        )
        .overlay {
            if viewModel.isDropTargeted {
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.accentColor, lineWidth: 3)
                    .padding(10)
                    .allowsHitTesting(false)
            }
        }
        .sheet(isPresented: $isShowingProfileManager) {
            ProfileManagerView(
                viewModel: viewModel,
                isPresented: $isShowingProfileManager
            )
        }
    }
}

private struct ToolbarView: View {
    @ObservedObject var viewModel: AppViewModel
    @Binding var isShowingProfileManager: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text("Pifagor SVG")
                    .font(.title2.weight(.semibold))
                Spacer()
                ToolbarAction(title: "Выбрать SVG", tip: "Выберите один или несколько SVG-файлов. После выбора их можно листать в ленте и сравнивать оригинал с результатом.") {
                    viewModel.chooseFiles()
                }
                ToolbarAction(title: "Выбрать папку", tip: "Выберите папку, чтобы загрузить все SVG внутри нее для массовой оптимизации.") {
                    viewModel.chooseFolder()
                }
                ToolbarAction(title: "Оптимизировать код", tip: "Пересчитывает SVG-код из левой колонки по активному профилю. Полезно после ручной правки кода.") {
                    viewModel.optimizeCurrentCode()
                }
                ToolbarAction(
                    title: "Применить ко всем и сохранить",
                    tip: "Применяет активный профиль ко всем выбранным SVG и сохраняет рядом файлы с суффиксом -opt.svg.",
                    isDisabled: viewModel.selectedFiles.isEmpty
                ) {
                    viewModel.batchOptimizeSelected()
                }

                ToolbarAction(
                    title: "Очистить",
                    tip: "Очищает загруженные SVG из приложения, чтобы выбрать новый набор без перезапуска.",
                    isDisabled: !viewModel.hasSelectedFiles && viewModel.originalCode.isEmpty
                ) {
                    viewModel.clearLoadedIcons()
                }
            }

            HStack(spacing: 14) {
                HStack(spacing: 5) {
                    Picker("Профиль", selection: activeProfileBinding) {
                        ForEach(viewModel.profiles) { profile in
                            Text(profile.name).tag(profile.id)
                        }
                    }
                    .frame(width: 260)
                    InfoTip("Активный профиль определяет цвет, размеры, stroke/fill и правила очистки. Он же используется Quick Action через правую кнопку Finder.")
                }

                ToolbarAction(title: "Профили...", tip: "Открывает список профилей. Там можно создать, дублировать, удалить, сбросить и настроить профиль под Bricks, HTML, логотипы или свои правила.") {
                    isShowingProfileManager = true
                }

                PreviewColorControls(viewModel: viewModel)

                Spacer()

                ToolbarAction(
                    title: "Скопировать полный SVG",
                    tip: "Копирует читаемую версию результата с переносами строк. Удобно для проверки или хранения.",
                    isDisabled: !viewModel.canSaveCodeResult
                ) {
                    viewModel.copyFullSVG()
                }

                ToolbarAction(
                    title: "Скопировать компактный SVG",
                    tip: "Копирует короткую версию без лишних пробелов и переносов. Удобно для прямой вставки в HTML.",
                    isDisabled: viewModel.compactCode.isEmpty
                ) {
                    viewModel.copyCompactSVG()
                }

                ToolbarAction(
                    title: "Сохранить",
                    tip: "Сохраняет только текущий выбранный и отредактированный SVG по настройкам активного профиля: папка, префикс, суффикс и перезапись.",
                    isDisabled: !viewModel.canSaveCodeResult
                ) {
                    viewModel.saveOptimizedCode()
                }
            }

            Text(viewModel.activeProfileDescription)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(14)
    }

    private var activeProfileBinding: Binding<UUID> {
        Binding(
            get: { viewModel.profileState.activeProfileID },
            set: { viewModel.setActiveProfile(id: $0) }
        )
    }
}

private struct PreviewColorControls: View {
    @ObservedObject var viewModel: AppViewModel

    var body: some View {
        HStack(spacing: 7) {
            Text("Цвета предпросмотра")
                .font(.callout)
            CompactColorPicker(title: "current", selection: $viewModel.previewCurrentColor)
            CompactColorPicker(title: "stroke", selection: $viewModel.previewStrokeColor)
            CompactColorPicker(title: "fill", selection: $viewModel.previewFillColor)
            CompactColorPicker(title: "фон", selection: $viewModel.previewBackgroundColor)
            InfoTip("Эти цвета меняют только предпросмотр в приложении. В SVG они не записываются. Так можно проверить белую иконку на сером фоне или отдельно увидеть stroke/fill.")
        }
    }
}

private struct CompactColorPicker: View {
    let title: String
    @Binding var selection: Color

    var body: some View {
        HStack(spacing: 3) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            ColorPicker(title, selection: $selection, supportsOpacity: false)
                .labelsHidden()
                .frame(width: 28)
        }
        .help(title)
    }
}

private struct InfoTip: View {
    let text: String
    @State private var isHovering = false
    @State private var isPinned = false

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Button {
            isPinned.toggle()
        } label: {
            Text("i")
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .foregroundStyle(isPinned ? Color.accentColor : Color.secondary)
                .frame(width: 15, height: 15)
                .overlay(
                    Circle()
                        .stroke(isPinned ? Color.accentColor : Color.secondary.opacity(0.65), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .focusable(false)
        .onHover { isHovering in
            self.isHovering = isHovering
        }
        .popover(isPresented: presentationBinding, arrowEdge: .top) {
            Text(text)
                .font(.callout)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(12)
                .frame(width: 300, alignment: .leading)
        }
        .help(text)
            .accessibilityLabel("Информация")
            .accessibilityHint(text)
    }

    private var presentationBinding: Binding<Bool> {
        Binding(
            get: { isHovering || isPinned },
            set: { newValue in
                if !newValue {
                    isHovering = false
                    isPinned = false
                }
            }
        )
    }
}

private struct ToolbarAction: View {
    let title: String
    let tip: String
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Button(title, action: action)
                .disabled(isDisabled)
            InfoTip(tip)
        }
    }
}

private struct ProfileManagerView: View {
    @ObservedObject var viewModel: AppViewModel
    @Binding var isPresented: Bool
    @State private var selectedProfileID: UUID
    @State private var draft: SVGUserProfile

    init(viewModel: AppViewModel, isPresented: Binding<Bool>) {
        self.viewModel = viewModel
        self._isPresented = isPresented
        let active = viewModel.activeProfile
        self._selectedProfileID = State(initialValue: active.id)
        self._draft = State(initialValue: active)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Профили оптимизации")
                    .font(.title3.weight(.semibold))
                Spacer()
                Button("Сохранить профиль") {
                    viewModel.saveProfile(draft)
                    selectedProfileID = draft.id
                }
                InfoTip("Сохраняет название, описание, размеры, цвета и правила очистки выбранного профиля.")
                Button("Готово") {
                    isPresented = false
                }
                .keyboardShortcut(.defaultAction)
            }
            .padding(18)

            Divider()

            HSplitView {
                VStack(alignment: .leading, spacing: 10) {
                    ProfileListView(
                        viewModel: viewModel,
                        selectedProfileID: $selectedProfileID,
                        draft: $draft
                    )
                }
                .frame(minWidth: 260, idealWidth: 290)
                .padding(14)

                Divider()

                ScrollView {
                    ProfileEditorView(draft: $draft)
                        .padding(18)
                }
                .frame(minWidth: 560)
            }
        }
        .frame(width: 920, height: 720)
        .onChange(of: selectedProfileID) { _, newValue in
            if let profile = viewModel.profiles.first(where: { $0.id == newValue }) {
                draft = profile
            }
        }
    }
}

private struct ProfileListView: View {
    @ObservedObject var viewModel: AppViewModel
    @Binding var selectedProfileID: UUID
    @Binding var draft: SVGUserProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 5) {
                Text("Профили")
                    .font(.headline)
                InfoTip("Профиль хранит все правила оптимизации: размер, цвет, stroke/fill и очистку SVG. Активный профиль используется в приложении и Finder Quick Action.")
            }

            List(selection: $selectedProfileID) {
                ForEach(viewModel.profiles) { profile in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(profile.name)
                            .font(.callout.weight(profile.id == viewModel.activeProfile.id ? .semibold : .regular))
                        Text(profile.description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    .tag(profile.id)
                }
            }
            .frame(minHeight: 360)

            ProfileButton(title: "Сделать активным", tip: "Активный профиль применяется к предпросмотру, массовому сохранению и Quick Action в Finder.") {
                viewModel.setActiveProfile(id: selectedProfileID)
            }

            ProfileButton(title: "Создать", tip: "Создает новый профиль на базе рекомендованных настроек Bricks currentColor.") {
                draft = viewModel.createBlankProfile()
                selectedProfileID = draft.id
            }

            ProfileButton(title: "Создать из шаблона «Логотипы»", tip: "Создает профиль для логотипов: фирменные цвета и фон сохраняются, опасный SVG-мусор очищается.") {
                draft = viewModel.createLogoProfile()
                selectedProfileID = draft.id
            }

            ProfileButton(title: "Дублировать", tip: "Создает копию выбранного профиля. Удобно делать варианты с другим цветом, размером или толщиной линии.") {
                if let profile = viewModel.duplicateProfile(id: selectedProfileID) {
                    draft = profile
                    selectedProfileID = profile.id
                }
            }

            ProfileButton(
                title: "Удалить",
                tip: "Удаляет выбранный пользовательский профиль. Рекомендованный профиль удалить нельзя.",
                isDisabled: draft.isBuiltIn
            ) {
                viewModel.deleteProfile(id: selectedProfileID)
                selectedProfileID = viewModel.activeProfile.id
                draft = viewModel.activeProfile
            }

            ProfileButton(
                title: "Сбросить",
                tip: "Возвращает рекомендованный профиль к заводским настройкам: currentColor, без размеров и полная безопасная очистка.",
                isDisabled: selectedProfileID != SVGUserProfile.recommendedID
            ) {
                viewModel.resetProfile(id: selectedProfileID)
                draft = viewModel.activeProfile
                selectedProfileID = draft.id
            }
        }
    }
}

private struct ProfileButton: View {
    let title: String
    let tip: String
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        HStack(spacing: 5) {
            Button(title, action: action)
                .frame(maxWidth: .infinity, alignment: .leading)
                .disabled(isDisabled)
            InfoTip(tip)
        }
    }
}

private struct ProfileEditorView: View {
    @Binding var draft: SVGUserProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            SettingsSection(title: "Название и описание") {
                InfoRow("Название", tip: "Название отображается в переключателе профилей на главном экране.") {
                    TextField("Название профиля", text: $draft.name)
                        .textFieldStyle(.roundedBorder)
                        .frame(maxWidth: 360)
                }

                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 5) {
                        Text("Описание")
                        InfoTip("Коротко напишите, для чего подходит профиль: Bricks, HTML-вставка, логотипы, фиксированные иконки, цветовая схема клиента.")
                    }
                    TextEditor(text: $draft.description)
                        .font(.body)
                        .frame(height: 74)
                        .overlay(
                            RoundedRectangle(cornerRadius: 5)
                                .stroke(Color.secondary.opacity(0.25), lineWidth: 1)
                        )
                }
            }

            SettingsSection(title: "Сохранение файлов") {
                InfoRow("Папка", tip: "Туда будет сохраняться текущий файл и массовая оптимизация. «Та же папка» сохраняет рядом с оригиналом.") {
                    Picker("", selection: $draft.options.outputDirectoryMode) {
                        Text("Та же папка").tag(SVGOutputDirectoryMode.sameFolder)
                        Text("Другая папка").tag(SVGOutputDirectoryMode.custom)
                    }
                    .labelsHidden()
                    .frame(width: 180)
                }

                if draft.options.outputDirectoryMode == .custom {
                    HStack(spacing: 8) {
                        InfoRow("Куда", tip: "Путь к папке, куда будут сохраняться новые SVG по этому профилю.") {
                            TextField("/Users/...", text: $draft.options.customOutputDirectory)
                                .textFieldStyle(.roundedBorder)
                                .frame(minWidth: 280)
                        }
                        Button("Выбрать") {
                            chooseOutputFolder()
                        }
                    }
                }

                InfoRow("Префикс", tip: "Добавляется перед исходным именем файла. Например prefix icon.svg станет prefixicon-opt.svg.") {
                    TextField("", text: $draft.options.outputPrefix)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 140)
                }

                InfoRow("Суффикс", tip: "Добавляется после исходного имени файла. По умолчанию -opt: icon.svg становится icon-opt.svg.") {
                    TextField("-opt", text: $draft.options.outputSuffix)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 140)
                }

                ToggleRow("Заменять существующий результат", tip: "Если включено, файл с таким именем будет перезаписан. Если выключено, приложение создаст -2, -3 и так далее.", isOn: $draft.options.overwriteExistingOutput)
            }

            SettingsSection(title: "Размер SVG") {
                InfoRow("Режим", tip: "Без размеров удаляет width/height и оставляет viewBox. Это лучший вариант для Bricks и CSS. 1em удобен для inline HTML. Фиксированный размер записывает width/height.") {
                    Picker("", selection: $draft.options.sizeMode) {
                        Text("Без размеров").tag(SVGSizeMode.none)
                        Text("1em").tag(SVGSizeMode.inline1em)
                        Text("Фиксированный").tag(SVGSizeMode.fixed)
                    }
                    .labelsHidden()
                    .frame(width: 220)
                }

                if draft.options.sizeMode == .fixed {
                    HStack(spacing: 10) {
                        InfoRow("Ширина", tip: "Число для width. Единица выбирается рядом: px, em, rem или %.") {
                            NumberStepperField(value: $draft.options.fixedWidth, fallback: 24, step: 1, width: 78)
                        }

                        Toggle("Связать", isOn: $draft.options.lockSize)
                            .toggleStyle(.checkbox)
                            .help("Если включено, height будет таким же как width.")

                        InfoRow("Высота", tip: "Число для height. Используется, когда связь ширины и высоты выключена.") {
                            NumberStepperField(value: $draft.options.fixedHeight, fallback: 24, step: 1, width: 78)
                                .disabled(draft.options.lockSize)
                        }

                        Picker("Ед.", selection: $draft.options.sizeUnit) {
                            Text("px").tag(SVGSizeUnit.px)
                            Text("em").tag(SVGSizeUnit.em)
                            Text("rem").tag(SVGSizeUnit.rem)
                            Text("%").tag(SVGSizeUnit.percent)
                        }
                        .frame(width: 90)
                    }
                }
            }

            SettingsSection(title: "Stroke и fill") {
                InfoRow("Stroke", tip: "Цвет линии. currentColor позволяет Bricks и CSS управлять цветом через свойство color.") {
                    Picker("", selection: $draft.options.strokeColorMode) {
                        Text("currentColor").tag(SVGColorMode.currentColor)
                        Text("Конкретный").tag(SVGColorMode.custom)
                        Text("Сохранять").tag(SVGColorMode.preserve)
                    }
                    .labelsHidden()
                    .frame(width: 220)
                }

                InfoRow("Цвет stroke", tip: "Используется только когда Stroke = «Конкретный». Например #008dcc.") {
                    HexColorField(hex: $draft.options.strokeColor)
                        .disabled(draft.options.strokeColorMode != .custom)
                }

                InfoRow("Fill", tip: "Цвет заливки. Для outline-иконок обычно лучше none или currentColor, для логотипов — сохранять.") {
                    Picker("", selection: $draft.options.fillColorMode) {
                        Text("currentColor").tag(SVGFillColorMode.currentColor)
                        Text("Конкретный").tag(SVGFillColorMode.custom)
                        Text("Сохранять").tag(SVGFillColorMode.preserve)
                        Text("none").tag(SVGFillColorMode.none)
                    }
                    .labelsHidden()
                    .frame(width: 220)
                }

                InfoRow("Цвет fill", tip: "Используется только когда Fill = «Конкретный».") {
                    HexColorField(hex: $draft.options.fillColor)
                        .disabled(draft.options.fillColorMode != .custom)
                }

                InfoRow("Stroke width", tip: "Можно задать толщину линии или сохранить исходную толщину из SVG.") {
                    Picker("", selection: $draft.options.strokeWidthMode) {
                        Text("Задать").tag(SVGStrokeWidthMode.set)
                        Text("Сохранять").tag(SVGStrokeWidthMode.preserve)
                    }
                    .labelsHidden()
                    .frame(width: 160)
                    NumberStepperField(value: $draft.options.strokeWidth, fallback: 1.5, step: 0.25, width: 78)
                        .disabled(draft.options.strokeWidthMode != .set)
                }
            }

            SettingsSection(title: "Очистка и перенос") {
                ToggleRow("Выносить fill/stroke/stroke-width на корневой <svg>", tip: "Убирает повторяющиеся атрибуты из path и переносит общие значения наверх, чтобы ими проще было управлять.", isOn: $draft.options.movePaintToRoot)
                ToggleRow("Переносить поддерживаемые inline style в SVG-атрибуты", tip: "Преобразует style=\"stroke: ...; fill: ...\" в обычные SVG-атрибуты и удаляет style, если свойства безопасны.", isOn: $draft.options.convertInlineStyles)
                ToggleRow("Удалять безопасные clipPath на весь viewBox", tip: "Удаляет clip-path=\"url(#...)\" только если он просто обрезает SVG по полному viewBox и не меняет вид иконки.", isOn: $draft.options.removeSafeClipPaths)
                ToggleRow("Разворачивать простые <use href=\"#...\">", tip: "Заменяет простые <use> реальными SVG-элементами, чтобы в результате не оставались href=\"#...\" зависимости.", isOn: $draft.options.expandUseReferences)
                ToggleRow("Удалять неиспользуемые <defs>", tip: "Удаляет defs после безопасного удаления внутренних ссылок. Если SVG содержит нужный градиент или маску, файл получит ручное решение.", isOn: $draft.options.removeUnusedDefs)
                ToggleRow("Удалять ненужные id", tip: "Удаляет id, когда на них больше нет ссылок. Это уменьшает SVG и убирает #id-зависимости.", isOn: $draft.options.removeIDs)
                ToggleRow("Разворачивать пустые группы <g>", tip: "Убирает группы без нужных атрибутов и поднимает их содержимое выше, чтобы SVG был короче.", isOn: $draft.options.unwrapEmptyGroups)
                ToggleRow("Удалять фоновые rect на весь viewBox", tip: "Удаляет прямоугольный фон, занимающий весь viewBox. Для логотипов обычно выключено, для иконок включайте вручную.", isOn: $draft.options.removeBackground)
                ToggleRow("Не оставлять url(#...), href=\"#...\" и другие #id-ссылки", tip: "Если включено, сложные mask/filter/gradient не будут молча ломаться: приложение покажет ручное решение и не сохранит плохой SVG.", isOn: $draft.options.requireNoInternalReferences)
            }

            SettingsSection(title: "Безопасность") {
                Label("Всегда удаляются <script>, внешние/data/file URL, <foreignObject>, <image>, <feImage>, <a> и onload/onclick/on*.", systemImage: "lock.fill")
                    .foregroundStyle(.secondary)
                InfoTip("Эти правила не отключаются в профилях, потому что они защищают WordPress, браузер и предпросмотр от активного или внешнего содержимого.")
            }
        }
    }

    private func chooseOutputFolder() {
        let panel = NSOpenPanel()
        panel.title = "Выберите папку для сохранения SVG"
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            draft.options.customOutputDirectory = url.path
        }
    }
}

private struct InfoRow<Content: View>: View {
    let title: String
    let tip: String
    @ViewBuilder let content: Content

    init(_ title: String, tip: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.tip = tip
        self.content = content()
    }

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 4) {
                Text(title)
                    .frame(width: 120, alignment: .leading)
                InfoTip(tip)
            }
            content
        }
    }
}

private struct HexColorField: View {
    @Binding var hex: String

    var body: some View {
        HStack(spacing: 8) {
            ColorPicker("", selection: colorBinding, supportsOpacity: false)
                .labelsHidden()
                .frame(width: 34)
            TextField("#000000", text: normalizedHexBinding)
                .textFieldStyle(.roundedBorder)
                .frame(width: 110)
        }
    }

    private var colorBinding: Binding<Color> {
        Binding(
            get: { Color(hexString: hex) ?? .black },
            set: { hex = $0.hexString }
        )
    }

    private var normalizedHexBinding: Binding<String> {
        Binding(
            get: { hex },
            set: { value in
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                hex = trimmed.hasPrefix("#") ? trimmed : "#\(trimmed)"
            }
        )
    }
}

private struct NumberStepperField: View {
    @Binding var value: String
    let fallback: Double
    let step: Double
    let width: CGFloat

    var body: some View {
        HStack(spacing: 5) {
            TextField("", text: $value)
                .textFieldStyle(.roundedBorder)
                .frame(width: width)
            Stepper("", value: numberBinding, in: 0...9999, step: step)
                .labelsHidden()
        }
    }

    private var numberBinding: Binding<Double> {
        Binding(
            get: { Double(value.trimmingCharacters(in: .whitespacesAndNewlines)) ?? fallback },
            set: { value = formatted($0) }
        )
    }

    private func formatted(_ number: Double) -> String {
        if number.rounded() == number {
            return String(Int(number))
        }
        return String(format: "%.2f", number)
            .replacingOccurrences(of: #"0+$"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"\.$"#, with: "", options: .regularExpression)
    }
}

private struct ToggleRow: View {
    let title: String
    let tip: String
    @Binding var isOn: Bool

    init(_ title: String, tip: String, isOn: Binding<Bool>) {
        self.title = title
        self.tip = tip
        self._isOn = isOn
    }

    var body: some View {
        HStack(spacing: 5) {
            Toggle(title, isOn: $isOn)
                .toggleStyle(.checkbox)
            InfoTip(tip)
        }
    }
}

private struct SettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            VStack(alignment: .leading, spacing: 8) {
                content
            }
        }
    }
}

private struct FileNavigatorView: View {
    @ObservedObject var viewModel: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Text("Выбранные SVG")
                    .font(.callout.weight(.semibold))
                InfoTip("Лента показывает все выбранные SVG. Нажмите на файл или используйте стрелки, чтобы проверить оптимизацию каждой иконки перед массовым сохранением.")

                Text(viewModel.selectedPositionText)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 90, alignment: .leading)

                Button {
                    viewModel.selectPreviousFile()
                } label: {
                    Image(systemName: "chevron.left")
                }
                .buttonStyle(.bordered)
                .disabled(!viewModel.hasMultipleSelectedFiles)
                .help("Предыдущая SVG-иконка")
                InfoTip("Переход к предыдущей выбранной SVG-иконке.")

                Button {
                    viewModel.selectNextFile()
                } label: {
                    Image(systemName: "chevron.right")
                }
                .buttonStyle(.bordered)
                .disabled(!viewModel.hasMultipleSelectedFiles)
                .help("Следующая SVG-иконка")
                InfoTip("Переход к следующей выбранной SVG-иконке.")

                Spacer()

                if viewModel.hasSelectedFiles {
                    Text("Нажмите на файл в ленте или листайте стрелками.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if viewModel.selectedFiles.isEmpty {
                Text("Файлы не выбраны")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
            } else {
                ScrollView(.horizontal, showsIndicators: true) {
                    HStack(spacing: 8) {
                        ForEach(Array(viewModel.selectedFiles.enumerated()), id: \.offset) { index, url in
                            FileChip(
                                index: index,
                                url: url,
                                fileName: url.lastPathComponent,
                                isSelected: index == viewModel.selectedFileIndex,
                                previewColors: viewModel.previewColors
                            ) {
                                viewModel.selectFile(at: index)
                            }
                        }
                    }
                    .padding(.bottom, 2)
                }
                .frame(height: 44)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }
}

private struct FileChip: View {
    let index: Int
    let url: URL
    let fileName: String
    let isSelected: Bool
    let previewColors: SVGPreviewColors
    let action: () -> Void
    @State private var svg = ""

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                Text(String(format: "%02d", index + 1))
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(isSelected ? Color.white : Color.secondary)

                SVGPreview(
                    svg: svg,
                    colors: previewColors,
                    showsCheckerboard: false,
                    stageLimit: 20
                )
                .frame(width: 22, height: 22)
                .clipShape(RoundedRectangle(cornerRadius: 4))

                Text(fileName)
                    .font(.caption)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .frame(width: 206, height: 32, alignment: .leading)
            .padding(.horizontal, 10)
            .background(isSelected ? Color.accentColor : Color.secondary.opacity(0.10))
            .foregroundStyle(isSelected ? Color.white : Color.primary)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(isSelected ? Color.accentColor : Color.secondary.opacity(0.20), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .help(fileName)
        .onAppear(perform: loadSVG)
        .onChange(of: url) { _, _ in
            loadSVG()
        }
    }

    private func loadSVG() {
        svg = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
    }
}

private struct CodeColumn: View {
    let title: String
    @Binding var code: String
    let previewSVG: String
    let previewColors: SVGPreviewColors

    var body: some View {
        VStack(spacing: 0) {
            Text(title)
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)

            VSplitView {
                SVGPreview(svg: previewSVG, colors: previewColors, stageLimit: 128)
                    .frame(minHeight: 120, idealHeight: 170)

                TextEditor(text: $code)
                    .font(.system(.body, design: .monospaced))
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .frame(minHeight: 260)
            }
        }
        .frame(minWidth: 420)
    }
}

private struct StatusView: View {
    @ObservedObject var viewModel: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 5) {
                Text(viewModel.statusText)
                    .font(.callout)
                InfoTip("Здесь показан результат оптимизации. Если SVG требует ручного решения, ниже появится причина: сложная маска, фильтр, градиент или другая #id-ссылка, которую нельзя безопасно удалить.")
            }
            if !viewModel.warnings.isEmpty {
                ScrollView {
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(viewModel.warnings, id: \.self) { warning in
                            Text("• \(warning)")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 80)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private extension Color {
    init?(hexString: String) {
        let cleaned = hexString
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "#"))

        guard cleaned.count == 6,
              let value = Int(cleaned, radix: 16) else {
            return nil
        }

        let red = Double((value >> 16) & 0xFF) / 255.0
        let green = Double((value >> 8) & 0xFF) / 255.0
        let blue = Double(value & 0xFF) / 255.0
        self = Color(red: red, green: green, blue: blue)
    }

    var hexString: String {
        let nsColor = NSColor(self).usingColorSpace(.deviceRGB) ?? .black
        let red = Int((nsColor.redComponent * 255).rounded())
        let green = Int((nsColor.greenComponent * 255).rounded())
        let blue = Int((nsColor.blueComponent * 255).rounded())
        return String(format: "#%02X%02X%02X", red, green, blue)
    }
}

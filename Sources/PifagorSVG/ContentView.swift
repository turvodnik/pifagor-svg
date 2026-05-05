import PifagorSVGCore
import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @StateObject private var viewModel = AppViewModel()

    var body: some View {
        VStack(spacing: 0) {
            ToolbarView(viewModel: viewModel)
            Divider()
            FileNavigatorView(viewModel: viewModel)
            Divider()
            HSplitView {
                CodeColumn(
                    title: "Оригинал: \(viewModel.currentFileName)",
                    code: $viewModel.originalCode,
                    previewSVG: viewModel.originalCode,
                    previewColor: viewModel.previewColor
                )
                CodeColumn(
                    title: "Результат",
                    code: $viewModel.optimizedCode,
                    previewSVG: viewModel.optimizedCode,
                    previewColor: viewModel.previewColor
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
        .onChange(of: viewModel.profile) { _, _ in
            viewModel.optimizeCurrentCode()
        }
        .onChange(of: viewModel.strokeWidth) { _, _ in
            viewModel.optimizeCurrentCode()
        }
        .onChange(of: viewModel.fixedSize) { _, _ in
            viewModel.optimizeCurrentCode()
        }
        .onChange(of: viewModel.removeBackground) { _, _ in
            viewModel.optimizeCurrentCode()
        }
    }
}

private struct ToolbarView: View {
    @ObservedObject var viewModel: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text("Pifagor SVG")
                    .font(.title2.weight(.semibold))
                Spacer()
                Button("Выбрать SVG") {
                    viewModel.chooseFiles()
                }
                Button("Выбрать папку") {
                    viewModel.chooseFolder()
                }
                Button("Оптимизировать код") {
                    viewModel.optimizeCurrentCode()
                }
                Button("Применить ко всем и сохранить") {
                    viewModel.batchOptimizeSelected()
                }
                .disabled(viewModel.selectedFiles.isEmpty)
            }

            HStack(spacing: 14) {
                Picker("Профиль", selection: $viewModel.profile) {
                    Text("Bricks currentColor").tag(SVGOptimizationProfile.bricksCurrentColor)
                    Text("Inline 1em").tag(SVGOptimizationProfile.inline1em)
                    Text("Fixed 24px").tag(SVGOptimizationProfile.fixed24)
                }
                .frame(width: 260)

                LabeledContent("Stroke") {
                    TextField("1.5", text: $viewModel.strokeWidth)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 70)
                }

                LabeledContent("Fixed") {
                    TextField("24", text: $viewModel.fixedSize)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 70)
                }

                Toggle("Удалять фон", isOn: $viewModel.removeBackground)
                    .toggleStyle(.checkbox)

                ColorPicker("Цвет предпросмотра", selection: $viewModel.previewColor)

                Spacer()

                Button("Скопировать полный SVG") {
                    viewModel.copyFullSVG()
                }
                .disabled(!viewModel.canSaveCodeResult)

                Button("Скопировать компактный SVG") {
                    viewModel.copyCompactSVG()
                }
                .disabled(viewModel.compactCode.isEmpty)

                Button("Сохранить -opt.svg") {
                    viewModel.saveOptimizedCode()
                }
                .disabled(!viewModel.canSaveCodeResult)
            }
        }
        .padding(14)
    }
}

private struct FileNavigatorView: View {
    @ObservedObject var viewModel: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Text("Выбранные SVG")
                    .font(.callout.weight(.semibold))

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

                Button {
                    viewModel.selectNextFile()
                } label: {
                    Image(systemName: "chevron.right")
                }
                .buttonStyle(.bordered)
                .disabled(!viewModel.hasMultipleSelectedFiles)
                .help("Следующая SVG-иконка")

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
                                fileName: url.lastPathComponent,
                                isSelected: index == viewModel.selectedFileIndex
                            ) {
                                viewModel.selectFile(at: index)
                            }
                        }
                    }
                    .padding(.bottom, 2)
                }
                .frame(height: 38)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }
}

private struct FileChip: View {
    let index: Int
    let fileName: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                Text(String(format: "%02d", index + 1))
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(isSelected ? Color.white : Color.secondary)

                Text(fileName)
                    .font(.caption)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .frame(width: 176, height: 28, alignment: .leading)
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
    }
}

private struct CodeColumn: View {
    let title: String
    @Binding var code: String
    let previewSVG: String
    let previewColor: Color

    var body: some View {
        VStack(spacing: 0) {
            Text(title)
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)

            SVGPreview(svg: previewSVG, previewColor: previewColor)
                .frame(minHeight: 220, idealHeight: 260)

            Divider()

            TextEditor(text: $code)
                .font(.system(.body, design: .monospaced))
                .scrollContentBackground(.hidden)
                .padding(8)
        }
        .frame(minWidth: 420)
    }
}

private struct StatusView: View {
    @ObservedObject var viewModel: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(viewModel.statusText)
                .font(.callout)
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

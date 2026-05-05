import AppKit
import Foundation
import PifagorSVGCore
import SwiftUI
import UniformTypeIdentifiers

@MainActor
final class AppViewModel: ObservableObject {
    @Published var originalCode = ""
    @Published var optimizedCode = ""
    @Published var compactCode = ""
    @Published var warnings: [String] = []
    @Published var statusText = "Добавьте SVG-файл, папку или вставьте код."
    @Published var selectedFiles: [URL] = []
    @Published var profile: SVGOptimizationProfile = .bricksCurrentColor
    @Published var strokeWidth = "1.5"
    @Published var fixedSize = "24"
    @Published var removeBackground = false
    @Published var previewColor = Color.black
    @Published var isDropTargeted = false

    private let optimizer = SVGOptimizer()

    var options: SVGOptimizationOptions {
        SVGOptimizationOptions(
            profile: profile,
            strokeWidth: normalized(strokeWidth, fallback: "1.5"),
            fixedSize: normalized(fixedSize, fallback: "24"),
            removeBackground: removeBackground
        )
    }

    var canSaveCodeResult: Bool {
        !optimizedCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func optimizeCurrentCode() {
        do {
            let result = try optimizer.optimize(originalCode, options: options)
            optimizedCode = result.fullSVG
            compactCode = result.compactSVG
            warnings = result.warnings
            statusText = result.status == .optimized
                ? "Код оптимизирован."
                : "Требует ручного решения: есть сложные внутренние ссылки."
        } catch {
            optimizedCode = ""
            compactCode = ""
            warnings = ["\(error)"]
            statusText = "Ошибка оптимизации SVG-кода."
        }
    }

    func chooseFiles() {
        let panel = NSOpenPanel()
        panel.title = "Выберите SVG-файлы"
        panel.allowsMultipleSelection = true
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.svg]

        if panel.runModal() == .OK {
            load(urls: panel.urls)
        }
    }

    func chooseFolder() {
        let panel = NSOpenPanel()
        panel.title = "Выберите папку с SVG"
        panel.allowsMultipleSelection = false
        panel.canChooseFiles = false
        panel.canChooseDirectories = true

        if panel.runModal() == .OK {
            load(urls: panel.urls)
        }
    }

    func load(urls: [URL]) {
        selectedFiles = collectSVGFiles(from: urls)
        guard let first = selectedFiles.first else {
            statusText = "SVG-файлы не найдены."
            return
        }

        do {
            originalCode = try String(contentsOf: first, encoding: .utf8)
            statusText = selectedFiles.count == 1
                ? "Загружен \(first.lastPathComponent)."
                : "Загружено файлов: \(selectedFiles.count). Первый показан в редакторе."
            optimizeCurrentCode()
        } catch {
            statusText = "Не удалось прочитать \(first.lastPathComponent)."
            warnings = ["\(error)"]
        }
    }

    func batchOptimizeSelected() {
        guard !selectedFiles.isEmpty else {
            statusText = "Сначала выберите SVG-файлы или папку."
            return
        }

        let files = selectedFiles
        let currentOptions = options
        statusText = "Идет массовая оптимизация: \(files.count) файлов."

        Task.detached(priority: .userInitiated) {
            let processor = SVGFileProcessor()
            var created = 0
            var skipped: [String] = []

            for file in files {
                do {
                    _ = try processor.optimizeFile(at: file, options: currentOptions)
                    created += 1
                } catch {
                    skipped.append("\(file.lastPathComponent): \(error)")
                }
            }

            await MainActor.run {
                self.warnings = skipped
                self.statusText = skipped.isEmpty
                    ? "Готово: создано \(created) файлов -opt.svg."
                    : "Создано \(created), пропущено \(skipped.count)."
            }
        }
    }

    func saveOptimizedCode() {
        guard canSaveCodeResult else {
            statusText = "Нет оптимизированного SVG для сохранения."
            return
        }

        let panel = NSSavePanel()
        panel.title = "Сохранить оптимизированный SVG"
        panel.allowedContentTypes = [.svg]
        panel.nameFieldStringValue = defaultSaveName()

        if panel.runModal() == .OK, let url = panel.url {
            do {
                try optimizedCode.write(to: url, atomically: true, encoding: .utf8)
                statusText = "Сохранено: \(url.lastPathComponent)."
            } catch {
                warnings = ["\(error)"]
                statusText = "Не удалось сохранить SVG."
            }
        }
    }

    func copyFullSVG() {
        copyToPasteboard(optimizedCode)
        statusText = "Полный SVG скопирован."
    }

    func copyCompactSVG() {
        copyToPasteboard(compactCode)
        statusText = "Компактный SVG скопирован."
    }

    func handleDrop(providers: [NSItemProvider]) -> Bool {
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                    let url = fileURL(from: item)
                    Task { @MainActor in
                        if let url {
                            self.load(urls: [url])
                        }
                    }
                }
                return true
            }

            if provider.canLoadObject(ofClass: NSString.self) {
                provider.loadObject(ofClass: NSString.self) { object, _ in
                    let text = (object as? NSString).map(String.init)
                    Task { @MainActor in
                        if let text, text.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("<svg") {
                            self.originalCode = text
                            self.selectedFiles = []
                            self.optimizeCurrentCode()
                        }
                    }
                }
                return true
            }
        }

        return false
    }

    private func defaultSaveName() -> String {
        guard let first = selectedFiles.first else {
            return "icon-opt.svg"
        }
        return SVGFileNamer.optimizedURL(for: first).lastPathComponent
    }

    private func copyToPasteboard(_ value: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
    }

    private func normalized(_ value: String, fallback: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? fallback : trimmed
    }

    private func collectSVGFiles(from urls: [URL]) -> [URL] {
        let fileManager = FileManager.default
        var result: [URL] = []

        for url in urls {
            var isDirectory: ObjCBool = false
            guard fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory) else {
                continue
            }

            if isDirectory.boolValue {
                let enumerator = fileManager.enumerator(
                    at: url,
                    includingPropertiesForKeys: [.isRegularFileKey],
                    options: [.skipsHiddenFiles]
                )
                while let item = enumerator?.nextObject() as? URL {
                    if item.isSVGInput {
                        result.append(item)
                    }
                }
            } else if url.isSVGInput {
                result.append(url)
            }
        }

        return result.sorted { $0.path < $1.path }
    }
}

private func fileURL(from item: NSSecureCoding?) -> URL? {
    if let url = item as? URL {
        return url
    }

    if let data = item as? Data {
        return URL(dataRepresentation: data, relativeTo: nil)
    }

    if let string = item as? String {
        return URL(string: string)
    }

    return nil
}

private extension URL {
    var isSVGInput: Bool {
        pathExtension.lowercased() == "svg"
            && !deletingPathExtension().lastPathComponent.hasSuffix("-opt")
            && !deletingPathExtension().lastPathComponent.matchesOptNumberSuffix
    }
}

private extension String {
    var matchesOptNumberSuffix: Bool {
        range(of: #"-opt-\d+$"#, options: .regularExpression) != nil
    }
}

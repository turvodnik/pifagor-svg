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
    @Published var selectedFileIndex = 0
    @Published var profileState = SVGProfileState()
    @Published var previewColor = Color.black
    @Published var isDropTargeted = false

    private let optimizer = SVGOptimizer()
    private let profileStore = SVGProfileStore()

    init() {
        loadProfiles()
    }

    var options: SVGOptimizationOptions {
        profileState.activeProfile.options
    }

    var profiles: [SVGUserProfile] {
        profileState.profiles
    }

    var activeProfile: SVGUserProfile {
        profileState.activeProfile
    }

    var activeProfileDescription: String {
        activeProfile.description
    }

    var canSaveCodeResult: Bool {
        !optimizedCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var selectedFileCount: Int {
        selectedFiles.count
    }

    var hasSelectedFiles: Bool {
        !selectedFiles.isEmpty
    }

    var hasMultipleSelectedFiles: Bool {
        selectedFiles.count > 1
    }

    var currentFileURL: URL? {
        guard selectedFiles.indices.contains(selectedFileIndex) else {
            return nil
        }
        return selectedFiles[selectedFileIndex]
    }

    var currentFileName: String {
        currentFileURL?.lastPathComponent ?? "SVG-код"
    }

    var selectedPositionText: String {
        guard hasSelectedFiles else {
            return "Нет выбранных файлов"
        }
        return "\(selectedFileIndex + 1) из \(selectedFiles.count)"
    }

    func clearLoadedIcons() {
        originalCode = ""
        optimizedCode = ""
        compactCode = ""
        warnings = []
        selectedFiles = []
        selectedFileIndex = 0
        statusText = "Загруженные иконки очищены. Можно выбрать новый набор SVG."
    }

    func loadProfiles() {
        do {
            profileState = try profileStore.load()
        } catch {
            profileState = SVGProfileState()
            warnings = ["Не удалось загрузить профили: \(error)"]
            statusText = "Профили сброшены к рекомендованному профилю."
        }
    }

    func setActiveProfile(id: UUID) {
        guard profileState.profiles.contains(where: { $0.id == id }) else {
            return
        }
        profileState.activeProfileID = id
        saveProfileState()
        optimizeCurrentCode()
    }

    func saveProfile(_ profile: SVGUserProfile) {
        var normalized = profile
        normalized.name = normalized.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Новый профиль"
            : normalized.name.trimmingCharacters(in: .whitespacesAndNewlines)
        profileState.replaceProfile(normalized)
        if profileState.activeProfileID == normalized.id {
            optimizeCurrentCode()
        }
        saveProfileState()
        statusText = "Профиль сохранен: \(normalized.name)."
    }

    func createBlankProfile() -> SVGUserProfile {
        let profile = SVGUserProfile.custom(
            name: profileStore.uniqueProfileName("Новый профиль", in: profileState),
            description: "Кастомный профиль оптимизации SVG.",
            options: .bricksDefault
        )
        profileState.profiles.append(profile)
        profileState.activeProfileID = profile.id
        saveProfileState()
        optimizeCurrentCode()
        return profile
    }

    func createLogoProfile() -> SVGUserProfile {
        var profile = SVGUserProfile.logoTemplate
        profile.id = UUID()
        profile.name = profileStore.uniqueProfileName("Логотипы", in: profileState)
        profileState.profiles.append(profile)
        profileState.activeProfileID = profile.id
        saveProfileState()
        optimizeCurrentCode()
        return profile
    }

    func duplicateProfile(id: UUID) -> SVGUserProfile? {
        guard let source = profileState.profiles.first(where: { $0.id == id }) else {
            return nil
        }
        var copy = source
        copy.id = UUID()
        copy.isBuiltIn = false
        copy.kind = .custom
        copy.name = profileStore.uniqueProfileName("\(source.name) копия", in: profileState)
        profileState.profiles.append(copy)
        profileState.activeProfileID = copy.id
        saveProfileState()
        optimizeCurrentCode()
        return copy
    }

    func deleteProfile(id: UUID) {
        do {
            profileState = try profileStore.deleteProfile(id: id, in: profileState)
            optimizeCurrentCode()
        } catch {
            warnings = ["\(error)"]
            statusText = "Не удалось удалить профиль."
        }
    }

    func resetProfile(id: UUID) {
        do {
            profileState = try profileStore.resetBuiltInProfile(id: id, in: profileState)
            optimizeCurrentCode()
            statusText = "Рекомендованный профиль сброшен к заводским настройкам."
        } catch {
            warnings = ["\(error)"]
            statusText = "Не удалось сбросить профиль."
        }
    }

    func optimizeCurrentCode() {
        guard !originalCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            optimizedCode = ""
            compactCode = ""
            warnings = []
            return
        }

        do {
            let result = try optimizer.optimize(originalCode, options: options)
            optimizedCode = result.fullSVG
            compactCode = result.compactSVG
            warnings = result.warnings
            if hasSelectedFiles {
                statusText = result.status == .optimized
                    ? "Показан \(currentFileName). Изменения применены в предпросмотре."
                    : "\(currentFileName): требуется ручное решение."
            } else {
                statusText = result.status == .optimized
                    ? "Код оптимизирован."
                    : "Требует ручного решения: есть сложные внутренние ссылки."
            }
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
        selectedFileIndex = 0
        guard let first = selectedFiles.first else {
            statusText = "SVG-файлы не найдены."
            return
        }

        loadSelectedFile()
        statusText = selectedFiles.count == 1
            ? "Загружен \(first.lastPathComponent)."
            : "Загружено файлов: \(selectedFiles.count). Используйте переключатель для просмотра."
    }

    func selectFile(at index: Int) {
        guard selectedFiles.indices.contains(index) else {
            return
        }
        selectedFileIndex = index
        loadSelectedFile()
    }

    func selectPreviousFile() {
        guard hasSelectedFiles else { return }
        let previous = selectedFileIndex == 0 ? selectedFiles.count - 1 : selectedFileIndex - 1
        selectFile(at: previous)
    }

    func selectNextFile() {
        guard hasSelectedFiles else { return }
        let next = selectedFileIndex == selectedFiles.count - 1 ? 0 : selectedFileIndex + 1
        selectFile(at: next)
    }

    func loadSelectedFile() {
        guard let file = currentFileURL else {
            originalCode = ""
            optimizedCode = ""
            compactCode = ""
            warnings = []
            return
        }

        do {
            originalCode = try String(contentsOf: file, encoding: .utf8)
            optimizeCurrentCode()
        } catch {
            originalCode = ""
            optimizedCode = ""
            compactCode = ""
            statusText = "Не удалось прочитать \(file.lastPathComponent)."
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
        statusText = "Применяю текущие настройки ко всем выбранным SVG: \(files.count) файлов."

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
                    ? "Готово: создано \(created) файлов -opt.svg по текущим настройкам."
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
        let fileProviders = providers.filter {
            $0.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier)
        }

        if !fileProviders.isEmpty {
            let group = DispatchGroup()
            let accumulator = DroppedURLAccumulator()

            for provider in fileProviders {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                    if let url = fileURL(from: item) {
                        accumulator.append(url)
                    }
                    group.leave()
                }
            }

            group.notify(queue: .main) {
                self.load(urls: accumulator.snapshot())
            }

            return true
        }

        for provider in providers {
            if provider.canLoadObject(ofClass: NSString.self) {
                provider.loadObject(ofClass: NSString.self) { object, _ in
                    let text = (object as? NSString).map(String.init)
                    Task { @MainActor in
                        if let text, text.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("<svg") {
                            self.originalCode = text
                            self.selectedFiles = []
                            self.selectedFileIndex = 0
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
        guard let currentFileURL else {
            return "icon-opt.svg"
        }
        return SVGFileNamer.optimizedURL(for: currentFileURL).lastPathComponent
    }

    private func copyToPasteboard(_ value: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
    }

    private func saveProfileState() {
        do {
            try profileStore.save(profileState)
        } catch {
            warnings = ["Не удалось сохранить профили: \(error)"]
            statusText = "Профили не удалось сохранить."
        }
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

private final class DroppedURLAccumulator: @unchecked Sendable {
    private let lock = NSLock()
    private var urls: [URL] = []

    func append(_ url: URL) {
        lock.lock()
        urls.append(url)
        lock.unlock()
    }

    func snapshot() -> [URL] {
        lock.lock()
        let current = urls
        lock.unlock()
        return current
    }
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

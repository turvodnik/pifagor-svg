import Foundation

public enum SVGProfileStoreError: Error, CustomStringConvertible {
    case profileNotFound(UUID)

    public var description: String {
        switch self {
        case .profileNotFound(let id):
            "Профиль не найден: \(id.uuidString)."
        }
    }
}

public struct SVGProfileStore {
    public let storageURL: URL
    private let fileManager: FileManager

    public init(
        storageURL: URL? = nil,
        fileManager: FileManager = .default
    ) {
        self.storageURL = storageURL ?? Self.defaultStorageURL(fileManager: fileManager)
        self.fileManager = fileManager
    }

    public func load() throws -> SVGProfileState {
        guard fileManager.fileExists(atPath: storageURL.path) else {
            let state = SVGProfileState()
            try save(state)
            return state
        }

        let data = try Data(contentsOf: storageURL)
        let decoder = JSONDecoder()
        var state = try decoder.decode(SVGProfileState.self, from: data)
        state.ensureRecommendedProfile()
        state.ensureActiveProfileExists()
        try save(state)
        return state
    }

    public func save(_ state: SVGProfileState) throws {
        var normalized = state
        normalized.ensureRecommendedProfile()
        normalized.ensureActiveProfileExists()
        try fileManager.createDirectory(
            at: storageURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(normalized)
        try data.write(to: storageURL, options: .atomic)
    }

    public func deleteProfile(id: UUID, in state: SVGProfileState) throws -> SVGProfileState {
        var next = state
        guard let profile = next.profiles.first(where: { $0.id == id }) else {
            throw SVGProfileStoreError.profileNotFound(id)
        }

        guard !profile.isBuiltIn else {
            return next
        }

        next.profiles.removeAll { $0.id == id }
        if next.activeProfileID == id {
            next.activeProfileID = SVGUserProfile.recommendedID
        }
        next.ensureRecommendedProfile()
        next.ensureActiveProfileExists()
        try save(next)
        return next
    }

    public func resetBuiltInProfile(id: UUID, in state: SVGProfileState) throws -> SVGProfileState {
        var next = state
        guard next.profiles.contains(where: { $0.id == id }) else {
            throw SVGProfileStoreError.profileNotFound(id)
        }

        if id == SVGUserProfile.recommendedID {
            next.replaceProfile(.recommended)
        }
        next.ensureActiveProfileExists()
        try save(next)
        return next
    }

    public func profile(named name: String, in state: SVGProfileState) -> SVGUserProfile? {
        let normalized = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return state.profiles.first { $0.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normalized }
    }

    public func uniqueProfileName(_ baseName: String, in state: SVGProfileState) -> String {
        let trimmed = baseName.trimmingCharacters(in: .whitespacesAndNewlines)
        let base = trimmed.isEmpty ? "Новый профиль" : trimmed
        let existing = Set(state.profiles.map { $0.name.lowercased() })
        if !existing.contains(base.lowercased()) {
            return base
        }

        var index = 2
        while existing.contains("\(base) \(index)".lowercased()) {
            index += 1
        }
        return "\(base) \(index)"
    }

    public static func defaultStorageURL(fileManager: FileManager = .default) -> URL {
        if let override = ProcessInfo.processInfo.environment["PIFAGOR_SVG_PROFILE_STORE"],
           !override.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return URL(fileURLWithPath: override)
        }

        let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? fileManager.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support")
        return base
            .appendingPathComponent("Pifagor SVG", isDirectory: true)
            .appendingPathComponent("profiles.json")
    }
}

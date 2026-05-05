import Foundation

public enum SVGOptimizationStatus: String, Sendable {
    case optimized
    case requiresManualReview
}

public enum SVGOptimizationProfile: String, CaseIterable, Codable, Sendable {
    case bricksCurrentColor
    case inline1em
    case fixed24
}

public enum SVGSizeMode: String, CaseIterable, Codable, Sendable {
    case none
    case inline1em
    case fixed
}

public enum SVGSizeUnit: String, CaseIterable, Codable, Sendable {
    case px
    case em
    case rem
    case percent

    public var suffix: String {
        switch self {
        case .px:
            "px"
        case .em:
            "em"
        case .rem:
            "rem"
        case .percent:
            "%"
        }
    }
}

public enum SVGColorMode: String, CaseIterable, Codable, Sendable {
    case currentColor
    case custom
    case preserve
}

public enum SVGFillColorMode: String, CaseIterable, Codable, Sendable {
    case currentColor
    case custom
    case preserve
    case none
}

public enum SVGStrokeWidthMode: String, CaseIterable, Codable, Sendable {
    case set
    case preserve
}

public enum SVGOutputDirectoryMode: String, CaseIterable, Codable, Sendable {
    case sameFolder
    case custom
}

public enum SVGUserProfileKind: String, CaseIterable, Codable, Sendable {
    case recommended
    case custom
    case logo
}

public struct SVGOptimizationOptions: Codable, Equatable, Sendable {
    public var sizeMode: SVGSizeMode
    public var fixedWidth: String
    public var fixedHeight: String
    public var sizeUnit: SVGSizeUnit
    public var lockSize: Bool
    public var strokeWidth: String
    public var strokeWidthMode: SVGStrokeWidthMode
    public var removeBackground: Bool
    public var colorMode: SVGColorMode
    public var customColor: String
    public var strokeColorMode: SVGColorMode
    public var strokeColor: String
    public var fillColorMode: SVGFillColorMode
    public var fillColor: String
    public var movePaintToRoot: Bool
    public var convertInlineStyles: Bool
    public var removeSafeClipPaths: Bool
    public var expandUseReferences: Bool
    public var removeUnusedDefs: Bool
    public var removeIDs: Bool
    public var unwrapEmptyGroups: Bool
    public var requireNoInternalReferences: Bool
    public var outputPrefix: String
    public var outputSuffix: String
    public var overwriteExistingOutput: Bool
    public var outputDirectoryMode: SVGOutputDirectoryMode
    public var customOutputDirectory: String

    private enum CodingKeys: String, CodingKey {
        case sizeMode
        case fixedWidth
        case fixedHeight
        case sizeUnit
        case lockSize
        case strokeWidth
        case strokeWidthMode
        case removeBackground
        case colorMode
        case customColor
        case strokeColorMode
        case strokeColor
        case fillColorMode
        case fillColor
        case movePaintToRoot
        case convertInlineStyles
        case removeSafeClipPaths
        case expandUseReferences
        case removeUnusedDefs
        case removeIDs
        case unwrapEmptyGroups
        case requireNoInternalReferences
        case outputPrefix
        case outputSuffix
        case overwriteExistingOutput
        case outputDirectoryMode
        case customOutputDirectory
    }

    public init(
        profile: SVGOptimizationProfile = .bricksCurrentColor,
        sizeMode: SVGSizeMode? = nil,
        fixedWidth: String? = nil,
        fixedHeight: String? = nil,
        sizeUnit: SVGSizeUnit = .px,
        lockSize: Bool = true,
        strokeWidth: String = "1.5",
        fixedSize: String = "24",
        strokeWidthMode: SVGStrokeWidthMode = .set,
        removeBackground: Bool = false,
        colorMode: SVGColorMode = .currentColor,
        customColor: String = "#000000",
        strokeColorMode: SVGColorMode? = nil,
        strokeColor: String? = nil,
        fillColorMode: SVGFillColorMode? = nil,
        fillColor: String? = nil,
        movePaintToRoot: Bool = true,
        convertInlineStyles: Bool = true,
        removeSafeClipPaths: Bool = true,
        expandUseReferences: Bool = true,
        removeUnusedDefs: Bool = true,
        removeIDs: Bool = true,
        unwrapEmptyGroups: Bool = true,
        requireNoInternalReferences: Bool = true,
        outputPrefix: String = "",
        outputSuffix: String = "-opt",
        overwriteExistingOutput: Bool = false,
        outputDirectoryMode: SVGOutputDirectoryMode = .sameFolder,
        customOutputDirectory: String = ""
    ) {
        let legacySizeMode: SVGSizeMode
        switch profile {
        case .bricksCurrentColor:
            legacySizeMode = .none
        case .inline1em:
            legacySizeMode = .inline1em
        case .fixed24:
            legacySizeMode = .fixed
        }

        self.sizeMode = sizeMode ?? legacySizeMode
        self.fixedWidth = fixedWidth ?? fixedSize
        self.fixedHeight = fixedHeight ?? fixedSize
        self.sizeUnit = sizeUnit
        self.lockSize = lockSize
        self.strokeWidth = strokeWidth
        self.strokeWidthMode = strokeWidthMode
        self.removeBackground = removeBackground
        self.colorMode = colorMode
        self.customColor = customColor
        self.strokeColorMode = strokeColorMode ?? colorMode
        self.strokeColor = strokeColor ?? customColor
        self.fillColorMode = fillColorMode ?? SVGFillColorMode(colorMode)
        self.fillColor = fillColor ?? customColor
        self.movePaintToRoot = movePaintToRoot
        self.convertInlineStyles = convertInlineStyles
        self.removeSafeClipPaths = removeSafeClipPaths
        self.expandUseReferences = expandUseReferences
        self.removeUnusedDefs = removeUnusedDefs
        self.removeIDs = removeIDs
        self.unwrapEmptyGroups = unwrapEmptyGroups
        self.requireNoInternalReferences = requireNoInternalReferences
        self.outputPrefix = outputPrefix
        self.outputSuffix = outputSuffix
        self.overwriteExistingOutput = overwriteExistingOutput
        self.outputDirectoryMode = outputDirectoryMode
        self.customOutputDirectory = customOutputDirectory
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.sizeMode = try container.decodeIfPresent(SVGSizeMode.self, forKey: .sizeMode) ?? .none
        self.fixedWidth = try container.decodeIfPresent(String.self, forKey: .fixedWidth) ?? "24"
        self.fixedHeight = try container.decodeIfPresent(String.self, forKey: .fixedHeight) ?? "24"
        self.sizeUnit = try container.decodeIfPresent(SVGSizeUnit.self, forKey: .sizeUnit) ?? .px
        self.lockSize = try container.decodeIfPresent(Bool.self, forKey: .lockSize) ?? true
        self.strokeWidth = try container.decodeIfPresent(String.self, forKey: .strokeWidth) ?? "1.5"
        self.strokeWidthMode = try container.decodeIfPresent(SVGStrokeWidthMode.self, forKey: .strokeWidthMode) ?? .set
        self.removeBackground = try container.decodeIfPresent(Bool.self, forKey: .removeBackground) ?? false
        self.colorMode = try container.decodeIfPresent(SVGColorMode.self, forKey: .colorMode) ?? .currentColor
        self.customColor = try container.decodeIfPresent(String.self, forKey: .customColor) ?? "#000000"
        self.strokeColorMode = try container.decodeIfPresent(SVGColorMode.self, forKey: .strokeColorMode) ?? colorMode
        self.strokeColor = try container.decodeIfPresent(String.self, forKey: .strokeColor) ?? customColor
        self.fillColorMode = try container.decodeIfPresent(SVGFillColorMode.self, forKey: .fillColorMode) ?? SVGFillColorMode(colorMode)
        self.fillColor = try container.decodeIfPresent(String.self, forKey: .fillColor) ?? customColor
        self.movePaintToRoot = try container.decodeIfPresent(Bool.self, forKey: .movePaintToRoot) ?? true
        self.convertInlineStyles = try container.decodeIfPresent(Bool.self, forKey: .convertInlineStyles) ?? true
        self.removeSafeClipPaths = try container.decodeIfPresent(Bool.self, forKey: .removeSafeClipPaths) ?? true
        self.expandUseReferences = try container.decodeIfPresent(Bool.self, forKey: .expandUseReferences) ?? true
        self.removeUnusedDefs = try container.decodeIfPresent(Bool.self, forKey: .removeUnusedDefs) ?? true
        self.removeIDs = try container.decodeIfPresent(Bool.self, forKey: .removeIDs) ?? true
        self.unwrapEmptyGroups = try container.decodeIfPresent(Bool.self, forKey: .unwrapEmptyGroups) ?? true
        self.requireNoInternalReferences = try container.decodeIfPresent(Bool.self, forKey: .requireNoInternalReferences) ?? true
        self.outputPrefix = try container.decodeIfPresent(String.self, forKey: .outputPrefix) ?? ""
        self.outputSuffix = try container.decodeIfPresent(String.self, forKey: .outputSuffix) ?? "-opt"
        self.overwriteExistingOutput = try container.decodeIfPresent(Bool.self, forKey: .overwriteExistingOutput) ?? false
        self.outputDirectoryMode = try container.decodeIfPresent(SVGOutputDirectoryMode.self, forKey: .outputDirectoryMode) ?? .sameFolder
        self.customOutputDirectory = try container.decodeIfPresent(String.self, forKey: .customOutputDirectory) ?? ""
    }

    public static let bricksDefault = SVGOptimizationOptions()
}

public extension SVGFillColorMode {
    init(_ colorMode: SVGColorMode) {
        switch colorMode {
        case .currentColor:
            self = .currentColor
        case .custom:
            self = .custom
        case .preserve:
            self = .preserve
        }
    }
}

public struct SVGUserProfile: Identifiable, Codable, Equatable, Sendable {
    public var id: UUID
    public var name: String
    public var description: String
    public var isBuiltIn: Bool
    public var kind: SVGUserProfileKind
    public var options: SVGOptimizationOptions

    public init(
        id: UUID = UUID(),
        name: String,
        description: String,
        isBuiltIn: Bool = false,
        kind: SVGUserProfileKind = .custom,
        options: SVGOptimizationOptions
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.isBuiltIn = isBuiltIn
        self.kind = kind
        self.options = options
    }

    public static let recommendedID = UUID(uuidString: "11111111-1111-1111-1111-111111111111")!
    public static let logoTemplateID = UUID(uuidString: "22222222-2222-2222-2222-222222222222")!

    public static let recommended = SVGUserProfile(
        id: recommendedID,
        name: "Рекомендованный",
        description: "Рекомендован для Bricks Builder, WordPress и CSS-управления иконками через currentColor.",
        isBuiltIn: true,
        kind: .recommended,
        options: .bricksDefault
    )

    public static let logoTemplate = SVGUserProfile(
        id: logoTemplateID,
        name: "Логотипы",
        description: "Шаблон для логотипов: сохраняет фирменные цвета и фон, чистит только безопасный мусор.",
        isBuiltIn: false,
        kind: .logo,
        options: SVGOptimizationOptions(
            sizeMode: SVGSizeMode.none,
            strokeWidthMode: .preserve,
            removeBackground: false,
            colorMode: .preserve,
            customColor: "#000000",
            strokeColorMode: .preserve,
            fillColorMode: .preserve,
            movePaintToRoot: false,
            convertInlineStyles: true,
            removeSafeClipPaths: true,
            expandUseReferences: true,
            removeUnusedDefs: true,
            removeIDs: true,
            unwrapEmptyGroups: true,
            requireNoInternalReferences: true
        )
    )

    public static func custom(
        name: String,
        description: String,
        options: SVGOptimizationOptions
    ) -> SVGUserProfile {
        SVGUserProfile(
            name: name,
            description: description,
            isBuiltIn: false,
            kind: .custom,
            options: options
        )
    }
}

public struct SVGProfileState: Codable, Equatable, Sendable {
    public var profiles: [SVGUserProfile]
    public var activeProfileID: UUID

    public init(
        profiles: [SVGUserProfile] = [.recommended],
        activeProfileID: UUID = SVGUserProfile.recommendedID
    ) {
        self.profiles = profiles.isEmpty ? [.recommended] : profiles
        self.activeProfileID = activeProfileID
        ensureRecommendedProfile()
        ensureActiveProfileExists()
    }

    public var activeProfile: SVGUserProfile {
        profiles.first { $0.id == activeProfileID }
            ?? profiles.first { $0.id == SVGUserProfile.recommendedID }
            ?? .recommended
    }

    public mutating func replaceProfile(_ profile: SVGUserProfile) {
        if let index = profiles.firstIndex(where: { $0.id == profile.id }) {
            profiles[index] = profile
        } else {
            profiles.append(profile)
        }
        ensureRecommendedProfile()
        ensureActiveProfileExists()
    }

    public mutating func ensureRecommendedProfile() {
        if !profiles.contains(where: { $0.id == SVGUserProfile.recommendedID }) {
            profiles.insert(.recommended, at: 0)
        }
    }

    public mutating func ensureActiveProfileExists() {
        if !profiles.contains(where: { $0.id == activeProfileID }) {
            activeProfileID = SVGUserProfile.recommendedID
        }
    }
}

public struct SVGOptimizationResult: Sendable {
    public let status: SVGOptimizationStatus
    public let fullSVG: String
    public let compactSVG: String
    public let warnings: [String]

    public init(
        status: SVGOptimizationStatus,
        fullSVG: String,
        compactSVG: String,
        warnings: [String]
    ) {
        self.status = status
        self.fullSVG = fullSVG
        self.compactSVG = compactSVG
        self.warnings = warnings
    }
}

public enum SVGOptimizationError: Error, CustomStringConvertible {
    case invalidUTF8
    case invalidXML(String)
    case missingSVGRoot
    case manualReviewRequired([String])

    public var description: String {
        switch self {
        case .invalidUTF8:
            "SVG-файл не удалось прочитать как UTF-8."
        case .invalidXML(let message):
            "Некорректный SVG/XML: \(message)"
        case .missingSVGRoot:
            "В документе не найден корневой <svg>."
        case .manualReviewRequired(let warnings):
            "SVG требует ручного решения: \(warnings.joined(separator: "; "))"
        }
    }
}

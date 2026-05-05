import Foundation

public enum SVGOptimizationStatus: String, Sendable {
    case optimized
    case requiresManualReview
}

public enum SVGOptimizationProfile: String, CaseIterable, Sendable {
    case bricksCurrentColor
    case inline1em
    case fixed24
}

public struct SVGOptimizationOptions: Sendable {
    public var profile: SVGOptimizationProfile
    public var strokeWidth: String
    public var fixedSize: String
    public var removeBackground: Bool

    public init(
        profile: SVGOptimizationProfile = .bricksCurrentColor,
        strokeWidth: String = "1.5",
        fixedSize: String = "24",
        removeBackground: Bool = false
    ) {
        self.profile = profile
        self.strokeWidth = strokeWidth
        self.fixedSize = fixedSize
        self.removeBackground = removeBackground
    }

    public static let bricksDefault = SVGOptimizationOptions()
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

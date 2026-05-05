import Foundation

public struct SVGFileProcessor {
    private let optimizer: SVGOptimizer
    private let fileManager: FileManager

    public init(
        optimizer: SVGOptimizer = SVGOptimizer(),
        fileManager: FileManager = .default
    ) {
        self.optimizer = optimizer
        self.fileManager = fileManager
    }

    @discardableResult
    public func optimizeFile(
        at inputURL: URL,
        options: SVGOptimizationOptions = .bricksDefault
    ) throws -> URL {
        let data = try Data(contentsOf: inputURL)
        guard let svg = String(data: data, encoding: .utf8) else {
            throw SVGOptimizationError.invalidUTF8
        }

        let result = try optimizer.optimize(svg, options: options)
        guard result.status == .optimized else {
            throw SVGOptimizationError.manualReviewRequired(result.warnings)
        }

        let outputURL = SVGFileNamer.optimizedURL(for: inputURL, fileManager: fileManager)
        try result.fullSVG.write(to: outputURL, atomically: true, encoding: .utf8)
        return outputURL
    }
}

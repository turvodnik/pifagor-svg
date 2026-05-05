import Foundation

public enum SVGFileNamer {
    public static func optimizedURL(
        for originalURL: URL,
        options: SVGOptimizationOptions,
        fileManager: FileManager = .default
    ) -> URL {
        let customDirectoryPath = options.customOutputDirectory.trimmingCharacters(in: .whitespacesAndNewlines)
        let customDirectory = options.outputDirectoryMode == .custom && !customDirectoryPath.isEmpty
            ? URL(fileURLWithPath: customDirectoryPath)
            : nil

        return optimizedURL(
            for: originalURL,
            prefix: options.outputPrefix,
            suffix: options.outputSuffix,
            outputDirectory: customDirectory,
            overwriteExisting: options.overwriteExistingOutput,
            fileManager: fileManager
        )
    }

    public static func optimizedURL(
        for originalURL: URL,
        prefix: String = "",
        suffix: String = "-opt",
        outputDirectory: URL? = nil,
        overwriteExisting: Bool = false,
        fileManager: FileManager = .default
    ) -> URL {
        let directory = outputDirectory ?? originalURL.deletingLastPathComponent()
        let baseName = originalURL.deletingPathExtension().lastPathComponent
        let pathExtension = originalURL.pathExtension.isEmpty ? "svg" : originalURL.pathExtension
        let cleanPrefix = prefix.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanSuffix = suffix.trimmingCharacters(in: .whitespacesAndNewlines)

        var candidate = directory
            .appendingPathComponent("\(cleanPrefix)\(baseName)\(cleanSuffix)")
            .appendingPathExtension(pathExtension)

        guard !overwriteExisting else {
            return candidate
        }

        var index = 2
        while fileManager.fileExists(atPath: candidate.path) {
            candidate = directory
                .appendingPathComponent("\(cleanPrefix)\(baseName)\(cleanSuffix)-\(index)")
                .appendingPathExtension(pathExtension)
            index += 1
        }

        return candidate
    }
}

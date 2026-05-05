import Foundation

public enum SVGFileNamer {
    public static func optimizedURL(
        for originalURL: URL,
        suffix: String = "-opt",
        fileManager: FileManager = .default
    ) -> URL {
        let directory = originalURL.deletingLastPathComponent()
        let baseName = originalURL.deletingPathExtension().lastPathComponent
        let pathExtension = originalURL.pathExtension.isEmpty ? "svg" : originalURL.pathExtension

        var candidate = directory
            .appendingPathComponent("\(baseName)\(suffix)")
            .appendingPathExtension(pathExtension)

        var index = 2
        while fileManager.fileExists(atPath: candidate.path) {
            candidate = directory
                .appendingPathComponent("\(baseName)\(suffix)-\(index)")
                .appendingPathExtension(pathExtension)
            index += 1
        }

        return candidate
    }
}

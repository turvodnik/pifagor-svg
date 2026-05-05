import Foundation
import PifagorSVGCore

struct CLIOptions {
    var inputPaths: [String] = []
    var legacyProfile: SVGOptimizationProfile?
    var profileName: String?
    var strokeWidth: String?
    var fixedSize: String?
    var removeBackground = false
    var recursive = true
}

enum CLIError: Error, CustomStringConvertible {
    case missingValue(String)
    case unknownArgument(String)
    case profileNotFound(String)
    case noInputs

    var description: String {
        switch self {
        case .missingValue(let option):
            "У параметра \(option) нет значения."
        case .unknownArgument(let argument):
            "Неизвестный параметр: \(argument)"
        case .profileNotFound(let name):
            "Профиль не найден: \(name)."
        case .noInputs:
            "Передайте один или несколько SVG-файлов или папок."
        }
    }
}

@main
struct PifagorSVGCLI {
    static func main() {
        do {
            let options = try parse(Array(CommandLine.arguments.dropFirst()))
            let files = collectSVGFiles(from: options.inputPaths, recursive: options.recursive)
            guard !files.isEmpty else {
                throw CLIError.noInputs
            }

            let processor = SVGFileProcessor()
            let optimizationOptions = try resolveOptimizationOptions(from: options)

            var failures = 0
            for file in files {
                do {
                    let output = try processor.optimizeFile(at: file, options: optimizationOptions)
                    print("OK \(file.path) -> \(output.lastPathComponent)")
                } catch {
                    failures += 1
                    print("SKIP \(file.path): \(error)")
                }
            }

            if failures > 0 {
                Foundation.exit(2)
            }
        } catch {
            print(helpText)
            print("")
            print("Ошибка: \(error)")
            Foundation.exit(1)
        }
    }

    private static func parse(_ arguments: [String]) throws -> CLIOptions {
        var options = CLIOptions()
        var index = 0
        var parsingOptions = true

        while index < arguments.count {
            let argument = arguments[index]
            if parsingOptions, argument == "--" {
                parsingOptions = false
                index += 1
                continue
            }

            if !parsingOptions {
                options.inputPaths.append(argument)
                index += 1
                continue
            }

            switch argument {
            case "--help", "-h":
                print(helpText)
                Foundation.exit(0)
            case "--profile":
                let value = try value(after: argument, in: arguments, at: &index)
                switch value {
                case "bricks", "bricks-current-color":
                    options.legacyProfile = .bricksCurrentColor
                case "inline", "inline-1em":
                    options.legacyProfile = .inline1em
                case "fixed", "fixed24":
                    options.legacyProfile = .fixed24
                default:
                    throw CLIError.unknownArgument("--profile \(value)")
                }
            case "--profile-name":
                options.profileName = try value(after: argument, in: arguments, at: &index)
            case "--stroke-width":
                options.strokeWidth = try value(after: argument, in: arguments, at: &index)
            case "--fixed-size":
                options.fixedSize = try value(after: argument, in: arguments, at: &index)
            case "--remove-background":
                options.removeBackground = true
            case "--no-recursive":
                options.recursive = false
            default:
                if argument.hasPrefix("-") {
                    throw CLIError.unknownArgument(argument)
                }
                options.inputPaths.append(argument)
            }
            index += 1
        }

        return options
    }

    private static func resolveOptimizationOptions(from options: CLIOptions) throws -> SVGOptimizationOptions {
        if let legacyProfile = options.legacyProfile {
            return SVGOptimizationOptions(
                profile: legacyProfile,
                strokeWidth: options.strokeWidth ?? "1.5",
                fixedSize: options.fixedSize ?? "24",
                removeBackground: options.removeBackground
            )
        }

        let store = SVGProfileStore()
        let state = try store.load()
        let profile: SVGUserProfile
        if let profileName = options.profileName {
            guard let named = store.profile(named: profileName, in: state) else {
                throw CLIError.profileNotFound(profileName)
            }
            profile = named
        } else {
            profile = state.activeProfile
        }

        var resolved = profile.options
        if let strokeWidth = options.strokeWidth {
            resolved.strokeWidthMode = .set
            resolved.strokeWidth = strokeWidth
        }
        if let fixedSize = options.fixedSize {
            resolved.sizeMode = .fixed
            resolved.fixedWidth = fixedSize
            resolved.fixedHeight = fixedSize
            resolved.sizeUnit = .px
            resolved.lockSize = true
        }
        if options.removeBackground {
            resolved.removeBackground = true
        }
        return resolved
    }

    private static func value(
        after option: String,
        in arguments: [String],
        at index: inout Int
    ) throws -> String {
        let valueIndex = index + 1
        guard valueIndex < arguments.count else {
            throw CLIError.missingValue(option)
        }
        index = valueIndex
        return arguments[valueIndex]
    }

    private static func collectSVGFiles(from paths: [String], recursive: Bool) -> [URL] {
        let fileManager = FileManager.default
        var urls: [URL] = []

        for path in paths {
            let url = URL(fileURLWithPath: path)
            var isDirectory: ObjCBool = false
            guard fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory) else {
                continue
            }

            if isDirectory.boolValue {
                let keys: [URLResourceKey] = [.isRegularFileKey]
                let enumerator = fileManager.enumerator(
                    at: url,
                    includingPropertiesForKeys: keys,
                    options: recursive ? [.skipsHiddenFiles] : [.skipsHiddenFiles, .skipsSubdirectoryDescendants]
                )
                while let item = enumerator?.nextObject() as? URL {
                    if item.isSVGInput {
                        urls.append(item)
                    }
                }
            } else if url.isSVGInput {
                urls.append(url)
            }
        }

        return urls.sorted { $0.path < $1.path }
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

private let helpText = """
Pifagor SVG CLI

Использование:
  pifagor-svg-cli [options] file.svg folder/

Параметры:
  --profile-name "Название"           Использовать сохраненный профиль по названию.
  --profile bricks|inline|fixed       Legacy-профиль. Если не передан, используется активный профиль приложения.
  --stroke-width 1.5                  Переопределить толщину stroke.
  --fixed-size 24                     Переопределить размер как fixed px.
  --remove-background                 Удалять full-viewBox фоновые rect.
  --no-recursive                      Не обходить вложенные папки.

Результат сохраняется рядом с оригиналом как имя-opt.svg, затем имя-opt-2.svg.
Файлы со сложными url(#...) ссылками пропускаются, чтобы не ломать иконку.
"""

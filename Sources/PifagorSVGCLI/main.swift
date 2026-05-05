import Foundation
import PifagorSVGCore

struct CLIOptions {
    var inputPaths: [String] = []
    var profile: SVGOptimizationProfile = .bricksCurrentColor
    var strokeWidth = "1.5"
    var fixedSize = "24"
    var removeBackground = false
    var recursive = true
}

enum CLIError: Error, CustomStringConvertible {
    case missingValue(String)
    case unknownArgument(String)
    case noInputs

    var description: String {
        switch self {
        case .missingValue(let option):
            "У параметра \(option) нет значения."
        case .unknownArgument(let argument):
            "Неизвестный параметр: \(argument)"
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
            let optimizationOptions = SVGOptimizationOptions(
                profile: options.profile,
                strokeWidth: options.strokeWidth,
                fixedSize: options.fixedSize,
                removeBackground: options.removeBackground
            )

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
                    options.profile = .bricksCurrentColor
                case "inline", "inline-1em":
                    options.profile = .inline1em
                case "fixed", "fixed24":
                    options.profile = .fixed24
                default:
                    throw CLIError.unknownArgument("--profile \(value)")
                }
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
  --profile bricks|inline|fixed       Профиль оптимизации. По умолчанию bricks.
  --stroke-width 1.5                  Толщина stroke для Bricks/inline.
  --fixed-size 24                     Размер для fixed-профиля.
  --remove-background                 Удалять full-viewBox фоновые rect.
  --no-recursive                      Не обходить вложенные папки.

Результат сохраняется рядом с оригиналом как имя-opt.svg, затем имя-opt-2.svg.
Файлы со сложными url(#...) ссылками пропускаются, чтобы не ломать иконку.
"""

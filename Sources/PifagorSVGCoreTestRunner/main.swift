import Foundation
import PifagorSVGCore

struct TestFailure: Error, CustomStringConvertible {
    let message: String

    var description: String {
        message
    }
}

func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    guard condition() else {
        throw TestFailure(message: message)
    }
}

func run(_ name: String, _ body: () throws -> Void) rethrows {
    try body()
    print("PASS \(name)")
}

try run("outline icon moves stroke control to root and removes safe clip path") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <g clip-path="url(#clip0_4418_3740)">
        <path d="M8.37988 12.0001L10.7899 14.4201L15.6199 9.58008" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4.23988 6.20008C4.23988 5.14008 5.10988 4.27008 6.16988 4.27008" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <defs>
        <clipPath id="clip0_4418_3740">
          <rect width="24" height="24" fill="white"/>
        </clipPath>
      </defs>
    </svg>
    """

    let result = try SVGOptimizer().optimize(input, options: .bricksDefault)

    try expect(result.status == .optimized, "Expected optimized status")
    try expect(result.fullSVG.contains(#"stroke="currentColor""#), "Expected root currentColor stroke")
    try expect(result.fullSVG.contains(#"stroke-width="1.5""#), "Expected root stroke width 1.5")
    try expect(result.fullSVG.contains(#"fill="none""#), "Expected root fill none")
    try expect(!result.fullSVG.contains("stroke=\"#fff\""), "Expected fixed path stroke removal")
    try expect(!result.fullSVG.contains("stroke-width=\"2\""), "Expected path stroke width removal")
    try expect(!result.fullSVG.contains("clip-path"), "Expected clip-path removal")
    try expect(!result.fullSVG.contains("url(#"), "Expected url(#...) removal")
    try expect(!result.fullSVG.contains("<defs"), "Expected unused defs removal")
    try expect(!result.fullSVG.contains("<g"), "Expected empty group unwrap")
    try expect(!result.fullSVG.contains("width=\"24\""), "Expected width removal")
    try expect(!result.fullSVG.contains("height=\"24\""), "Expected height removal")
}

try run("single color filled icon uses currentColor") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M2 2h20v20H2z" fill="#111111"/>
      <path d="M7 7h10v10H7z" fill="#111111"/>
    </svg>
    """

    let result = try SVGOptimizer().optimize(input, options: .bricksDefault)

    try expect(result.status == .optimized, "Expected optimized status")
    try expect(result.fullSVG.contains(#"fill="currentColor""#), "Expected root currentColor fill")
    try expect(!result.fullSVG.contains("#111111"), "Expected fixed fill removal")
    try expect(!result.fullSVG.contains("width=\"24\""), "Expected width removal")
    try expect(!result.fullSVG.contains("height=\"24\""), "Expected height removal")
}

try run("use reference is expanded and ids are removed") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <defs>
        <path id="check" d="M4 12l4 4 12-12" stroke="#fff" stroke-width="2"/>
      </defs>
      <use href="#check"/>
    </svg>
    """

    let result = try SVGOptimizer().optimize(input, options: .bricksDefault)

    try expect(result.status == .optimized, "Expected optimized status")
    try expect(result.fullSVG.contains(#"d="M4 12l4 4 12-12""#), "Expected referenced path expansion")
    try expect(!result.fullSVG.contains("<use"), "Expected use removal")
    try expect(!result.fullSVG.contains("href="), "Expected href removal")
    try expect(!result.fullSVG.contains("id="), "Expected id removal")
    try expect(!result.fullSVG.contains("#check"), "Expected # reference removal")
}

try run("dangerous links scripts and event handlers are removed") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="alert(1)">
      <script>alert(1)</script>
      <a href="https://example.com"><path d="M1 1h22v22H1z" fill="#000"/></a>
      <path d="M2 2h20v20H2z" onclick="alert(1)" fill="#000"/>
    </svg>
    """

    let result = try SVGOptimizer().optimize(input, options: .bricksDefault)

    try expect(result.status == .optimized, "Expected optimized status")
    try expect(!result.fullSVG.contains("<script"), "Expected script removal")
    try expect(!result.fullSVG.contains("<a "), "Expected anchor removal")
    try expect(!result.fullSVG.contains("onload"), "Expected onload removal")
    try expect(!result.fullSVG.contains("onclick"), "Expected onclick removal")
    try expect(!result.fullSVG.contains("https://example.com"), "Expected external URL removal")
}

try run("active svg primitives and external url attributes are removed or blocked") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject>
      <style>@import url(https://example.com/a.css); path { fill: red }</style>
      <image href=" data:image/svg+xml;base64,PHN2Zy8+ "/>
      <feImage href="file:///tmp/icon.svg"/>
      <path d="M2 2h20v20H2z" filter=" url(https://example.com/filter.svg#f) " fill="#000"/>
    </svg>
    """

    let result = try SVGOptimizer().optimize(input, options: .bricksDefault)

    try expect(result.status == .optimized, "Expected active content to be removed instead of rendered")
    try expect(!result.fullSVG.contains("foreignObject"), "Expected foreignObject removal")
    try expect(!result.fullSVG.contains("<style"), "Expected style element removal")
    try expect(!result.fullSVG.contains("<image"), "Expected image removal")
    try expect(!result.fullSVG.contains("<feImage"), "Expected feImage removal")
    try expect(!result.fullSVG.contains("https://example.com"), "Expected external URL removal")
    try expect(!result.fullSVG.contains("data:image"), "Expected data URL removal")
    try expect(!result.fullSVG.contains("file:///"), "Expected file URL removal")
}

try run("unsupported inline style forces manual review instead of silently dropping declarations") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path style="fill: #000; transform: translate(1px, 1px)" d="M2 2h20v20H2z"/>
    </svg>
    """

    let result = try SVGOptimizer().optimize(input, options: .bricksDefault)

    try expect(result.status == .requiresManualReview, "Expected manual review for unsupported style")
    try expect(result.warnings.contains { $0.contains("style") }, "Expected style warning")
}

try run("complex gradient reference requires manual review") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <defs>
        <linearGradient id="paint0"><stop stop-color="#fff"/></linearGradient>
      </defs>
      <path d="M2 2h20v20H2z" fill="url(#paint0)"/>
    </svg>
    """

    let result = try SVGOptimizer().optimize(input, options: .bricksDefault)

    try expect(result.status == .requiresManualReview, "Expected manual review status")
    try expect(result.warnings.contains { $0.contains("fill") && $0.contains("url(#paint0)") }, "Expected gradient warning")
}

try run("use with geometry attributes requires manual review") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <defs><path id="check" d="M4 12l4 4 12-12"/></defs>
      <use href="#check" x="2" y="3"/>
    </svg>
    """

    let result = try SVGOptimizer().optimize(input, options: .bricksDefault)

    try expect(result.status == .requiresManualReview, "Expected manual review for use geometry")
    try expect(result.warnings.contains { $0.contains("<use") }, "Expected use warning")
}

try run("output file names use dash opt suffix without overwriting") {
    let tempDirectory = FileManager.default.temporaryDirectory
        .appendingPathComponent(UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: tempDirectory) }

    let original = tempDirectory.appendingPathComponent("badge.svg")
    let firstExisting = tempDirectory.appendingPathComponent("badge-opt.svg")
    try "<svg/>".write(to: original, atomically: true, encoding: .utf8)
    try "<svg/>".write(to: firstExisting, atomically: true, encoding: .utf8)

    let generated = SVGFileNamer.optimizedURL(for: original, fileManager: .default)

    try expect(generated.lastPathComponent == "badge-opt-2.svg", "Expected badge-opt-2.svg")
}

try run("cli style parser can receive paths after dash dash") {
    let tempDirectory = FileManager.default.temporaryDirectory
        .appendingPathComponent(UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: tempDirectory) }

    let dashed = tempDirectory.appendingPathComponent("-icon.svg")
    try """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M2 2h20v20H2z" fill="#000"/>
    </svg>
    """.write(to: dashed, atomically: true, encoding: .utf8)

    let output = SVGFileNamer.optimizedURL(for: dashed, fileManager: .default)

    try expect(output.lastPathComponent == "-icon-opt.svg", "Expected -icon-opt.svg")
}

try run("compact output has no extra whitespace between tags") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M2 2h20v20H2z" fill="#000"/>
    </svg>
    """

    let result = try SVGOptimizer().optimize(input, options: .bricksDefault)

    try expect(!result.compactSVG.contains("\n"), "Expected compact SVG without newlines")
    try expect(!result.compactSVG.contains(">  <"), "Expected compact SVG without inter-tag spaces")
}

try run("output keeps a single xmlns declaration") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M2 2h20v20H2z" fill="#000"/>
    </svg>
    """

    let result = try SVGOptimizer().optimize(input, options: .bricksDefault)
    let namespaceCount = result.fullSVG.components(separatedBy: #"xmlns="http://www.w3.org/2000/svg""#).count - 1

    try expect(namespaceCount == 1, "Expected one SVG xmlns declaration, got \(namespaceCount)")
}

try run("custom color mode writes a concrete root stroke") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M4 12l4 4 12-12" stroke="#fff" stroke-width="2"/>
    </svg>
    """

    let result = try SVGOptimizer().optimize(
        input,
        options: SVGOptimizationOptions(colorMode: .custom, customColor: "#008dcc")
    )

    try expect(result.status == .optimized, "Expected optimized status")
    try expect(result.fullSVG.contains("stroke=\"#008dcc\""), "Expected custom root stroke")
    try expect(!result.fullSVG.contains(#"stroke="currentColor""#), "Expected no currentColor in custom mode")
}

try run("internal reference cleanup can be disabled for special cases") {
    let input = """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <defs>
        <linearGradient id="paint0"><stop stop-color="#fff"/></linearGradient>
      </defs>
      <path d="M2 2h20v20H2z" fill="url(#paint0)"/>
    </svg>
    """

    let result = try SVGOptimizer().optimize(
        input,
        options: SVGOptimizationOptions(
            removeUnusedDefs: false,
            removeIDs: false,
            requireNoInternalReferences: false
        )
    )

    try expect(result.status == .optimized, "Expected optimized status when internal refs are allowed")
    try expect(result.fullSVG.contains("url(#paint0)"), "Expected internal reference to remain")
    try expect(result.fullSVG.contains("<defs>"), "Expected defs to remain")
    try expect(result.fullSVG.contains(#"id="paint0""#), "Expected id to remain")
}

print("All Pifagor SVG core tests passed")

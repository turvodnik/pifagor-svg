import Foundation

public struct SVGOptimizer {
    private let paintableElementNames: Set<String> = [
        "path", "circle", "ellipse", "line", "polyline", "polygon", "rect"
    ]
    private let allowedElementNames: Set<String> = [
        "svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect",
        "defs", "clippath", "symbol", "use", "title", "desc", "lineargradient",
        "radialgradient", "stop", "mask", "filter", "a"
    ]
    private let dangerousElementNames: Set<String> = [
        "script", "metadata", "foreignobject", "style", "image", "feimage",
        "iframe", "audio", "video", "canvas", "object", "embed"
    ]

    public init() {}

    public func optimize(
        _ svg: String,
        options: SVGOptimizationOptions = .bricksDefault
    ) throws -> SVGOptimizationResult {
        let document: XMLDocument
        do {
            document = try XMLDocument(
                data: Data(svg.utf8),
                options: [.nodePreserveAll]
            )
        } catch {
            throw SVGOptimizationError.invalidXML(error.localizedDescription)
        }

        guard let root = document.rootElement(), root.normalizedName == "svg" else {
            throw SVGOptimizationError.missingSVGRoot
        }

        var warnings: [String] = []
        let viewBox = ViewBox(root.attributeValue("viewBox"))

        if options.convertInlineStyles {
            convertInlineStyles(in: root, warnings: &warnings)
        }
        sanitizeDangerousContent(in: root, warnings: &warnings)
        if options.expandUseReferences {
            expandUseReferences(in: root, warnings: &warnings)
        }
        if options.removeSafeClipPaths {
            removeSafeClipPathReferences(in: root, viewBox: viewBox)
        }
        removeWhitespaceNodes(in: root)
        if options.unwrapEmptyGroups {
            unwrapEmptyGroups(in: root)
        }

        if options.requireNoInternalReferences {
            warnings.append(contentsOf: remainingInternalReferenceWarnings(in: root))
        }
        if !warnings.isEmpty {
            let full = serialize(root, pretty: true)
            return SVGOptimizationResult(
                status: .requiresManualReview,
                fullSVG: full,
                compactSVG: compact(full),
                warnings: warnings
            )
        }

        applyPaintRules(to: root, options: options, viewBox: viewBox, warnings: &warnings)
        applySizeRules(to: root, options: options)
        let internalReferencesRemain = hasInternalReferences(in: root)
        if options.removeUnusedDefs, !internalReferencesRemain {
            removeUnusedDefinitionContent(in: root)
        }
        if options.removeIDs, !internalReferencesRemain {
            removeAllIDs(in: root)
        }
        removeWhitespaceNodes(in: root)
        if options.unwrapEmptyGroups {
            unwrapEmptyGroups(in: root)
        }
        root.ensureAttribute("aria-hidden", value: "true")
        root.ensureAttribute("focusable", value: "false")

        let full = serialize(root, pretty: true)
        return SVGOptimizationResult(
            status: .optimized,
            fullSVG: full,
            compactSVG: compact(full),
            warnings: warnings
        )
    }

    private func convertInlineStyles(in element: XMLElement, warnings: inout [String]) {
        if let style = element.attributeValue("style") {
            var unsupported: [String] = []
            for declaration in style.split(separator: ";") {
                let parts = declaration.split(separator: ":", maxSplits: 1)
                guard parts.count == 2 else { continue }
                let key = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
                let value = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
                if SVGAttributeNames.styleConvertible.contains(key), element.attributeValue(key) == nil {
                    element.setAttribute(key, value: value)
                } else if !key.isEmpty {
                    unsupported.append(key)
                }
            }
            if !unsupported.isEmpty {
                warnings.append("style содержит неподдерживаемые свойства: \(unsupported.joined(separator: ", "))")
            }
            element.removeAttribute(forName: "style")
        }

        for child in element.elementChildren {
            convertInlineStyles(in: child, warnings: &warnings)
        }
    }

    private func sanitizeDangerousContent(in element: XMLElement, warnings: inout [String]) {
        var index = 0
        while index < element.childCount {
            guard let child = element.child(at: index) else {
                index += 1
                continue
            }

            if child.kind == .comment {
                element.removeChild(at: index)
                continue
            }

            guard let childElement = child as? XMLElement else {
                index += 1
                continue
            }

            if dangerousElementNames.contains(childElement.normalizedName) {
                element.removeChild(at: index)
                continue
            }

            if !allowedElementNames.contains(childElement.normalizedName) {
                warnings.append("Элемент <\(childElement.name ?? "unknown")> требует ручного решения и удален из безопасного вывода.")
                element.removeChild(at: index)
                continue
            }

            switch childElement.normalizedName {
            case "a":
                unwrap(childElement)
                continue
            default:
                sanitizeDangerousAttributes(in: childElement)
                sanitizeDangerousContent(in: childElement, warnings: &warnings)
                index += 1
            }
        }

        sanitizeDangerousAttributes(in: element)
    }

    private func sanitizeDangerousAttributes(in element: XMLElement) {
        for attribute in element.attributeList {
            let name = attribute.name ?? ""
            let value = attribute.stringValue ?? ""
            let lowerName = name.lowercased()
            let normalizedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
            let lowerValue = normalizedValue.lowercased()

            if lowerName.hasPrefix("on") {
                element.removeAttribute(forName: name)
                continue
            }

            if SVGReferenceParser.hasExternalURL(in: normalizedValue) {
                element.removeAttribute(forName: name)
                continue
            }

            if SVGAttributeNames.linkNames.contains(lowerName),
               !lowerValue.isEmpty,
               !lowerValue.hasPrefix("#") {
                element.removeAttribute(forName: name)
            }
        }
    }

    private func expandUseReferences(in root: XMLElement, warnings: inout [String]) {
        let idMap = elementsByID(in: root)
        for useElement in root.descendants(named: "use") {
            guard let href = useElement.attributeValue("href") ?? useElement.attributeValue("xlink:href"),
                  href.hasPrefix("#") else {
                continue
            }

            let id = String(href.dropFirst())
            guard let referenced = idMap[id] else { continue }

            if useElement.hasAnyAttribute(named: ["x", "y", "width", "height"]) {
                warnings.append("<use href=\"\(href)\"> с x/y/width/height требует ручного решения")
                continue
            }

            if referenced.normalizedName == "symbol", referenced.attributeValue("viewBox") != nil {
                warnings.append("<use href=\"\(href)\"> на <symbol viewBox> требует ручного решения")
                continue
            }

            let replacement = XMLElement(name: "g")
            for attribute in useElement.attributeList {
                guard let name = attribute.name else { continue }
                let lowerName = name.lowercased()
                guard lowerName != "href",
                      lowerName != "xlink:href",
                      lowerName != "id",
                      lowerName != "x",
                      lowerName != "y",
                      lowerName != "width",
                      lowerName != "height" else {
                    continue
                }
                replacement.setAttribute(name, value: attribute.stringValue ?? "")
            }

            if referenced.normalizedName == "symbol" {
                for child in referenced.children ?? [] {
                    if let copied = child.copy() as? XMLNode {
                        replacement.addChild(copied)
                    }
                }
            } else if let copied = referenced.copy() as? XMLElement {
                removeAllIDs(in: copied)
                replacement.addChild(copied)
            }

            replace(useElement, with: replacement)
        }
    }

    private func removeSafeClipPathReferences(in root: XMLElement, viewBox: ViewBox?) {
        guard let viewBox else { return }
        let idMap = elementsByID(in: root)

        for element in root.allElements {
            guard let clipPath = element.attributeValue("clip-path"),
                  let id = SVGReferenceParser.internalURLID(from: clipPath),
                  let referenced = idMap[id],
                  referenced.normalizedName == "clippath",
                  isSafeFullViewBoxClipPath(referenced, viewBox: viewBox) else {
                continue
            }

            element.removeAttribute(forName: "clip-path")
        }
    }

    private func isSafeFullViewBoxClipPath(_ clipPath: XMLElement, viewBox: ViewBox) -> Bool {
        let elementChildren = clipPath.elementChildren
        guard elementChildren.count == 1,
              let rect = elementChildren.first,
              rect.normalizedName == "rect" else {
            return false
        }

        return isFullViewBoxRect(rect, viewBox: viewBox)
    }

    private func isFullViewBoxRect(_ element: XMLElement, viewBox: ViewBox) -> Bool {
        guard element.normalizedName == "rect" else { return false }

        let x = element.attributeValue("x").flatMap(Double.init) ?? viewBox.minX
        let y = element.attributeValue("y").flatMap(Double.init) ?? viewBox.minY
        let width = element.attributeValue("width").flatMap(Double.init)
        let height = element.attributeValue("height").flatMap(Double.init)

        return x.nearlyEquals(viewBox.minX)
            && y.nearlyEquals(viewBox.minY)
            && (width?.nearlyEquals(viewBox.width) ?? false)
            && (height?.nearlyEquals(viewBox.height) ?? false)
    }

    private func remainingInternalReferenceWarnings(in root: XMLElement) -> [String] {
        var warnings: [String] = []

        for element in root.allElements {
            for attribute in element.attributeList {
                guard let name = attribute.name,
                      let value = attribute.stringValue else {
                    continue
                }

                let lowerName = name.lowercased()
                let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
                if SVGReferenceParser.internalURLID(from: trimmedValue) != nil {
                    warnings.append("\(name)=\"\(value)\" требует ручного решения")
                } else if SVGAttributeNames.linkNames.contains(lowerName), trimmedValue.hasPrefix("#") {
                    warnings.append("\(name)=\"\(value)\" требует ручного решения")
                }
            }
        }

        return warnings
    }

    private func applyPaintRules(
        to root: XMLElement,
        options: SVGOptimizationOptions,
        viewBox: ViewBox?,
        warnings: inout [String]
    ) {
        let paintElements = root.allElements.filter { paintableElementNames.contains($0.normalizedName) }
        let backgroundElements = Set(
            paintElements
                .filter { element in
                    guard let viewBox else { return false }
                    return isFullViewBoxRect(element, viewBox: viewBox)
                        && element.attributeValue("fill").map { $0.lowercased() != "none" } == true
                }
                .map(ObjectIdentifier.init)
        )

        if options.removeBackground {
            for element in paintElements where backgroundElements.contains(ObjectIdentifier(element)) {
                element.detach()
            }
        }

        let activePaintElements = root.allElements.filter { paintableElementNames.contains($0.normalizedName) }
        let nonBackgroundElements = activePaintElements.filter {
            !backgroundElements.contains(ObjectIdentifier($0))
        }
        let hasStroke = nonBackgroundElements.contains { element in
            guard let stroke = element.attributeValue("stroke") ?? root.attributeValue("stroke") else {
                return false
            }
            return !stroke.paintIsNone
        }

        if hasStroke {
            applyOutlineRules(to: root, paintElements: nonBackgroundElements, options: options)
            return
        }

        let fillValues = nonBackgroundElements
            .compactMap { $0.attributeValue("fill") ?? root.attributeValue("fill") }
            .filter { !$0.paintIsNone && !SVGReferenceParser.containsInternalURL($0) }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }

        let uniqueFills = Set(fillValues)
        if uniqueFills.count == 1 {
            if options.movePaintToRoot {
                root.setAttribute("fill", value: resolvedFillColorValue(original: uniqueFills.first, options: options))
                for element in nonBackgroundElements {
                    element.removeAttribute(forName: "fill")
                }
            } else {
                for element in nonBackgroundElements {
                    if element.attributeValue("fill") != nil {
                        element.setAttribute("fill", value: resolvedFillColorValue(original: element.attributeValue("fill"), options: options))
                    }
                }
            }
        } else if uniqueFills.count > 1, options.fillColorMode != .preserve {
            warnings.append("Многоцветная fill-иконка сохранена без агрессивной замены цветов.")
        }
    }

    private func applyOutlineRules(
        to root: XMLElement,
        paintElements: [XMLElement],
        options: SVGOptimizationOptions
    ) {
        if !options.movePaintToRoot {
            for element in paintElements {
                if element.attributeValue("stroke") != nil {
                    element.setAttribute("stroke", value: resolvedStrokeColorValue(original: element.attributeValue("stroke"), options: options))
                }
                if options.strokeWidthMode == .set, element.attributeValue("stroke-width") != nil {
                    element.setAttribute("stroke-width", value: options.strokeWidth)
                }
            }
            return
        }

        let originalStroke = commonAttribute("stroke", in: paintElements) ?? root.attributeValue("stroke")
        root.setAttribute("fill", value: resolvedOutlineFillValue(root: root, paintElements: paintElements, options: options))
        root.setAttribute("stroke", value: resolvedStrokeColorValue(original: originalStroke, options: options))

        if let strokeWidth = resolvedStrokeWidthValue(root: root, paintElements: paintElements, options: options) {
            root.setAttribute("stroke-width", value: strokeWidth)
        } else {
            root.removeAttribute(forName: "stroke-width")
        }

        if let commonLineCap = commonAttribute("stroke-linecap", in: paintElements) {
            root.setAttribute("stroke-linecap", value: commonLineCap)
        }

        if let commonLineJoin = commonAttribute("stroke-linejoin", in: paintElements) {
            root.setAttribute("stroke-linejoin", value: commonLineJoin)
        }

        for element in paintElements {
            element.removeAttribute(forName: "stroke")
            element.removeAttribute(forName: "stroke-width")
            element.removeAttribute(forName: "stroke-linecap")
            element.removeAttribute(forName: "stroke-linejoin")
            if element.attributeValue("fill")?.paintIsNone == true {
                element.removeAttribute(forName: "fill")
            }
        }
    }

    private func commonAttribute(_ name: String, in elements: [XMLElement]) -> String? {
        let values = elements
            .compactMap { $0.attributeValue(name) }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        guard let first = values.first, values.allSatisfy({ $0 == first }) else {
            return nil
        }

        return first
    }

    private func resolvedStrokeColorValue(original: String?, options: SVGOptimizationOptions) -> String {
        switch options.strokeColorMode {
        case .currentColor:
            return "currentColor"
        case .custom:
            return options.strokeColor.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? "currentColor"
                : options.strokeColor.trimmingCharacters(in: .whitespacesAndNewlines)
        case .preserve:
            return original?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                ? original!.trimmingCharacters(in: .whitespacesAndNewlines)
                : "currentColor"
        }
    }

    private func resolvedFillColorValue(original: String?, options: SVGOptimizationOptions) -> String {
        switch options.fillColorMode {
        case .currentColor:
            return "currentColor"
        case .custom:
            return options.fillColor.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? "currentColor"
                : options.fillColor.trimmingCharacters(in: .whitespacesAndNewlines)
        case .preserve:
            return original?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                ? original!.trimmingCharacters(in: .whitespacesAndNewlines)
                : "currentColor"
        case .none:
            return "none"
        }
    }

    private func resolvedOutlineFillValue(
        root: XMLElement,
        paintElements: [XMLElement],
        options: SVGOptimizationOptions
    ) -> String {
        if options.fillColorMode == .none {
            return "none"
        }

        let hasActiveFill = paintElements.contains { element in
            guard let fill = element.attributeValue("fill") ?? root.attributeValue("fill") else {
                return false
            }
            return !fill.paintIsNone
        }

        guard hasActiveFill else {
            return "none"
        }

        let original = commonAttribute("fill", in: paintElements) ?? root.attributeValue("fill")
        return resolvedFillColorValue(original: original, options: options)
    }

    private func resolvedStrokeWidthValue(
        root: XMLElement,
        paintElements: [XMLElement],
        options: SVGOptimizationOptions
    ) -> String? {
        switch options.strokeWidthMode {
        case .set:
            return options.strokeWidth
        case .preserve:
            return commonAttribute("stroke-width", in: paintElements) ?? root.attributeValue("stroke-width")
        }
    }

    private func applySizeRules(to root: XMLElement, options: SVGOptimizationOptions) {
        switch options.sizeMode {
        case .none:
            root.removeAttribute(forName: "width")
            root.removeAttribute(forName: "height")
        case .inline1em:
            root.setAttribute("width", value: "1em")
            root.setAttribute("height", value: "1em")
        case .fixed:
            root.setAttribute("width", value: dimensionValue(options.fixedWidth, unit: options.sizeUnit))
            root.setAttribute("height", value: dimensionValue(options.lockSize ? options.fixedWidth : options.fixedHeight, unit: options.sizeUnit))
        }
    }

    private func dimensionValue(_ value: String, unit: SVGSizeUnit) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let number = trimmed.isEmpty ? "24" : trimmed
        if number.lowercased().hasSuffix("px")
            || number.lowercased().hasSuffix("em")
            || number.lowercased().hasSuffix("rem")
            || number.hasSuffix("%") {
            return number
        }
        return "\(number)\(unit.suffix)"
    }

    private func removeUnusedDefinitionContent(in root: XMLElement) {
        for element in root.descendants(named: "defs") {
            element.detach()
        }
    }

    private func hasInternalReferences(in root: XMLElement) -> Bool {
        for element in root.allElements {
            for attribute in element.attributeList {
                guard let value = attribute.stringValue else { continue }
                if SVGReferenceParser.internalURLID(from: value) != nil {
                    return true
                }
                if let name = attribute.name?.lowercased(),
                   SVGAttributeNames.linkNames.contains(name),
                   value.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("#") {
                    return true
                }
            }
        }
        return false
    }

    private func removeAllIDs(in element: XMLElement) {
        element.removeAttribute(forName: "id")
        for child in element.elementChildren {
            removeAllIDs(in: child)
        }
    }

    private func removeWhitespaceNodes(in element: XMLElement) {
        var index = 0
        while index < element.childCount {
            guard let child = element.child(at: index) else {
                index += 1
                continue
            }

            if child.kind == .text,
               (child.stringValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                element.removeChild(at: index)
                continue
            }

            if let childElement = child as? XMLElement {
                removeWhitespaceNodes(in: childElement)
            }
            index += 1
        }
    }

    private func unwrapEmptyGroups(in root: XMLElement) {
        var didChange = true
        while didChange {
            didChange = false
            for group in root.descendants(named: "g") {
                guard group.attributeList.isEmpty else { continue }
                unwrap(group)
                didChange = true
                break
            }
        }
    }

    private func elementsByID(in root: XMLElement) -> [String: XMLElement] {
        var result: [String: XMLElement] = [:]
        for element in root.allElements {
            if let id = element.attributeValue("id"), !id.isEmpty {
                result[id] = element
            }
        }
        return result
    }

    private func replace(_ element: XMLElement, with replacement: XMLElement) {
        guard let parent = element.parent as? XMLElement,
              let index = parent.indexOfChild(element) else {
            return
        }

        parent.removeChild(at: index)
        parent.insertChild(replacement, at: index)
    }

    private func unwrap(_ element: XMLElement) {
        guard let parent = element.parent as? XMLElement,
              let index = parent.indexOfChild(element) else {
            return
        }

        let children = (element.children ?? []).compactMap { $0.copy() as? XMLNode }
        parent.removeChild(at: index)
        for (offset, child) in children.enumerated() {
            parent.insertChild(child, at: index + offset)
        }
    }

    private func serialize(_ root: XMLElement, pretty: Bool) -> String {
        let options: XMLNode.Options = pretty ? [.nodePrettyPrint] : []
        let svg = root.xmlString(options: options)
        guard !svg.contains("xmlns=") else {
            return svg
        }
        return svg.replacingOccurrences(
            of: "<svg",
            with: #"<svg xmlns="http://www.w3.org/2000/svg""#,
            options: [],
            range: svg.range(of: "<svg")
        )
    }

    private func compact(_ svg: String) -> String {
        let withoutInterTagWhitespace = svg.replacingOccurrences(
            of: #">\s+<"#,
            with: "><",
            options: .regularExpression
        )
        return withoutInterTagWhitespace
            .replacingOccurrences(
                of: #"\s+xmlns="http://www\.w3\.org/2000/svg""#,
                with: "",
                options: .regularExpression
            )
            .replacingOccurrences(of: "\n", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

private enum SVGAttributeNames {
    static let styleConvertible: Set<String> = [
        "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
        "clip-path", "mask", "filter", "opacity", "fill-rule", "clip-rule"
    ]

    static let linkNames: Set<String> = [
        "href", "xlink:href"
    ]
}

private enum SVGReferenceParser {
    private static let externalSchemes = [
        "http:", "https:", "data:", "file:", "javascript:", "mailto:", "//"
    ]

    static func containsInternalURL(_ value: String) -> Bool {
        internalURLID(from: value) != nil
    }

    static func hasExternalURL(in value: String) -> Bool {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        if externalSchemes.contains(where: { lower.hasPrefix($0) }) {
            return true
        }

        for content in urlFunctionContents(in: trimmed) {
            let normalized = content
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
                .lowercased()
            if normalized.hasPrefix("#") {
                continue
            }
            return true
        }

        return false
    }

    static func internalURLID(from value: String) -> String? {
        let pattern = #"url\(\s*#([A-Za-z_][A-Za-z0-9_.:-]*)\s*\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(value.startIndex..<value.endIndex, in: value)
        guard let match = regex.firstMatch(in: value, range: range),
              match.numberOfRanges > 1,
              let idRange = Range(match.range(at: 1), in: value) else {
            return nil
        }
        return String(value[idRange])
    }

    private static func urlFunctionContents(in value: String) -> [String] {
        let pattern = #"url\(\s*([^)]+?)\s*\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return []
        }
        let range = NSRange(value.startIndex..<value.endIndex, in: value)
        return regex.matches(in: value, range: range).compactMap { match in
            guard match.numberOfRanges > 1,
                  let contentRange = Range(match.range(at: 1), in: value) else {
                return nil
            }
            return String(value[contentRange])
        }
    }
}

private struct ViewBox {
    let minX: Double
    let minY: Double
    let width: Double
    let height: Double

    init?(_ value: String?) {
        guard let value else { return nil }
        let parts = value
            .replacingOccurrences(of: ",", with: " ")
            .split(whereSeparator: { $0.isWhitespace })
            .compactMap { Double($0) }
        guard parts.count == 4 else { return nil }
        minX = parts[0]
        minY = parts[1]
        width = parts[2]
        height = parts[3]
    }
}

private extension Double {
    func nearlyEquals(_ other: Double) -> Bool {
        abs(self - other) < 0.0001
    }
}

private extension String {
    var paintIsNone: Bool {
        trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "none"
    }
}

private extension XMLElement {
    var normalizedName: String {
        (name ?? "").lowercased()
    }

    var attributeList: [XMLNode] {
        attributes ?? []
    }

    var elementChildren: [XMLElement] {
        (children ?? []).compactMap { $0 as? XMLElement }
    }

    var allElements: [XMLElement] {
        [self] + elementChildren.flatMap(\.allElements)
    }

    func descendants(named name: String) -> [XMLElement] {
        allElements.filter { $0.normalizedName == name.lowercased() && $0 !== self }
    }

    func attributeValue(_ name: String) -> String? {
        attribute(forName: name)?.stringValue
    }

    func ensureAttribute(_ name: String, value: String) {
        if attributeValue(name) == nil {
            setAttribute(name, value: value)
        }
    }

    func hasAnyAttribute(named names: Set<String>) -> Bool {
        names.contains { attributeValue($0) != nil }
    }

    func setAttribute(_ name: String, value: String) {
        removeAttribute(forName: name)
        addAttribute(XMLNode.attribute(withName: name, stringValue: value) as! XMLNode)
    }

    func indexOfChild(_ child: XMLNode) -> Int? {
        for index in 0..<childCount {
            if self.child(at: index) === child {
                return index
            }
        }
        return nil
    }
}

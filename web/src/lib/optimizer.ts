export type OptimizationStatus = "optimized" | "requiresManualReview";
export type SizeMode = "none" | "inline1em" | "fixed";
export type SizeUnit = "px" | "em" | "rem" | "percent";
export type ColorMode = "currentColor" | "custom" | "preserve";
export type FillColorMode = ColorMode | "none";
export type StrokeWidthMode = "set" | "preserve";

export interface OptimizationSettings {
  sizeMode: SizeMode;
  fixedWidth: string;
  fixedHeight: string;
  sizeUnit: SizeUnit;
  lockSize: boolean;
  strokeWidth: string;
  strokeWidthMode: StrokeWidthMode;
  removeBackground: boolean;
  strokeColorMode: ColorMode;
  strokeColor: string;
  fillColorMode: FillColorMode;
  fillColor: string;
  movePaintToRoot: boolean;
  convertInlineStyles: boolean;
  removeSafeClipPaths: boolean;
  expandUseReferences: boolean;
  removeUnusedDefs: boolean;
  removeIDs: boolean;
  unwrapEmptyGroups: boolean;
  requireNoInternalReferences: boolean;
  outputPrefix: string;
  outputSuffix: string;
  logoOptimization: boolean;
}

export interface OptimizationResult {
  status: OptimizationStatus;
  fullSvg: string;
  compactSvg: string;
  warnings: string[];
}

const paintableElementNames = new Set(["path", "circle", "ellipse", "line", "polyline", "polygon", "rect"]);
const allowedElementNames = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "rect",
  "defs",
  "clippath",
  "symbol",
  "use",
  "title",
  "desc",
  "lineargradient",
  "radialgradient",
  "stop",
  "mask",
  "filter",
  "a"
]);
const dangerousElementNames = new Set([
  "script",
  "metadata",
  "foreignobject",
  "style",
  "image",
  "feimage",
  "iframe",
  "audio",
  "video",
  "canvas",
  "object",
  "embed"
]);
const styleConvertible = new Set([
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "clip-path",
  "mask",
  "filter",
  "opacity",
  "fill-rule",
  "clip-rule"
]);
const linkNames = new Set(["href", "xlink:href"]);
const externalSchemes = ["http:", "https:", "data:", "file:", "javascript:", "mailto:", "//"];

export const defaultSettings: OptimizationSettings = {
  sizeMode: "none",
  fixedWidth: "24",
  fixedHeight: "24",
  sizeUnit: "px",
  lockSize: true,
  strokeWidth: "1.5",
  strokeWidthMode: "set",
  removeBackground: false,
  strokeColorMode: "currentColor",
  strokeColor: "#000000",
  fillColorMode: "currentColor",
  fillColor: "#000000",
  movePaintToRoot: true,
  convertInlineStyles: true,
  removeSafeClipPaths: true,
  expandUseReferences: true,
  removeUnusedDefs: true,
  removeIDs: true,
  unwrapEmptyGroups: true,
  requireNoInternalReferences: true,
  outputPrefix: "",
  outputSuffix: "-opt",
  logoOptimization: false
};

export const logoSettings: OptimizationSettings = {
  ...defaultSettings,
  strokeWidthMode: "preserve",
  removeBackground: false,
  strokeColorMode: "preserve",
  fillColorMode: "preserve",
  movePaintToRoot: false,
  logoOptimization: true
};

export function effectiveSettings(settings: OptimizationSettings): OptimizationSettings {
  if (!settings.logoOptimization) {
    return settings;
  }

  return {
    ...settings,
    strokeWidthMode: "preserve",
    removeBackground: false,
    strokeColorMode: "preserve",
    fillColorMode: "preserve",
    movePaintToRoot: false
  };
}

export function optimizeSvg(svg: string, rawSettings: OptimizationSettings = defaultSettings): OptimizationResult {
  const settings = effectiveSettings(rawSettings);
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Invalid SVG/XML: ${parserError.textContent?.trim() ?? "parser error"}`);
  }

  const root = document.documentElement;
  if (!root || normalizedName(root) !== "svg") {
    throw new Error("Missing root <svg> element.");
  }

  const warnings: string[] = [];
  const viewBox = parseViewBox(root.getAttribute("viewBox"));

  if (settings.convertInlineStyles) {
    convertInlineStyles(root, warnings);
  }
  sanitizeDangerousContent(root, warnings);
  if (settings.expandUseReferences) {
    expandUseReferences(root, warnings);
  }
  if (settings.removeSafeClipPaths && viewBox) {
    removeSafeClipPathReferences(root, viewBox);
  }
  removeWhitespaceNodes(root);
  if (settings.unwrapEmptyGroups) {
    unwrapEmptyGroups(root);
  }
  if (settings.requireNoInternalReferences) {
    warnings.push(...remainingInternalReferenceWarnings(root));
  }

  if (warnings.length > 0) {
    const fullSvg = serialize(root);
    return {
      status: "requiresManualReview",
      fullSvg,
      compactSvg: compact(fullSvg),
      warnings: unique(warnings)
    };
  }

  applyPaintRules(root, settings, viewBox);
  applySizeRules(root, settings);
  const internalReferencesRemain = hasInternalReferences(root);
  if (settings.removeUnusedDefs && !internalReferencesRemain) {
    descendants(root, "defs").forEach((element) => element.remove());
  }
  if (settings.removeIDs && !internalReferencesRemain) {
    removeAllIDs(root);
  }
  removeWhitespaceNodes(root);
  if (settings.unwrapEmptyGroups) {
    unwrapEmptyGroups(root);
  }
  ensureAttribute(root, "aria-hidden", "true");
  ensureAttribute(root, "focusable", "false");

  const fullSvg = serialize(root);
  return {
    status: "optimized",
    fullSvg,
    compactSvg: compact(fullSvg),
    warnings: []
  };
}

export function outputFileName(fileName: string, settings: OptimizationSettings): string {
  const cleanPrefix = settings.outputPrefix.trim();
  const cleanSuffix = settings.outputSuffix.trim() || "-opt";
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  const extension = dotIndex > 0 ? fileName.slice(dotIndex + 1) : "svg";
  return `${cleanPrefix}${baseName}${cleanSuffix}.${extension || "svg"}`;
}

export function toInlineHtmlSvg(svg: string): string {
  return compact(svg);
}

function convertInlineStyles(element: Element, warnings: string[]): void {
  const style = element.getAttribute("style");
  if (style) {
    const unsupported: string[] = [];
    for (const declaration of style.split(";")) {
      const [rawKey, ...rawValue] = declaration.split(":");
      const key = rawKey?.trim();
      const value = rawValue.join(":").trim();
      if (!key) {
        continue;
      }
      if (styleConvertible.has(key) && !element.hasAttribute(key)) {
        element.setAttribute(key, value);
      } else {
        unsupported.push(key);
      }
    }
    if (unsupported.length > 0) {
      warnings.push(`style contains unsupported properties: ${unsupported.join(", ")}`);
    }
    element.removeAttribute("style");
  }

  elementChildren(element).forEach((child) => convertInlineStyles(child, warnings));
}

function sanitizeDangerousContent(element: Element, warnings: string[]): void {
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      continue;
    }
    if (!(child instanceof Element)) {
      continue;
    }

    const name = normalizedName(child);
    if (dangerousElementNames.has(name)) {
      child.remove();
      continue;
    }
    if (!allowedElementNames.has(name)) {
      warnings.push(`Element <${child.tagName}> requires manual review and was removed from the safe output.`);
      child.remove();
      continue;
    }
    if (name === "a") {
      unwrap(child);
      continue;
    }

    sanitizeDangerousAttributes(child);
    sanitizeDangerousContent(child, warnings);
  }

  sanitizeDangerousAttributes(element);
}

function sanitizeDangerousAttributes(element: Element): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name;
    const value = attribute.value;
    const lowerName = name.toLowerCase();
    const normalizedValue = value.trim();
    const lowerValue = normalizedValue.toLowerCase();

    if (lowerName.startsWith("on")) {
      element.removeAttribute(name);
      continue;
    }
    if (hasExternalURL(normalizedValue)) {
      element.removeAttribute(name);
      continue;
    }
    if (linkNames.has(lowerName) && lowerValue && !lowerValue.startsWith("#")) {
      element.removeAttribute(name);
    }
  }
}

function expandUseReferences(root: Element, warnings: string[]): void {
  const idMap = elementsByID(root);
  for (const useElement of descendants(root, "use")) {
    const href = useElement.getAttribute("href") ?? useElement.getAttribute("xlink:href");
    if (!href?.startsWith("#")) {
      continue;
    }
    const referenced = idMap.get(href.slice(1));
    if (!referenced) {
      continue;
    }
    if (["x", "y", "width", "height"].some((name) => useElement.hasAttribute(name))) {
      warnings.push(`<use href="${href}"> with x/y/width/height requires manual review`);
      continue;
    }
    if (normalizedName(referenced) === "symbol" && referenced.hasAttribute("viewBox")) {
      warnings.push(`<use href="${href}"> on <symbol viewBox> requires manual review`);
      continue;
    }

    const replacement = root.ownerDocument.createElement("g");
    for (const attribute of Array.from(useElement.attributes)) {
      const lowerName = attribute.name.toLowerCase();
      if (["href", "xlink:href", "id", "x", "y", "width", "height"].includes(lowerName)) {
        continue;
      }
      replacement.setAttribute(attribute.name, attribute.value);
    }

    if (normalizedName(referenced) === "symbol") {
      for (const child of Array.from(referenced.childNodes)) {
        replacement.appendChild(child.cloneNode(true));
      }
    } else {
      const copy = referenced.cloneNode(true) as Element;
      removeAllIDs(copy);
      replacement.appendChild(copy);
    }

    useElement.parentNode?.replaceChild(replacement, useElement);
  }
}

function removeSafeClipPathReferences(root: Element, viewBox: ViewBox): void {
  const idMap = elementsByID(root);
  for (const element of allElements(root)) {
    const clipPath = element.getAttribute("clip-path");
    const id = clipPath ? internalURLID(clipPath) : null;
    const referenced = id ? idMap.get(id) : null;
    if (referenced && normalizedName(referenced) === "clippath" && isSafeFullViewBoxClipPath(referenced, viewBox)) {
      element.removeAttribute("clip-path");
    }
  }
}

function applyPaintRules(root: Element, settings: OptimizationSettings, viewBox: ViewBox | null): void {
  const paintElements = allElements(root).filter((element) => paintableElementNames.has(normalizedName(element)));
  const backgroundElements = new Set(
    paintElements.filter((element) => {
      if (!viewBox || !isFullViewBoxRect(element, viewBox)) {
        return false;
      }
      const fill = element.getAttribute("fill");
      return fill !== null && !paintIsNone(fill);
    })
  );

  if (settings.removeBackground) {
    for (const element of backgroundElements) {
      element.remove();
    }
  }

  const activePaintElements = allElements(root).filter((element) => paintableElementNames.has(normalizedName(element)));
  const nonBackgroundElements = activePaintElements.filter((element) => !backgroundElements.has(element));
  const hasStroke = nonBackgroundElements.some((element) => {
    const stroke = element.getAttribute("stroke") ?? root.getAttribute("stroke");
    return stroke !== null && !paintIsNone(stroke);
  });

  if (hasStroke) {
    applyOutlineRules(root, nonBackgroundElements, settings);
    return;
  }

  const fillValues = nonBackgroundElements
    .map((element) => element.getAttribute("fill") ?? root.getAttribute("fill"))
    .filter((value): value is string => typeof value === "string" && value.length > 0 && !paintIsNone(value) && !containsInternalURL(value))
    .map((value) => value.trim().toLowerCase());
  const uniqueFills = new Set(fillValues);
  if (uniqueFills.size === 1) {
    if (settings.movePaintToRoot) {
      root.setAttribute("fill", resolvedFillColorValue(Array.from(uniqueFills)[0], settings));
      nonBackgroundElements.forEach((element) => element.removeAttribute("fill"));
    } else {
      nonBackgroundElements.forEach((element) => {
        const fill = element.getAttribute("fill");
        if (fill !== null) {
          element.setAttribute("fill", resolvedFillColorValue(fill, settings));
        }
      });
    }
  }
}

function applyOutlineRules(root: Element, paintElements: Element[], settings: OptimizationSettings): void {
  if (!settings.movePaintToRoot) {
    for (const element of paintElements) {
      const stroke = element.getAttribute("stroke");
      if (stroke !== null) {
        element.setAttribute("stroke", resolvedStrokeColorValue(stroke, settings));
      }
      if (settings.strokeWidthMode === "set" && element.hasAttribute("stroke-width")) {
        element.setAttribute("stroke-width", settings.strokeWidth);
      }
    }
    return;
  }

  const originalStroke = commonAttribute("stroke", paintElements) ?? root.getAttribute("stroke");
  root.setAttribute("fill", resolvedOutlineFillValue(root, paintElements, settings));
  root.setAttribute("stroke", resolvedStrokeColorValue(originalStroke, settings));
  const strokeWidth = resolvedStrokeWidthValue(root, paintElements, settings);
  if (strokeWidth) {
    root.setAttribute("stroke-width", strokeWidth);
  } else {
    root.removeAttribute("stroke-width");
  }

  const lineCap = commonAttribute("stroke-linecap", paintElements);
  const lineJoin = commonAttribute("stroke-linejoin", paintElements);
  if (lineCap) {
    root.setAttribute("stroke-linecap", lineCap);
  }
  if (lineJoin) {
    root.setAttribute("stroke-linejoin", lineJoin);
  }

  for (const element of paintElements) {
    element.removeAttribute("stroke");
    element.removeAttribute("stroke-width");
    element.removeAttribute("stroke-linecap");
    element.removeAttribute("stroke-linejoin");
    if (paintIsNone(element.getAttribute("fill"))) {
      element.removeAttribute("fill");
    }
  }
}

function applySizeRules(root: Element, settings: OptimizationSettings): void {
  if (settings.sizeMode === "none") {
    root.removeAttribute("width");
    root.removeAttribute("height");
    return;
  }
  if (settings.sizeMode === "inline1em") {
    root.setAttribute("width", "1em");
    root.setAttribute("height", "1em");
    return;
  }
  root.setAttribute("width", dimensionValue(settings.fixedWidth, settings.sizeUnit));
  root.setAttribute(
    "height",
    dimensionValue(settings.lockSize ? settings.fixedWidth : settings.fixedHeight, settings.sizeUnit)
  );
}

function remainingInternalReferenceWarnings(root: Element): string[] {
  const warnings: string[] = [];
  for (const element of allElements(root)) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name;
      const value = attribute.value;
      if (internalURLID(value)) {
        warnings.push(`${name}="${value}" requires manual review`);
      } else if (linkNames.has(name.toLowerCase()) && value.trim().startsWith("#")) {
        warnings.push(`${name}="${value}" requires manual review`);
      }
    }
  }
  return warnings;
}

function hasInternalReferences(root: Element): boolean {
  return allElements(root).some((element) =>
    Array.from(element.attributes).some((attribute) => {
      if (internalURLID(attribute.value)) {
        return true;
      }
      return linkNames.has(attribute.name.toLowerCase()) && attribute.value.trim().startsWith("#");
    })
  );
}

function serialize(root: Element): string {
  let svg = new XMLSerializer().serializeToString(root);
  if (!svg.includes("xmlns=")) {
    svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

function compact(svg: string): string {
  return svg
    .replace(/>\s+</g, "><")
    .replace(/\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "")
    .replace(/\n/g, "")
    .trim();
}

function resolvedStrokeColorValue(original: string | null, settings: OptimizationSettings): string {
  if (settings.strokeColorMode === "currentColor") {
    return "currentColor";
  }
  if (settings.strokeColorMode === "custom") {
    return settings.strokeColor.trim() || "currentColor";
  }
  return original?.trim() || "currentColor";
}

function resolvedFillColorValue(original: string | null, settings: OptimizationSettings): string {
  if (settings.fillColorMode === "currentColor") {
    return "currentColor";
  }
  if (settings.fillColorMode === "custom") {
    return settings.fillColor.trim() || "currentColor";
  }
  if (settings.fillColorMode === "none") {
    return "none";
  }
  return original?.trim() || "currentColor";
}

function resolvedOutlineFillValue(root: Element, paintElements: Element[], settings: OptimizationSettings): string {
  if (settings.fillColorMode === "none") {
    return "none";
  }
  const hasActiveFill = paintElements.some((element) => {
    const fill = element.getAttribute("fill") ?? root.getAttribute("fill");
    return fill !== null && !paintIsNone(fill);
  });
  if (!hasActiveFill) {
    return "none";
  }
  return resolvedFillColorValue(commonAttribute("fill", paintElements) ?? root.getAttribute("fill"), settings);
}

function resolvedStrokeWidthValue(root: Element, paintElements: Element[], settings: OptimizationSettings): string | null {
  if (settings.strokeWidthMode === "set") {
    return settings.strokeWidth;
  }
  return commonAttribute("stroke-width", paintElements) ?? root.getAttribute("stroke-width");
}

function commonAttribute(name: string, elements: Element[]): string | null {
  const values = elements.map((element) => element.getAttribute(name)?.trim()).filter(Boolean) as string[];
  if (values.length === 0) {
    return null;
  }
  return values.every((value) => value === values[0]) ? values[0] : null;
}

function dimensionValue(value: string, unit: SizeUnit): string {
  const trimmed = value.trim() || "24";
  if (/px$|em$|rem$|%$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}${unit === "percent" ? "%" : unit}`;
}

function removeWhitespaceNodes(element: Element): void {
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) {
      child.remove();
      continue;
    }
    if (child instanceof Element) {
      removeWhitespaceNodes(child);
    }
  }
}

function unwrapEmptyGroups(root: Element): void {
  let didChange = true;
  while (didChange) {
    didChange = false;
    for (const group of descendants(root, "g")) {
      if (group.attributes.length === 0) {
        unwrap(group);
        didChange = true;
        break;
      }
    }
  }
}

function unwrap(element: Element): void {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }
  for (const child of Array.from(element.childNodes)) {
    parent.insertBefore(child.cloneNode(true), element);
  }
  element.remove();
}

function removeAllIDs(element: Element): void {
  element.removeAttribute("id");
  elementChildren(element).forEach(removeAllIDs);
}

function elementsByID(root: Element): Map<string, Element> {
  const result = new Map<string, Element>();
  for (const element of allElements(root)) {
    const id = element.getAttribute("id");
    if (id) {
      result.set(id, element);
    }
  }
  return result;
}

function isSafeFullViewBoxClipPath(clipPath: Element, viewBox: ViewBox): boolean {
  const children = elementChildren(clipPath);
  return children.length === 1 && normalizedName(children[0]) === "rect" && isFullViewBoxRect(children[0], viewBox);
}

function isFullViewBoxRect(element: Element, viewBox: ViewBox): boolean {
  if (normalizedName(element) !== "rect") {
    return false;
  }
  const x = numberAttribute(element, "x") ?? viewBox.minX;
  const y = numberAttribute(element, "y") ?? viewBox.minY;
  const width = numberAttribute(element, "width");
  const height = numberAttribute(element, "height");
  return nearlyEquals(x, viewBox.minX) && nearlyEquals(y, viewBox.minY) && nearlyEquals(width, viewBox.width) && nearlyEquals(height, viewBox.height);
}

function parseViewBox(value: string | null): ViewBox | null {
  if (!value) {
    return null;
  }
  const parts = value.replace(/,/g, " ").split(/\s+/).map(Number).filter((value) => Number.isFinite(value));
  if (parts.length !== 4) {
    return null;
  }
  return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
}

function containsInternalURL(value: string): boolean {
  return internalURLID(value) !== null;
}

function internalURLID(value: string): string | null {
  return /url\(\s*#([A-Za-z_][A-Za-z0-9_.:-]*)\s*\)/.exec(value)?.[1] ?? null;
}

function hasExternalURL(value: string): boolean {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (externalSchemes.some((scheme) => lower.startsWith(scheme))) {
    return true;
  }
  for (const match of trimmed.matchAll(/url\(\s*([^)]+?)\s*\)/gi)) {
    const normalized = match[1].trim().replace(/^['"]|['"]$/g, "").toLowerCase();
    if (!normalized.startsWith("#")) {
      return true;
    }
  }
  return false;
}

function allElements(root: Element): Element[] {
  return [root, ...Array.from(root.getElementsByTagName("*"))];
}

function descendants(root: Element, name: string): Element[] {
  return allElements(root).filter((element) => normalizedName(element) === name);
}

function elementChildren(element: Element): Element[] {
  return Array.from(element.children);
}

function normalizedName(element: Element): string {
  return element.localName.toLowerCase();
}

function paintIsNone(value: string | null): boolean {
  return value?.trim().toLowerCase() === "none";
}

function numberAttribute(element: Element, name: string): number | null {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) ? value : null;
}

function nearlyEquals(a: number | null, b: number): boolean {
  return a !== null && Math.abs(a - b) < 0.0001;
}

function ensureAttribute(element: Element, name: string, value: string): void {
  if (!element.hasAttribute(name)) {
    element.setAttribute(name, value);
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

interface ViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

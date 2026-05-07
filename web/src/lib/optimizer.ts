import { optimize as optimizeWithSvgo } from "svgo/browser";
import type { Config as SvgoConfig } from "svgo";

export type OptimizationStatus = "optimized" | "requiresManualReview";
export type OptimizationProfile = "auto" | "icon" | "multicolor" | "expert";
export type SizeMode = "none" | "inline1em" | "fixed";
export type SizeUnit = "px" | "em" | "rem" | "percent";
export type ColorMode = "currentColor" | "custom" | "preserve";
export type FillColorMode = ColorMode | "none";
export type StrokeWidthMode = "set" | "preserve";
export type OutputNameSource = "file" | "code";

export interface ExpertPluginSettings {
  cleanupIds: boolean;
  mergePaths: boolean;
  removeHiddenElems: boolean;
  removeRasterImages: boolean;
  removeTitle: boolean;
  removeDesc: boolean;
  removeDimensions: boolean;
  sortAttrs: boolean;
  sortDefsChildren: boolean;
}

export interface OptimizationSettings {
  profile: OptimizationProfile;
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
  prettyMarkup: boolean;
  codeOutputName: string;
  outputPrefix: string;
  outputSuffix: string;
  expertPlugins: ExpertPluginSettings;
  preserveEmbeddedImages: boolean;
  logoOptimization?: boolean;
}

export interface OptimizationResult {
  status: OptimizationStatus;
  profile: OptimizationProfile;
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
  "pattern",
  "marker",
  "mask",
  "filter",
  "fegaussianblur",
  "feblend",
  "fecolormatrix",
  "fecomponenttransfer",
  "fecomposite",
  "feconvolvematrix",
  "fediffuselighting",
  "fedisplacementmap",
  "fedropshadow",
  "feflood",
  "fefunca",
  "fefuncb",
  "fefuncg",
  "fefuncr",
  "feimage",
  "femerge",
  "femergenode",
  "femorphology",
  "feoffset",
  "fepointlight",
  "fespecularlighting",
  "fespotlight",
  "fetile",
  "feturbulence",
  "image",
  "a"
]);
const dangerousElementNames = new Set([
  "script",
  "foreignobject",
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
const editorNamespacePrefixes = ["inkscape", "sodipodi", "rdf", "dc", "cc"];
const rasterImageNames = new Set(["image", "feimage"]);

export const defaultExpertPlugins: ExpertPluginSettings = {
  cleanupIds: true,
  mergePaths: false,
  removeHiddenElems: true,
  removeRasterImages: true,
  removeTitle: false,
  removeDesc: false,
  removeDimensions: false,
  sortAttrs: true,
  sortDefsChildren: true
};

export const defaultSettings: OptimizationSettings = {
  profile: "auto",
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
  prettyMarkup: false,
  codeOutputName: "pifagor-svg.svg",
  outputPrefix: "",
  outputSuffix: "-opt",
  expertPlugins: defaultExpertPlugins,
  preserveEmbeddedImages: false
};

export const logoSettings: OptimizationSettings = {
  ...defaultSettings,
  profile: "multicolor",
  strokeWidthMode: "preserve",
  removeBackground: false,
  strokeColorMode: "preserve",
  fillColorMode: "preserve",
  movePaintToRoot: false
};

export function effectiveSettings(settings: OptimizationSettings, profile: OptimizationProfile = settings.profile): OptimizationSettings {
  const normalized = normalizeRuntimeSettings(settings);
  if (profile !== "multicolor") {
    return normalized;
  }

  return {
    ...normalized,
    profile,
    strokeWidthMode: "preserve",
    removeBackground: false,
    strokeColorMode: "preserve",
    fillColorMode: "preserve",
    movePaintToRoot: false,
    removeUnusedDefs: false,
    removeIDs: false,
    requireNoInternalReferences: false
  };
}

export function optimizeSvg(svg: string, rawSettings: OptimizationSettings = defaultSettings): OptimizationResult {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Invalid SVG/XML: ${parserError.textContent?.trim() ?? "parser error"}`);
  }

  const root = document.documentElement;
  if (!root || normalizedName(root) !== "svg") {
    throw new Error("Missing root <svg> element.");
  }

  const profile = resolveProfile(root, rawSettings);
  const settings = effectiveSettings(rawSettings, profile);
  const warnings: string[] = [];

  if (settings.convertInlineStyles) {
    convertInlineStyles(root, profile === "icon" ? warnings : []);
  }
  sanitizeDangerousContent(root, warnings, settings);
  if (settings.expandUseReferences && shouldUseIconRules(profile)) {
    expandUseReferences(root, warnings);
  }
  const initialViewBox = parseViewBox(root.getAttribute("viewBox"));
  if (settings.removeSafeClipPaths && initialViewBox) {
    removeSafeClipPathReferences(root, initialViewBox);
  }
  removeWhitespaceNodes(root);
  if (settings.unwrapEmptyGroups) {
    unwrapEmptyGroups(root);
  }

  const optimizedRoot = parseOptimizedSvg(runSvgo(serialize(root), settings, profile));
  const viewBox = parseViewBox(optimizedRoot.getAttribute("viewBox"));

  sanitizeDangerousContent(optimizedRoot, warnings, settings);
  if (settings.removeSafeClipPaths && viewBox) {
    removeSafeClipPathReferences(optimizedRoot, viewBox);
  }
  removeWhitespaceNodes(optimizedRoot);
  if (settings.unwrapEmptyGroups) {
    unwrapEmptyGroups(optimizedRoot);
  }
  if (settings.requireNoInternalReferences && shouldUseIconRules(profile)) {
    warnings.push(...remainingInternalReferenceWarnings(optimizedRoot));
  }

  if (warnings.length > 0) {
    const fullSvg = serialize(optimizedRoot);
    const formattedFullSvg = formatSvgMarkup(fullSvg, settings.prettyMarkup);
    return {
      status: "requiresManualReview",
      profile,
      fullSvg: formattedFullSvg,
      compactSvg: compact(fullSvg),
      warnings: unique(warnings)
    };
  }

  if (shouldApplyPaintRules(profile)) {
    applyPaintRules(optimizedRoot, settings, viewBox);
  }
  applySizeRules(optimizedRoot, settings);
  const internalReferencesRemain = hasInternalReferences(optimizedRoot);
  if (settings.removeUnusedDefs && !internalReferencesRemain && shouldUseIconRules(profile)) {
    descendants(optimizedRoot, "defs").forEach((element) => element.remove());
  }
  if (settings.removeIDs && !internalReferencesRemain && shouldUseIconRules(profile)) {
    removeAllIDs(optimizedRoot);
  }
  removeWhitespaceNodes(optimizedRoot);
  if (settings.unwrapEmptyGroups) {
    unwrapEmptyGroups(optimizedRoot);
  }
  ensureAttribute(optimizedRoot, "aria-hidden", "true");
  ensureAttribute(optimizedRoot, "focusable", "false");

  const serializedSvg = serialize(optimizedRoot);
  return {
    status: "optimized",
    profile,
    fullSvg: formatSvgMarkup(serializedSvg, settings.prettyMarkup),
    compactSvg: compact(serializedSvg),
    warnings: []
  };
}

export function outputFileName(fileName: string, settings: OptimizationSettings, source: OutputNameSource = "file"): string {
  const normalized = normalizeRuntimeSettings(settings);
  if (source === "code") {
    return ensureSvgExtension(sanitizeFileName(normalized.codeOutputName) || defaultSettings.codeOutputName);
  }

  const cleanPrefix = sanitizeFileNamePart(normalized.outputPrefix);
  const cleanSuffix = sanitizeFileNamePart(normalized.outputSuffix) || "-opt";
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return `${cleanPrefix}${sanitizeFileNamePart(baseName)}${cleanSuffix}.svg`;
}

export function toInlineHtmlSvg(svg: string): string {
  return compact(svg);
}

export function formatSvgMarkup(svg: string, pretty: boolean): string {
  return pretty ? prettifySvg(svg) : compactFullSvg(svg);
}

export function sanitizeSvgForPreview(svg: string): string {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Invalid SVG/XML: ${parserError.textContent?.trim() ?? "parser error"}`);
  }

  const root = document.documentElement;
  if (!root || normalizedName(root) !== "svg") {
    throw new Error("Missing root <svg> element.");
  }

  sanitizeDangerousContent(root, [], defaultSettings);
  return serialize(root);
}

function normalizeRuntimeSettings(settings: OptimizationSettings): OptimizationSettings {
  const rawProfile = (settings as { profile?: OptimizationProfile | "logo" }).profile;
  const profile = settings.logoOptimization || rawProfile === "logo"
    ? "multicolor"
    : isOptimizationProfile(rawProfile)
      ? rawProfile
      : defaultSettings.profile;
  const settingsWithoutLegacyLogo = { ...settings };
  delete settingsWithoutLegacyLogo.logoOptimization;
  return {
    ...defaultSettings,
    ...settingsWithoutLegacyLogo,
    profile,
    codeOutputName: settings.codeOutputName || defaultSettings.codeOutputName,
    outputSuffix: settings.outputSuffix ?? defaultSettings.outputSuffix,
    expertPlugins: {
      ...defaultExpertPlugins,
      ...settings.expertPlugins
    },
    prettyMarkup: Boolean(settings.prettyMarkup),
    preserveEmbeddedImages: Boolean(settings.preserveEmbeddedImages)
  };
}

function isOptimizationProfile(value: unknown): value is OptimizationProfile {
  return value === "auto" || value === "icon" || value === "multicolor" || value === "expert";
}

function resolveProfile(root: Element, rawSettings: OptimizationSettings): OptimizationProfile {
  const requested = normalizeRuntimeSettings(rawSettings).profile;
  if (requested !== "auto") {
    return isOptimizationProfile(requested) ? requested : "icon";
  }
  return isComplexSvg(root) ? "multicolor" : "icon";
}

function isComplexSvg(root: Element): boolean {
  const referenceElements = new Set(["lineargradient", "radialgradient", "filter", "mask", "pattern", "marker", "image", "feimage"]);
  if (allElements(root).some((element) => referenceElements.has(normalizedName(element)))) {
    return true;
  }

  const paintValues = new Set<string>();
  for (const element of allElements(root)) {
    for (const name of ["fill", "stroke", "stop-color"]) {
      const value = element.getAttribute(name);
      if (!value || paintIsNone(value) || value === "currentColor" || containsInternalURL(value)) {
        continue;
      }
      paintValues.add(value.trim().toLowerCase());
    }
    const style = element.getAttribute("style");
    if (style && /url\(\s*#|gradient|filter|mask/i.test(style)) {
      return true;
    }
  }
  return paintValues.size > 1;
}

function runSvgo(svg: string, settings: OptimizationSettings, profile: OptimizationProfile): string {
  try {
    return optimizeWithSvgo(svg, svgoConfig(settings, profile)).data;
  } catch {
    return svg;
  }
}

function svgoConfig(settings: OptimizationSettings, profile: OptimizationProfile): SvgoConfig {
  const expert = settings.expertPlugins;
  const isExpert = profile === "expert";
  const conservative = profile === "multicolor";
  const cleanupIds = isExpert ? expert.cleanupIds : !conservative;
  const removeHiddenElems = isExpert ? expert.removeHiddenElems : profile === "icon";
  const removeTitle = isExpert ? expert.removeTitle : false;
  const removeDesc = isExpert ? expert.removeDesc : false;
  const plugins = [
    "removeDoctype",
    "removeXMLProcInst",
    "removeComments",
    "removeMetadata",
    "removeEditorsNSData",
    "removeScripts",
    {
      name: "preset-default",
      params: {
        overrides: {
          cleanupIds: cleanupIds ? undefined : false,
          convertColors: conservative ? false : undefined,
          mergePaths: isExpert ? expert.mergePaths : profile === "icon",
          removeHiddenElems,
          removeDesc,
          removeUselessDefs: profile === "icon" ? undefined : false,
          removeUnknownsAndDefaults: false,
          cleanupNumericValues: {
            floatPrecision: conservative ? 4 : 3
          },
          convertPathData: {
            floatPrecision: conservative ? 4 : 3
          }
        }
      }
    }
  ] as unknown as NonNullable<SvgoConfig["plugins"]>;

  if (removeTitle) {
    plugins.push("removeTitle");
  }
  if (isExpert && expert.removeDimensions) {
    plugins.push("removeDimensions");
  }
  if (isExpert && expert.sortAttrs) {
    plugins.push("sortAttrs");
  }
  if (isExpert && expert.sortDefsChildren) {
    plugins.push("sortDefsChildren");
  }
  if (!settings.preserveEmbeddedImages || (isExpert && expert.removeRasterImages)) {
    plugins.push("removeRasterImages");
  }

  return {
    multipass: profile === "icon" || profile === "expert",
    floatPrecision: conservative ? 4 : 3,
    plugins,
    js2svg: {
      pretty: false
    }
  };
}

function parseOptimizedSvg(svg: string): Element {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Invalid SVG/XML after optimization: ${parserError.textContent?.trim() ?? "parser error"}`);
  }
  const root = document.documentElement;
  if (!root || normalizedName(root) !== "svg") {
    throw new Error("Missing root <svg> element after optimization.");
  }
  return root;
}

function shouldUseIconRules(profile: OptimizationProfile): boolean {
  return profile === "icon" || profile === "expert";
}

function shouldApplyPaintRules(profile: OptimizationProfile): boolean {
  return profile === "icon" || profile === "expert";
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

function sanitizeDangerousContent(element: Element, warnings: string[], settings: OptimizationSettings): void {
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      continue;
    }
    if (!(child instanceof Element)) {
      continue;
    }

    const name = normalizedName(child);
    if (name === "metadata" || normalizedTagName(child).includes(":")) {
      child.remove();
      continue;
    }
    if (dangerousElementNames.has(name)) {
      child.remove();
      continue;
    }
    if (rasterImageNames.has(name)) {
      sanitizeDangerousAttributes(child, settings);
      if (!shouldKeepEmbeddedImage(child, settings)) {
        child.remove();
        continue;
      }
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

    sanitizeDangerousAttributes(child, settings);
    sanitizeDangerousContent(child, warnings, settings);
  }

  sanitizeDangerousAttributes(element, settings);
}

function sanitizeDangerousAttributes(element: Element, settings: OptimizationSettings): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name;
    const value = attribute.value;
    const lowerName = name.toLowerCase();
    const normalizedValue = value.trim();
    const lowerValue = normalizedValue.toLowerCase();

    if (lowerName === "xmlns" || lowerName === "xmlns:xlink") {
      continue;
    }
    if (lowerName.startsWith("xmlns:") || editorNamespacePrefixes.some((prefix) => lowerName.startsWith(`${prefix}:`))) {
      element.removeAttribute(name);
      continue;
    }
    if (lowerName.startsWith("on")) {
      element.removeAttribute(name);
      continue;
    }
    if (isAllowedEmbeddedImageReference(element, lowerName, normalizedValue, settings)) {
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

function shouldKeepEmbeddedImage(element: Element, settings: OptimizationSettings): boolean {
  if (!(settings.profile === "expert" && settings.preserveEmbeddedImages)) {
    return false;
  }
  const href = element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? "";
  return href.trim().toLowerCase().startsWith("data:image/");
}

function isAllowedEmbeddedImageReference(element: Element, lowerName: string, value: string, settings: OptimizationSettings): boolean {
  return (
    rasterImageNames.has(normalizedName(element)) &&
    linkNames.has(lowerName) &&
    settings.profile === "expert" &&
    settings.preserveEmbeddedImages &&
    value.trim().toLowerCase().startsWith("data:image/")
  );
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

function compactFullSvg(svg: string): string {
  return svg
    .replace(/>\s+</g, "><")
    .replace(/\n+/g, "")
    .trim();
}

function prettifySvg(svg: string): string {
  const compacted = compactFullSvg(svg);
  if (!compacted) {
    return "";
  }

  let depth = 0;
  return compacted
    .replace(/></g, ">\n<")
    .split("\n")
    .map((line) => {
      const token = line.trim();
      if (!token) {
        return "";
      }
      if (/^<\//.test(token)) {
        depth = Math.max(0, depth - 1);
      }
      const formatted = `${"  ".repeat(depth)}${token}`;
      if (isOpeningTag(token)) {
        depth += 1;
      }
      return formatted;
    })
    .filter(Boolean)
    .join("\n");
}

function isOpeningTag(token: string): boolean {
  return (
    /^<[A-Za-z][\w:-]*(?:\s|>)/.test(token) &&
    !token.endsWith("/>") &&
    !token.includes("</")
  );
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

function sanitizeFileName(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeFileNamePart(value: string): string {
  return value
    .trim()
    .replace(/\.svg$/i, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function ensureSvgExtension(value: string): string {
  const clean = sanitizeFileName(value) || "pifagor-svg";
  return clean.toLowerCase().endsWith(".svg") ? clean : `${clean}.svg`;
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

function normalizedTagName(element: Element): string {
  return element.tagName.toLowerCase();
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

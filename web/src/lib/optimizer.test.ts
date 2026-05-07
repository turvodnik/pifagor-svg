import { describe, expect, it } from "vitest";
import {
  defaultSettings,
  logoSettings,
  optimizeSvg,
  outputFileName,
  toInlineHtmlSvg,
  type OptimizationSettings
} from "./optimizer";

describe("optimizeSvg", () => {
  it("moves outline stroke controls to root and removes safe clip paths", () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <g clip-path="url(#clip0)">
          <path d="M8 12l2 2 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 6c0-1 1-2 2-2" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <defs>
          <clipPath id="clip0"><rect width="24" height="24" fill="white"/></clipPath>
        </defs>
      </svg>
    `;

    const result = optimizeSvg(input, { ...defaultSettings, profile: "icon" });

    expect(result.status).toBe("optimized");
    expect(result.fullSvg).toContain('stroke="currentColor"');
    expect(result.fullSvg).toContain('stroke-width="1.5"');
    expect(result.fullSvg).toContain('fill="none"');
    expect(result.fullSvg).not.toContain('stroke="#fff"');
    expect(result.fullSvg).not.toContain("clip-path");
    expect(result.fullSvg).not.toContain("<defs");
    expect(result.fullSvg).not.toContain('width="24"');
    expect(result.fullSvg).not.toContain('height="24"');
  });

  it("removes active SVG content and external URLs before preview or download", () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="alert(1)">
        <script>alert(1)</script>
        <a href="https://example.com"><path d="M1 1h22v22H1z" fill="#000"/></a>
        <path d="M2 2h20v20H2z" onclick="alert(1)" filter="url(https://example.com/filter.svg#f)" fill="#000"/>
      </svg>
    `;

    const result = optimizeSvg(input, { ...defaultSettings, profile: "icon" });

    expect(result.status).toBe("optimized");
    expect(result.fullSvg).not.toContain("<script");
    expect(result.fullSvg).not.toContain("<a ");
    expect(result.fullSvg).not.toContain("onload");
    expect(result.fullSvg).not.toContain("onclick");
    expect(result.fullSvg).not.toContain("https://example.com");
  });

  it("keeps brand colors and background when logo optimization is enabled", () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
        <rect width="120" height="40" fill="#ffffff"/>
        <path d="M10 10h30v20H10z" fill="#008dcc"/>
        <path d="M50 10h30v20H50z" fill="#111111"/>
      </svg>
    `;

    const result = optimizeSvg(input, logoSettings);

    expect(result.status).toBe("optimized");
    expect(result.fullSvg).toContain("#ffffff");
    expect(result.fullSvg).toContain("#008dcc");
    expect(result.fullSvg).toContain("#111111");
    expect(result.fullSvg).not.toContain("currentColor");
  });

  it("uses multicolor as the conservative brand-safe profile", () => {
    expect(logoSettings.profile).toBe("multicolor");
  });

  it("returns manual review when internal references would be unsafe to remove", () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <defs><linearGradient id="paint0"><stop stop-color="#fff"/></linearGradient></defs>
        <path d="M2 2h20v20H2z" fill="url(#paint0)"/>
      </svg>
    `;

    const result = optimizeSvg(input, { ...defaultSettings, profile: "icon" });

    expect(result.status).toBe("requiresManualReview");
    expect(result.warnings.some((warning) => warning.includes('fill="url(#'))).toBe(true);
  });

  it("keeps complex multicolor SVG references in auto mode instead of requiring manual review", () => {
    const input = `<?xml version="1.0" encoding="UTF-8"?>
      <!-- Created with Inkscape -->
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="350.66" height="248" viewBox="0 0 1052.3622 744.09448" inkscape:version="0.47">
        <title>little red racing car</title>
        <metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></metadata>
        <defs>
          <linearGradient id="paintA"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#660000"/></linearGradient>
          <radialGradient id="paintB" xlink:href="#paintA" cx="22.682" cy="-15.034" r="3.243"/>
          <filter id="shadow"><feGaussianBlur stdDeviation="0.57264819"/></filter>
        </defs>
        <g inkscape:label="Layer 1">
          <path d="M10 10h80v40H10z" style="fill:url(#paintA);filter:url(#shadow)"/>
          <path d="M15 15h20v20H15z" fill="#ff8080"/>
        </g>
      </svg>`;

    const result = optimizeSvg(input, defaultSettings);

    expect(result.status).toBe("optimized");
    expect(result.profile).toBe("multicolor");
    expect(result.fullSvg).toContain("linearGradient");
    expect(result.fullSvg).toContain("radialGradient");
    expect(result.fullSvg).toContain("filter");
    expect(result.fullSvg).toContain("url(#");
    expect(result.fullSvg).not.toContain("metadata");
    expect(result.fullSvg).not.toContain("inkscape:");
    expect(result.fullSvg).not.toContain("Created with Inkscape");
  });

  it("preserves embedded raster images only when expert mode explicitly allows them", () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <image href="data:image/png;base64,AAAA" width="24" height="24"/>
      <image href="https://example.com/icon.png" width="24" height="24"/>
    </svg>`;

    const defaultResult = optimizeSvg(input, defaultSettings);
    const expertResult = optimizeSvg(input, {
      ...defaultSettings,
      profile: "expert",
      preserveEmbeddedImages: true
    });

    expect(defaultResult.fullSvg).not.toContain("<image");
    expect(expertResult.fullSvg).toContain('href="data:image/png;base64,AAAA"');
    expect(expertResult.fullSvg).not.toContain("https://example.com/icon.png");
  });

  it("writes compact inline SVG without xmlns and derives output filenames", () => {
    const result = optimizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="#000"/></svg>`,
      defaultSettings
    );

    expect(result.fullSvg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(result.compactSvg).not.toContain("xmlns=");
    expect(result.compactSvg).not.toContain("\n");
    expect(outputFileName("icon.svg", defaultSettings)).toBe("icon-opt.svg");
    expect(outputFileName("pasted.svg", defaultSettings, "code")).toBe("pifagor-svg.svg");
    expect(
      outputFileName("icon.svg", { ...defaultSettings, outputPrefix: "web-", outputSuffix: "-clean" })
    ).toBe("web-icon-clean.svg");
    expect(
      outputFileName("pasted.svg", { ...defaultSettings, codeOutputName: "custom-inline" }, "code")
    ).toBe("custom-inline.svg");
  });

  it("keeps regular SVG compact by default and formats it when pretty markup is enabled", () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/></svg>`;
    const compactResult = optimizeSvg(input, defaultSettings);
    const prettyResult = optimizeSvg(input, { ...defaultSettings, prettyMarkup: true });

    expect(defaultSettings.prettyMarkup).toBe(false);
    expect(compactResult.fullSvg).not.toContain("\n");
    expect(prettyResult.fullSvg).toContain("\n");
    expect(prettyResult.fullSvg).toContain("  <path");
    expect(prettyResult.compactSvg).not.toContain("\n");
  });

  it("creates inline HTML SVG without xmlns while preserving viewBox", () => {
    const result = toInlineHtmlSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 2h20v20H2z" fill="currentColor"/>
      </svg>
    `);

    expect(result).toContain("<svg");
    expect(result).toContain('viewBox="0 0 24 24"');
    expect(result).toContain('aria-hidden="true"');
    expect(result).not.toContain("xmlns=");
    expect(result).not.toContain("\n");
  });

  it("applies fixed sizes with selected units", () => {
    const settings: OptimizationSettings = {
      ...defaultSettings,
      sizeMode: "fixed",
      fixedWidth: "2",
      fixedHeight: "3",
      lockSize: false,
      sizeUnit: "rem"
    };

    const result = optimizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="#000"/></svg>`,
      settings
    );

    expect(result.fullSvg).toContain('width="2rem"');
    expect(result.fullSvg).toContain('height="3rem"');
  });
});

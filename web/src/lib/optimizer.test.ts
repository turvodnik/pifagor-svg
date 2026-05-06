import { describe, expect, it } from "vitest";
import {
  defaultSettings,
  logoSettings,
  optimizeSvg,
  outputFileName,
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

    const result = optimizeSvg(input, defaultSettings);

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

    const result = optimizeSvg(input, defaultSettings);

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

  it("returns manual review when internal references would be unsafe to remove", () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <defs><linearGradient id="paint0"><stop stop-color="#fff"/></linearGradient></defs>
        <path d="M2 2h20v20H2z" fill="url(#paint0)"/>
      </svg>
    `;

    const result = optimizeSvg(input, defaultSettings);

    expect(result.status).toBe("requiresManualReview");
    expect(result.warnings.some((warning) => warning.includes('fill="url(#paint0)"'))).toBe(true);
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

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { defaultSettings } from "./lib/optimizer";
import { defaultPreviewSettings, loadSavedSettings, saveSettings } from "./lib/settings";

const originalClipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, "clipboard");
const originalSecureContext = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

describe("App", () => {
  afterEach(() => {
    restoreProperty(Navigator.prototype, "clipboard", originalClipboard);
    restoreProperty(window, "isSecureContext", originalSecureContext);
    restoreProperty(URL, "createObjectURL", originalCreateObjectUrl);
    restoreProperty(URL, "revokeObjectURL", originalRevokeObjectUrl);
    vi.restoreAllMocks();
  });

  it("renders the privacy-first SVG optimizer workspace", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Pifagor SVG Optimize/i })).toBeInTheDocument();
    expect(screen.getByText(/processed only in your browser/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Optimize SVG code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Optimize SVG files/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Optimize SVG files/i }));

    expect(screen.getByText(/Drop SVG files/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Web developer: Pifagor Studio/i })).toHaveAttribute(
      "href",
      "https://pifagor.studio"
    );
  });

  it("opens preset settings in a drawer instead of occupying workspace space", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Settings$/i }));

    expect(screen.getByRole("heading", { name: /Preset settings/i })).toBeInTheDocument();
    expect(screen.getByText(/Logo optimization/i)).toBeInTheDocument();
    expect(screen.queryByText(/Contrast grid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Transparent grid/i)).not.toBeInTheDocument();
  });

  it("forces preview SVGs to ignore intrinsic width and height attributes", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

    expect(styles).toMatch(
      /\.svg-preview svg\s*{[^}]*\n\s*width:\s*100%;[^}]*\n\s*height:\s*100%;/s
    );
  });

  it("keeps fixed size controls stable when the unit dropdown opens", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

    expect(styles).toMatch(/\.inline-grid\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)\s+minmax\(86px,\s*0\.72fr\);/s);
    expect(styles).toMatch(/\.inline-grid\s+\.custom-select-menu\s*{[^}]*position:\s*absolute;/s);
  });

  it("uses SVG code editor surfaces for source and result code", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Optimize SVG code/i }));

    expect(document.querySelectorAll(".svg-code-editor")).toHaveLength(2);
    expect(screen.getByText(/File names/i)).toBeInTheDocument();
  });

  it("applies reset defaults to the active preset immediately", () => {
    saveSettings({
      locale: "en",
      settings: { ...defaultSettings, fillColorMode: "custom", fillColor: "#d10000" },
      preview: { ...defaultPreviewSettings, backgroundMode: "light" }
    });

    render(<App />);

    const settingsButton = screen.getByRole("button", { name: /^Settings$/i });
    expect(settingsButton).toHaveClass("has-custom-preset");

    fireEvent.click(settingsButton);
    const drawer = document.querySelector(".settings-drawer") as HTMLElement;
    fireEvent.click(within(drawer).getByRole("button", { name: /Reset defaults/i }));

    expect(settingsButton).not.toHaveClass("has-custom-preset");
    expect(loadSavedSettings()).toEqual({
      locale: "en",
      settings: defaultSettings,
      preview: defaultPreviewSettings
    });
  });

  it("shows feedback when copy is unavailable before optimization", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Copy SVG/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/Optimize SVG first/i);
  });

  it("uses app-rendered dropdown menus instead of native select popups", () => {
    render(<App />);

    expect(document.querySelector("select")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Settings$/i }));

    expect(document.querySelector("select")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /currentColor|ZIP|No width/i }).length).toBeGreaterThan(0);
  });

  it("keeps source previews visually original when optimization preset changes paint", async () => {
    saveSettings({
      locale: "en",
      settings: { ...defaultSettings, fillColorMode: "custom", fillColor: "#d10000" },
      preview: defaultPreviewSettings
    });
    render(<App />);

    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    const original = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1h22v22H1z" fill="#000000"/></svg>`;
    fireEvent.change(fileInput, {
      target: {
        files: [new File([original], "icon.svg", { type: "image/svg+xml" })]
      }
    });

    await screen.findByLabelText(/Original SVG code/i);
    await waitFor(() => expect(document.querySelector(".source-panel .svg-preview svg")).toBeInTheDocument());

    expect(document.querySelector(".source-panel .svg-preview svg")?.outerHTML).toContain('fill="#000000"');
    expect(document.querySelector(".preview-panel .svg-preview svg")?.outerHTML).toContain('fill="#d10000"');
  });

  it("shows source and result SVG sizes without re-reading files", async () => {
    render(<App />);

    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    const original = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>`;
    fireEvent.change(fileInput, {
      target: {
        files: [new File([original], "size.svg", { type: "image/svg+xml" })]
      }
    });

    await screen.findByLabelText(/Original SVG code/i);

    await waitFor(() => {
      expect(document.querySelector(".file-pill-size")).not.toBeInTheDocument();
      expect(document.querySelector(".source-panel .section-label")).toHaveTextContent(/Original SVG code\s+\(\d+ B\)/);
      expect(document.querySelector(".preview-panel .section-label")).toHaveTextContent(/Result\s+\(\d+ B\)/);
      expect(document.querySelector(".source-panel .panel-meta h2")).toHaveTextContent(/^size\.svg$/);
      expect(document.querySelector(".preview-panel .panel-meta h2")).toHaveTextContent(/^size-opt\.svg$/);
    });
  });

  it("copies manual result edits as regular SVG", async () => {
    const writeText = mockClipboard();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Optimize SVG code/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Optimize$/i }));

    const resultCode = await screen.findByLabelText(/Optimized SVG code/i);
    const editedSvg = '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/></svg>';
    fireEvent.change(resultCode, { target: { value: editedSvg } });
    fireEvent.click(screen.getByRole("button", { name: /^Copy SVG$/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(editedSvg));
  });

  it("copies manual result edits as inline HTML SVG", async () => {
    const writeText = mockClipboard();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Optimize SVG code/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Optimize$/i }));

    const resultCode = await screen.findByLabelText(/Optimized SVG code/i);
    fireEvent.change(resultCode, {
      target: {
        value: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n  <path d="M4 4h16v16H4z"/>\n</svg>`
      }
    });
    fireEvent.click(screen.getByRole("button", { name: /HTML SVG/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = writeText.mock.calls.at(-1)?.[0] ?? "";
    expect(copied).toContain('viewBox="0 0 24 24"');
    expect(copied).not.toContain("xmlns=");
    expect(copied).not.toContain("\n");
  });

  it("downloads the manually edited selected SVG", async () => {
    const capturedBlobs: Blob[] = [];
    const downloadNames: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadNames.push(this.download);
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        capturedBlobs.push(blob);
        return "blob:edited-svg";
      })
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Optimize SVG code/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Optimize$/i }));

    const resultCode = await screen.findByLabelText(/Optimized SVG code/i);
    const editedSvg = '<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"/></svg>';
    fireEvent.change(resultCode, { target: { value: editedSvg } });
    fireEvent.click(screen.getByRole("button", { name: /^Download$/i }));

    await waitFor(() => expect(capturedBlobs).toHaveLength(1));
    await expect(readBlobText(capturedBlobs[0])).resolves.toBe(editedSvg);
    expect(downloadNames).toEqual(["pifagor-svg.svg"]);
  });

  it("re-optimizes edited source file SVG in the current session", async () => {
    render(<App />);

    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    const original = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1h22v22H1z" fill="#000"/></svg>`;
    fireEvent.change(fileInput, {
      target: {
        files: [new File([original], "icon.svg", { type: "image/svg+xml" })]
      }
    });

    const sourceCode = await screen.findByLabelText(/Original SVG code/i);
    await waitFor(() => expect((sourceCode as HTMLTextAreaElement).value).toContain("M1 1h22v22H1z"));
    fireEvent.change(sourceCode, {
      target: {
        value: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="#000"/></svg>`
      }
    });

    const sourcePanel = document.querySelector(".source-panel") as HTMLElement;
    fireEvent.click(within(sourcePanel).getByRole("button", { name: /^Optimize$/i }));

    await waitFor(() => expect((screen.getByLabelText(/Optimized SVG code/i) as HTMLTextAreaElement).value).toContain("M2 2h20v20H2z"));
  });
});

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(Navigator.prototype, "clipboard", {
    configurable: true,
    value: { writeText }
  });
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true
  });
  return writeText;
}

function restoreProperty(target: object, key: PropertyKey, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  delete (target as Record<PropertyKey, unknown>)[key];
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read blob."));
    reader.readAsText(blob);
  });
}

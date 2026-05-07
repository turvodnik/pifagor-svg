import { describe, expect, it } from "vitest";
import { defaultSettings } from "./optimizer";
import { defaultPreviewSettings, detectLocale, loadSavedSettings, saveSettings } from "./settings";

describe("settings", () => {
  it("detects supported browser languages and falls back to English", () => {
    expect(detectLocale(["uk-UA", "ru-RU"])).toBe("uk");
    expect(detectLocale(["pt-BR", "fr-FR"])).toBe("en");
  });

  it("stores the single editable preset in localStorage", () => {
    const next = { ...defaultSettings, profile: "multicolor" as const, strokeWidth: "2", prettyMarkup: true };
    const preview = { ...defaultPreviewSettings, backgroundMode: "light" as const };

    saveSettings({ locale: "de", settings: next, preview });

    expect(loadSavedSettings()).toEqual({ locale: "de", settings: next, preview });
  });

  it("migrates older saved logo and output settings", () => {
    localStorage.setItem(
      "pifagor-svg:web-settings:v1",
      JSON.stringify({
        locale: "ru",
        settings: {
          ...defaultSettings,
          logoOptimization: true,
          outputSuffix: "-clean"
        },
        preview: defaultPreviewSettings
      })
    );

    expect(loadSavedSettings()?.settings).toMatchObject({
      profile: "multicolor",
      outputSuffix: "-clean",
      codeOutputName: "pifagor",
      prettyMarkup: false
    });
  });

  it("migrates the old pasted-code default filename to the new extension-free default", () => {
    localStorage.setItem(
      "pifagor-svg:web-settings:v1",
      JSON.stringify({
        locale: "ru",
        settings: {
          ...defaultSettings,
          codeOutputName: "pifagor-svg.svg"
        },
        preview: defaultPreviewSettings
      })
    );

    expect(loadSavedSettings()?.settings.codeOutputName).toBe("pifagor");
  });
});

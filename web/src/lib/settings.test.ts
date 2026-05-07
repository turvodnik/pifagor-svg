import { describe, expect, it } from "vitest";
import { defaultSettings } from "./optimizer";
import { defaultPreviewSettings, detectLocale, loadSavedSettings, saveSettings } from "./settings";

describe("settings", () => {
  it("detects supported browser languages and falls back to English", () => {
    expect(detectLocale(["uk-UA", "ru-RU"])).toBe("uk");
    expect(detectLocale(["pt-BR", "fr-FR"])).toBe("en");
  });

  it("stores the single editable preset in localStorage", () => {
    const next = { ...defaultSettings, profile: "logo" as const, strokeWidth: "2" };
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
      profile: "logo",
      outputSuffix: "-clean",
      codeOutputName: "pifagor-svg.svg"
    });
  });
});

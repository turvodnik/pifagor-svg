import { defaultExpertPlugins, defaultSettings, type OptimizationProfile, type OptimizationSettings } from "./optimizer";

export type Locale = "en" | "ru" | "uk" | "es" | "de";
export type PreviewBackgroundMode = "dark" | "light" | "custom";

export interface PreviewSettings {
  backgroundMode: PreviewBackgroundMode;
  backgroundColor: string;
}

export interface SavedSettings {
  locale: Locale;
  settings: OptimizationSettings;
  preview: PreviewSettings;
}

const storageKey = "pifagor-svg:web-settings:v1";
const supportedLocales: Locale[] = ["en", "ru", "uk", "es", "de"];
const supportedPreviewBackgroundModes: PreviewBackgroundMode[] = ["dark", "light", "custom"];

export const defaultPreviewSettings: PreviewSettings = {
  backgroundMode: "dark",
  backgroundColor: "#f8fafc"
};

export function detectLocale(languages: readonly string[] = navigator.languages): Locale {
  for (const language of languages) {
    const code = language.toLowerCase().split("-")[0] as Locale;
    if (supportedLocales.includes(code)) {
      return code;
    }
  }
  return "en";
}

export function localeFromPath(pathname: string = window.location.pathname): Locale | null {
  const code = pathname.split("/").filter(Boolean)[0] as Locale | undefined;
  return code && supportedLocales.includes(code) ? code : null;
}

export function loadSavedSettings(): SavedSettings | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SavedSettings>;
    if (!parsed.locale || !supportedLocales.includes(parsed.locale) || !parsed.settings) {
      return null;
    }
    return {
      locale: parsed.locale,
      settings: normalizeOptimizationSettings(parsed.settings),
      preview: normalizePreviewSettings(parsed.preview)
    };
  } catch {
    return null;
  }
}

export function saveSettings(value: SavedSettings): void {
  localStorage.setItem(storageKey, JSON.stringify(value));
}

export function resetSettings(locale: Locale): SavedSettings {
  const value = { locale, settings: defaultSettings, preview: defaultPreviewSettings };
  saveSettings(value);
  return value;
}

export const locales: Locale[] = supportedLocales;

export function normalizeOptimizationSettings(value: Partial<OptimizationSettings> | undefined): OptimizationSettings {
  const raw = value ?? {};
  const rawProfile = (raw as { profile?: OptimizationProfile; logoOptimization?: boolean }).profile;
  const profile = (raw as { logoOptimization?: boolean }).logoOptimization
    ? "logo"
    : isSupportedProfile(rawProfile)
      ? rawProfile
      : defaultSettings.profile;
  const rawWithoutLegacyLogo = { ...raw };
  delete rawWithoutLegacyLogo.logoOptimization;

  return {
    ...defaultSettings,
    ...rawWithoutLegacyLogo,
    profile,
    codeOutputName: raw.codeOutputName || defaultSettings.codeOutputName,
    outputPrefix: raw.outputPrefix ?? defaultSettings.outputPrefix,
    outputSuffix: raw.outputSuffix ?? defaultSettings.outputSuffix,
    expertPlugins: {
      ...defaultExpertPlugins,
      ...raw.expertPlugins
    },
    preserveEmbeddedImages: Boolean(raw.preserveEmbeddedImages)
  };
}

function normalizePreviewSettings(value: Partial<PreviewSettings> | undefined): PreviewSettings {
  const next = { ...defaultPreviewSettings, ...value };
  return {
    ...next,
    backgroundMode: supportedPreviewBackgroundModes.includes(next.backgroundMode) ? next.backgroundMode : defaultPreviewSettings.backgroundMode
  };
}

function isSupportedProfile(value: unknown): value is OptimizationProfile {
  return value === "auto" || value === "icon" || value === "logo" || value === "multicolor" || value === "expert";
}

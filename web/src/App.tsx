import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ChevronDown,
  Code2,
  Copy,
  Files,
  FolderOpen,
  Globe2,
  Heart,
  LockKeyhole,
  SlidersHorizontal,
  X,
  RefreshCcw,
  Settings2,
  UploadCloud,
  Zap
} from "lucide-react";
import { copy } from "./i18n";
import { SvgCodeEditor } from "./components/SvgCodeEditor";
import {
  defaultSettings,
  optimizeSvg,
  outputFileName,
  sanitizeSvgForPreview,
  toInlineHtmlSvg,
  type ColorMode,
  type FillColorMode,
  type ExpertPluginSettings,
  type OptimizationProfile,
  type OptimizationSettings,
  type SizeMode
} from "./lib/optimizer";
import {
  defaultPreviewSettings,
  detectLocale,
  loadSavedSettings,
  localeFromPath,
  locales,
  saveSettings,
  type Locale,
  type PreviewBackgroundMode,
  type PreviewSettings
} from "./lib/settings";
import { copyToClipboard, downloadText, downloadZip, processFiles, type BatchOutputMode } from "./lib/browser";
import type { ProcessedFile } from "./workers/optimizer.worker";

const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M4 12l4 4 12-12" stroke="#111111" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

type InputMode = "code" | "files";
type SelectOption<T extends string> = {
  value: T;
  label: string;
};

function createPastedResult(svg: string, settings: OptimizationSettings): ProcessedFile {
  const name = "pasted.svg";
  try {
    const result = optimizeSvg(svg, settings);
    return {
      name,
      outputName: outputFileName(name, settings, "code"),
      original: svg,
      originalSizeBytes: byteSize(svg),
      originalPreviewSvg: previewOriginalSvg(svg),
      result,
      resultSizeBytes: byteSize(result.fullSvg),
      error: null
    };
  } catch (error) {
    return {
      name,
      outputName: outputFileName(name, settings, "code"),
      original: svg,
      originalSizeBytes: byteSize(svg),
      originalPreviewSvg: previewOriginalSvg(svg),
      result: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function reprocessExistingFile(file: ProcessedFile, settings: OptimizationSettings): ProcessedFile {
  if (!file.original) {
    return { ...file, outputName: outputFileName(file.name, settings), resultSizeBytes: undefined, editedSvg: undefined };
  }
  try {
    const result = optimizeSvg(file.original, settings);
    return {
      ...file,
      outputName: outputFileName(file.name, settings),
      originalSizeBytes: byteSize(file.original),
      originalPreviewSvg: previewOriginalSvg(file.original),
      result,
      resultSizeBytes: byteSize(result.fullSvg),
      editedSvg: undefined,
      error: null
    };
  } catch (error) {
    return {
      ...file,
      outputName: outputFileName(file.name, settings),
      originalSizeBytes: byteSize(file.original),
      originalPreviewSvg: previewOriginalSvg(file.original),
      result: null,
      resultSizeBytes: undefined,
      editedSvg: undefined,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function displaySvg(file: ProcessedFile | null): string {
  return file?.editedSvg ?? file?.result?.fullSvg ?? "";
}

function previewSafeSvg(svg: string, settings: OptimizationSettings): string {
  if (!svg.trim()) {
    return "";
  }
  try {
    return optimizeSvg(svg, settings).fullSvg;
  } catch {
    return "";
  }
}

function previewOriginalSvg(svg: string): string {
  if (!svg.trim()) {
    return "";
  }
  try {
    return sanitizeSvgForPreview(svg);
  } catch {
    return "";
  }
}

function byteSize(value: string): number {
  return new Blob([value]).size;
}

function formatByteSize(bytes: number | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kilobytes = bytes / 1024;
  return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;
}

function resultByteSize(file: ProcessedFile | null): number | undefined {
  if (!file) {
    return undefined;
  }
  if (file.editedSvg !== undefined) {
    return byteSize(file.editedSvg);
  }
  return file.resultSizeBytes ?? (file.result ? byteSize(file.result.fullSvg) : undefined);
}

function settingsAreDefault(settings: OptimizationSettings): boolean {
  return JSON.stringify(settings) === JSON.stringify(defaultSettings);
}

function previewSettingsAreDefault(settings: PreviewSettings): boolean {
  return JSON.stringify(settings) === JSON.stringify(defaultPreviewSettings);
}

function colorPickerValue(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : "#000000";
}

export default function App() {
  const saved = loadSavedSettings();
  const [locale, setLocaleState] = useState<Locale>(() => saved?.locale ?? localeFromPath() ?? detectLocale());
  const [settings, setSettings] = useState<OptimizationSettings>(() => saved?.settings ?? defaultSettings);
  const [draftSettings, setDraftSettings] = useState<OptimizationSettings>(() => saved?.settings ?? defaultSettings);
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>(() => saved?.preview ?? defaultPreviewSettings);
  const [draftPreviewSettings, setDraftPreviewSettings] = useState<PreviewSettings>(() => saved?.preview ?? defaultPreviewSettings);
  const [inputMode, setInputMode] = useState<InputMode>("files");
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [codeResult, setCodeResult] = useState<ProcessedFile | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pastedSvg, setPastedSvg] = useState(sampleSvg);
  const [isBusy, setIsBusy] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [outputMode, setOutputMode] = useState<BatchOutputMode>("zip");
  const [toast, setToast] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const t = copy[locale];
  const languageOptions: SelectOption<Locale>[] = locales.map((item) => ({ value: item, label: item.toUpperCase() }));
  const profileOptions: SelectOption<OptimizationProfile>[] = [
    { value: "auto", label: t.profileAuto },
    { value: "icon", label: t.profileIcon },
    { value: "logo", label: t.profileLogo },
    { value: "multicolor", label: t.profileMulticolor },
    { value: "expert", label: t.profileExpert }
  ];
  const sizeModeOptions: SelectOption<SizeMode>[] = [
    { value: "none", label: t.noSize },
    { value: "inline1em", label: t.inline },
    { value: "fixed", label: t.fixed }
  ];
  const sizeUnitOptions: SelectOption<OptimizationSettings["sizeUnit"]>[] = [
    { value: "px", label: "px" },
    { value: "em", label: "em" },
    { value: "rem", label: "rem" },
    { value: "percent", label: "%" }
  ];
  const strokeColorOptions: SelectOption<ColorMode>[] = [
    { value: "currentColor", label: t.currentColor },
    { value: "custom", label: t.custom },
    { value: "preserve", label: t.preserve }
  ];
  const fillColorOptions: SelectOption<FillColorMode>[] = [
    { value: "currentColor", label: t.currentColor },
    { value: "custom", label: t.custom },
    { value: "preserve", label: t.preserve },
    { value: "none", label: t.none }
  ];
  const previewBackgroundOptions: SelectOption<PreviewBackgroundMode>[] = [
    { value: "dark", label: t.previewDark },
    { value: "light", label: t.previewLight },
    { value: "custom", label: t.custom }
  ];
  const outputModeOptions: SelectOption<BatchOutputMode>[] = [
    { value: "zip", label: t.zip },
    { value: "separate", label: t.separate }
  ];

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    saveSettings({ locale, settings, preview: previewSettings });
  }, [locale, previewSettings, settings]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const selectedFile = files[selectedIndex] ?? null;
  const selected = inputMode === "code" ? codeResult : selectedFile;
  const optimizedCount = files.filter((file) => file.result?.status === "optimized").length;
  const warningCount = files.filter((file) => file.result?.status === "requiresManualReview" || file.error).length;
  const isCustomPreset = !settingsAreDefault(settings) || !previewSettingsAreDefault(previewSettings);
  const previewStageClassName = `preview-stage mini-preview preview-bg-${previewSettings.backgroundMode}`;
  const previewStageStyle = (
    previewSettings.backgroundMode === "custom"
      ? { "--preview-bg": colorPickerValue(previewSettings.backgroundColor) }
      : undefined
  ) as CSSProperties | undefined;

  const selectedSvg = displaySvg(selected);
  const previewSvg = previewSafeSvg(selectedSvg, settings);
  const htmlSvg = selectedSvg ? toInlineHtmlSvg(selectedSvg) : "";
  const paintControlsLocked = draftSettings.profile === "logo" || draftSettings.profile === "multicolor";
  const selectedResultSize = formatByteSize(resultByteSize(selected));
  const selectedSourceSize = formatByteSize(inputMode === "files" ? selectedFile?.originalSizeBytes : byteSize(pastedSvg));
  const sourcePreviewSvg = useMemo(() => {
    if (inputMode === "files") {
      return selectedFile?.originalPreviewSvg ?? previewOriginalSvg(selectedFile?.original ?? "");
    }
    return previewOriginalSvg(pastedSvg);
  }, [inputMode, pastedSvg, selectedFile]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    saveSettings({ locale: next, settings, preview: previewSettings });
  };

  const openSettings = () => {
    setDraftSettings(settings);
    setDraftPreviewSettings(previewSettings);
    setIsSettingsOpen(true);
  };

  const patchDraftSettings = (patch: Partial<OptimizationSettings>) => {
    setDraftSettings((current) => ({ ...current, ...patch }));
  };

  const patchExpertPlugins = (patch: Partial<ExpertPluginSettings>) => {
    setDraftSettings((current) => ({
      ...current,
      expertPlugins: {
        ...current.expertPlugins,
        ...patch
      }
    }));
  };

  const patchDraftPreviewSettings = (patch: Partial<PreviewSettings>) => {
    setDraftPreviewSettings((current) => ({ ...current, ...patch }));
  };

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 1800);
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const svgFiles = Array.from(fileList).filter((file) => file.name.toLowerCase().endsWith(".svg"));
    if (svgFiles.length === 0) {
      return;
    }
    setIsBusy(true);
    try {
      const next = await processFiles(svgFiles, settings);
      setFiles(next);
      setSelectedIndex(0);
      setInputMode("files");
    } finally {
      setIsBusy(false);
    }
  };

  const clearFiles = () => {
    setFiles([]);
    setSelectedIndex(0);
  };

  const handlePasteOptimize = () => {
    setCodeResult(createPastedResult(pastedSvg, settings));
    setInputMode("code");
  };

  const updateSelectedSource = (original: string) => {
    setFiles((current) =>
      current.map((file, index) =>
        index === selectedIndex
          ? {
              ...file,
              original,
              originalSizeBytes: byteSize(original),
              originalPreviewSvg: previewOriginalSvg(original)
            }
          : file
      )
    );
  };

  const reoptimizeSelectedSource = () => {
    if (!selectedFile) {
      showToast(t.nothingToDownload);
      return;
    }
    const nextFile = reprocessExistingFile(selectedFile, settings);
    setFiles((current) => current.map((file, index) => (index === selectedIndex ? nextFile : file)));
  };

  const updateResultSvg = (editedSvg: string) => {
    if (inputMode === "code") {
      setCodeResult((current) => (current ? { ...current, editedSvg, resultSizeBytes: byteSize(editedSvg) } : current));
      return;
    }
    setFiles((current) => current.map((file, index) => (index === selectedIndex ? { ...file, editedSvg, resultSizeBytes: byteSize(editedSvg) } : file)));
  };

  const downloadSelected = () => {
    if (selected && selectedSvg) {
      downloadText(selected.outputName, selectedSvg);
      showToast(t.downloadStarted);
      return;
    }
    showToast(t.nothingToDownload);
  };

  const downloadAll = () => {
    const optimized = files.filter((file) => file.result?.status === "optimized");
    if (optimized.length === 0) {
      showToast(t.nothingToDownload);
      return;
    }
    if (optimized.length === 1) {
      downloadText(optimized[0].outputName, displaySvg(optimized[0]));
      showToast(t.downloadStarted);
      return;
    }
    if (outputMode === "zip") {
      downloadZip("pifagor-svg-optimized.zip", optimized);
      showToast(t.downloadStarted);
      return;
    }
    optimized.forEach((file) => downloadText(file.outputName, displaySvg(file)));
    showToast(t.downloadStarted);
  };

  const copySvg = async () => {
    if (!selectedSvg) {
      showToast(t.nothingToCopy);
      return;
    }
    try {
      await copyToClipboard(selectedSvg);
      showToast(t.copied);
    } catch {
      showToast(t.copyFailed);
    }
  };

  const copyHtmlSvg = async () => {
    if (!htmlSvg) {
      showToast(t.nothingToCopy);
      return;
    }
    try {
      await copyToClipboard(htmlSvg);
      showToast(t.copied);
    } catch {
      showToast(t.copyFailed);
    }
  };

  const commitPreset = (nextSettings: OptimizationSettings, nextPreviewSettings: PreviewSettings) => {
    const next = { ...nextSettings };
    const nextPreview = { ...nextPreviewSettings };
    setSettings(next);
    setPreviewSettings(nextPreview);
    if (codeResult) {
      setCodeResult(createPastedResult(pastedSvg, next));
    }
    if (files.length > 0) {
      setFiles((current) => current.map((file) => reprocessExistingFile(file, next)));
    }
    saveSettings({ locale, settings: next, preview: nextPreview });
  };

  const resetPreset = () => {
    setDraftSettings(defaultSettings);
    setDraftPreviewSettings(defaultPreviewSettings);
    commitPreset(defaultSettings, defaultPreviewSettings);
  };

  const applyPreset = () => {
    commitPreset(draftSettings, draftPreviewSettings);
    setIsSettingsOpen(false);
  };

  const currentWarnings = useMemo(() => {
    if (!selected) {
      return [];
    }
    if (selected.error) {
      return [selected.error];
    }
    return selected.result?.warnings ?? [];
  }, [selected]);

  const renderPreviewPanel = () => (
    <section className={`preview-panel ${inputMode === "code" ? "code-result" : ""}`}>
      <div className="panel-top">
        <div className={previewStageClassName} style={previewStageStyle}>
          {previewSvg ? <div className="svg-preview" dangerouslySetInnerHTML={{ __html: previewSvg }} /> : null}
        </div>
        <div className="panel-meta">
          <p className="section-label">
            {t.result}
            {selectedResultSize && <> <span className="size-label">({selectedResultSize})</span></>}
          </p>
          <h2>{selected?.outputName ?? t.optimizedCode}</h2>
          <div className="toolbar-buttons">
            <button className="primary-button" type="button" onClick={downloadSelected}>
              <ArrowDownToLine size={15} />
              {t.download}
            </button>
            <button className="ghost-button" type="button" onClick={copySvg}>
              <Copy size={15} />
              {t.copySvg}
            </button>
            <button className="ghost-button" type="button" onClick={copyHtmlSvg} title={t.copyHtmlSvg} aria-label={`${t.htmlSvg}: ${t.copyHtmlSvg}`}>
              <Copy size={15} />
              {t.htmlSvg}
            </button>
          </div>
        </div>
      </div>

      <div className="code-card">
        <SvgCodeEditor ariaLabel={t.optimizedCode} value={selectedSvg} onChange={updateResultSvg} />
      </div>

      {currentWarnings.length > 0 && (
        <div className="warnings">
          <strong>{t.warnings}</strong>
          {currentWarnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <img className="brand-logo" src="/pifagor_logo.svg" alt="Pifagor Studio" />
          <span>SVG Optimize</span>
        </a>
        <div className="topbar-actions">
          <button
            className={`ghost-button compact-button ${isCustomPreset ? "has-custom-preset" : ""}`}
            type="button"
            onClick={openSettings}
            title={isCustomPreset ? t.customPreset : t.settingsShort}
          >
            <SlidersHorizontal size={16} />
            {t.settingsShort}
            {isCustomPreset && <span className="preset-indicator" aria-hidden="true" />}
          </button>
          <div className="language-select">
            <Globe2 size={16} />
            <CustomSelect label="Language" value={locale} options={languageOptions} onChange={setLocale} compact />
          </div>
        </div>
      </header>

      <main>
        <h1 className="sr-only">Pifagor SVG Optimize</h1>
        <section className="mode-switch" aria-label={t.modeLabel}>
          <button className={inputMode === "files" ? "is-active" : ""} type="button" onClick={() => setInputMode("files")}>
            <Files size={16} />
            <span>
              <strong>{t.optimizeFiles}</strong>
            </span>
          </button>
          <button className={inputMode === "code" ? "is-active" : ""} type="button" onClick={() => setInputMode("code")}>
            <Code2 size={16} />
            <span>
              <strong>{t.optimizeCode}</strong>
            </span>
          </button>
        </section>

        {inputMode === "files" ? (
          <section className="workspace files-workspace" aria-label="SVG file optimizer workspace">
            <div
              className={`upload-strip ${isDropActive ? "is-active" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDropActive(true);
              }}
              onDragLeave={() => setIsDropActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDropActive(false);
              void handleFiles(event.dataTransfer.files);
            }}
          >
              <div className="upload-copy">
                <UploadCloud size={18} />
                <div>
                  <strong>{files.length > 0 ? `${files.length} SVG` : t.dropTitle}</strong>
                  <span>{files.length > 0 ? `${optimizedCount} ${t.readyShort}${warningCount > 0 ? ` / ${warningCount} ${t.warnings}` : ""}` : t.dropBody}</span>
                </div>
              </div>
              <div className="upload-actions">
                <label className="primary-button">
                  <Files size={15} />
                  {t.pickFiles}
                  <input type="file" accept=".svg,image/svg+xml" multiple onChange={(event) => void handleFiles(event.target.files ?? [])} />
                </label>
                <label className="ghost-button">
                  <FolderOpen size={15} />
                  {t.pickFolder}
                  <input ref={folderInputRef} type="file" accept=".svg,image/svg+xml" multiple onChange={(event) => void handleFiles(event.target.files ?? [])} />
                </label>
                <button className="primary-button" type="button" onClick={downloadAll} disabled={files.length === 0}>
                  <ArrowDownToLine size={15} />
                  {t.downloadAll}
                </button>
                <button className="ghost-button" type="button" onClick={clearFiles} disabled={files.length === 0}>
                  <RefreshCcw size={15} />
                  {t.reset}
                </button>
              </div>
              {files.length > 0 && (
                <div className="file-rail" aria-label={t.files}>
                  {files.map((file, index) => (
                    <button
                      key={`${file.name}-${index}`}
                      className={index === selectedIndex ? "is-selected" : ""}
                      type="button"
                      onClick={() => {
                        setSelectedIndex(index);
                        setInputMode("files");
                      }}
                    >
                      <span className={`file-pill-thumb preview-bg-${previewSettings.backgroundMode}`} style={previewStageStyle} aria-hidden="true">
                        {file.originalPreviewSvg ? <span dangerouslySetInnerHTML={{ __html: file.originalPreviewSvg }} /> : <Files size={14} />}
                      </span>
                      <span className="file-pill-name">{file.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <section className="paste-panel source-panel">
              <div className="panel-top">
                <div className={previewStageClassName} style={previewStageStyle}>
                  {sourcePreviewSvg ? <div className="svg-preview" dangerouslySetInnerHTML={{ __html: sourcePreviewSvg }} /> : null}
                </div>
                <div className="panel-meta">
                  <p className="section-label">
                    {t.originalCode}
                    {selectedSourceSize && <> <span className="size-label">({selectedSourceSize})</span></>}
                  </p>
                  <h2>{selectedFile?.name ?? t.sourceCode}</h2>
                  <div className="toolbar-buttons">
                    <button className="primary-button" type="button" onClick={reoptimizeSelectedSource} disabled={!selectedFile}>
                      <Zap size={15} />
                      {t.optimizePaste}
                    </button>
                  </div>
                </div>
              </div>
              <SvgCodeEditor id="original-svg" ariaLabel={t.originalCode} value={selectedFile?.original ?? ""} onChange={updateSelectedSource} />
            </section>

            {renderPreviewPanel()}
          </section>
        ) : (
          <section className="workspace code-workspace" aria-label="SVG code optimizer workspace">
            <section className="paste-panel code-source">
              <div className="panel-top">
                <div className={previewStageClassName} style={previewStageStyle}>
                  {sourcePreviewSvg ? <div className="svg-preview" dangerouslySetInnerHTML={{ __html: sourcePreviewSvg }} /> : null}
                </div>
                <div className="panel-meta">
                  <p className="section-label">
                    {t.originalCode}
                    {selectedSourceSize && <> <span className="size-label">({selectedSourceSize})</span></>}
                  </p>
                  <h2>{t.sourceCode}</h2>
                  <div className="toolbar-buttons">
                    <button className="primary-button" type="button" onClick={handlePasteOptimize}>
                      <Zap size={15} />
                      {t.optimizePaste}
                    </button>
                  </div>
                </div>
              </div>
              <SvgCodeEditor id="pasted-svg" ariaLabel={t.sourceCode} value={pastedSvg} onChange={setPastedSvg} />
            </section>

            {renderPreviewPanel()}
          </section>
        )}

        <section className="trust-band">
          <LockKeyhole size={18} />
          <div>
            <h2>{t.safeNoteTitle}</h2>
            <p>{t.privacy}</p>
          </div>
        </section>
      </main>

      <footer>
        <p>{t.footer}</p>
        <a className="developer-link" href="https://pifagor.studio" target="_blank" rel="noreferrer" aria-label={t.developer}>
          <span>Made with</span>
          <Heart size={14} />
          <img src="/pifagor_logo.svg" alt="" />
        </a>
      </footer>

      <button
        className={`drawer-backdrop ${isSettingsOpen ? "is-open" : ""}`}
        type="button"
        aria-label="Close settings"
        onClick={() => setIsSettingsOpen(false)}
      />
      <aside className={`settings-drawer ${isSettingsOpen ? "is-open" : ""}`} aria-hidden={!isSettingsOpen}>
        <div className="drawer-heading">
          <div className="panel-heading">
            <Settings2 size={18} />
            <h2>{t.settings}</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => setIsSettingsOpen(false)} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <Field label={t.profile}>
          <div className="profile-grid">
            {profileOptions.map((option) => (
              <button
                key={option.value}
                className={draftSettings.profile === option.value ? "is-selected" : ""}
                type="button"
                onClick={() => patchDraftSettings({ profile: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        {(draftSettings.profile === "logo" || draftSettings.profile === "multicolor") && (
          <p className="settings-note">{draftSettings.profile === "logo" ? t.logoHint : t.logoHint}</p>
        )}

        <Field label={t.size}>
          <CustomSelect label={t.size} value={draftSettings.sizeMode} options={sizeModeOptions} onChange={(sizeMode) => patchDraftSettings({ sizeMode })} />
        </Field>
        {draftSettings.sizeMode === "fixed" && (
          <div className="inline-grid">
            <input value={draftSettings.fixedWidth} onChange={(event) => patchDraftSettings({ fixedWidth: event.target.value })} aria-label="Width" />
            <input value={draftSettings.lockSize ? draftSettings.fixedWidth : draftSettings.fixedHeight} disabled={draftSettings.lockSize} onChange={(event) => patchDraftSettings({ fixedHeight: event.target.value })} aria-label="Height" />
            <CustomSelect label="Size unit" value={draftSettings.sizeUnit} options={sizeUnitOptions} onChange={(sizeUnit) => patchDraftSettings({ sizeUnit })} />
          </div>
        )}

        <Field label={t.stroke}>
          <CustomSelect
            label={t.stroke}
            value={draftSettings.strokeColorMode}
            options={strokeColorOptions}
            onChange={(strokeColorMode) => patchDraftSettings({ strokeColorMode })}
            disabled={paintControlsLocked}
          />
        </Field>
        {draftSettings.strokeColorMode === "custom" && !paintControlsLocked && (
          <ColorControl label={t.strokeColor} value={draftSettings.strokeColor} onChange={(strokeColor) => patchDraftSettings({ strokeColor })} />
        )}

        <Field label={t.fill}>
          <CustomSelect
            label={t.fill}
            value={draftSettings.fillColorMode}
            options={fillColorOptions}
            onChange={(fillColorMode) => patchDraftSettings({ fillColorMode })}
            disabled={paintControlsLocked}
          />
        </Field>
        {draftSettings.fillColorMode === "custom" && !paintControlsLocked && (
          <ColorControl label={t.fillColor} value={draftSettings.fillColor} onChange={(fillColor) => patchDraftSettings({ fillColor })} />
        )}

        <Field label={t.previewBackground}>
          <CustomSelect
            label={t.previewBackground}
            value={draftPreviewSettings.backgroundMode}
            options={previewBackgroundOptions}
            onChange={(backgroundMode) => patchDraftPreviewSettings({ backgroundMode })}
          />
        </Field>
        {draftPreviewSettings.backgroundMode === "custom" && (
          <ColorControl
            label={t.previewBackgroundColor}
            value={draftPreviewSettings.backgroundColor}
            onChange={(backgroundColor) => patchDraftPreviewSettings({ backgroundColor })}
          />
        )}

        <div className="toggle-stack">
          <label>
            <input type="checkbox" checked={draftSettings.movePaintToRoot} disabled={paintControlsLocked} onChange={(event) => patchDraftSettings({ movePaintToRoot: event.target.checked })} />
            {t.movePaint}
          </label>
          <label>
            <input type="checkbox" checked={draftSettings.removeBackground} disabled={paintControlsLocked} onChange={(event) => patchDraftSettings({ removeBackground: event.target.checked })} />
            {t.removeBg}
          </label>
        </div>

        {draftSettings.profile === "expert" && (
          <section className="settings-section">
            <h3>{t.expertSettings}</h3>
            <div className="toggle-stack">
              <label>
                <input type="checkbox" checked={draftSettings.preserveEmbeddedImages} onChange={(event) => patchDraftSettings({ preserveEmbeddedImages: event.target.checked })} />
                {t.preserveEmbeddedImages}
              </label>
              <label>
                <input type="checkbox" checked={draftSettings.expertPlugins.mergePaths} onChange={(event) => patchExpertPlugins({ mergePaths: event.target.checked })} />
                {t.mergePaths}
              </label>
              <label>
                <input type="checkbox" checked={draftSettings.expertPlugins.cleanupIds} onChange={(event) => patchExpertPlugins({ cleanupIds: event.target.checked })} />
                {t.cleanupIds}
              </label>
              <label>
                <input type="checkbox" checked={draftSettings.expertPlugins.removeHiddenElems} onChange={(event) => patchExpertPlugins({ removeHiddenElems: event.target.checked })} />
                {t.removeHiddenElems}
              </label>
            </div>
          </section>
        )}

        <section className="settings-section">
          <h3>{t.fileNames}</h3>
          <Field label={t.codeOutputName}>
            <input value={draftSettings.codeOutputName} onChange={(event) => patchDraftSettings({ codeOutputName: event.target.value })} />
          </Field>
          <div className="file-name-grid">
            <Field label={t.outputPrefix}>
              <input value={draftSettings.outputPrefix} onChange={(event) => patchDraftSettings({ outputPrefix: event.target.value })} />
            </Field>
            <Field label={t.outputSuffix}>
              <input value={draftSettings.outputSuffix} onChange={(event) => patchDraftSettings({ outputSuffix: event.target.value })} />
            </Field>
          </div>
        </section>

        <Field label={t.output}>
          <CustomSelect label={t.output} value={outputMode} options={outputModeOptions} onChange={setOutputMode} />
        </Field>

        <div className="settings-actions">
          <button className="primary-button full" type="button" onClick={applyPreset}>
            <Zap size={16} />
            {t.applySettings}
          </button>
          <button className="ghost-button full" type="button" onClick={resetPreset}>
            <RefreshCcw size={16} />
            {t.reset}
          </button>
        </div>
      </aside>
      <div className={`toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="color-row">
      <input className="color-swatch" type="color" value={colorPickerValue(value)} onChange={(event) => onChange(event.target.value)} aria-label={label} />
      <input className="color-input" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span>{label}</span>
      {children}
    </div>
  );
}

function CustomSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  compact = false
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeFromOutside(event: PointerEvent) {
      if (!selectRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", closeFromOutside);
    window.addEventListener("keydown", closeWithEscape);

    return () => {
      window.removeEventListener("pointerdown", closeFromOutside);
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  return (
    <div className={`custom-select ${compact ? "is-compact" : ""} ${isOpen ? "is-open" : ""}`} ref={selectRef}>
      <button
        className="custom-select-trigger"
        type="button"
        aria-label={`${label}: ${selected?.label ?? ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{selected?.label}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen && (
        <div className="custom-select-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              className={option.value === value ? "is-selected" : ""}
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

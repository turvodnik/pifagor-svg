import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDownToLine,
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
import { defaultSettings, optimizeSvg, outputFileName, type ColorMode, type FillColorMode, type OptimizationSettings, type SizeMode } from "./lib/optimizer";
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

function createPastedResult(svg: string, settings: OptimizationSettings): ProcessedFile {
  const name = "pasted.svg";
  try {
    const result = optimizeSvg(svg, settings);
    return { name, outputName: outputFileName(name, settings), original: svg, result, error: null };
  } catch (error) {
    return {
      name,
      outputName: outputFileName(name, settings),
      original: svg,
      result: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function reprocessExistingFile(file: ProcessedFile, settings: OptimizationSettings): ProcessedFile {
  if (!file.original) {
    return { ...file, outputName: outputFileName(file.name, settings) };
  }
  try {
    const result = optimizeSvg(file.original, settings);
    return { ...file, outputName: outputFileName(file.name, settings), result, error: null };
  } catch (error) {
    return {
      ...file,
      outputName: outputFileName(file.name, settings),
      result: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
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

  const previewSvg = selected?.result?.fullSvg ?? "";
  const compactSvg = selected?.result?.compactSvg ?? "";
  const sourcePreviewSvg = useMemo(() => {
    if (inputMode === "files") {
      return selectedFile?.result?.fullSvg ?? "";
    }
    try {
      return optimizeSvg(pastedSvg, settings).fullSvg;
    } catch {
      return "";
    }
  }, [inputMode, pastedSvg, selectedFile, settings]);

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

  const downloadSelected = () => {
    if (selected?.result?.status === "optimized") {
      downloadText(selected.outputName, selected.result.fullSvg);
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
      downloadText(optimized[0].outputName, optimized[0].result!.fullSvg);
      showToast(t.downloadStarted);
      return;
    }
    if (outputMode === "zip") {
      downloadZip("pifagor-svg-optimized.zip", optimized);
      showToast(t.downloadStarted);
      return;
    }
    optimized.forEach((file) => downloadText(file.outputName, file.result!.fullSvg));
    showToast(t.downloadStarted);
  };

  const copyCompact = async () => {
    if (!compactSvg) {
      showToast(t.nothingToCopy);
      return;
    }
    try {
      await copyToClipboard(compactSvg);
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

  const renderPreviewPanel = (showDownloadAll: boolean) => (
    <section className={`preview-panel ${inputMode === "code" ? "code-result" : ""}`}>
      <div className="panel-top">
        <div className={previewStageClassName} style={previewStageStyle}>
          {previewSvg ? <div className="svg-preview" dangerouslySetInnerHTML={{ __html: previewSvg }} /> : null}
        </div>
        <div className="panel-meta">
          <p className="section-label">{t.result}</p>
          <h2>{selected?.outputName ?? t.optimizedCode}</h2>
          <div className="toolbar-buttons">
            <button className="primary-button" type="button" onClick={downloadSelected}>
              <ArrowDownToLine size={15} />
              {t.download}
            </button>
            <button className="ghost-button" type="button" onClick={copyCompact}>
              <Copy size={15} />
              {t.copySvg}
            </button>
            {showDownloadAll && (
              <button className="primary-button" type="button" onClick={downloadAll}>
                <ArrowDownToLine size={15} />
                {t.downloadAll}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="code-card">
        <pre className="code-output" aria-label={t.optimizedCode}>
          {selected?.result?.fullSvg ?? ""}
        </pre>
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
          <label className="language-select">
            <Globe2 size={16} />
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              {locales.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
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
                      <span className="file-pill-thumb" aria-hidden="true">
                        {file.result?.fullSvg ? <span dangerouslySetInnerHTML={{ __html: file.result.fullSvg }} /> : <Files size={14} />}
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
                  <p className="section-label">{t.originalCode}</p>
                  <h2>{selectedFile?.name ?? t.sourceCode}</h2>
                </div>
              </div>
              <textarea id="original-svg" aria-label={t.originalCode} value={selectedFile?.original ?? ""} spellCheck={false} readOnly />
            </section>

            {renderPreviewPanel(true)}
          </section>
        ) : (
          <section className="workspace code-workspace" aria-label="SVG code optimizer workspace">
            <section className="paste-panel code-source">
              <div className="panel-top">
                <div className={previewStageClassName} style={previewStageStyle}>
                  {sourcePreviewSvg ? <div className="svg-preview" dangerouslySetInnerHTML={{ __html: sourcePreviewSvg }} /> : null}
                </div>
                <div className="panel-meta">
                  <p className="section-label">{t.originalCode}</p>
                  <h2>{t.sourceCode}</h2>
                  <div className="toolbar-buttons">
                    <button className="primary-button" type="button" onClick={handlePasteOptimize}>
                      <Zap size={15} />
                      {t.optimizePaste}
                    </button>
                  </div>
                </div>
              </div>
              <textarea id="pasted-svg" aria-label={t.sourceCode} value={pastedSvg} spellCheck={false} onChange={(event) => setPastedSvg(event.target.value)} />
            </section>

            {renderPreviewPanel(false)}
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

        <label className="switch-row">
          <input
            type="checkbox"
            checked={draftSettings.logoOptimization}
            onChange={(event) => patchDraftSettings({ logoOptimization: event.target.checked })}
          />
          <span>
            <strong>{t.logoMode}</strong>
            <small>{t.logoHint}</small>
          </span>
        </label>

        <Field label={t.size}>
          <select value={draftSettings.sizeMode} onChange={(event) => patchDraftSettings({ sizeMode: event.target.value as SizeMode })}>
            <option value="none">{t.noSize}</option>
            <option value="inline1em">{t.inline}</option>
            <option value="fixed">{t.fixed}</option>
          </select>
        </Field>
        {draftSettings.sizeMode === "fixed" && (
          <div className="inline-grid">
            <input value={draftSettings.fixedWidth} onChange={(event) => patchDraftSettings({ fixedWidth: event.target.value })} aria-label="Width" />
            <input value={draftSettings.lockSize ? draftSettings.fixedWidth : draftSettings.fixedHeight} disabled={draftSettings.lockSize} onChange={(event) => patchDraftSettings({ fixedHeight: event.target.value })} aria-label="Height" />
            <select value={draftSettings.sizeUnit} onChange={(event) => patchDraftSettings({ sizeUnit: event.target.value as OptimizationSettings["sizeUnit"] })}>
              <option value="px">px</option>
              <option value="em">em</option>
              <option value="rem">rem</option>
              <option value="percent">%</option>
            </select>
          </div>
        )}

        <Field label={t.stroke}>
          <select value={draftSettings.strokeColorMode} onChange={(event) => patchDraftSettings({ strokeColorMode: event.target.value as ColorMode })} disabled={draftSettings.logoOptimization}>
            <option value="currentColor">{t.currentColor}</option>
            <option value="custom">{t.custom}</option>
            <option value="preserve">{t.preserve}</option>
          </select>
        </Field>
        {draftSettings.strokeColorMode === "custom" && !draftSettings.logoOptimization && (
          <ColorControl label={t.strokeColor} value={draftSettings.strokeColor} onChange={(strokeColor) => patchDraftSettings({ strokeColor })} />
        )}

        <Field label={t.fill}>
          <select value={draftSettings.fillColorMode} onChange={(event) => patchDraftSettings({ fillColorMode: event.target.value as FillColorMode })} disabled={draftSettings.logoOptimization}>
            <option value="currentColor">{t.currentColor}</option>
            <option value="custom">{t.custom}</option>
            <option value="preserve">{t.preserve}</option>
            <option value="none">{t.none}</option>
          </select>
        </Field>
        {draftSettings.fillColorMode === "custom" && !draftSettings.logoOptimization && (
          <ColorControl label={t.fillColor} value={draftSettings.fillColor} onChange={(fillColor) => patchDraftSettings({ fillColor })} />
        )}

        <Field label={t.previewBackground}>
          <select
            value={draftPreviewSettings.backgroundMode}
            onChange={(event) => patchDraftPreviewSettings({ backgroundMode: event.target.value as PreviewBackgroundMode })}
          >
            <option value="dark">{t.previewDark}</option>
            <option value="light">{t.previewLight}</option>
            <option value="custom">{t.custom}</option>
          </select>
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
            <input type="checkbox" checked={draftSettings.movePaintToRoot} disabled={draftSettings.logoOptimization} onChange={(event) => patchDraftSettings({ movePaintToRoot: event.target.checked })} />
            {t.movePaint}
          </label>
          <label>
            <input type="checkbox" checked={draftSettings.removeBackground} disabled={draftSettings.logoOptimization} onChange={(event) => patchDraftSettings({ removeBackground: event.target.checked })} />
            {t.removeBg}
          </label>
        </div>

        <Field label={t.output}>
          <select value={outputMode} onChange={(event) => setOutputMode(event.target.value as BatchOutputMode)}>
            <option value="zip">{t.zip}</option>
            <option value="separate">{t.separate}</option>
          </select>
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
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

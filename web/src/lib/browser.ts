import { zipSync, strToU8 } from "fflate";
import type { ProcessedFile } from "../workers/optimizer.worker";
import { optimizeSvg, outputFileName, type OptimizationSettings } from "./optimizer";

export type BatchOutputMode = "zip" | "separate";

export function processFiles(files: File[], settings: OptimizationSettings): Promise<ProcessedFile[]> {
  return processFilesOnMainThread(files, settings);
}

export async function processFilesOnMainThread(files: File[], settings: OptimizationSettings): Promise<ProcessedFile[]> {
  const processed: ProcessedFile[] = [];
  for (const [index, file] of files.entries()) {
    try {
      const original = await readBlobText(file);
      const result = optimizeSvg(original, settings);
      processed.push({
        name: file.name,
        outputName: outputFileName(file.name, settings),
        original,
        result,
        error: null
      });
    } catch (error) {
      processed.push({
        name: file.name,
        outputName: outputFileName(file.name, settings),
        original: "",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    if (index % 3 === 2) {
      await yieldToBrowser();
    }
  }
  return processed;
}

export function downloadText(fileName: string, content: string, mime = "image/svg+xml;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  downloadBlob(fileName, blob);
}

export function downloadZip(fileName: string, files: ProcessedFile[]): void {
  const entries = Object.fromEntries(
    files
      .filter((file) => file.result?.status === "optimized")
      .map((file) => [file.outputName, strToU8(file.result!.fullSvg)])
  );
  const bytes = zipSync(entries, { level: 6 });
  downloadBlob(fileName, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/zip" }));
}

export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Some browsers expose Clipboard API but still deny writes; fall back to the older local copy path.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const didCopy = document.execCommand("copy");
  textarea.remove();
  if (!didCopy) {
    throw new Error("Clipboard copy failed.");
  }
}

export function readBlobText(blob: Blob): Promise<string> {
  if ("text" in blob && typeof blob.text === "function") {
    return blob.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsText(blob);
  });
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

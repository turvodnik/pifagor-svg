import { optimizeSvg, outputFileName, type OptimizationSettings, type OptimizationResult } from "../lib/optimizer";
import { readBlobText } from "../lib/browser";

export interface WorkerRequest {
  id: string;
  files: File[];
  settings: OptimizationSettings;
}

export interface ProcessedFile {
  name: string;
  outputName: string;
  original: string;
  result: OptimizationResult | null;
  error: string | null;
}

export interface WorkerResponse {
  id: string;
  files: ProcessedFile[];
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, files, settings } = event.data;
  const processed: ProcessedFile[] = [];

  for (const file of files) {
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
  }

  self.postMessage({ id, files: processed } satisfies WorkerResponse);
};

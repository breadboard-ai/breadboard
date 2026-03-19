/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Telemetry — records timing, metadata, and generated code for each run.
 * Persists to localStorage for cross-session comparison and replay.
 */

export { Telemetry };
export type { RunRecord };

interface RunRecord {
  id: string;
  mode: "one-shot" | "prefab" | "design-first";
  timestamp: string;
  generateTimeMs: number;
  transformTimeMs: number;
  totalTimeMs: number;
  promptSizeChars: number;
  outputFileCount: number;
  outputTotalChars: number;
  /** Stage timings for design-first mode. */
  stageTimes?: {
    assessMs: number;
    designMs: number;
    generateMs: number;
    transformMs: number;
  };
  /** Whether custom components were allowed (prefab mode). */
  allowCustomComponents?: boolean;
  /** Which image model was used (design-first mode). */
  imageModel?: string;
  /** Which design theme was active. */
  theme?: string;
  /** Which Gemini model was used for code generation. */
  model?: string;
  /** Whether theme-aware layout was enabled. */
  themeAwareLayout?: boolean;
}

const STORAGE_KEY = "ea-magazine-runs";
const CODE_STORAGE_KEY = "ea-magazine-code";

class Telemetry {
  #runs: RunRecord[] = [];
  #codeStore: Map<string, string> = new Map();
  #filesStore: Map<string, Record<string, string>> = new Map();

  constructor() {
    this.#load();
  }

  get runs(): readonly RunRecord[] {
    return this.#runs;
  }

  addRun(
    record: Omit<RunRecord, "id" | "timestamp">,
    code?: string,
    files?: Record<string, string>
  ): RunRecord {
    const run: RunRecord = {
      ...record,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.#runs.unshift(run);
    if (code) {
      this.#codeStore.set(run.id, code);
    }
    if (files) {
      this.#filesStore.set(run.id, files);
    }
    this.#save();
    return run;
  }

  /** Get stored code for a run, or null if not available. */
  getCode(runId: string): string | null {
    return this.#codeStore.get(runId) ?? null;
  }

  /** Get stored raw files for a run, or null if not available. */
  getFiles(runId: string): Record<string, string> | null {
    return this.#filesStore.get(runId) ?? null;
  }

  clearAll() {
    this.#runs = [];
    this.#codeStore.clear();
    this.#filesStore.clear();
    this.#save();
  }

  #load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.#runs = JSON.parse(raw);
      }
    } catch {
      this.#runs = [];
    }

    try {
      const codeRaw = localStorage.getItem(CODE_STORAGE_KEY);
      if (codeRaw) {
        const entries = JSON.parse(codeRaw) as [string, string][];
        this.#codeStore = new Map(entries);
      }
    } catch {
      this.#codeStore = new Map();
    }

    try {
      const filesRaw = localStorage.getItem(CODE_STORAGE_KEY + "-files");
      if (filesRaw) {
        const entries = JSON.parse(filesRaw) as [
          string,
          Record<string, string>,
        ][];
        this.#filesStore = new Map(entries);
      }
    } catch {
      this.#filesStore = new Map();
    }
  }

  #save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#runs));
      // Only keep code for the last 100 runs to avoid filling localStorage
      const recentIds = new Set(this.#runs.slice(0, 100).map((r) => r.id));
      for (const key of this.#codeStore.keys()) {
        if (!recentIds.has(key)) {
          this.#codeStore.delete(key);
        }
      }
      for (const key of this.#filesStore.keys()) {
        if (!recentIds.has(key)) {
          this.#filesStore.delete(key);
        }
      }
      localStorage.setItem(
        CODE_STORAGE_KEY,
        JSON.stringify([...this.#codeStore.entries()])
      );
      localStorage.setItem(
        CODE_STORAGE_KEY + "-files",
        JSON.stringify([...this.#filesStore.entries()])
      );
    } catch {
      // localStorage full or unavailable
    }
  }
}

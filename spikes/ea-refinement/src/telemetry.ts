/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Telemetry — records timing, metadata, and generated code for each run.
 * Tracks both baseline generation and refinement runs with feedback context.
 * Persists to localStorage for cross-session comparison.
 */

export { Telemetry };
export type { RunRecord };

interface RunRecord {
  id: string;
  type: "baseline" | "refinement" | "chat";
  timestamp: string;
  generateTimeMs: number;
  transformTimeMs: number;
  totalTimeMs: number;
  promptSizeChars: number;
  outputFileCount: number;
  outputTotalChars: number;
  model: string;
  /** Context level used for baseline generation. */
  contextLevel?: string;
  /** Feedback level applied (F0–F5 or custom). */
  feedbackLevel?: string;
  /** The actual feedback text sent. */
  feedbackText?: string;
  /** Version number in the promote chain. */
  version?: number;
  /** Whether the user promoted this refinement. */
  promoted?: boolean;
  /** Chat memory accumulated at time of run. */
  memorySizeChars?: number;
}

const STORAGE_KEY = "ea-refinement-runs";
const CODE_STORAGE_KEY = "ea-refinement-code";

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
    if (code) this.#codeStore.set(run.id, code);
    if (files) this.#filesStore.set(run.id, files);
    this.#save();
    return run;
  }

  /** Mark a run as promoted. */
  markPromoted(runId: string) {
    const run = this.#runs.find((r) => r.id === runId);
    if (run) {
      run.promoted = true;
      this.#save();
    }
  }

  getCode(runId: string): string | null {
    return this.#codeStore.get(runId) ?? null;
  }

  getFiles(runId: string): Record<string, string> | null {
    return this.#filesStore.get(runId) ?? null;
  }

  clearAll() {
    this.#runs = [];
    this.#codeStore.clear();
    this.#filesStore.clear();
    this.#save();
  }

  /** Export telemetry as a markdown table for the spike report. */
  toMarkdown(): string {
    if (this.#runs.length === 0) return "_No runs recorded._";

    const lines = [
      "| # | Type | Model | Context | Feedback | Gen ms | Xfm ms | " +
        "Total ms | Files | Chars | Promoted |",
      "|---|------|-------|---------|----------|--------|--------|" +
        "----------|-------|-------|----------|",
    ];

    for (let i = this.#runs.length - 1; i >= 0; i--) {
      const r = this.#runs[i];
      lines.push(
        `| ${this.#runs.length - i} ` +
          `| ${r.type} ` +
          `| ${r.model.replace("gemini-3.1-", "").replace("-preview", "")} ` +
          `| ${r.contextLevel ?? "—"} ` +
          `| ${r.feedbackLevel ?? "—"} ` +
          `| ${r.generateTimeMs} ` +
          `| ${r.transformTimeMs} ` +
          `| ${r.totalTimeMs} ` +
          `| ${r.outputFileCount} ` +
          `| ${r.outputTotalChars} ` +
          `| ${r.promoted ? "✓" : "—"} |`
      );
    }

    return lines.join("\n");
  }

  #load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.#runs = JSON.parse(raw);
    } catch {
      this.#runs = [];
    }

    try {
      const codeRaw = localStorage.getItem(CODE_STORAGE_KEY);
      if (codeRaw) {
        this.#codeStore = new Map(JSON.parse(codeRaw));
      }
    } catch {
      this.#codeStore = new Map();
    }

    try {
      const filesRaw = localStorage.getItem(CODE_STORAGE_KEY + "-files");
      if (filesRaw) {
        this.#filesStore = new Map(JSON.parse(filesRaw));
      }
    } catch {
      this.#filesStore = new Map();
    }
  }

  #save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#runs));
      const recentIds = new Set(this.#runs.slice(0, 50).map((r) => r.id));
      for (const key of this.#codeStore.keys()) {
        if (!recentIds.has(key)) this.#codeStore.delete(key);
      }
      for (const key of this.#filesStore.keys()) {
        if (!recentIds.has(key)) this.#filesStore.delete(key);
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

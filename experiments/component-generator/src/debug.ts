/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { debugLog };

interface DebugEntry {
  timestamp: string;
  type:
    | "request"
    | "response"
    | "sse-chunk"
    | "transform"
    | "render"
    | "parsed"
    | "error";
  data: unknown;
}

/**
 * In-memory debug log. Captures request/response pairs, SSE chunks,
 * transform results, and render data. Copy to clipboard via the UI button.
 */
const debugLog = {
  _entries: [] as DebugEntry[],

  /** Add an entry to the log. */
  add(type: DebugEntry["type"], data: unknown): void {
    this._entries.push({
      timestamp: new Date().toISOString(),
      type,
      data,
    });
  },

  /** Clear the log. */
  clear(): void {
    this._entries = [];
  },

  /** Export the full log as a JSON string. */
  toJSON(): string {
    return JSON.stringify(this._entries, null, 2);
  },

  /** Copy the log to the clipboard. */
  async copyToClipboard(): Promise<void> {
    const json = this.toJSON();
    await navigator.clipboard.writeText(json);
  },

  /** Number of entries. */
  get size(): number {
    return this._entries.length;
  },
};

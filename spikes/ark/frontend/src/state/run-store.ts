/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * RunStore — signal-backed reactive state for agent runs.
 *
 * Polls the backend for run summaries and manages SSE streams for live
 * event detail when a run is selected. Handles bundle fetching and
 * parsing for completed runs.
 */

import { Signal } from "signal-polyfill";
import {
  backend,
  type RunSummary,
  type RunEvent,
} from "../services/backend.js";
import { parseMultipart } from "../pipeline/multipart.js";
import { mapPartsToBundle } from "../pipeline/bundle-mapper.js";
import type { ViewBundle } from "../types.js";

export { RunStore, type RunSummary, type RunEvent };

class RunStore {
  /** All known runs (polled periodically). */
  readonly runs = new Signal.State<RunSummary[]>([]);

  /** Currently selected run ID (null = none selected). */
  readonly selectedRunId = new Signal.State<string | null>(null);

  /** SSE events for the selected run. */
  readonly events = new Signal.State<RunEvent[]>([]);

  /** The currently loaded ViewBundle (null = no bundle loaded). */
  readonly currentBundle = new Signal.State<ViewBundle | null>(null);

  /** Loading state for bundle fetch. */
  readonly bundleLoading = new Signal.State(false);

  #pollTimer: ReturnType<typeof setTimeout> | null = null;
  #closeStream: (() => void) | null = null;

  /** Start a new run and resume polling. */
  async startRun(objective: string) {
    await backend.startRun(objective);
    // Kick off polling so the new run appears and is tracked.
    this.#ensurePolling();
  }

  /** Toggle run selection. Opens/closes SSE stream accordingly. */
  selectRun(id: string) {
    if (this.selectedRunId.get() === id) {
      // Deselect.
      this.selectedRunId.set(null);
      this.events.set([]);
      this.#closeSSE();
      return;
    }

    this.selectedRunId.set(id);
    this.events.set([]);
    this.#openSSE(id);
  }

  /**
   * Fetch the bundle for a completed run, parse multipart response,
   * and map it into a ViewBundle for the iframe pipeline.
   */
  async openBundle(runId: string) {
    this.bundleLoading.set(true);
    this.currentBundle.set(null);

    try {
      const response = await backend.fetchBundle(runId);
      const parts = await parseMultipart(response);
      const bundle = mapPartsToBundle(runId, parts);
      this.currentBundle.set(bundle);
    } catch (err) {
      console.error("[ark-store] Bundle fetch failed:", err);
      this.currentBundle.set(null);
    } finally {
      this.bundleLoading.set(false);
    }
  }

  /** Close the bundle viewport and return to the run list. */
  closeBundle() {
    this.currentBundle.set(null);
  }

  /** Start polling (initial poll on load, then smart polling). */
  startPolling() {
    this.#poll(); // Initial poll on load.
  }

  /** Stop polling and close any active SSE stream. */
  stopPolling() {
    if (this.#pollTimer !== null) {
      clearTimeout(this.#pollTimer);
      this.#pollTimer = null;
    }
    this.#closeSSE();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  async #poll() {
    try {
      const summaries = await backend.pollRuns();
      this.runs.set(summaries);

      // Smart polling: continue only if any run is still active.
      const hasActive = summaries.some((r) => r.status !== "complete");
      if (hasActive) {
        this.#pollTimer = setTimeout(() => this.#poll(), 1000);
      } else {
        this.#pollTimer = null;
      }
    } catch {
      // Transient error — retry after a delay.
      this.#pollTimer = setTimeout(() => this.#poll(), 2000);
    }
  }

  /** Kick off polling (e.g. after starting a new run). */
  #ensurePolling() {
    if (this.#pollTimer === null) {
      this.#poll();
    }
  }

  #openSSE(runId: string) {
    this.#closeSSE();

    this.#closeStream = backend.streamRun(runId, {
      onStart: (data) => {
        this.events.set([...this.events.get(), data]);
      },
      onProgress: (data) => {
        this.events.set([...this.events.get(), data]);
      },
      onDone: (data) => {
        this.events.set([...this.events.get(), data]);
        this.#closeStream = null;
        // Trigger a poll to pick up the final state (artifacts, etc.).
        this.#poll();
      },
      onError: () => {
        this.events.set([
          ...this.events.get(),
          { type: "done", detail: "Connection lost" },
        ]);
        this.#closeStream = null;
      },
    });
  }

  #closeSSE() {
    if (this.#closeStream) {
      this.#closeStream();
      this.#closeStream = null;
    }
  }
}

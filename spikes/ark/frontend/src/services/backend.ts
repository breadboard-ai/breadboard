/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Backend Service — stateless client for the Ark backend API.
 *
 * All network calls live here. No state, no signals — pure fetch wrappers.
 */

export { backend, type RunSummary, type RunEvent, type ReuseInfo };

const BACKEND_URL = "http://localhost:8080";

/** Reuse analysis for a single file. */
interface ReuseInfo {
  status: "new" | "reused";
  library_file?: string;
}

/** Shape returned by GET /agent/runs/status. */
interface RunSummary {
  id: string;
  objective: string;
  status: "running" | "complete";
  current_step: string;
  current_detail: string;
  progress: number;
  total_steps: number;
  artifacts: string[];
}

/** Shape of SSE event data. */
interface RunEvent {
  type: "start" | "progress" | "done";
  step?: string;
  detail?: string;
  code?: string;
  objective?: string;
  id?: string;
  artifacts?: string[];
}

/** Callback signature for SSE stream events. */
interface StreamCallbacks {
  onStart?: (data: RunEvent) => void;
  onProgress?: (data: RunEvent) => void;
  onDone?: (data: RunEvent) => void;
  onError?: () => void;
}

const backend = {
  /** Start a new agent run. Returns the run ID. */
  async startRun(objective: string): Promise<string> {
    const res = await fetch(`${BACKEND_URL}/agent/runs/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective, type: "ui" }),
    });
    const data = await res.json();
    return data.id;
  },

  /** Poll all run statuses. */
  async pollRuns(): Promise<RunSummary[]> {
    const res = await fetch(`${BACKEND_URL}/agent/runs/status`);
    return res.json();
  },

  /**
   * Open an SSE stream for a specific run.
   * Returns a cleanup function to close the stream.
   */
  streamRun(runId: string, callbacks: StreamCallbacks): () => void {
    const evtSource = new EventSource(`${BACKEND_URL}/agent/runs/${runId}`);

    evtSource.addEventListener("start", (e) => {
      callbacks.onStart?.(JSON.parse((e as MessageEvent).data));
    });

    evtSource.addEventListener("progress", (e) => {
      callbacks.onProgress?.(JSON.parse((e as MessageEvent).data));
    });

    evtSource.addEventListener("done", (e) => {
      callbacks.onDone?.(JSON.parse((e as MessageEvent).data));
      evtSource.close();
    });

    evtSource.addEventListener("error", () => {
      callbacks.onError?.();
      evtSource.close();
    });

    return () => evtSource.close();
  },

  /** Build the URL for a run artifact. */
  artifactUrl(runId: string, filename: string): string {
    return `${BACKEND_URL}/out/${runId}/${filename}`;
  },

  /** Fetch the multipart bundle for a completed run. */
  async fetchBundle(runId: string): Promise<Response> {
    const res = await fetch(`${BACKEND_URL}/agent/runs/${runId}/bundle`);
    if (!res.ok) {
      throw new Error(`Bundle fetch failed: ${res.status} ${res.statusText}`);
    }
    return res;
  },

  /** Delete a run and its artifacts. */
  async deleteRun(runId: string): Promise<void> {
    await fetch(`${BACKEND_URL}/agent/runs/${runId}`, { method: "DELETE" });
  },

  /** Check reuse for a completed run's files. */
  async checkReuse(runId: string): Promise<Record<string, ReuseInfo>> {
    const res = await fetch(`${BACKEND_URL}/agent/runs/${runId}/reuse`);
    if (!res.ok) return {};
    return res.json();
  },
};

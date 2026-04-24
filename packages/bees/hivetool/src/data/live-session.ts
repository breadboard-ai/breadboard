/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client for Gemini Live API sessions.
 *
 * Reads a session bundle (`live_session.json`) from a task directory,
 * opens a WebSocket to the Gemini Live API, sends the setup message,
 * and manages the session lifecycle.  On completion or error, writes
 * `live_result.json` for the box's `LiveStream` to pick up.
 *
 * This module handles WebSocket messaging and audio I/O. Tool
 * dispatch is a separate concern added in Phase 4.
 */

import { Signal } from "signal-polyfill";
import { AudioInput, AudioOutput } from "./audio-handler.js";

export { LiveSessionClient };
export type { LiveSessionBundle, SessionStatus };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The session bundle written by `LiveRunner` on the Python side. */
interface LiveSessionBundle {
  token: string;
  endpoint: string;
  setup: Record<string, unknown>;
  task_id: string;
}

type SessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/** A message received from the Live API WebSocket. */
interface ServerMessage {
  setupComplete?: Record<string, unknown>;
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }>;
    };
    turnComplete?: boolean;
  };
  toolCall?: {
    functionCalls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  };
}

// ---------------------------------------------------------------------------
// LiveSessionClient
// ---------------------------------------------------------------------------

class LiveSessionClient {
  /** Reactive session status for UI binding. */
  readonly status = new Signal.State<SessionStatus>("idle");

  /** Reactive transcript — appended as text arrives from the model. */
  readonly transcript = new Signal.State<string>("");

  /** Whether the microphone is currently active. */
  readonly micActive = new Signal.State<boolean>(false);

  /** The task ID this session belongs to. */
  readonly taskId: string;

  #ws: WebSocket | null = null;
  #bundle: LiveSessionBundle;
  #ticketDir: FileSystemDirectoryHandle;
  #audioInput: AudioInput | null = null;
  #audioOutput = new AudioOutput();
  #dispatchObserver: { disconnect(): void } | null = null;

  constructor(
    bundle: LiveSessionBundle,
    ticketDir: FileSystemDirectoryHandle,
  ) {
    this.#bundle = bundle;
    this.#ticketDir = ticketDir;
    this.taskId = bundle.task_id;
  }

  // ── Lifecycle ──

  /**
   * Open the WebSocket connection and send the setup message.
   *
   * Resolves when the connection is established (or rejects on immediate
   * failure).  Session events arrive asynchronously via the WebSocket.
   */
  async connect(): Promise<void> {
    if (this.#ws) return;

    this.status.set("connecting");

    // Build the authenticated WebSocket URL.
    // Ephemeral tokens use access_token, not key.
    const url = `${this.#bundle.endpoint}?access_token=${this.#bundle.token}`;

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);

      ws.addEventListener("open", () => {
        console.log(
          `[live:${this.taskId.slice(0, 8)}] WebSocket connected`,
        );

        // Send the setup message immediately.
        ws.send(JSON.stringify({ setup: this.#bundle.setup }));
      });

      ws.addEventListener("message", (event: MessageEvent) => {
        this.#handleMessage(event.data);
      });

      ws.addEventListener("close", (event: CloseEvent) => {
        console.log(
          `[live:${this.taskId.slice(0, 8)}] WebSocket closed:`,
          event.code,
          event.reason,
        );
        this.#ws = null;

        if (this.status.get() === "connecting") {
          this.status.set("error");
          reject(new Error(`WebSocket closed during setup: ${event.reason}`));
        } else {
          this.status.set("disconnected");
          this.#writeResult("completed");
        }
      });

      ws.addEventListener("error", () => {
        console.error(
          `[live:${this.taskId.slice(0, 8)}] WebSocket error`,
        );
        if (this.status.get() === "connecting") {
          this.status.set("error");
          reject(new Error("WebSocket connection failed"));
        } else {
          this.status.set("error");
          this.#writeResult("failed", "WebSocket error");
        }
      });

      this.#ws = ws;
    });
  }

  /** Gracefully close the session. */
  disconnect(): void {
    this.stopMic();
    this.#audioOutput.dispose();
    this.#dispatchObserver?.disconnect();
    this.#dispatchObserver = null;
    if (!this.#ws) return;
    this.#ws.close(1000, "Client disconnect");
    this.#ws = null;
  }

  // ── Audio ──

  /** Start capturing microphone audio and streaming to the Live API. */
  async startMic(): Promise<void> {
    if (this.#audioInput?.running) return;
    if (this.status.get() !== "connected") return;

    this.#audioInput = new AudioInput((base64Pcm: string) => {
      this.send({
        realtimeInput: {
          audio: {
            data: base64Pcm,
            mimeType: "audio/pcm;rate=16000",
          },
        },
      });
    });

    await this.#audioInput.start();
    this.micActive.set(true);
  }

  /** Stop microphone capture. */
  stopMic(): void {
    if (this.#audioInput) {
      this.#audioInput.stop();
      this.#audioInput = null;
    }
    this.micActive.set(false);
  }

  /** Send raw data over the WebSocket (for audio chunks, etc.). */
  send(message: Record<string, unknown>): void {
    if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) return;
    this.#ws.send(JSON.stringify(message));
  }

  // ── Message handling ──

  async #handleMessage(data: string | Blob | ArrayBuffer): Promise<void> {
    // The Live API sends all frames as binary. Decode to text first.
    let text: string;
    if (typeof data === "string") {
      text = data;
    } else if (data instanceof Blob) {
      text = await data.text();
    } else if (data instanceof ArrayBuffer) {
      text = new TextDecoder().decode(data);
    } else {
      return;
    }

    let message: ServerMessage;
    try {
      message = JSON.parse(text) as ServerMessage;
    } catch {
      console.warn(
        `[live:${this.taskId.slice(0, 8)}] Unparseable message:`,
        text.slice(0, 100),
      );
      return;
    }

    // Setup complete — transition to connected.
    if (message.setupComplete) {
      console.log(
        `[live:${this.taskId.slice(0, 8)}] Setup complete`,
      );
      this.status.set("connected");
      return;
    }

    // Model content — text goes to transcript, audio goes to speakers.
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.text) {
          this.transcript.set(this.transcript.get() + part.text);
        }
        if (part.inlineData?.data) {
          this.#audioOutput.play(part.inlineData.data);
        }
      }
    }

    // Tool calls — dispatch via filesystem and relay results.
    if (message.toolCall) {
      const calls = message.toolCall.functionCalls;
      console.log(
        `[live:${this.taskId.slice(0, 8)}] Tool call:`,
        calls.map((fc) => fc.name).join(", "),
      );
      // Fire-and-forget — dispatches concurrently while audio continues.
      void this.#dispatchToolCalls(calls);
    }
  }

  // ── Tool dispatch ──

  /**
   * Dispatch tool calls through the filesystem and relay results.
   *
   * 1. Write each call as `tool_dispatch/{id}.json` (wire format).
   * 2. Observe the directory with `FileSystemObserver` for `.result.json` files.
   * 3. When all results arrive, send a single `toolResponse` on the WebSocket.
   */
  async #dispatchToolCalls(
    calls: Array<{ id: string; name: string; args: Record<string, unknown> }>,
  ): Promise<void> {
    const tag = `[live:${this.taskId.slice(0, 8)}]`;

    let dispatchDir: FileSystemDirectoryHandle;
    try {
      dispatchDir = await this.#ticketDir.getDirectoryHandle(
        "tool_dispatch",
        { create: true },
      );
    } catch (e) {
      console.error(`${tag} Failed to create tool_dispatch dir:`, e);
      return;
    }

    // Write all call files.
    for (const call of calls) {
      const callData = {
        functionCall: { id: call.id, name: call.name, args: call.args },
      };
      try {
        const fh = await dispatchDir.getFileHandle(
          `${call.id}.json`,
          { create: true },
        );
        const w = await fh.createWritable();
        await w.write(JSON.stringify(callData, null, 2) + "\n");
        await w.close();
      } catch (e) {
        console.error(`${tag} Failed to write call file for ${call.id}:`, e);
      }
    }

    // Collect results — one per call.
    const pending = new Map<
      string,
      { name: string; resolve: (result: Record<string, unknown>) => void }
    >();
    const resultPromises: Array<Promise<Record<string, unknown>>> = [];

    for (const call of calls) {
      const p = new Promise<Record<string, unknown>>((resolve) => {
        pending.set(call.id, { name: call.name, resolve });
      });
      resultPromises.push(p);
    }

    // Try to read results that may already exist (fast handler).
    for (const call of calls) {
      if (await this.#tryReadResult(dispatchDir, call.id, pending)) {
        // Already resolved.
      }
    }

    // If all resolved immediately, send response and return.
    if (pending.size === 0) {
      const results = await Promise.all(resultPromises);
      this.#sendToolResponse(results);
      return;
    }

    // Observe for remaining results via FileSystemObserver.
    if ("FileSystemObserver" in globalThis) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (globalThis as any).FileSystemObserver;

      const observer = new Ctor(async (records: unknown[]) => {
        for (const record of records) {
          const r = record as {
            relativePathComponents?: string[];
            type?: string;
          };
          const parts = r.relativePathComponents;
          if (!parts || parts.length === 0) continue;

          const filename = parts[parts.length - 1];
          if (!filename.endsWith(".result.json")) continue;

          const callId = filename.replace(".result.json", "");
          if (!pending.has(callId)) continue;

          await this.#tryReadResult(dispatchDir, callId, pending);
        }

        // All results collected — send response.
        if (pending.size === 0) {
          observer.disconnect();
          const results = await Promise.all(resultPromises);
          this.#sendToolResponse(results);
        }
      });

      observer.observe(dispatchDir, { recursive: false });

      // Store for cleanup on disconnect.
      this.#dispatchObserver?.disconnect();
      this.#dispatchObserver = observer;

      // Timeout: 60s safety net.
      setTimeout(() => {
        if (pending.size > 0) {
          console.warn(
            `${tag} Tool dispatch timeout — ${pending.size} calls pending`,
          );
          for (const [id, entry] of pending) {
            entry.resolve({
              id,
              name: entry.name,
              response: { error: "Dispatch timeout" },
            });
          }
          pending.clear();
          observer.disconnect();
          void Promise.all(resultPromises).then((results) =>
            this.#sendToolResponse(results),
          );
        }
      }, 60_000);
    } else {
      // Fallback: poll-based (if FileSystemObserver unavailable).
      const POLL_MS = 300;
      const TIMEOUT_MS = 60_000;
      const start = Date.now();

      const poll = async () => {
        while (pending.size > 0 && Date.now() - start < TIMEOUT_MS) {
          for (const callId of [...pending.keys()]) {
            await this.#tryReadResult(dispatchDir, callId, pending);
          }
          if (pending.size > 0) {
            await new Promise((r) => setTimeout(r, POLL_MS));
          }
        }

        // Timeout any remaining.
        for (const [id, entry] of pending) {
          entry.resolve({
            id,
            name: entry.name,
            response: { error: "Dispatch timeout" },
          });
        }
        pending.clear();

        const results = await Promise.all(resultPromises);
        this.#sendToolResponse(results);
      };

      void poll();
    }
  }

  /** Try to read a result file; resolve the pending entry if found. */
  async #tryReadResult(
    dispatchDir: FileSystemDirectoryHandle,
    callId: string,
    pending: Map<
      string,
      { name: string; resolve: (result: Record<string, unknown>) => void }
    >,
  ): Promise<boolean> {
    try {
      const fh = await dispatchDir.getFileHandle(`${callId}.result.json`);
      const file = await fh.getFile();
      const text = await file.text();
      const data = JSON.parse(text) as {
        functionResponse?: {
          id: string;
          name: string;
          response: Record<string, unknown>;
        };
      };

      const entry = pending.get(callId);
      if (entry && data.functionResponse) {
        entry.resolve(data.functionResponse);
        pending.delete(callId);
        return true;
      }
    } catch {
      // File doesn't exist yet — expected.
    }
    return false;
  }

  /** Send tool response on the WebSocket. */
  #sendToolResponse(
    responses: Array<Record<string, unknown>>,
  ): void {
    const tag = `[live:${this.taskId.slice(0, 8)}]`;
    console.log(
      `${tag} Sending tool response for`,
      responses.length,
      "calls",
    );
    this.send({
      toolResponse: {
        functionResponses: responses,
      },
    });
  }

  // ── Result writing ──

  async #writeResult(
    status: "completed" | "failed",
    error?: string,
  ): Promise<void> {
    try {
      const result: Record<string, unknown> = { status };
      if (error) result.error = error;
      result.timestamp = new Date().toISOString();

      const fileHandle = await this.#ticketDir.getFileHandle(
        "live_result.json",
        { create: true },
      );
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(result, null, 2) + "\n");
      await writable.close();

      console.log(
        `[live:${this.taskId.slice(0, 8)}] Result written: ${status}`,
      );
    } catch (e) {
      console.error(
        `[live:${this.taskId.slice(0, 8)}] Failed to write result:`,
        e,
      );
    }
  }

  // ── Static factory ──

  /**
   * Read a session bundle from a ticket directory.
   *
   * Returns `null` if `live_session.json` doesn't exist or isn't readable.
   */
  static async fromTicketDir(
    ticketDir: FileSystemDirectoryHandle,
  ): Promise<LiveSessionClient | null> {
    try {
      const fileHandle = await ticketDir.getFileHandle(
        "live_session.json",
      );
      const file = await fileHandle.getFile();
      const text = await file.text();
      const bundle = JSON.parse(text) as LiveSessionBundle;

      if (!bundle.token || !bundle.endpoint || !bundle.setup) {
        console.warn("Invalid live_session.json — missing required fields");
        return null;
      }

      return new LiveSessionClient(bundle, ticketDir);
    } catch {
      // File doesn't exist or isn't readable — not a live session.
      return null;
    }
  }

  /**
   * Check whether a ticket directory has an active live session bundle
   * (i.e., `live_session.json` exists but `live_result.json` does not).
   */
  static async hasActiveSession(
    ticketDir: FileSystemDirectoryHandle,
  ): Promise<boolean> {
    try {
      await ticketDir.getFileHandle("live_session.json");
    } catch {
      return false;
    }

    // If result already exists, the session is done.
    try {
      await ticketDir.getFileHandle("live_result.json");
      return false;
    } catch {
      return true;
    }
  }
}

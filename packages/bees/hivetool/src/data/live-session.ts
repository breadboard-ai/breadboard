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

    // Tool calls — Phase 4 will handle these.
    if (message.toolCall) {
      console.log(
        `[live:${this.taskId.slice(0, 8)}] Tool call:`,
        message.toolCall.functionCalls.map((fc) => fc.name).join(", "),
      );
    }
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

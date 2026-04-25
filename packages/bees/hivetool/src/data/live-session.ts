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
    interrupted?: boolean;
  };
  toolCall?: {
    functionCalls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  };
  toolCallCancellation?: {
    ids: string[];
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
  /** Whether the user is currently holding the Talk button. */
  readonly talking = new Signal.State<boolean>(false);

  /** The task ID this session belongs to. */
  readonly taskId: string;

  #ws: WebSocket | null = null;
  #bundle: LiveSessionBundle;
  #ticketDir: FileSystemDirectoryHandle;
  #audioInput: AudioInput | null = null;
  #audioOutput = new AudioOutput();
  #dispatchObserver: { disconnect(): void } | null = null;
  #contextObserver: { disconnect(): void } | null = null;

  // Transcript state (for real-time UI display only).
  #currentTurnParts: Array<{ text?: string }> = [];
  #processedContextFiles = new Set<string>();

  // Event channel state.
  #eventSeq = 0;
  #liveEventsDir: FileSystemDirectoryHandle | null = null;

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

    // Resolve the live_events/ directory for event writing.
    try {
      this.#liveEventsDir = await this.#ticketDir.getDirectoryHandle(
        "live_events",
        { create: true },
      );
    } catch (e) {
      console.error(
        `[live:${this.taskId.slice(0, 8)}] Failed to resolve live_events dir:`,
        e,
      );
    }

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
          void this.#writeEvent("sessionEnd", { status: "completed" });
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
          void this.#writeEvent("sessionEnd", {
            status: "failed",
            error: "WebSocket error",
          });
          this.#writeResult("failed", "WebSocket error");
        }
      });

      this.#ws = ws;
    });
  }

  /** Gracefully close the session. */
  disconnect(): void {
    this.#stopMic();
    this.#audioOutput.dispose();
    this.#dispatchObserver?.disconnect();
    this.#dispatchObserver = null;
    this.#contextObserver?.disconnect();
    this.#contextObserver = null;
    // Write sessionEnd event for the box.
    void this.#writeEvent("sessionEnd", { status: "completed" });
    if (!this.#ws) return;
    this.#ws.close(1000, "Client disconnect");
    this.#ws = null;
  }

  // ── Push-to-Talk ──

  /**
   * Begin talking — opens the audio gate so mic chunks flow to the API.
   *
   * On first call, starts the mic capture (getUserMedia). The mic stays
   * running across talk presses to avoid latency. Subsequent calls just
   * open the gate.
   */
  async beginTalking(): Promise<void> {
    if (this.status.get() !== "connected") return;

    // Lazily start the mic on the first Talk press.
    if (!this.#audioInput) {
      this.#audioInput = new AudioInput(
        // onChunk — forward PCM to the WebSocket.
        (base64Pcm: string) => {
          this.send({
            realtimeInput: {
              audio: {
                data: base64Pcm,
                mimeType: "audio/pcm;rate=16000",
              },
            },
          });
        },
        // onStreamEnd — send audioStreamEnd when the gate closes.
        () => {
          this.send({ realtimeInput: { audioStreamEnd: true } });
        },
      );
      await this.#audioInput.start();
    }

    this.#audioInput.openGate();
    this.talking.set(true);
  }

  /**
   * End talking — closes the audio gate.
   *
   * The mic stays running (no getUserMedia teardown). The audio gate
   * close triggers an `audioStreamEnd` message to the API, flushing
   * any cached audio in the server's VAD.
   */
  endTalking(): void {
    if (this.#audioInput && !this.#audioInput.gated) {
      this.#audioInput.closeGate();
    }
    this.talking.set(false);
  }

  /** Stop mic capture entirely and release the MediaStream. */
  #stopMic(): void {
    if (this.#audioInput) {
      this.#audioInput.stop();
      this.#audioInput = null;
    }
    this.talking.set(false);
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
      // Write sessionStart event with the config.
      void this.#writeEvent("sessionStart", {
        config: this.#bundle.setup,
      });
      // Start watching for context updates from the box.
      void this.#startContextObserver();
      return;
    }

    // Model content — text goes to transcript, audio goes to speakers.
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.text) {
          this.transcript.set(this.transcript.get() + part.text);
          this.#currentTurnParts.push({ text: part.text });
        }
        if (part.inlineData?.data) {
          this.#audioOutput.play(part.inlineData.data);
        }
      }
    }

    // Interruption — the user spoke over the model.
    // Flush the audio playback queue and discard the partial turn.
    if (message.serverContent?.interrupted) {
      console.log(
        `[live:${this.taskId.slice(0, 8)}] Model interrupted`,
      );
      this.#audioOutput.flush();
      this.#currentTurnParts = [];
    }

    // Turn complete — write event with accumulated model text parts.
    if (message.serverContent?.turnComplete) {
      const modelParts = this.#currentTurnParts
        .filter((p) => p.text)
        .map((p) => ({ text: p.text }));
      void this.#writeEvent("turnComplete", { parts: modelParts });
      this.#currentTurnParts = [];
      // Add a newline separator between turns in the transcript.
      const current = this.transcript.get();
      if (current && !current.endsWith("\n")) {
        this.transcript.set(current + "\n");
      }
    }

    // Audio transcription — the API nests these inside serverContent
    // when inputAudioTranscription / outputAudioTranscription are
    // enabled in the setup config.
    const serverContent = message.serverContent as
      | (Record<string, unknown> & typeof message.serverContent)
      | undefined;
    if (serverContent?.inputTranscription) {
      const { text } = serverContent.inputTranscription as { text?: string };
      if (text) {
        // Show user speech in the UI transcript.
        this.transcript.set(this.transcript.get() + `\n> ${text}\n`);
        void this.#writeEvent("inputTranscript", { text });
      }
    }
    if (serverContent?.outputTranscription) {
      const { text } = serverContent.outputTranscription as { text?: string };
      if (text) {
        void this.#writeEvent("outputTranscript", { text });
      }
    }

    // Usage metadata — forward to event channel.
    // The Live API can send usageMetadata alongside other fields
    // on the BidiGenerateContentServerMessage.
    const rawMessage = message as Record<string, unknown>;
    if (rawMessage.usageMetadata) {
      void this.#writeEvent("usageMetadata", {
        metadata: rawMessage.usageMetadata,
      });
    }

    // Tool calls — dispatch via filesystem and relay results.
    if (message.toolCall) {
      const calls = message.toolCall.functionCalls;
      console.log(
        `[live:${this.taskId.slice(0, 8)}] Tool call:`,
        calls.map((fc) => fc.name).join(", "),
      );
      // Write toolCall event.
      void this.#writeEvent("toolCall", {
        functionCalls: calls.map((fc) => ({
          name: fc.name,
          args: fc.args,
          id: fc.id,
        })),
      });
      // Fire-and-forget — dispatches concurrently while audio continues.
      void this.#dispatchToolCalls(calls);
    }

    // Tool call cancellation — the server cancelled pending calls
    // (typically because the user interrupted during tool execution).
    if (message.toolCallCancellation) {
      const ids = message.toolCallCancellation.ids;
      console.log(
        `[live:${this.taskId.slice(0, 8)}] Tool calls cancelled:`,
        ids.join(", "),
      );
      // Already-dispatched calls may still complete on the Python side.
      // We log the cancellation; best-effort is sufficient here.
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

    // Write toolResponse event for the box.
    void this.#writeEvent("toolResponse", {
      functionResponses: responses,
    });
  }

  // ── Context update observer ──

  /**
   * Watch `context_updates/` for files written by `LiveStream.send_context()`.
   *
   * When a new `.json` file appears, reads it and injects the parts as
   * `clientContent` on the WebSocket so the model receives context updates
   * from subagent completions.
   */
  async #startContextObserver(): Promise<void> {
    const tag = `[live:${this.taskId.slice(0, 8)}]`;

    let contextDir: FileSystemDirectoryHandle;
    try {
      contextDir = await this.#ticketDir.getDirectoryHandle(
        "context_updates",
      );
    } catch {
      console.log(`${tag} No context_updates/ directory — skipping observer`);
      return;
    }

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
          if (!filename.endsWith(".json")) continue;
          if (this.#processedContextFiles.has(filename)) continue;

          await this.#injectContextUpdate(contextDir, filename);
        }
      });

      observer.observe(contextDir, { recursive: false });
      this.#contextObserver = observer;
      console.log(`${tag} Context update observer started`);
    } else {
      // Fallback: poll-based.
      console.log(
        `${tag} FileSystemObserver unavailable — polling context_updates/`,
      );
      this.#pollContextUpdates(contextDir);
    }
  }

  /** Read and inject a single context update file. */
  async #injectContextUpdate(
    contextDir: FileSystemDirectoryHandle,
    filename: string,
  ): Promise<void> {
    if (this.#processedContextFiles.has(filename)) return;
    this.#processedContextFiles.add(filename);

    const tag = `[live:${this.taskId.slice(0, 8)}]`;

    try {
      const fh = await contextDir.getFileHandle(filename);
      const file = await fh.getFile();
      const text = await file.text();
      const data = JSON.parse(text) as { parts?: Array<{ text?: string }> };

      if (!data.parts || data.parts.length === 0) return;

      // Inject into the WebSocket as client content.
      this.send({
        clientContent: {
          turns: [{ role: "user", parts: data.parts }],
          turnComplete: true,
        },
      });

      // Add context marker to transcript.
      const summary = data.parts
        .map((p) => p.text || "")
        .join(" ")
        .slice(0, 100);
      this.transcript.set(
        this.transcript.get() + `\n[Context update: ${summary}]\n`,
      );

      // Write contextUpdate event for the box.
      void this.#writeEvent("contextUpdate", { parts: data.parts });

      console.log(`${tag} Context update injected: ${filename}`);
    } catch (e) {
      console.error(`${tag} Failed to read context update ${filename}:`, e);
    }
  }

  /** Poll-based fallback for context updates. */
  #pollContextUpdates(
    contextDir: FileSystemDirectoryHandle,
  ): void {
    const POLL_MS = 1000;

    const poll = async () => {
      while (this.status.get() === "connected") {
        try {
          for await (const [name] of contextDir.entries()) {
            if (!name.endsWith(".json")) continue;
            if (this.#processedContextFiles.has(name)) continue;
            await this.#injectContextUpdate(contextDir, name);
          }
        } catch {
          // Directory iteration error — ignore.
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    };

    void poll();
  }

  // ── Event channel writing ──

  /**
   * Write a structured event file to `live_events/` for the box to read.
   *
   * Files are named `{seq:06d}.json` with an incrementing sequence number.
   * The box's `LiveStream` polls this directory and translates events
   * into `EvalCollector`-compatible event dicts.
   */
  async #writeEvent(
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!this.#liveEventsDir) return;

    const seq = this.#eventSeq++;
    const filename = `${String(seq).padStart(6, "0")}.json`;
    const event = {
      type,
      ...data,
      timestamp: new Date().toISOString(),
    };

    try {
      const fh = await this.#liveEventsDir.getFileHandle(filename, {
        create: true,
      });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(event, null, 2) + "\n");
      await w.close();
    } catch (e) {
      console.error(
        `[live:${this.taskId.slice(0, 8)}] Failed to write event ${filename}:`,
        e,
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

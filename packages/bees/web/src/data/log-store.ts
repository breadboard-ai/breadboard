/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal-backed reactive store for log files.
 *
 * Resolves the `state/logs/` subdirectory via a shared StateAccess,
 * uses FileSystemObserver for live updates, and manages session grouping.
 */

import { Signal } from "signal-polyfill";
import type { StateAccess } from "./state-access.js";
import type {
  LogRunEntry,
  LogFileInfo,
  LogSession,
  MergedSessionView,
  SessionSegment,
  TurnGroup,
} from "./types.js";

export { LogStore };

class LogStore {
  constructor(private access: StateAccess) {}

  // ── Public reactive state (read via .get() in SignalWatcher renders) ──

  readonly sessions = new Signal.State<LogSession[]>([]);
  readonly selectedSessionId = new Signal.State<string | null>(null);
  readonly selectedView = new Signal.State<MergedSessionView | null>(null);
  readonly recentlyUpdatedSession = new Signal.State<{ id: string; at: number } | null>(null);

  // ── Private ──

  /** The ``state/logs/`` subdirectory. */
  #logsHandle: FileSystemDirectoryHandle | null = null;
  #observer: { disconnect(): void } | null = null;
  #cache = new Map<string, { data: LogRunEntry; lastModified: number }>();
  #activated = false;


  // ── Lifecycle ──

  /** Activate the store — resolves logs/ subdir, scans, observes. */
  async activate(): Promise<void> {
    if (this.#activated) return;
    if (this.access.accessState.get() !== "ready") return;

    const logsHandle = await this.access.getSubdirectory("logs");
    if (!logsHandle) {
      console.warn("Could not find logs/ subdirectory in state/");
      return;
    }

    this.#logsHandle = logsHandle;
    this.#activated = true;
    await this.scan();
    this.#startObserver();
  }

  /** Scan the logs subdirectory and rebuild sessions. */
  async scan(): Promise<void> {
    if (!this.#logsHandle) return;

    const filenames: string[] = [];
    for await (const [name, entry] of (
      this.#logsHandle as FileSystemDirectoryHandle & {
        entries(): AsyncIterable<[string, FileSystemHandle]>;
      }
    ).entries()) {
      if (entry.kind === "file" && name.endsWith(".log.json")) {
        filenames.push(name);
      }
    }

    let cacheUpdated = false;

    for (const filename of filenames) {
      const fileHandle = await this.#logsHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const cached = this.#cache.get(filename);

      if (!cached || cached.lastModified < file.lastModified) {
        const data = await this.#readFile(filename);
        if (!data) continue;
        const runEntry = (data as Array<Record<string, unknown>>).find(
          (e) => e.type === "run"
        ) as LogRunEntry | undefined;
        if (runEntry) {
          this.#cache.set(filename, { data: runEntry, lastModified: file.lastModified });
          cacheUpdated = true;
          if (this.#observer) {
            this.recentlyUpdatedSession.set({ id: runEntry.sessionId, at: Date.now() });
          }
        }
      }
    }

    // Prune deleted files.
    for (const key of this.#cache.keys()) {
      if (!filenames.includes(key)) {
        this.#cache.delete(key);
        cacheUpdated = true;
      }
    }

    if (cacheUpdated) {
      this.#rebuildSessions();
      const selectedId = this.selectedSessionId.get();
      if (selectedId) {
        this.selectedView.set(this.#computeMergedView(selectedId));
      }
    }
  }


  /** Select a session — computes the merged timeline view. */
  selectSession(sessionId: string): void {
    this.selectedSessionId.set(sessionId);
    this.selectedView.set(this.#computeMergedView(sessionId));
  }

  #computeMergedView(sessionId: string): MergedSessionView | null {
    // Gather all cached entries for this session.
    const entries: { filename: string; data: LogRunEntry }[] = [];
    for (const [filename, entry] of this.#cache) {
      if (entry.data.sessionId === sessionId) {
        entries.push({ filename, data: entry.data });
      }
    }

    if (entries.length === 0) return null;

    // Sort oldest-first.
    entries.sort((a, b) =>
      a.data.startedDateTime.localeCompare(b.data.startedDateTime)
    );

    const segments: SessionSegment[] = [];

    for (let i = 0; i < entries.length; i++) {
      const { filename, data } = entries[i];
      const ctx = data.context;
      const turns = data.turns;

      // Build per-turn groups from the structured turn boundaries.
      // Function response entries are input to the turn whose sendRequest
      // carries them, so scan backward to pull them into the right group.
      const turnGroups: TurnGroup[] = [];

      // First pass: compute adjusted starts.
      const starts: number[] = [];
      for (let t = 0; t < turns.length; t++) {
        let start = turns[t].contextLengthAtStart;
        // Pull in preceding function response entries.
        while (start > 0) {
          const prev = ctx[start - 1];
          if (
            prev?.role === "user" &&
            prev.parts?.some((p) => "functionResponse" in p)
          ) {
            start--;
          } else {
            break;
          }
        }
        // For the first turn, include the user prompt if the scan
        // didn't already pull in a function response.
        if (
          t === 0 &&
          start === turns[t].contextLengthAtStart &&
          start > 0
        ) {
          start--;
        }
        starts.push(start);
      }

      // Second pass: build groups using adjusted starts.
      for (let t = 0; t < turns.length; t++) {
        const start = starts[t];
        const end =
          t < turns.length - 1 ? starts[t + 1] : ctx.length;
        turnGroups.push({
          turnIndex: t,
          entries: ctx.slice(start, end),
          tokenMetadata: turns[t].tokenMetadata,
        });
      }

      segments.push({
        filename,
        segmentIndex: i,
        startedDateTime: data.startedDateTime,
        totalDurationMs: data.totalDurationMs,
        turnCount: data.turnCount,
        turnGroups,
        totalThoughts: data.totalThoughts,
        totalFunctionCalls: data.totalFunctionCalls,
        totalTokens: data.tokenMetadata?.totalTokens ?? 0,
        config: data.config,
        tokenMetadata: data.tokenMetadata,
      });
    }

    return {
      sessionId,
      segments,
      totalDurationMs: entries.reduce(
        (s, e) => s + e.data.totalDurationMs,
        0
      ),
      totalTurns: entries.reduce((s, e) => s + e.data.turnCount, 0),
      totalThoughts: entries.reduce(
        (s, e) => s + e.data.totalThoughts,
        0
      ),
      totalFunctionCalls: entries.reduce(
        (s, e) => s + e.data.totalFunctionCalls,
        0
      ),
      totalTokens: entries.reduce(
        (s, e) => s + (e.data.tokenMetadata?.totalTokens ?? 0),
        0
      ),
    };
  }

  /** Clean up the observer. */
  destroy(): void {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  // ── Private helpers ──

  #rebuildSessions(): void {
    const sessionMap = new Map<string, LogFileInfo[]>();
    for (const [filename, entry] of this.#cache) {
      const sid = entry.data.sessionId || "unknown";
      if (!sessionMap.has(sid)) sessionMap.set(sid, []);
      sessionMap.get(sid)!.push({
        filename,
        sessionId: sid,
        startedDateTime: entry.data.startedDateTime,
        totalDurationMs: entry.data.totalDurationMs,
        turnCount: entry.data.turnCount,
        totalThoughts: entry.data.totalThoughts,
        totalFunctionCalls: entry.data.totalFunctionCalls,
        totalTokens: entry.data.tokenMetadata?.totalTokens ?? 0,
      });
    }


    const sessions = Array.from(sessionMap.entries())
      .map(([sessionId, files]) => ({
        sessionId,
        files: files.sort((a, b) =>
          b.startedDateTime.localeCompare(a.startedDateTime)
        ),
      }))
      .sort((a, b) => {
        const aLatest = a.files.at(-1)?.startedDateTime ?? "";
        const bLatest = b.files.at(-1)?.startedDateTime ?? "";
        return bLatest.localeCompare(aLatest);
      });

    this.sessions.set(sessions);
  }

  async #readFile(filename: string): Promise<unknown[] | null> {
    if (!this.#logsHandle) return null;
    try {
      const fileHandle = await this.#logsHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  #startObserver(): void {
    if (!this.#logsHandle) return;
    if (!("FileSystemObserver" in globalThis)) return;
    try {
      // FileSystemObserver is experimental — access via dynamic typing.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (globalThis as any).FileSystemObserver;
      const observer = new Ctor((records: unknown[]) => {
        if (records.length > 0) this.scan();
      });
      observer.observe(this.#logsHandle, { recursive: false });
      this.#observer = observer;
    } catch (e) {
      console.warn("FileSystemObserver not available:", e);
    }
  }
}

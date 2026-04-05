/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal-backed reactive store for log files.
 *
 * Manages File System Access API handles, IndexedDB persistence,
 * FileSystemObserver for live updates, and session grouping.
 */

import { Signal } from "signal-polyfill";
import type {
  LogRunEntry,
  LogFileInfo,
  LogSession,
  MergedSessionView,
  SessionSegment,
  TurnGroup,
} from "./types.js";

export { LogStore };

type AccessState = "none" | "prompt" | "ready";

const DB_NAME = "bees-log-handles";
const STORE_NAME = "handles";
const HANDLE_KEY = "out-dir";

class LogStore {
  // ── Public reactive state (read via .get() in SignalWatcher renders) ──

  readonly accessState = new Signal.State<AccessState>("none");
  readonly sessions = new Signal.State<LogSession[]>([]);
  readonly selectedSessionId = new Signal.State<string | null>(null);
  readonly selectedView = new Signal.State<MergedSessionView | null>(null);

  // ── Private ──

  #handle: FileSystemDirectoryHandle | null = null;
  #observer: { disconnect(): void } | null = null;
  #cache = new Map<string, LogRunEntry>();

  // ── Lifecycle ──

  /** Try loading a previously saved directory handle from IDB. */
  async init(): Promise<void> {
    const handle = await this.#loadHandle();
    if (!handle) {
      this.accessState.set("none");
      return;
    }
    const granted = await this.#checkPermission(handle);
    if (!granted) {
      this.accessState.set("prompt");
      return;
    }
    this.#handle = handle;
    this.accessState.set("ready");
    await this.scan();
    this.#startObserver();
  }

  /** Prompt the user to pick a directory. */
  async openDirectory(): Promise<void> {
    try {
      const handle = await (
        window as unknown as {
          showDirectoryPicker(opts: {
            mode: string;
            id?: string;
          }): Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker({
        mode: "read",
        // Browser remembers the last directory chosen for this ID,
        // so re-picks open to the right place automatically.
        id: "bees-out-dir",
      });
      await this.#saveHandle(handle);
      this.#handle = handle;
      this.accessState.set("ready");
      await this.scan();
      this.#startObserver();
    } catch {
      // User cancelled the picker.
    }
  }

  /** Re-request permission on a previously saved handle. */
  async requestAccess(): Promise<void> {
    const handle = await this.#loadHandle();
    if (!handle) return;
    const granted = await this.#checkPermission(handle);
    if (!granted) return;
    this.#handle = handle;
    this.accessState.set("ready");
    await this.scan();
    this.#startObserver();
  }

  /** Scan the directory and rebuild sessions. */
  async scan(): Promise<void> {
    if (!this.#handle) return;

    const filenames: string[] = [];
    for await (const [name, entry] of (
      this.#handle as FileSystemDirectoryHandle & {
        entries(): AsyncIterable<[string, FileSystemHandle]>;
      }
    ).entries()) {
      if (entry.kind === "file" && name.endsWith(".log.json")) {
        filenames.push(name);
      }
    }

    // Read new files.
    const newFiles = filenames.filter((f) => !this.#cache.has(f));
    for (const filename of newFiles) {
      const data = await this.#readFile(filename);
      if (!data) continue;
      const runEntry = (data as Array<Record<string, unknown>>).find(
        (e) => e.type === "run"
      ) as LogRunEntry | undefined;
      if (runEntry) {
        this.#cache.set(filename, runEntry);
      }
    }

    // Prune deleted files.
    for (const key of this.#cache.keys()) {
      if (!filenames.includes(key)) {
        this.#cache.delete(key);
      }
    }

    this.#rebuildSessions();
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
      if (entry.sessionId === sessionId) {
        entries.push({ filename, data: entry });
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
      const sid = entry.sessionId || "unknown";
      if (!sessionMap.has(sid)) sessionMap.set(sid, []);
      sessionMap.get(sid)!.push({
        filename,
        sessionId: sid,
        startedDateTime: entry.startedDateTime,
        totalDurationMs: entry.totalDurationMs,
        turnCount: entry.turnCount,
        totalThoughts: entry.totalThoughts,
        totalFunctionCalls: entry.totalFunctionCalls,
        totalTokens: entry.tokenMetadata?.totalTokens ?? 0,
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
    if (!this.#handle) return null;
    try {
      const fileHandle = await this.#handle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  #startObserver(): void {
    if (!this.#handle) return;
    if (!("FileSystemObserver" in globalThis)) return;
    try {
      // FileSystemObserver is experimental — access via dynamic typing.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (globalThis as any).FileSystemObserver;
      const observer = new Ctor((records: unknown[]) => {
        if (records.length > 0) this.scan();
      });
      observer.observe(this.#handle, { recursive: false });
      this.#observer = observer;
    } catch (e) {
      console.warn("FileSystemObserver not available:", e);
    }
  }

  // ── IDB (no library dependency) ──

  #openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async #saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await this.#openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ id: HANDLE_KEY, handle });
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    });
  }

  async #loadHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const db = await this.#openDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const result = request.result as
            | { handle: FileSystemDirectoryHandle }
            | undefined;
          db.close();
          resolve(result?.handle ?? null);
        };
        request.onerror = () => {
          db.close();
          resolve(null);
        };
      });
    } catch {
      return null;
    }
  }

  async #checkPermission(
    handle: FileSystemDirectoryHandle
  ): Promise<boolean> {
    try {
      const perm = await (
        handle as FileSystemDirectoryHandle & {
          queryPermission(opts: { mode: string }): Promise<string>;
          requestPermission(opts: { mode: string }): Promise<string>;
        }
      ).queryPermission({ mode: "read" });
      if (perm === "granted") return true;

      const req = await (
        handle as FileSystemDirectoryHandle & {
          requestPermission(opts: { mode: string }): Promise<string>;
        }
      ).requestPermission({ mode: "read" });
      return req === "granted";
    } catch {
      return false;
    }
  }
}

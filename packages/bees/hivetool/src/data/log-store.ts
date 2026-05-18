/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal-backed reactive store for session files grouped by parent entities.
 *
 * Resolves the entity directory (`agents/`) via a shared StateAccess,
 * uses FileSystemObserver for live updates, and manages session grouping.
 */

import { Signal } from "signal-polyfill";
import type { StateAccess } from "./state-access.js";
import type {
  AgentGroupedSessions,
  SidebarSessionInfo,
} from "./types.js";

export { LogStore };

interface LineageJson {
  forked_from?: { session: string; at_turn: number };
  forked_to?: { session: string; at_turn: number };
}

class LogStore {
  constructor(private access: StateAccess) {}

  // ── Public reactive state (read via .get() in render methods) ──

  readonly agentGroups = new Signal.State<AgentGroupedSessions[]>([]);
  readonly selectedSessionId = new Signal.State<string | null>(null);
  readonly recentlyUpdatedSession = new Signal.State<{ id: string; at: number } | null>(null);

  /** Resolved active agent for the currently selected session. */
  readonly selectedAgentId = new Signal.Computed(() => {
    const selectedSid = this.selectedSessionId.get();
    if (!selectedSid) return null;
    for (const group of this.agentGroups.get()) {
      if (group.agentId === selectedSid) return group.agentId; // selected by agent ID fallback
      if (group.sessions.some((s) => s.sessionId === selectedSid)) {
        return group.agentId;
      }
    }
    return null;
  });

  // ── Private ──

  /** Handle for the primary entity directory (agents/). */
  #entityHandle: FileSystemDirectoryHandle | null = null;
  #observer: { disconnect(): void } | null = null;
  #activated = false;

  // ── Lifecycle ──

  /**
   * Activate the store — resolves the entity directory, scans, observes.
   */
  async activate(): Promise<void> {
    if (this.#activated) return;
    if (this.access.accessState.get() !== "ready") return;

    const agentsHandle = await this.access.getSubdirectory("agents");
    if (!agentsHandle) {
      console.warn("Could not find agents/ subdirectory in hive/");
      return;
    }
    this.#entityHandle = agentsHandle;

    this.#activated = true;
    await this.scan();
    this.#startObserver();
  }

  /** Scan the entity directory, load entity metadata and their sessions. */
  async scan(): Promise<void> {
    if (!this.#entityHandle) return;

    const groups: AgentGroupedSessions[] = [];

    try {
      for await (const [name, entry] of (
        this.#entityHandle as FileSystemDirectoryHandle & {
          entries(): AsyncIterable<[string, FileSystemHandle]>;
        }
      ).entries()) {
        if (entry.kind !== "directory") continue;

        const entityDir = await this.#entityHandle.getDirectoryHandle(name);
        const metadata = await this.#readJson(entityDir, "metadata.json") as Record<string, unknown> | null;
        if (!metadata) continue;
        if (metadata.kind === "coordination") continue;

        const title = (metadata.title as string) || `Agent ${name.slice(0, 8)}`;
        const status = (metadata.status as string) || "unknown";
        const activeSessionId = (metadata.active_session as string) || null;

        const sessions: SidebarSessionInfo[] = [];
        try {
          const sessionsDir = await entityDir.getDirectoryHandle("sessions");
          for await (const [sName, sEntry] of (
            sessionsDir as FileSystemDirectoryHandle & {
              entries(): AsyncIterable<[string, FileSystemHandle]>;
            }
          ).entries()) {
            if (sEntry.kind !== "directory") continue;

            const sessionDir = await sessionsDir.getDirectoryHandle(sName);
            const sStatus = (await this.#readText(sessionDir, "status"))?.trim() ?? "unknown";
            const lineage = await this.#readJson(sessionDir, "lineage.json") as LineageJson | null;

            let eventCount = 0;
            let lastModified = 0;

            try {
              const eventsHandle = await sessionDir.getFileHandle("events.jsonl");
              const eventsFile = await eventsHandle.getFile();
              lastModified = eventsFile.lastModified;
              const eventsText = await eventsFile.text();
              if (eventsText) {
                eventCount = eventsText.split("\n").filter(Boolean).length;
              }
            } catch {
              try {
                const statusHandle = await sessionDir.getFileHandle("status");
                const statusFile = await statusHandle.getFile();
                lastModified = statusFile.lastModified;
              } catch {
                // Ignore missing status file
              }
            }

            sessions.push({
              sessionId: sName,
              status: sStatus,
              eventCount,
              lastModified,
              isForked: !!lineage?.forked_from,
              forkedFrom: lineage?.forked_from,
              forkedTo: lineage?.forked_to,
            });
          }
        } catch {
          // No sessions directory yet
        }

        // Sort sessions by lastModified descending (most recently updated first)
        sessions.sort((a, b) => b.lastModified - a.lastModified);

        groups.push({
          agentId: name,
          title,
          status,
          activeSessionId,
          sessions,
        });
      }
    } catch (e) {
      console.error("Failed to scan entity sessions:", e);
    }

    // Sort taskGroups by their most recently updated session's lastModified, descending
    groups.sort((a, b) => {
      const aMax = a.sessions.length > 0 ? Math.max(...a.sessions.map((s) => s.lastModified)) : 0;
      const bMax = b.sessions.length > 0 ? Math.max(...b.sessions.map((s) => s.lastModified)) : 0;
      return bMax - aMax;
    });

    this.agentGroups.set(groups);
  }

  /** Select a session ID. */
  selectSession(sessionId: string): void {
    this.selectedSessionId.set(sessionId);
  }

  /** Tear down all state so the store can be re-activated against a new hive. */
  reset(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#entityHandle = null;
    this.#activated = false;
    this.agentGroups.set([]);
    this.selectedSessionId.set(null);
    this.recentlyUpdatedSession.set(null);
  }

  /** Clean up the observer. */
  destroy(): void {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  // ── Private helpers ──

  async #readJson(
    dir: FileSystemDirectoryHandle,
    filename: string
  ): Promise<unknown | null> {
    try {
      const fileHandle = await dir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async #readText(
    dir: FileSystemDirectoryHandle,
    filename: string
  ): Promise<string | null> {
    try {
      const fileHandle = await dir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  #startObserver(): void {
    if (!this.#entityHandle) return;
    if (!("FileSystemObserver" in globalThis)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (globalThis as any).FileSystemObserver;
      const observer = new Ctor((records: unknown[]) => {
        if (records.length > 0) {
          this.scan();
          
          // Fire recentlyUpdatedSession animation trigger if we can resolve a sessionId
          interface FileSystemChangeRecord {
            relativePathComponents?: string[];
            relativePath?: string;
          }
          for (const record of records) {
            const r = record as FileSystemChangeRecord;
            let segments: string[] = [];
            if (Array.isArray(r.relativePathComponents)) {
              segments = r.relativePathComponents;
            } else if (typeof r.relativePath === "string") {
              segments = r.relativePath.split("/").filter(Boolean);
            }
            // [entityId, "sessions", sessionId, ...]
            if (segments.length >= 3 && segments[1] === "sessions") {
              this.recentlyUpdatedSession.set({ id: segments[2], at: Date.now() });
              break;
            }
          }
        }
      });
      observer.observe(this.#entityHandle, { recursive: true });
      this.#observer = observer;
    } catch (e) {
      console.warn("FileSystemObserver not available:", e);
    }
  }
}

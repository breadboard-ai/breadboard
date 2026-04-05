/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal-backed reactive store for ticket directories.
 *
 * Reads ticket data from `state/tickets/{uuid}/` directories,
 * combining `metadata.json` and `objective.md` into TicketData objects.
 * Uses FileSystemObserver for live updates.
 */

import { Signal } from "signal-polyfill";
import type { StateAccess } from "./state-access.js";
import type { TicketData } from "./types.js";

export { TicketStore };
export type { FileTreeNode };

/** A node in a ticket's directory tree. */
interface FileTreeNode {
  name: string;
  kind: "file" | "directory";
  children?: FileTreeNode[];
}

class TicketStore {
  constructor(private access: StateAccess) {}

  readonly tickets = new Signal.State<TicketData[]>([]);
  readonly selectedTicketId = new Signal.State<string | null>(null);
  readonly selectedTicket = new Signal.Computed(() => {
    const id = this.selectedTicketId.get();
    if (!id) return null;
    return this.tickets.get().find((t) => t.id === id) ?? null;
  });

  #ticketsHandle: FileSystemDirectoryHandle | null = null;
  #observer: { disconnect(): void } | null = null;
  #activated = false;

  /** Activate the store — resolves tickets/ subdir, scans, observes. */
  async activate(): Promise<void> {
    if (this.#activated) return;
    if (this.access.accessState.get() !== "ready") return;

    const ticketsHandle = await this.access.getSubdirectory("tickets");
    if (!ticketsHandle) {
      console.warn("Could not find tickets/ subdirectory in state/");
      return;
    }

    this.#ticketsHandle = ticketsHandle;
    this.#activated = true;
    await this.scan();
    this.#startObserver();
  }

  /** Scan the tickets subdirectory and rebuild the ticket list. */
  async scan(): Promise<void> {
    if (!this.#ticketsHandle) return;

    const entries: TicketData[] = [];

    for await (const [name, entry] of (
      this.#ticketsHandle as FileSystemDirectoryHandle & {
        entries(): AsyncIterable<[string, FileSystemHandle]>;
      }
    ).entries()) {
      if (entry.kind !== "directory") continue;

      const ticketDir = await this.#ticketsHandle!.getDirectoryHandle(name);
      const metadata = await this.#readJson(ticketDir, "metadata.json");
      if (!metadata) continue;

      const objective = await this.#readText(ticketDir, "objective.md");

      entries.push({
        id: name,
        objective: objective ?? "",
        ...(metadata as Omit<TicketData, "id" | "objective">),
      } as TicketData);
    }

    // Sort newest first.
    entries.sort((a, b) => {
      const aDate = a.created_at ?? "";
      const bDate = b.created_at ?? "";
      return bDate.localeCompare(aDate);
    });

    this.tickets.set(entries);
  }

  selectTicket(id: string): void {
    this.selectedTicketId.set(id);
  }

  /** Clean up the observer. */
  destroy(): void {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  // ── File tree ──

  /** Read the directory tree for a ticket's filesystem. */
  async readTree(ticketId: string): Promise<FileTreeNode[]> {
    if (!this.#ticketsHandle) return [];
    try {
      const ticketDir = await this.#ticketsHandle.getDirectoryHandle(ticketId);
      const fsDir = await ticketDir.getDirectoryHandle("filesystem");
      return this.#scanDir(fsDir);
    } catch {
      return [];
    }
  }

  /** Read the text content of a file within a ticket's filesystem. */
  async readFileContent(
    ticketId: string,
    path: string[]
  ): Promise<string | null> {
    if (!this.#ticketsHandle) return null;
    try {
      const ticketDir = await this.#ticketsHandle.getDirectoryHandle(ticketId);
      let dir = await ticketDir.getDirectoryHandle("filesystem");
      // Walk to the parent directory.
      for (const segment of path.slice(0, -1)) {
        dir = await dir.getDirectoryHandle(segment);
      }
      const filename = path.at(-1);
      if (!filename) return null;
      const fileHandle = await dir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  async #scanDir(dir: FileSystemDirectoryHandle): Promise<FileTreeNode[]> {
    const nodes: FileTreeNode[] = [];
    for await (const [name, entry] of (
      dir as FileSystemDirectoryHandle & {
        entries(): AsyncIterable<[string, FileSystemHandle]>;
      }
    ).entries()) {
      if (entry.kind === "directory") {
        const subDir = await dir.getDirectoryHandle(name);
        const children = await this.#scanDir(subDir);
        nodes.push({ name, kind: "directory", children });
      } else {
        nodes.push({ name, kind: "file" });
      }
    }
    // Directories first, then files, alphabetically within each group.
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return nodes;
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
    if (!this.#ticketsHandle) return;
    if (!("FileSystemObserver" in globalThis)) return;
    try {
      // FileSystemObserver is experimental — access via dynamic typing.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (globalThis as any).FileSystemObserver;
      const observer = new Ctor((records: unknown[]) => {
        if (records.length > 0) this.scan();
      });
      // Recursive — ticket subdirectories may be added/modified.
      observer.observe(this.#ticketsHandle, { recursive: true });
      this.#observer = observer;
    } catch (e) {
      console.warn("FileSystemObserver not available:", e);
    }
  }
}

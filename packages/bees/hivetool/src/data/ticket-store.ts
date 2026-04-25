/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal-backed reactive store for ticket directories.
 *
 * Reads ticket data from `hive/tickets/{uuid}/` directories,
 * combining `metadata.json` and `objective.md` into TicketData objects.
 * Uses FileSystemObserver for live updates.
 */

import { Signal } from "signal-polyfill";
import type { StateAccess } from "./state-access.js";
import type { TicketData } from "./types.js";
import { LiveSessionClient } from "./live-session.js";

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
  readonly recentlyUpdatedTicket = new Signal.State<{ id: string; at: number } | null>(null);
  readonly selectedTicket = new Signal.Computed(() => {
    const id = this.selectedTicketId.get();
    if (!id) return null;
    return this.tickets.get().find((t) => t.id === id) ?? null;
  });

  /** Set of ticket IDs with active (unresolved) live session bundles. */
  readonly activeLiveSessions = new Signal.State<Set<string>>(new Set());

  /**
   * The single active live session connection.
   *
   * At most one WebSocket is open at a time.  The connection survives
   * ticket selection changes — switching tickets in the sidebar does
   * not tear it down.
   */
  readonly activeConnection = new Signal.State<LiveSessionClient | null>(null);

  #ticketsHandle: FileSystemDirectoryHandle | null = null;
  #observer: { disconnect(): void } | null = null;
  #activated = false;

  /** Activate the store — resolves tickets/ subdir, scans, observes. */
  async activate(): Promise<void> {
    if (this.#activated) return;
    if (this.access.accessState.get() !== "ready") return;

    const ticketsHandle = await this.access.getSubdirectory("tickets");
    if (!ticketsHandle) {
      console.warn("Could not find tickets/ subdirectory in hive/");
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
      const chatLog = await this.#readJson(ticketDir, "chat_log.json");

      entries.push({
        id: name,
        objective: objective ?? "",
        ...(metadata as Omit<TicketData, "id" | "objective">),
        ...(chatLog ? { chat_history: chatLog as TicketData["chat_history"] } : {}),
      } as TicketData);
    }

    // Sort newest first.
    entries.sort((a, b) => {
      const aDate = a.created_at ?? "";
      const bDate = b.created_at ?? "";
      return bDate.localeCompare(aDate);
    });

    this.tickets.set(entries);

    // Detect active live sessions.
    await this.#detectLiveSessions(entries);
  }

  selectTicket(id: string): void {
    this.selectedTicketId.set(id);
  }

  /** Tear down all state so the store can be re-activated against a new hive. */
  reset(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#ticketsHandle = null;
    this.#activated = false;
    this.tickets.set([]);
    this.selectedTicketId.set(null);
    this.recentlyUpdatedTicket.set(null);
    this.activeLiveSessions.set(new Set());
    this.disconnectLiveSession();
  }

  /** Clean up the observer. */
  destroy(): void {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  /**
   * Create a new task by writing files to `tickets/{uuid}/`.
   *
   * Writes `objective.md` and `metadata.json` — the minimal structure
   * the scheduler expects. The box's file watcher will detect the new
   * directory and trigger the scheduler automatically.
   *
   * Returns the generated task ID (UUID).
   */
  async createTask(opts: {
    objective: string;
    playbook_id?: string;
    title?: string;
    functions?: string[];
    skills?: string[];
    tags?: string[];
    tasks?: string[];
    model?: string;
    runner?: "generate" | "live";
    context?: string;
    watch_events?: Array<{ type: string }>;
  }): Promise<string> {
    if (!this.#ticketsHandle) throw new Error("Ticket store not activated");

    const taskId = crypto.randomUUID();
    const taskDir = await this.#ticketsHandle.getDirectoryHandle(taskId, {
      create: true,
    });

    // Write objective.md
    const objectiveHandle = await taskDir.getFileHandle("objective.md", {
      create: true,
    });
    const objectiveWritable = await objectiveHandle.createWritable();
    await objectiveWritable.write(opts.objective);
    await objectiveWritable.close();

    // Build metadata — mirror Python's TaskStore.create() shape.
    const metadata: Record<string, unknown> = {
      status: "available",
      created_at: new Date().toISOString(),
      kind: "work",
    };
    if (opts.playbook_id) metadata.playbook_id = opts.playbook_id;
    if (opts.playbook_id) metadata.playbook_run_id = crypto.randomUUID();
    if (opts.title) metadata.title = opts.title;
    if (opts.functions?.length) metadata.functions = opts.functions;
    if (opts.skills?.length) metadata.skills = opts.skills;
    if (opts.tags?.length) metadata.tags = opts.tags;
    if (opts.tasks?.length) metadata.tasks = opts.tasks;
    if (opts.model) metadata.model = opts.model;
    if (opts.runner) metadata.runner = opts.runner;
    if (opts.context) metadata.context = opts.context;
    if (opts.watch_events?.length) metadata.watch_events = opts.watch_events;

    // Write metadata.json
    const metadataHandle = await taskDir.getFileHandle("metadata.json", {
      create: true,
    });
    const metadataWritable = await metadataHandle.createWritable();
    await metadataWritable.write(
      JSON.stringify(metadata, null, 2) + "\n"
    );
    await metadataWritable.close();

    return taskId;
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

  /**
   * Get the `FileSystemDirectoryHandle` for a ticket.
   *
   * Used by `LiveSessionClient.fromTicketDir()` to read the session bundle.
   */
  async getTicketDirHandle(
    ticketId: string,
  ): Promise<FileSystemDirectoryHandle | null> {
    if (!this.#ticketsHandle) return null;
    try {
      return await this.#ticketsHandle.getDirectoryHandle(ticketId);
    } catch {
      return null;
    }
  }

  // ── Live session connection management ──

  /**
   * Connect to a live session for the given ticket.
   *
   * Disconnects any existing session first (one connection at a time).
   * Creates a `LiveSessionClient`, opens the WebSocket, and stores
   * the client in `activeConnection`.
   */
  async connectLiveSession(ticketId: string): Promise<void> {
    // Already connected to this ticket — nothing to do.
    const current = this.activeConnection.get();
    if (current?.taskId === ticketId) return;

    // Disconnect any existing session.
    if (current) {
      current.disconnect();
      this.activeConnection.set(null);
    }

    const dirHandle = await this.getTicketDirHandle(ticketId);
    if (!dirHandle) {
      console.error("Could not get directory handle for ticket", ticketId);
      return;
    }

    const client = await LiveSessionClient.fromTicketDir(dirHandle);
    if (!client) {
      console.error("Could not create LiveSessionClient for", ticketId);
      return;
    }

    this.activeConnection.set(client);

    try {
      await client.connect();
    } catch (e) {
      console.error("Live session connection failed:", e);
      this.activeConnection.set(null);
    }
  }

  /** Disconnect the active live session. */
  disconnectLiveSession(): void {
    const client = this.activeConnection.get();
    if (client) {
      client.disconnect();
      this.activeConnection.set(null);
    }
  }




  // ── Live session detection ──

  async #detectLiveSessions(tickets: TicketData[]): Promise<void> {
    if (!this.#ticketsHandle) return;

    const liveTickets = tickets.filter((t) => t.runner === "live");
    if (liveTickets.length === 0) {
      if (this.activeLiveSessions.get().size > 0) {
        this.activeLiveSessions.set(new Set());
      }
      return;
    }

    const activeIds = new Set<string>();
    for (const ticket of liveTickets) {
      try {
        const ticketDir = await this.#ticketsHandle.getDirectoryHandle(
          ticket.id,
        );
        if (await LiveSessionClient.hasActiveSession(ticketDir)) {
          activeIds.add(ticket.id);
        }
      } catch {
        // Directory not accessible — skip.
      }
    }

    // Only update signal if the set changed.
    const current = this.activeLiveSessions.get();
    if (
      activeIds.size !== current.size ||
      ![...activeIds].every((id) => current.has(id))
    ) {
      this.activeLiveSessions.set(activeIds);
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
        if (records.length > 0) {
          this.scan();
          interface FileSystemChangeRecord {
            relativePathComponents?: string[];
            relativePath?: string;
          }
          for (const record of records) {
            const r = record as FileSystemChangeRecord;
            const pathSegments = r.relativePathComponents;
            const relativePath = r.relativePath;
            let ticketId: string | null = null;
            
            if (Array.isArray(pathSegments) && pathSegments.length > 0) {
              ticketId = pathSegments[0];
            } else if (typeof relativePath === "string") {
              const segments = relativePath.split("/");
              if (segments.length > 0) {
                ticketId = segments[0];
              }
            }

            if (ticketId) {
              this.recentlyUpdatedTicket.set({ id: ticketId, at: Date.now() });
              break;
            }
          }
        }
      });
      // Recursive — ticket subdirectories may be added/modified.
      observer.observe(this.#ticketsHandle, { recursive: true });
      this.#observer = observer;
    } catch (e) {
      console.warn("FileSystemObserver not available:", e);
    }
  }
}

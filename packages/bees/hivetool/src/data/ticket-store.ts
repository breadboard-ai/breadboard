/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal-backed reactive store for entity directories.
 *
 * Reads entity data from `hive/agents/{uuid}/` (Project Swarm layout),
 * combining `metadata.json` and `objective.md` into TicketData objects
 * for the UI. Uses FileSystemObserver for live updates.
 */

import { Signal } from "signal-polyfill";
import type { StateAccess } from "./state-access.js";
import type { TicketData, TaskItemData, SurfaceManifest } from "./types.js";
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

  /**
   * Fires when a file inside a ticket's `filesystem/` directory changes.
   *
   * Consumers (e.g. surface-pane) use this to push `filechange` events
   * to sandboxed bundle iframes via the opalSDK EventTarget bridge.
   */
  readonly filesystemChange = new Signal.State<{
    ticketId: string;
    paths: string[];
    at: number;
  } | null>(null);
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

  /** Handle for agents/ directory. */
  #agentsHandle: FileSystemDirectoryHandle | null = null;
  /** Handle for tasks/ directory. */
  #tasksHandle: FileSystemDirectoryHandle | null = null;
  #observer: { disconnect(): void } | null = null;
  #activated = false;

  /** Cached tasks indexed by assignee agent ID. */
  readonly #tasksByAssignee = new Signal.State<Map<string, TaskItemData[]>>(
    new Map(),
  );

  /** Activate the store — resolves entity directories, scans, observes. */
  async activate(): Promise<void> {
    if (this.#activated) return;
    if (this.access.accessState.get() !== "ready") return;

    const agentsHandle = await this.access.getSubdirectory("agents");
    if (!agentsHandle) {
      console.warn("Could not find agents/ subdirectory in hive/");
      return;
    }

    this.#agentsHandle = agentsHandle;
    this.#tasksHandle = await this.access.getSubdirectory("tasks");
    this.#activated = true;
    await this.scan();
    this.#startObserver();
  }

  /** Scan entity directories and rebuild the ticket list. */
  async scan(): Promise<void> {
    if (!this.#agentsHandle) return;

    const entries = await this.#scanAgentsDir();

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



  /** Scan `agents/` + `tasks/` — the Project Swarm layout.
   *
   * Reads agent metadata from `agents/{uuid}/metadata.json` and task
   * records from `tasks/{uuid}.json`. Adapts agent+task data into the
   * existing `TicketData` shape for backward compatibility with the UI.
   */
  async #scanAgentsDir(): Promise<TicketData[]> {
    if (!this.#agentsHandle) return [];

    // Load all tasks into a lookup by assignee.
    const tasksByAssignee = new Map<string, TaskItemData[]>();
    if (this.#tasksHandle) {
      for await (const [name, entry] of (
        this.#tasksHandle as FileSystemDirectoryHandle & {
          entries(): AsyncIterable<[string, FileSystemHandle]>;
        }
      ).entries()) {
        if (entry.kind !== "file" || !name.endsWith(".json")) continue;
        try {
          const fileHandle = await this.#tasksHandle!.getFileHandle(name);
          const file = await fileHandle.getFile();
          const text = await file.text();
          const taskData = JSON.parse(text) as TaskItemData;
          if (taskData.assignee) {
            const list = tasksByAssignee.get(taskData.assignee) ?? [];
            list.push(taskData);
            tasksByAssignee.set(taskData.assignee, list);
          }
        } catch {
          // Skip malformed task files.
        }
      }
    }

    // Cache task data for getTasksForAgent().
    this.#tasksByAssignee.set(tasksByAssignee);

    const entries: TicketData[] = [];

    for await (const [name, entry] of (
      this.#agentsHandle as FileSystemDirectoryHandle & {
        entries(): AsyncIterable<[string, FileSystemHandle]>;
      }
    ).entries()) {
      if (entry.kind !== "directory") continue;

      const agentDir = await this.#agentsHandle!.getDirectoryHandle(name);
      const metadata = await this.#readJson(agentDir, "metadata.json");
      if (!metadata) continue;

      // The full agent metadata — includes execution-state bridge fields.
      const md = metadata as Record<string, unknown>;
      const agentTasks = tasksByAssignee.get(name) ?? [];
      const chatLog = await this.#readJson(agentDir, "chat_log.json");

      // Read objective.md from the agent directory.
      const objectiveMd = await this.#readText(agentDir, "objective.md");

      // Pick the first task's objective, then objective.md, then type label.
      const primaryTask = agentTasks[0];
      const objective =
        primaryTask?.objective ?? objectiveMd ?? `Agent: ${md.type}`;

      // Shim agent data into TicketData shape — map every field the
      // detail/pane components read.
      entries.push({
        id: name,
        objective,
        status: md.status as string,
        created_at: md.created_at as string | undefined,
        completed_at: md.completed_at as string | undefined,
        slug: md.slug as string | undefined,
        model: md.model as string | undefined,
        runner: md.runner as TicketData["runner"],
        voice: md.voice as string | undefined,
        functions: md.functions as string[] | undefined,
        skills: md.skills as string[] | undefined,
        tags: md.tags as string[] | undefined,
        playbook_id: md.playbook_id as string | undefined,
        playbook_run_id: md.playbook_run_id as string | undefined,
        parent_task_id: md.parent_id as string | undefined,
        owning_task_id: md.workspace_root_id as string | undefined,
        active_session: md.active_session as string | undefined,
        title: (md.title as string | undefined) ?? primaryTask?.title,
        outcome: (md.outcome as string | undefined) ?? primaryTask?.outcome,
        kind: (md.kind as string | undefined) ?? primaryTask?.kind,
        // Execution-state bridge fields.
        error: md.error as string | undefined,
        suspend_event: md.suspend_event as Record<string, unknown> | undefined,
        context: md.context as string | undefined,
        turns: md.turns as number | undefined,
        thoughts: md.thoughts as number | undefined,
        assignee: md.assignee as string | undefined,
        depends_on: md.depends_on as string[] | undefined,
        options: md.options as Record<string, unknown> | undefined,
        files: md.files as TicketData["files"],
        watch_events: md.watch_events as TicketData["watch_events"],
        outcome_content: md.outcome_content as Record<string, unknown> | undefined,
        ...(chatLog ? { chat_history: chatLog as TicketData["chat_history"] } : {}),
      } as TicketData);
    }

    return entries;
  }

  /**
   * Get task records assigned to a given agent.
   *
   * Returns tasks from the cached `tasks/` scan. The data refreshes
   * on every `scan()` cycle, so it stays current with disk changes.
   */
  getTasksForAgent(agentId: string): TaskItemData[] {
    return this.#tasksByAssignee.get().get(agentId) ?? [];
  }

  selectTicket(id: string | null): void {
    this.selectedTicketId.set(id);
  }

  /** Tear down all state so the store can be re-activated against a new hive. */
  reset(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#agentsHandle = null;
    this.#tasksHandle = null;
    this.#activated = false;
    this.tickets.set([]);
    this.selectedTicketId.set(null);
    this.recentlyUpdatedTicket.set(null);
    this.filesystemChange.set(null);
    this.activeLiveSessions.set(new Set());
    this.disconnectLiveSession();
  }

  /** Clean up the observer. */
  destroy(): void {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  /**
   * Create a new agent.
   *
   * Creates:
   *   - `agents/{uuid}/metadata.json` and `agents/{uuid}/objective.md`
   *   - `tasks/{uuid}.json`
   *
   * The box's file watcher detects the new directory and triggers the
   * scheduler automatically.
   *
   * Returns the generated entity ID (UUID).
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
    runner?: "generate" | "live" | "direct_model";
    context?: string;
    watch_events?: Array<{ type: string }>;
    options?: Record<string, unknown>;
  }): Promise<string> {
    return this.#createTaskSwarm(opts);
  }

  /** Create agent + task in the Project Swarm layout. */
  async #createTaskSwarm(opts: {
    objective: string;
    playbook_id?: string;
    title?: string;
    functions?: string[];
    skills?: string[];
    tags?: string[];
    tasks?: string[];
    model?: string;
    runner?: "generate" | "live" | "direct_model";
    context?: string;
    watch_events?: Array<{ type: string }>;
    options?: Record<string, unknown>;
  }): Promise<string> {
    if (!this.#agentsHandle) throw new Error("Agents handle not available");

    const agentId = crypto.randomUUID();
    const agentDir = await this.#agentsHandle.getDirectoryHandle(agentId, {
      create: true,
    });

    // Determine if system.* functions are present.
    const hasSystem = opts.functions?.some((f) => f.startsWith("system.")) ?? false;

    // Write objective.md
    const objectiveHandle = await agentDir.getFileHandle("objective.md", {
      create: true,
    });
    const objectiveWritable = await objectiveHandle.createWritable();
    await objectiveWritable.write(opts.objective);
    await objectiveWritable.close();

    // Build agent metadata — mirrors UnifiedAgentStore._create_swarm().
    const metadata: Record<string, unknown> = {
      type: opts.playbook_id ?? "",
      slug: "",
      status: "available",
      finite: hasSystem,
      runner: opts.runner ?? "generate",
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
    if (opts.context) metadata.context = opts.context;
    if (opts.watch_events?.length) metadata.watch_events = opts.watch_events;
    if (opts.options && Object.keys(opts.options).length) metadata.options = opts.options;

    // Write agent metadata.json
    const metadataHandle = await agentDir.getFileHandle("metadata.json", {
      create: true,
    });
    const metadataWritable = await metadataHandle.createWritable();
    await metadataWritable.write(
      JSON.stringify(metadata, null, 2) + "\n"
    );
    await metadataWritable.close();

    // Write lightweight task record to tasks/.
    if (this.#tasksHandle) {
      const taskId = crypto.randomUUID();
      const taskRecord: Record<string, unknown> = {
        id: taskId,
        objective: opts.objective,
        status: "available",
        assignee: agentId,
        kind: "work",
        created_at: new Date().toISOString(),
      };
      if (opts.title) taskRecord.title = opts.title;
      if (opts.context) taskRecord.context = opts.context;
      if (opts.tags?.length) taskRecord.tags = opts.tags;

      const taskFileHandle = await this.#tasksHandle.getFileHandle(
        `${taskId}.json`,
        { create: true },
      );
      const taskWritable = await taskFileHandle.createWritable();
      await taskWritable.write(
        JSON.stringify(taskRecord, null, 2) + "\n"
      );
      await taskWritable.close();
    }

    return agentId;
  }



  // ── File tree ──

  /** Read the directory tree for a ticket's filesystem. */
  async readTree(ticketId: string): Promise<FileTreeNode[]> {
    try {
      const entityDir = await this.#getEntityDirHandle(ticketId);
      if (!entityDir) return [];
      const ticket = this.tickets.get().find((t) => t.id === ticketId);
      let fsDir: FileSystemDirectoryHandle;
      if (ticket && ticket.active_session) {
        const sessionsDir = await entityDir.getDirectoryHandle("sessions");
        const sessionDir = await sessionsDir.getDirectoryHandle(ticket.active_session);
        fsDir = await sessionDir.getDirectoryHandle("workspace");
      } else {
        fsDir = await entityDir.getDirectoryHandle("filesystem");
      }
      return this.#scanDir(fsDir);
    } catch {
      return [];
    }
  }

  /** Read the text content (or base64 data URL for images) of a file within a ticket's filesystem. */
  async readFileContent(
    ticketId: string,
    path: string[]
  ): Promise<string | null> {
    try {
      const entityDir = await this.#getEntityDirHandle(ticketId);
      if (!entityDir) return null;
      const ticket = this.tickets.get().find((t) => t.id === ticketId);
      let dir: FileSystemDirectoryHandle;
      if (ticket && ticket.active_session) {
        const sessionsDir = await entityDir.getDirectoryHandle("sessions");
        const sessionDir = await sessionsDir.getDirectoryHandle(ticket.active_session);
        dir = await sessionDir.getDirectoryHandle("workspace");
      } else {
        dir = await entityDir.getDirectoryHandle("filesystem");
      }
      // Walk to the parent directory.
      for (const segment of path.slice(0, -1)) {
        dir = await dir.getDirectoryHandle(segment);
      }
      const filename = path.at(-1);
      if (!filename) return null;
      const fileHandle = await dir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const lower = filename.toLowerCase();
      if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp") || lower.endsWith(".svg")) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = globalThis.btoa(binary);
        const mime = lower.endsWith(".svg") ? "image/svg+xml" : (file.type || "image/png");
        return `data:${mime};base64,${base64}`;
      }
      if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") || lower.endsWith(".mp3") || lower.endsWith(".wav")) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = globalThis.btoa(binary);
        let mime = file.type;
        if (!mime || mime === "audio/mp3") {
          if (lower.endsWith(".mp4")) mime = "video/mp4";
          else if (lower.endsWith(".webm")) mime = "video/webm";
          else if (lower.endsWith(".mov")) mime = "video/quicktime";
          else if (lower.endsWith(".mp3")) mime = "audio/mpeg";
          else if (lower.endsWith(".wav")) mime = "audio/wav";
          else mime = "application/octet-stream";
        }
        return `data:${mime};base64,${base64}`;
      }
      return await file.text();
    } catch {
      return null;
    }
  }

  /**
   * Read the root `surface.json` from a ticket's filesystem.
   *
   * Returns the parsed manifest, or `null` if no surface exists.
   */
  async readSurface(ticketId: string): Promise<SurfaceManifest | null> {
    try {
      const entityDir = await this.#getEntityDirHandle(ticketId);
      if (!entityDir) return null;
      const ticket = this.tickets.get().find((t) => t.id === ticketId);
      let fsDir: FileSystemDirectoryHandle;
      if (ticket && ticket.active_session) {
        const sessionsDir = await entityDir.getDirectoryHandle("sessions");
        const sessionDir = await sessionsDir.getDirectoryHandle(ticket.active_session);
        fsDir = await sessionDir.getDirectoryHandle("workspace");
      } else {
        fsDir = await entityDir.getDirectoryHandle("filesystem");
      }
      const fileHandle = await fsDir.getFileHandle("surface.json");
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Basic validation: must have items array.
      if (!parsed || !Array.isArray(parsed.items)) return null;
      return parsed as SurfaceManifest;
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
   * Get the `FileSystemDirectoryHandle` for a ticket or agent.
   *
   * Used by `LiveSessionClient.fromTicketDir()` to read the session bundle.
   */
  async getTicketDirHandle(
    ticketId: string,
  ): Promise<FileSystemDirectoryHandle | null> {
    return this.#getEntityDirHandle(ticketId);
  }

  /**
   * Resolve the directory handle for an entity ID.
   *
   * Looks up `agents/{id}`.
   */
  async #getEntityDirHandle(
    entityId: string,
  ): Promise<FileSystemDirectoryHandle | null> {
    if (!this.#agentsHandle) return null;
    try {
      return await this.#agentsHandle.getDirectoryHandle(entityId);
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
    if (!this.#agentsHandle) return;

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
        const entityDir = await this.#getEntityDirHandle(ticket.id);
        if (entityDir && await LiveSessionClient.hasActiveSession(entityDir)) {
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
    // Observe the primary entity directory.
    const handle = this.#agentsHandle;
    if (!handle) return;
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

          let updatedTicketId: string | null = null;
          const fsChanges = new Map<string, string[]>();

          for (const record of records) {
            const r = record as FileSystemChangeRecord;
            let segments: string[];

            if (Array.isArray(r.relativePathComponents) && r.relativePathComponents.length > 0) {
              segments = r.relativePathComponents;
            } else if (typeof r.relativePath === "string") {
              segments = r.relativePath.split("/").filter(Boolean);
            } else {
              continue;
            }

            if (segments.length === 0) continue;

            const ticketId = segments[0];
            if (!updatedTicketId) updatedTicketId = ticketId;

            // Filesystem changes:
            // Legacy: [ticketId, "filesystem", ...path]
            // New: [ticketId, "sessions", sessionId, "workspace", ...path]
            if (segments.length >= 3 && segments[1] === "filesystem") {
              const fsPath = segments.slice(2).join("/");
              if (!fsChanges.has(ticketId)) fsChanges.set(ticketId, []);
              fsChanges.get(ticketId)!.push(fsPath);
            } else if (segments.length >= 5 && segments[1] === "sessions" && segments[3] === "workspace") {
              const fsPath = segments.slice(4).join("/");
              if (!fsChanges.has(ticketId)) fsChanges.set(ticketId, []);
              fsChanges.get(ticketId)!.push(fsPath);
            }
          }

          if (updatedTicketId) {
            this.recentlyUpdatedTicket.set({ id: updatedTicketId, at: Date.now() });
          }

          const now = Date.now();
          for (const [ticketId, paths] of fsChanges) {
            this.filesystemChange.set({ ticketId, paths, at: now });
          }
        }
      });
      // Recursive — entity subdirectories may be added/modified.
      observer.observe(handle, { recursive: true });
      this.#observer = observer;
    } catch (e) {
      console.warn("FileSystemObserver not available:", e);
    }
  }
}

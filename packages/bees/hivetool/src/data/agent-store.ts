/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal-backed reactive store for agent directories.
 *
 * Reads agent data from `hive/agents/{uuid}/`, combining
 * `metadata.json` and `objective.md` into AgentData objects
 * for the UI. Uses FileSystemObserver for live updates.
 */

import { Signal } from "signal-polyfill";
import type { StateAccess } from "./state-access.js";
import type { AgentData, TaskItemData, SurfaceManifest, TrajectoryData } from "./types.js";
import { LiveSessionClient } from "./live-session.js";

export { AgentStore };
export type { FileTreeNode };

/** A node in an agent's directory tree. */
interface FileTreeNode {
  name: string;
  kind: "file" | "directory";
  children?: FileTreeNode[];
}

class AgentStore {
  constructor(private access: StateAccess) {}

  readonly agents = new Signal.State<AgentData[]>([]);
  readonly selectedAgentId = new Signal.State<string | null>(null);
  readonly recentlyUpdatedAgent = new Signal.State<{ id: string; at: number } | null>(null);

  readonly trajectories = new Signal.State<TrajectoryData[]>([]);
  readonly selectedTrajectoryAgentId = new Signal.State<string | null>(null);
  readonly recentlyUpdatedTrajectory = new Signal.State<{ id: string; at: number } | null>(null);

  readonly selectedTrajectory = new Signal.Computed(() => {
    const id = this.selectedTrajectoryAgentId.get();
    if (!id) return null;
    return this.trajectories.get().find((t) => t.agentId === id) ?? null;
  });


  /**
   * Fires when a file inside an agent's workspace directory changes.
   *
   * Consumers (e.g. surface-pane) use this to push `filechange` events
   * to sandboxed bundle iframes via the opalSDK EventTarget bridge.
   */
  readonly filesystemChange = new Signal.State<{
    agentId: string;
    paths: string[];
    at: number;
  } | null>(null);
  readonly selectedAgent = new Signal.Computed(() => {
    const id = this.selectedAgentId.get();
    if (!id) return null;
    return this.agents.get().find((t) => t.id === id) ?? null;
  });

  /** Set of agent IDs with active (unresolved) live session bundles. */
  readonly activeLiveSessions = new Signal.State<Set<string>>(new Set());

  /**
   * The single active live session connection.
   *
   * At most one WebSocket is open at a time.  The connection survives
   * agent selection changes — switching agents in the sidebar does
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

  /** All task records from the `tasks/` directory. */
  readonly tasks = new Signal.State<TaskItemData[]>([]);

  /** Currently selected task ID for the Tasks tab. */
  readonly selectedTaskId = new Signal.State<string | null>(null);

  /** Activate the store — resolves entity directories, scans, observes. */
  async activate(): Promise<void> {
    if (this.#activated) return;
    if (this.access.accessState.get() !== "ready") return;

    const agentsHandle = await this.access.getSubdirectory("agents", {
      create: true,
    });
    if (!agentsHandle) {
      console.warn("Could not resolve agents/ subdirectory in hive/");
      return;
    }

    this.#agentsHandle = agentsHandle;
    this.#tasksHandle = await this.access.getSubdirectory("tasks", {
      create: true,
    });
    this.#activated = true;
    await this.scan();
    this.#startObserver();
  }

  /** Scan entity directories and rebuild the agent list. */
  async scan(): Promise<void> {
    if (!this.#agentsHandle) return;

    const entries = await this.#scanAgentsDir();

    // Sort newest first.
    entries.sort((a, b) => {
      const aDate = a.created_at ?? "";
      const bDate = b.created_at ?? "";
      return bDate.localeCompare(aDate);
    });

    this.agents.set(entries);

    await this.#scanTrajectories(entries);

    // Detect active live sessions.
    await this.#detectLiveSessions(entries);
  }



  /** Scan `agents/` + `tasks/` — the Project Swarm layout.
   *
   * Reads agent metadata from `agents/{uuid}/metadata.json` and task
   * records from `tasks/{uuid}.json`. Produces AgentData objects for
   * the UI.
   */
  async #scanAgentsDir(): Promise<AgentData[]> {
    if (!this.#agentsHandle) return [];

    // Load all tasks into a lookup by assignee.
    const tasksByAssignee = new Map<string, TaskItemData[]>();
    const allTasks: TaskItemData[] = [];
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
          allTasks.push(taskData);
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

    // Sort tasks: newest first.
    allTasks.sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );

    // Cache task data for getTasksForAgent() and expose flat list.
    this.#tasksByAssignee.set(tasksByAssignee);
    this.tasks.set(allTasks);

    const entries: AgentData[] = [];

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

      // Map agent metadata into AgentData shape.
      entries.push({
        id: name,
        objective,
        status: md.status as string,
        finite: md.finite as boolean | undefined,
        created_at: md.created_at as string | undefined,
        completed_at: md.completed_at as string | undefined,
        slug: md.slug as string | undefined,
        model: md.model as string | undefined,
        runner: md.runner as AgentData["runner"],
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
        files: md.files as AgentData["files"],
        watch_events: md.watch_events as AgentData["watch_events"],
        outcome_content: md.outcome_content as Record<string, unknown> | undefined,
        ...(chatLog ? { chat_history: chatLog as AgentData["chat_history"] } : {}),
      } as AgentData);
    }

    return entries;
  }

  async #scanTrajectories(entries: AgentData[]): Promise<void> {
    if (!this.#agentsHandle) return;
    const trajs: TrajectoryData[] = [];

    for (const agent of entries) {
      try {
        const agentDir = await this.#agentsHandle.getDirectoryHandle(agent.id);
        const trajFileHandle = await agentDir.getFileHandle("antigravity_traj.json");
        const file = await trajFileHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);

        trajs.push({
          agentId: agent.id,
          agentTitle: agent.title ?? `Agent ${agent.id.slice(0, 8)}`,
          agentStatus: agent.status ?? "unknown",
          trajectoryId: data.trajectory_id || "",
          steps: data.steps || [],
          lastModified: file.lastModified,
        });
      } catch {
        // No trajectory file for this agent, skip.
      }
    }

    // Sort by lastModified descending (most recently updated first)
    trajs.sort((a, b) => b.lastModified - a.lastModified);
    this.trajectories.set(trajs);
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

  selectAgent(id: string | null): void {
    this.selectedAgentId.set(id);
  }

  /** Tear down all state so the store can be re-activated against a new hive. */
  reset(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#agentsHandle = null;
    this.#tasksHandle = null;
    this.#activated = false;
    this.agents.set([]);
    this.tasks.set([]);
    this.selectedAgentId.set(null);
    this.selectedTaskId.set(null);
    this.recentlyUpdatedAgent.set(null);
    this.trajectories.set([]);
    this.selectedTrajectoryAgentId.set(null);
    this.recentlyUpdatedTrajectory.set(null);
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
    return this.#createAgentSwarm(opts);
  }

  /** Create agent + task in the Project Swarm layout. */
  async #createAgentSwarm(opts: {
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

  /** Read the directory tree for an agent's workspace. */
  async readTree(agentId: string): Promise<FileTreeNode[]> {
    try {
      const entityDir = await this.#getEntityDirHandle(agentId);
      if (!entityDir) return [];
      const agent = this.agents.get().find((t) => t.id === agentId);
      let fsDir: FileSystemDirectoryHandle;
      if (agent && agent.active_session) {
        const sessionsDir = await entityDir.getDirectoryHandle("sessions");
        const sessionDir = await sessionsDir.getDirectoryHandle(agent.active_session);
        fsDir = await sessionDir.getDirectoryHandle("workspace");
      } else {
        fsDir = await entityDir.getDirectoryHandle("filesystem");
      }
      return this.#scanDir(fsDir);
    } catch {
      return [];
    }
  }

  /** Read the text content (or base64 data URL for images) of a file within an agent's workspace. */
  async readFileContent(
    agentId: string,
    path: string[]
  ): Promise<string | null> {
    try {
      const entityDir = await this.#getEntityDirHandle(agentId);
      if (!entityDir) return null;
      const agent = this.agents.get().find((t) => t.id === agentId);
      let dir: FileSystemDirectoryHandle;
      if (agent && agent.active_session) {
        const sessionsDir = await entityDir.getDirectoryHandle("sessions");
        const sessionDir = await sessionsDir.getDirectoryHandle(agent.active_session);
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
   * Read the root `surface.json` from an agent's workspace.
   *
   * Returns the parsed manifest, or `null` if no surface exists.
   */
  async readSurface(agentId: string): Promise<SurfaceManifest | null> {
    try {
      const entityDir = await this.#getEntityDirHandle(agentId);
      if (!entityDir) return null;
      const agent = this.agents.get().find((t) => t.id === agentId);
      let fsDir: FileSystemDirectoryHandle;
      if (agent && agent.active_session) {
        const sessionsDir = await entityDir.getDirectoryHandle("sessions");
        const sessionDir = await sessionsDir.getDirectoryHandle(agent.active_session);
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
   * Get the `FileSystemDirectoryHandle` for an agent.
   *
   * Used by `LiveSessionClient.fromTicketDir()` to read the session bundle.
   */
  async getAgentDirHandle(
    agentId: string,
  ): Promise<FileSystemDirectoryHandle | null> {
    return this.#getEntityDirHandle(agentId);
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
   * Connect to a live session for the given agent.
   *
   * Disconnects any existing session first (one connection at a time).
   * Creates a `LiveSessionClient`, opens the WebSocket, and stores
   * the client in `activeConnection`.
   */
  async connectLiveSession(agentId: string): Promise<void> {
    // Already connected to this agent — nothing to do.
    const current = this.activeConnection.get();
    if (current?.taskId === agentId) return;

    // Disconnect any existing session.
    if (current) {
      current.disconnect();
      this.activeConnection.set(null);
    }

    const dirHandle = await this.getAgentDirHandle(agentId);
    if (!dirHandle) {
      console.error("Could not get directory handle for agent", agentId);
      return;
    }

    const client = await LiveSessionClient.fromTicketDir(dirHandle);
    if (!client) {
      console.error("Could not create LiveSessionClient for", agentId);
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

  async #detectLiveSessions(agents: AgentData[]): Promise<void> {
    if (!this.#agentsHandle) return;

    const liveAgents = agents.filter((t) => t.runner === "live");
    if (liveAgents.length === 0) {
      if (this.activeLiveSessions.get().size > 0) {
        this.activeLiveSessions.set(new Set());
      }
      return;
    }

    const activeIds = new Set<string>();
    for (const agent of liveAgents) {
      try {
        const entityDir = await this.#getEntityDirHandle(agent.id);
        if (entityDir && await LiveSessionClient.hasActiveSession(entityDir)) {
          activeIds.add(agent.id);
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

          let updatedAgentId: string | null = null;
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

            const agentId = segments[0];
            if (!updatedAgentId) updatedAgentId = agentId;

            // Filesystem changes:
            // Legacy: [agentId, "filesystem", ...path]
            // New: [agentId, "sessions", sessionId, "workspace", ...path]
            if (segments.length >= 3 && segments[1] === "filesystem") {
              const fsPath = segments.slice(2).join("/");
              if (!fsChanges.has(agentId)) fsChanges.set(agentId, []);
              fsChanges.get(agentId)!.push(fsPath);
            } else if (segments.length >= 5 && segments[1] === "sessions" && segments[3] === "workspace") {
              const fsPath = segments.slice(4).join("/");
              if (!fsChanges.has(agentId)) fsChanges.set(agentId, []);
              fsChanges.get(agentId)!.push(fsPath);
            } else if (segments.length === 2 && segments[1] === "antigravity_traj.json") {
              this.recentlyUpdatedTrajectory.set({ id: agentId, at: Date.now() });
            }
          }

          if (updatedAgentId) {
            this.recentlyUpdatedAgent.set({ id: updatedAgentId, at: Date.now() });
          }

          const now = Date.now();
          for (const [agentId, paths] of fsChanges) {
            this.filesystemChange.set({ agentId, paths, at: now });
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

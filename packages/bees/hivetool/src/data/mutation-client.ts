/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client for the mutation log — writes mutation files to `hive/mutations/`.
 *
 * The box watches this directory and processes mutations atomically.
 * Hot mutations (respond-to-task, create-task-group) are processed inline
 * while the scheduler is running. Cold mutations (reset) are processed in
 * the quiescent gap between shutdown and restart.
 *
 * This client is fire-and-forget: it writes the command file and returns.
 * Effects are observed through existing store observers.
 */

import type { StateAccess } from "./state-access.js";

export { MutationClient };

/** Task specification for batch creation. */
interface TaskSpec {
  ref?: string;
  objective: string;
  title?: string;
  playbook_id?: string;
  tags?: string[];
  functions?: string[];
  skills?: string[];
  tasks?: string[];
  model?: string;
  context?: string;
  watch_events?: string[];
  kind?: string;
  depends_on?: string[];
}

class MutationClient {
  constructor(private access: StateAccess) {}

  /**
   * Request a hive reset — deletes all tasks and session logs.
   *
   * Cold mutation: the box shuts down, clears `tickets/` and `logs/`,
   * then restarts to re-boot the root template.
   */
  async requestReset(): Promise<string> {
    return this.#writeMutation({ type: "reset" });
  }

  /**
   * Respond to a suspended task — writes response and flips assignee
   * atomically.
   *
   * Hot mutation: the box writes `response.json` and updates
   * `metadata.json` in a single pass before triggering the scheduler,
   * preventing the race where the scheduler sees the assignee flip
   * before the response file exists.
   */
  async respondToTask(
    taskId: string,
    response: Record<string, unknown>
  ): Promise<string> {
    return this.#writeMutation({
      type: "respond-to-task",
      task_id: taskId,
      response,
    });
  }

  /**
   * Create multiple tasks as a group with intra-batch dependencies.
   *
   * Hot mutation: the box creates all tasks sequentially, resolving
   * `depends_on` refs to real task IDs within the batch.  The scheduler
   * is triggered once after all tasks are created.
   */
  async createTaskGroup(tasks: TaskSpec[]): Promise<string> {
    return this.#writeMutation({
      type: "create-task-group",
      tasks,
    });
  }

  // -- internal -----------------------------------------------------------

  async #writeMutation(data: Record<string, unknown>): Promise<string> {
    const mutationsDir = await this.#getMutationsDir();

    const mutationId = crypto.randomUUID();
    const filename = `${mutationId}.json`;

    const mutation = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    const fileHandle = await mutationsDir.getFileHandle(filename, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(mutation, null, 2) + "\n");
    await writable.close();

    return mutationId;
  }

  async #getMutationsDir(): Promise<FileSystemDirectoryHandle> {
    const handle = this.access.handle;
    if (!handle) throw new Error("No hive directory handle");
    return handle.getDirectoryHandle("mutations", { create: true });
  }
}


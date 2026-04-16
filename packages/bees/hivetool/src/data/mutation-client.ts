/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client for the mutation log — writes mutation files to `hive/mutations/`.
 *
 * The box watches this directory and processes mutations atomically
 * in the quiescent gap between shutdown and restart. This client is
 * fire-and-forget: it writes the command file and returns. The effects
 * are observed through existing store observers (TicketStore, LogStore).
 */

import type { StateAccess } from "./state-access.js";

export { MutationClient };

class MutationClient {
  constructor(private access: StateAccess) {}

  /**
   * Request a hive reset — deletes all tasks and session logs.
   *
   * Writes a `reset` mutation file to `mutations/{uuid}.json`.
   * The box processes it on the next watch cycle, clearing `tickets/`
   * and `logs/` atomically, then restarting to re-boot the root template.
   *
   * Returns the mutation ID (UUID) for debugging.
   */
  async requestReset(): Promise<string> {
    const mutationsDir = await this.#getMutationsDir();

    const mutationId = crypto.randomUUID();
    const filename = `${mutationId}.json`;

    const mutation = {
      type: "reset",
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

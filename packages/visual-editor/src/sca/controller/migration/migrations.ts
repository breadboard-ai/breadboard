/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RecentBoardStore } from "../../../data/recent-boards.js";
import { RecentBoardsController } from "../subcontrollers/home/recent-boards-controller.js";
import { unwrap } from "../decorators/utils/wrap-unwrap.js";
import { RecentBoard } from "../../types.js";
import {
  FlagController,
  StatusUpdatesController,
} from "../subcontrollers/global/global.js";
import { RuntimeFlags } from "@breadboard-ai/types";
import { IdbFlagManager } from "../../../idb/flags/idb-flag-manager.js";
import {
  IntegrationsController,
  type StoredServer,
} from "../subcontrollers/editor/integrations/integrations.js";
import { openDB, deleteDB } from "idb";

/**
 * localStorage key for status updates hash (legacy storage).
 * Must match the key used in main-base.ts.
 */
const UPDATE_HASH_KEY = "bb-update-hash";

/**
 * Legacy IDB database name for MCP servers.
 * Must match the constant in mcp/server-store.ts.
 */
const LEGACY_MCP_SERVERS_DB = "mcp-servers";
const LEGACY_MCP_SERVERS_STORE = "servers";

/**
 * Carries the boards over from the old RecentBoardStore to the new
 * RecentBoardController. The migration is tracked in the Controller so that it
 * does not happen multiple times.
 */
export async function recentBoardsMigration(
  boardController: RecentBoardsController
) {
  // Wait for the board controller to boot so we can check its migration status.
  await boardController.isHydrated;
  if (boardController.isMigrated) return;

  const boardStore = RecentBoardStore.__instance();

  // If we get here we are in an unmigrated state so grab the boards, and move
  // them over.
  await boardStore.restore();
  const boards = unwrap(boardStore.boards) as RecentBoard[];
  if (boardController.boards.length > 0 && boards.length === 0) return;
  boardController.migrate(boards);

  // Remove the boards from the old store.
  await boardStore.clear();
  await boardController.isSettled;
}

/**
 * Carries the flags over from the old IdbFlagManager to the new FlagController.
 * The migration is tracked in the Controller so that it does not happen
 * multiple times.
 */
export async function flagsMigration(
  flagController: FlagController,
  runtimeFlags: RuntimeFlags
) {
  // Wait for the flag controller to boot so we can check its migration status.
  await flagController.isHydrated;
  if (flagController.isMigrated) return;

  const flagStore = new IdbFlagManager(runtimeFlags);
  const flags = await flagStore.flags();

  flagController.migrate(flags);
  await flagController.isSettled;
}

/**
 * Carries the status updates hash from raw localStorage to the new
 * StatusUpdatesController. This ensures users don't see the "new updates"
 * chip for updates they've already seen.
 */
export async function statusUpdatesMigration(
  controller: StatusUpdatesController
) {
  // Wait for the controller to boot so we can check its migration status.
  await controller.isHydrated;
  if (controller.isMigrated) return;

  const existingHash = globalThis.localStorage.getItem(UPDATE_HASH_KEY);
  if (existingHash) {
    controller.migrate(existingHash);
    globalThis.localStorage.removeItem(UPDATE_HASH_KEY);
  } else {
    // Mark as migrated even if no hash existed
    controller.migrate("0");
  }

  await controller.isSettled;
}

/**
 * Migrates MCP servers from the legacy `mcp-servers` IDB database to the
 * IntegrationsController's `storedServers` field.
 *
 * The legacy database stores servers in an object store called "servers",
 * keyed by URL, with values of `Omit<McpServerInfo, "url">`.
 */
export async function mcpServersMigration(controller: IntegrationsController) {
  await controller.isHydrated;
  if (controller.isMigrated) return;

  try {
    const db = await openDB(LEGACY_MCP_SERVERS_DB, 1, {
      upgrade(db) {
        // Ensure the object store exists even if the DB was never created.
        if (!db.objectStoreNames.contains(LEGACY_MCP_SERVERS_STORE)) {
          db.createObjectStore(LEGACY_MCP_SERVERS_STORE);
        }
      },
    });

    const tx = db.transaction(LEGACY_MCP_SERVERS_STORE, "readonly");
    const store = tx.objectStore(LEGACY_MCP_SERVERS_STORE);
    const [keys, values] = await Promise.all([
      store.getAllKeys(),
      store.getAll(),
    ]);
    await tx.done;
    db.close();

    const servers = new Map<string, StoredServer>();
    for (let i = 0; i < keys.length; i++) {
      const url = String(keys[i]);
      const entry = values[i] as { title?: string; authToken?: string };
      servers.set(url, {
        url,
        title: entry.title ?? url,
        authToken: entry.authToken,
      });
    }

    controller.migrate(servers);

    // Delete the legacy database after successful migration.
    await deleteDB(LEGACY_MCP_SERVERS_DB);
  } catch {
    // If the legacy DB doesn't exist or can't be opened, mark as migrated
    // anyway so we don't retry on every boot.
    controller.migrate(new Map());
  }

  await controller.isSettled;
}

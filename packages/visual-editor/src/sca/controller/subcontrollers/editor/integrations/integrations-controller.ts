/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  McpServerDescriptor,
  McpServerIdentifier,
} from "@breadboard-ai/types";
import type { IntegrationState } from "../../../../../ui/state/types.js";
import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";

export { IntegrationsController };
export type { StoredServer };

/**
 * Slim shape for server entries persisted to IDB.
 * Avoids storing MCP SDK types that may not round-trip cleanly.
 */
type StoredServer = {
  url: string;
  title: string;
  authToken?: string;
};

/**
 * Manages the lifecycle and state of MCP server integrations.
 *
 * **State:**
 * - `registered`: Active integrations keyed by server URL. Each entry is a
 *   plain `IntegrationState` snapshot pushed by actions. Uses `deep: true`
 *   so mutations to snapshot properties trigger reactivity.
 * - `known`: All known MCP servers (built-ins + user-stored). Wholesale-
 *   replaced by the `Integration.refreshKnown` action.
 * - `knownStatus`: Async load state for the known servers list.
 * - `storedServers`: User-added MCP servers, persisted to IDB. Replaces
 *   the standalone `McpServerStore` class.
 *
 * **Mutations:**
 * All writes to state are performed by integration actions, not by the
 * controller itself (SCA pattern).
 */
class IntegrationsController extends RootController {
  /**
   * Active integrations, keyed by server URL.
   * deep: true — plain IntegrationState snapshots are stored here,
   * and consumers need to react to property changes (status, tools).
   */
  @field({ deep: true })
  private accessor _registered: Map<McpServerIdentifier, IntegrationState> =
    new Map();

  /**
   * Public getter for the registered integrations map.
   */
  get registered(): ReadonlyMap<McpServerIdentifier, IntegrationState> {
    return this._registered;
  }

  /**
   * Sets the registered integrations map.
   * Called only by the `Integration.syncFromGraph` action.
   */
  setRegistered(map: Map<McpServerIdentifier, IntegrationState>) {
    this._registered = map;
  }

  /**
   * All known MCP servers (built-ins + stored).
   * deep: false — wholesale-replaced by the refreshKnown action.
   */
  @field({ deep: false })
  private accessor _known: Map<McpServerIdentifier, McpServerDescriptor> =
    new Map();

  /**
   * Tracks the async load state for the known servers list.
   */
  @field()
  accessor knownStatus: "pending" | "complete" | "error" = "pending";

  /**
   * Public getter for the known servers map.
   */
  get known(): ReadonlyMap<McpServerIdentifier, McpServerDescriptor> {
    return this._known;
  }

  /**
   * Sets the known servers map and marks the status as complete.
   * Called only by the `Integration.refreshKnown` action.
   */
  setKnown(map: Map<McpServerIdentifier, McpServerDescriptor>) {
    this._known = map;
    this.knownStatus = "complete";
  }

  /**
   * Marks the known servers status as errored.
   */
  setKnownError() {
    this.knownStatus = "error";
  }

  // ---------------------------------------------------------------------------
  // Stored servers (IDB-persisted)
  // ---------------------------------------------------------------------------

  /**
   * User-added MCP servers, persisted to IDB.
   * Replaces the standalone `McpServerStore` / `createMcpServerStore()`.
   * Actions perform wholesale replacement via `setStoredServers`.
   */
  @field({ persist: "idb", deep: false })
  private accessor _storedServers: Map<string, StoredServer> = new Map();

  get storedServers(): ReadonlyMap<string, StoredServer> {
    return this._storedServers;
  }

  setStoredServers(map: Map<string, StoredServer>) {
    this._storedServers = map;
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  /**
   * Resets all integration state. Called on graph close or reset.
   * Note: stored servers are NOT reset — they persist across graphs.
   */
  resetAll() {
    this._registered = new Map();
    this._known = new Map();
    this.knownStatus = "pending";
  }

  // ---------------------------------------------------------------------------
  // Migration
  // ---------------------------------------------------------------------------

  @field({ persist: "idb" })
  private accessor _isMigrated = false;

  get isMigrated(): boolean {
    return this._isMigrated;
  }

  /**
   * Migrates stored servers from the legacy `mcp-servers` IDB database.
   * Called during the migration phase at boot.
   *
   * @param servers Map of stored servers read from the legacy database
   */
  migrate(servers: Map<string, StoredServer>) {
    if (this._isMigrated) return;

    if (servers.size > 0) {
      this._storedServers = servers;
    }
    this._isMigrated = true;
  }
}

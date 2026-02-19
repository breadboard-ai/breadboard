/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for MCP Integration management.
 *
 * - `syncFromGraph`: Syncs registered integrations from graph descriptor
 * - `refreshKnown`: Rebuilds the known servers list (built-ins + stored)
 * - `register`: Adds a server to the graph as an integration
 * - `unregister`: Removes a server from the graph integrations
 * - `add`: Adds a new MCP server and registers it
 * - `remove`: Unregisters and removes an MCP server
 */

import type {
  McpServerDescriptor,
  McpServerIdentifier,
  McpServerInstanceIdentifier,
  Outcome,
  UUID,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";

import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onGraphVersionChange } from "./triggers.js";

export const bind = makeAction();

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Upserts an integration into the graph via the editor.
 */
async function upsertIntegration(
  url: string,
  title: string
): Promise<Outcome<McpServerInstanceIdentifier>> {
  const { controller } = bind;
  const { editor } = controller.editor.graph;

  if (!editor) {
    return err("No editor available to upsert integration");
  }

  const id = url;
  const upserting = await editor.edit(
    [
      {
        type: "upsertintegration",
        id,
        integration: { title, url },
      },
    ],
    `Upserting integration "${url}"`
  );
  if (!upserting.success) {
    return err(`Failed to upsert integration "${url}"`);
  }
  return id;
}

// =============================================================================
// Triggered Actions
// =============================================================================

/**
 * Syncs integrations from the graph descriptor to the controller.
 *
 * Reads `graph.integrations`, creates/updates `IntegrationManager` instances,
 * and writes plain snapshots to the controller.
 *
 * **Triggers:**
 * - `onGraphVersionChange`: Fires when the graph version changes
 */
export const syncFromGraph = asAction(
  "Integration.syncFromGraph",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onGraphVersionChange(bind),
  },
  async (): Promise<void> => {
    const { controller, services } = bind;
    const integrationsController = controller.editor.integrations;
    const graphController = controller.editor.graph;
    const graph = graphController.graph;
    const managers = services.integrationManagers;

    if (!graph) {
      managers.clear();
      integrationsController.resetAll();
      return;
    }

    const { integrations = {} } = graph;
    const graphEntries = Object.entries(integrations);

    // Determine which managers to keep, create, or remove.
    const nextManagerKeys = new Set(graphEntries.map(([key]) => key));

    // Remove managers that are no longer in the graph.
    for (const key of managers.keys()) {
      if (!nextManagerKeys.has(key)) {
        managers.delete(key);
      }
    }

    // Helper: push all manager snapshots into the controller.
    const pushSnapshots = () => {
      integrationsController.setRegistered(managers.snapshots());
    };

    // Create or update managers.
    for (const [key, integration] of graphEntries) {
      managers.getOrCreate(key, integration, services.mcpClientManager, () => {
        // When async loading completes, push fresh snapshots.
        pushSnapshots();
        // Also refresh the known list since registration status may change.
        refreshKnown();
      });
    }

    // Push initial snapshots (status = "loading").
    pushSnapshots();

    // Refresh known servers whenever registrations change.
    await refreshKnown();
  }
);

// =============================================================================
// Actions
// =============================================================================

/**
 * Rebuilds the known servers list from built-in servers, the controller's
 * stored servers (IDB-persisted), and currently registered integrations.
 *
 * Reads are synchronous — the controller's `storedServers` field hydrates
 * from IDB on boot, so no async IDB calls are needed here.
 */
export const refreshKnown = asAction(
  "Integration.refreshKnown",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller, services } = bind;
    const integrationsController = controller.editor.integrations;
    const managers = services.integrationManagers;

    // Start with built-in servers.
    const builtIns: [McpServerIdentifier, McpServerDescriptor][] =
      services.mcpClientManager.builtInServers().map((info) => [
        info.url,
        {
          title: info.title,
          description: info.description,
          details: {
            name: info.title,
            version: "0.0.1",
            url: info.url,
          },
          registered: false,
          removable: false,
        },
      ]);

    const result = new Map<McpServerIdentifier, McpServerDescriptor>(builtIns);

    // Add user-stored servers from the controller's persisted field.
    for (const [id, info] of integrationsController.storedServers) {
      const registered = integrationsController.registered.has(id);
      result.set(id, {
        title: info.title,
        details: {
          name: info.title,
          version: "0.0.1",
          url: info.url,
          authToken: info.authToken,
        },
        registered,
        removable: isRemovable(id, result),
      });
    }

    // Overlay registered integrations from the managers.
    for (const [key, mgr] of managers.entries()) {
      result.set(key, mgr.descriptor());
    }

    integrationsController.setKnown(result);
  }
);

function isRemovable(
  id: string,
  result: Map<McpServerIdentifier, McpServerDescriptor>
): boolean {
  const existing = result.get(id);
  if (existing?.removable === false) return false;
  return true;
}

/**
 * Registers a known server as an active integration in the graph.
 */
export const register = asAction(
  "Integration.register",
  { mode: ActionMode.Immediate },
  async (id: McpServerIdentifier): Promise<Outcome<void>> => {
    const { controller } = bind;
    const integrationsController = controller.editor.integrations;

    if (integrationsController.knownStatus !== "complete") {
      return err(
        `Server list is not available, status: "${integrationsController.knownStatus}"`
      );
    }

    const server = integrationsController.known.get(id);
    if (!server) {
      return err(`MCP Server "${id}" does not exist`);
    }
    if (server.registered) {
      return err(`MCP Server "${id}" is already registered`);
    }

    const adding = await upsertIntegration(server.details.url, server.title);
    if (!ok(adding)) return adding;
  }
);

/**
 * Unregisters a server from the graph integrations.
 */
export const unregister = asAction(
  "Integration.unregister",
  { mode: ActionMode.Immediate },
  async (id: McpServerIdentifier): Promise<Outcome<void>> => {
    const { controller } = bind;
    const integrationsController = controller.editor.integrations;
    const { editor } = controller.editor.graph;

    if (integrationsController.knownStatus !== "complete") {
      return err(
        `Server list is not available, status: "${integrationsController.knownStatus}"`
      );
    }

    const server = integrationsController.known.get(id);
    if (!server) {
      return err(`MCP Server "${id}" does not exist`);
    }
    if (!server.registered) {
      return err(`MCP Server "${id}" is already unregistered`);
    }

    if (!editor) {
      return err("No editor available to unregister integration");
    }

    const removing = await editor.edit(
      [
        {
          type: "removeintegration",
          id: id as UUID,
        },
      ],
      `Removing integration "${id}"`
    );
    if (!removing.success) {
      return err(`Failed to remove integration "${id}"`);
    }
  }
);

/**
 * Adds a new MCP server to the stored list and registers it as an
 * integration in the graph.
 *
 * Writes to the controller's `storedServers` field (IDB-persisted).
 */
export const add = asAction(
  "Integration.add",
  { mode: ActionMode.Immediate },
  async (
    url: string,
    title: string = url,
    authToken: string | undefined
  ): Promise<Outcome<void>> => {
    const { controller } = bind;
    const integrationsController = controller.editor.integrations;

    // Write to the controller's persisted stored servers field.
    const next = new Map(integrationsController.storedServers);
    next.set(url, { url, title, authToken });
    integrationsController.setStoredServers(next);

    // Register as a graph integration.
    const adding = await upsertIntegration(url, title);
    if (!ok(adding)) return adding;
  }
);

/**
 * Removes an MCP server: unregisters from the graph and removes from the
 * stored server list.
 *
 * Writes to the controller's `storedServers` field (IDB-persisted).
 */
export const remove = asAction(
  "Integration.remove",
  { mode: ActionMode.Immediate },
  async (id: McpServerIdentifier): Promise<Outcome<void>> => {
    const { controller } = bind;
    const integrationsController = controller.editor.integrations;
    const { editor } = controller.editor.graph;

    if (integrationsController.knownStatus !== "complete") {
      return err(
        `Server list is not available, status: "${integrationsController.knownStatus}"`
      );
    }

    const server = integrationsController.known.get(id);
    if (!server) {
      return err(`MCP Server "${id}" does not exist`);
    }

    // Remove from graph if registered.
    if (server.removable && editor) {
      const removing = await editor.edit(
        [
          {
            type: "removeintegration",
            id: id as UUID,
          },
        ],
        `Removing integration "${id}"`
      );
      if (!removing.success) {
        return err(`Failed to remove integration "${id}"`);
      }
    }

    // Remove from stored server list.
    const next = new Map(integrationsController.storedServers);
    next.delete(server.details.url);
    integrationsController.setStoredServers(next);
  }
);

/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Service-layer management of MCP integration lifecycles.
 *
 * `IntegrationManagerService` owns a map of `IntegrationManager` instances,
 * each of which connects to an MCP server, fetches its tool list, and
 * produces plain `IntegrationState` snapshots for the controller.
 *
 * This service is injected via `services.integrationManagers` so that
 * actions can create/query/remove managers without module-level state.
 */

import type {
  Integration,
  McpServerDescriptor,
  McpServerIdentifier,
  Outcome,
} from "@breadboard-ai/types";
import type { IntegrationState, Tool } from "../types.js";
import { ok } from "@breadboard-ai/utils";
import type {
  McpClient,
  McpClientManager,
  McpListToolResult,
} from "../../mcp/index.js";

export { IntegrationManagerService, IntegrationManager, fromMcpTool };

function fromMcpTool(url: string, tool: McpListToolResult["tools"][0]): Tool {
  return {
    url,
    title: tool.title || tool.name,
    description: tool.description,
    icon: "robot_server",
    id: tool.name,
    order: Number.MAX_SAFE_INTEGER,
    tags: [],
  };
}

/**
 * Manages a collection of `IntegrationManager` instances.
 *
 * Actions use this service to create, query, and remove managers.
 * Only plain snapshots flow into the controller — the live manager
 * objects stay here.
 */
class IntegrationManagerService {
  #managers = new Map<McpServerIdentifier, IntegrationManager>();

  /**
   * Returns an existing manager or creates a new one.
   * If the manager already exists, it is updated with the new integration data.
   */
  getOrCreate(
    key: McpServerIdentifier,
    integration: Integration,
    clientFactory: McpClientManager,
    onStateChange: () => void
  ): IntegrationManager {
    const existing = this.#managers.get(key);
    if (existing) {
      existing.update(integration);
      return existing;
    }

    const mgr = new IntegrationManager(
      integration,
      clientFactory,
      onStateChange
    );
    this.#managers.set(key, mgr);
    return mgr;
  }

  get(key: McpServerIdentifier): IntegrationManager | undefined {
    return this.#managers.get(key);
  }

  has(key: McpServerIdentifier): boolean {
    return this.#managers.has(key);
  }

  delete(key: McpServerIdentifier): void {
    this.#managers.delete(key);
  }

  clear(): void {
    this.#managers.clear();
  }

  keys(): IterableIterator<McpServerIdentifier> {
    return this.#managers.keys();
  }

  entries(): IterableIterator<[McpServerIdentifier, IntegrationManager]> {
    return this.#managers.entries();
  }

  /**
   * Builds a snapshot map of all managers' current state.
   * This is what gets pushed into the controller's `_registered` field.
   */
  snapshots(): Map<McpServerIdentifier, IntegrationState> {
    const result = new Map<McpServerIdentifier, IntegrationState>();
    for (const [key, mgr] of this.#managers) {
      result.set(key, mgr.snapshot());
    }
    return result;
  }
}

/**
 * Service-layer object managing one MCP integration's lifecycle.
 * NOT stored in the controller — only plain snapshots are.
 */
class IntegrationManager {
  #client: Promise<Outcome<McpClient>>;
  #integration: Integration;
  #onStateChange: () => void;

  title: string;
  url: string;
  status: "complete" | "error" | "loading" = "loading";
  message: string | null = null;
  tools: Map<string, Tool> = new Map();

  constructor(
    integration: Integration,
    clientFactory: McpClientManager,
    onStateChange: () => void
  ) {
    this.#integration = integration;
    this.#onStateChange = onStateChange;
    this.title = integration.title;
    this.url = integration.url;
    this.#client = clientFactory.createClient(integration.url, {
      title: integration.title,
      name: integration.title,
      version: "0.0.1",
    });
    this.#reload();
  }

  async #reload(): Promise<void> {
    const client = await this.#client;
    if (!ok(client)) {
      this.status = "error";
      this.message = "Unable to load MCP client";
      this.#onStateChange();
      return;
    }

    try {
      const listing = await client.listTools();
      listing.tools.forEach((mcpTool) => {
        const tool = fromMcpTool(this.url, mcpTool);
        this.tools.set(tool.id!, tool);
      });
      this.status = "complete";
    } catch (e) {
      this.status = "error";
      this.message = `Unable to load tools: ${(e as Error).message}`;
    }
    this.#onStateChange();
  }

  update(integration: Integration) {
    this.#integration = integration;
    this.title = integration.title;
    this.url = integration.url;
  }

  /**
   * Returns a plain-object snapshot of this manager's state.
   * This is what gets stored in the controller's `_registered` map.
   */
  snapshot(): IntegrationState {
    return {
      title: this.title,
      url: this.url,
      status: this.status,
      message: this.message,
      tools: new Map(this.tools),
    };
  }

  descriptor(): McpServerDescriptor {
    return {
      title: this.#integration.title,
      details: {
        name: this.#integration.title,
        version: "0.0.1",
        url: this.#integration.url,
      },
      registered: true,
      removable: true,
    };
  }
}

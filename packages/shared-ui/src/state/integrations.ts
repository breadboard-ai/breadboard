/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditableGraph,
  GraphDescriptor,
  Integration,
  McpServerDescriptor,
  McpServerIdentifier,
  McpServerInstanceIdentifier,
  Outcome,
  TokenGetter,
  UUID,
} from "@breadboard-ai/types";
import {
  AsyncComputedResult,
  Integrations,
  IntegrationState,
  Tool,
} from "./types";
import { err, ok } from "@breadboard-ai/utils";
import { SignalMap } from "signal-utils/map";
import { AsyncComputed } from "signal-utils/async-computed";
import {
  createMcpServerStore,
  listBuiltInMcpServers,
  McpClient,
  McpClientFactory,
  McpListToolResult,
  McpServerStore,
} from "@breadboard-ai/mcp";
import { signal } from "signal-utils";
import { updateMapDynamic } from "./utils/update-map";

export { IntegrationsImpl };

function fromMcpTool(url: string, tool: McpListToolResult["tools"][0]): Tool {
  return {
    url,
    title: tool.title || tool.name,
    description: tool.description,
    icon: "robot_server",
    connectorInstance: tool.name,
    order: Number.MAX_SAFE_INTEGER,
    tags: [],
  };
}

class IntegrationManager implements IntegrationState {
  #client: Promise<Outcome<McpClient>>;

  @signal
  get title() {
    return this.integration.title;
  }

  @signal
  get url() {
    return this.integration.url;
  }

  @signal
  accessor integration: Integration;

  @signal
  accessor status: "complete" | "error" | "loading" = "loading";

  @signal
  accessor message: string | null = null;

  tools: Map<string, Tool> = new SignalMap();

  constructor(
    integration: Integration,
    public clientFactory: McpClientFactory,
    private serverStore: McpServerStore
  ) {
    this.integration = integration;
    const { url, title } = integration;
    this.#client = this.clientFactory.createClient(
      url,
      {
        title,
        name: title,
        version: "0.0.1",
      },
      serverStore
    );
    this.#reload();
  }

  async #reload(): Promise<void> {
    const client = await this.#client;
    if (!ok(client)) {
      this.status = "error";
      this.message = "Unable to load MCP client";
      return;
    }

    try {
      const listing = await client.listTools();
      listing.tools.forEach((mcpTool) => {
        const tool = fromMcpTool(this.integration.url, mcpTool);
        this.tools.set(tool.connectorInstance!, tool);
      });
      this.status = "complete";
    } catch (e) {
      this.status = "error";
      this.message = `Unable to load tools: ${(e as Error).message}`;
    }
  }
  update(integration: Integration) {
    this.integration = integration;
  }

  descriptor(): McpServerDescriptor {
    return {
      title: this.integration.title,
      details: {
        name: "name goes here",
        version: "0.0.1",
        url: this.integration.url,
      },
      registered: true,
      removable: true,
    };
  }
}

class IntegrationsImpl implements Integrations {
  #integrations: Map<McpServerIdentifier, IntegrationManager> = new SignalMap();
  #clientFactory: McpClientFactory;

  /**
   * A grouped list of all tools available.
   */
  @signal
  get all(): Map<McpServerIdentifier, IntegrationState> {
    // TODO: Expand this to include built-ins.
    return this.#integrations;
  }

  #builtIns: [McpServerIdentifier, McpServerDescriptor][] =
    listBuiltInMcpServers().map((descriptor) => [
      descriptor.details.url,
      descriptor,
    ]);

  #serverList = createMcpServerStore();

  constructor(
    tokenGetter: TokenGetter,
    proxyUrl?: string,
    private readonly editable?: EditableGraph
  ) {
    this.#clientFactory = new McpClientFactory(tokenGetter, proxyUrl);
    if (!editable) {
      console.warn(
        `Integration Initialization will fail: No editable supplied`
      );
      return;
    }
    this.#reload(editable.raw());

    editable?.addEventListener("graphchange", (evt) => {
      if (!evt.integrationsChange) return;
      this.#reload(evt.graph);
    });
  }

  #reload(graph: GraphDescriptor) {
    const { integrations = {} } = graph;
    updateMapDynamic(this.#integrations, Object.entries(integrations), {
      create: (from) => {
        return new IntegrationManager(
          from,
          this.#clientFactory,
          this.#serverList
        );
      },
      update: (from, existing) => {
        existing.update(from);
        return existing;
      },
    });
  }

  get servers(): AsyncComputedResult<
    Map<McpServerIdentifier, McpServerDescriptor>
  > {
    return this.#servers;
  }

  #servers = new AsyncComputed(async (signal) => {
    signal.throwIfAborted();

    const result = new SignalMap<McpServerIdentifier, McpServerDescriptor>(
      this.#builtIns
    );

    const inBgl = new Map<McpServerIdentifier, McpServerDescriptor>();

    this.#integrations.forEach((mgr, id) => {
      inBgl.set(id, mgr.descriptor());
    });

    const stored = await this.#serverList.list();
    if (!ok(stored)) {
      console.warn("Unable to load stored MCP servers", stored.$error);
    } else {
      for (const info of stored) {
        const id = info.url;
        const registered = inBgl.has(id);
        result.set(id, {
          title: info.title,
          details: {
            name: info.title,
            version: "0.0.1",
            url: info.url,
            authToken: info.authToken,
          },
          registered,
          removable: isRemovable(id),
        });
      }
    }

    inBgl.forEach((value, key) => result.set(key, value));

    return result;

    function isRemovable(id: string) {
      const existing = result.get(id);
      if (existing?.removable === false) return false;
      return true;
    }
  });

  async #upsertIntegration(
    url: string,
    title: string
  ): Promise<Outcome<McpServerInstanceIdentifier>> {
    const id = url;
    const upserting = await this.editable!.edit(
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
      return err(`Failed to upsert integration "${url}`);
    }
    return id;
  }

  async register(id: McpServerIdentifier): Promise<Outcome<void>> {
    const servers = this.servers.value;
    if (!servers) {
      return err(
        `Server list is not available, status: "${this.servers.status}"`
      );
    }
    const server = servers.get(id);
    if (!server) {
      return err(`MCP Server "${id}" does not exist`);
    }
    if (server.registered) {
      return err(`MCP Server "${id}" is already registered`);
    }

    const adding = await this.#upsertIntegration(
      server.details.url,
      server.title
    );
    if (!ok(adding)) return adding;
  }

  async unregister(id: McpServerIdentifier): Promise<Outcome<void>> {
    const servers = this.servers.value;
    if (!servers) {
      return err(
        `Server list is not available, status: "${this.servers.status}"`
      );
    }
    const server = servers.get(id);
    if (!server) {
      return err(`MCP Server "${id}" does not exist`);
    }
    if (!server.registered) {
      return err(`MCP Server "${id}" is already unregistered`);
    }
    const removing = await this.editable!.edit(
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

    if (!removing.success) {
      return err(`Unable to unregister integration "${id}"`);
    }
  }

  async add(
    url: string,
    title: string = url,
    authToken: string | undefined
  ): Promise<Outcome<void>> {
    // Add as new asset
    const adding = await this.#upsertIntegration(url, title);
    if (!ok(adding)) return adding;
    // Add to the server list
    await this.#serverList.add({ url, title, authToken });
  }

  #createId(url: string) {
    return `connectors/${url
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}`;
  }

  async remove(id: McpServerIdentifier): Promise<Outcome<void>> {
    const servers = this.servers.value;
    if (!servers) {
      return err(
        `Server list is not available, status: "${this.servers.status}"`
      );
    }
    const server = servers.get(id);
    if (!server) {
      return err(`MCP Server "${id}" does not exist`);
    }
    // Unregister
    if (server.removable) {
      const removing = await this.editable!.edit(
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
    return this.#serverList.remove(server.details.url);
  }

  async rename(_id: string, _title: string): Promise<Outcome<void>> {
    return err("Method not implemented.");
  }
}

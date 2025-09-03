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
  UUID,
} from "@breadboard-ai/types";
import { AsyncComputedResult, Integrations } from "./types";
import { err, ok } from "@breadboard-ai/utils";
import { SignalMap } from "signal-utils/map";
import { McpServerStore } from "./utils/mcp-server-store";
import { AsyncComputed } from "signal-utils/async-computed";
import { listBuiltInMcpServers } from "@breadboard-ai/mcp";
import { signal } from "signal-utils";

export { IntegrationsImpl };

class IntegrationsImpl implements Integrations {
  @signal
  accessor #integrations: Map<string, Integration> = new Map();

  #serverList = new McpServerStore();

  constructor(private readonly editable?: EditableGraph) {
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
    this.#integrations = new Map(Object.entries(integrations));
  }

  get servers(): AsyncComputedResult<
    Map<McpServerIdentifier, McpServerDescriptor>
  > {
    return this.#servers;
  }

  #servers = new AsyncComputed(async (signal) => {
    signal.throwIfAborted();

    const builtIns: [McpServerIdentifier, McpServerDescriptor][] =
      listBuiltInMcpServers().map((descriptor) => [
        descriptor.details.url,
        descriptor,
      ]);

    const result = new SignalMap<McpServerIdentifier, McpServerDescriptor>(
      builtIns
    );

    const inBgl = new Map<McpServerIdentifier, McpServerDescriptor>();

    this.#integrations.forEach((integration, id) => {
      inBgl.set(id, {
        title: integration.title,
        details: {
          name: "name goes here",
          version: "0.0.1",
          url: integration.url,
        },
        registered: true,
        removable: true,
      });
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
          details: { name: info.title, version: "0.0.1", url: info.url },
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

  async add(url: string, title: string = url): Promise<Outcome<void>> {
    // Add as new asset
    const adding = await this.#upsertIntegration(url, title);
    if (!ok(adding)) return adding;
    // Add to the server list
    await this.#serverList.add({ url, title });
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

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { Mcp, McpServer, McpServerIdentifier, ProjectInternal } from "./types";
import { signal } from "signal-utils";
import { err, fromJson, ok } from "@breadboard-ai/utils";
import { SignalMap } from "signal-utils/map";
import { McpServerStore } from "./utils/mcp-server-store";

export { McpImpl };

type McpConnectorConfiguration = {
  url: string;
  configuration: {
    endpoint: string;
  };
};

const MCP_CONNECTOR_URL = "embed://a2/mcp.bgl.json";

class McpImpl implements Mcp {
  #serverList = new McpServerStore();

  constructor(private readonly project: ProjectInternal) {}

  @signal
  get servers(): Map<McpServerIdentifier, McpServer> {
    const result = new SignalMap<McpServerIdentifier, McpServer>();
    result.set("built-in-example", {
      title: "Local Memory",
      details: {
        name: "local memory",
        version: "0.0.1",
        url: "builtin://url/goes/here",
      },
      registered: false,
      removable: false,
    });

    this.project.graphAssets.forEach((asset, key) => {
      const { connector, metadata } = asset;
      if (!connector) return;
      const url = (connector.configuration as McpConnectorConfiguration)
        .configuration.endpoint;
      if (connector.type.url !== MCP_CONNECTOR_URL) return;
      // TODO: Fill out all the details
      result.set(key, {
        title: metadata?.title || connector.id,
        details: {
          name: "name goes here",
          version: "0.0.1",
          url,
        },
        registered: true,
        removable: true,
      });
    });
    return result;
  }

  async #addAsset(id: string, url: string, title: string) {
    return this.project.organizer.addGraphAsset({
      path: id,
      data: fromJson({
        url: "embed://a2/mcp.bgl.json",
        configuration: {
          endpoint: url,
        },
      }),
      metadata: {
        type: "connector",
        title,
      },
    });
  }

  async register(id: McpServerIdentifier): Promise<Outcome<void>> {
    const server = this.servers.get(id);
    if (!server) {
      return err(`MCP Server "${id}" does not exist`);
    }
    if (server.registered) {
      return err(`MCP Server "${id}" is already registered`);
    }

    const adding = await this.#addAsset(id, server.details.url, server.title);
    if (!ok(adding)) return adding;

    server.registered = true;
    // TODO: Maybe use signals on props instead?
    this.servers.set(id, server);
  }

  async unregister(id: McpServerIdentifier): Promise<Outcome<void>> {
    const server = this.servers.get(id);
    if (!server) {
      return err(`MCP Server "${id}" does not exist`);
    }
    if (!server.registered) {
      return err(`MCP Server "${id}" is already unregistered`);
    }

    const removing = await this.project.organizer.removeGraphAsset(id);
    if (!ok(removing)) return removing;

    server.registered = false;
    this.servers.set(id, server);
  }

  async add(url: string, title: string = url): Promise<Outcome<void>> {
    const id = `connectors/${globalThis.crypto.randomUUID()}`;
    // Add as new asset
    const adding = await this.#addAsset(id, url, title);
    if (!ok(adding)) return adding;
    // Add to the server list
    await this.#serverList.add({ url, title });
  }

  async remove(id: McpServerIdentifier): Promise<Outcome<void>> {
    const server = this.servers.get(id);
    if (!server) {
      return err(`MCP Server "${id}" does not exist`);
    }
    // Unregister
    if (server.registered) {
      const removing = await this.project.organizer.removeGraphAsset(id);
      if (!ok(removing)) return removing;
    }
    // Remove from the server list
    this.servers.delete(id);
    return this.#serverList.remove(server.details.url);
  }

  async rename(_id: string, _title: string): Promise<Outcome<void>> {
    return err("Method not implemented.");
  }
}

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import {
  AsyncComputedResult,
  Mcp,
  McpServer,
  McpServerIdentifier,
  McpServerInstanceIdentifier,
  ProjectInternal,
} from "./types";
import { err, fromJson, ok } from "@breadboard-ai/utils";
import { SignalMap } from "signal-utils/map";
import { McpServerStore } from "./utils/mcp-server-store";
import { AsyncComputed } from "signal-utils/async-computed";

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

  get servers(): AsyncComputedResult<Map<McpServerIdentifier, McpServer>> {
    return this.#servers;
  }

  #servers = new AsyncComputed(async (signal) => {
    signal.throwIfAborted();

    const result = new SignalMap<McpServerIdentifier, McpServer>();
    const inBgl = new Map<McpServerIdentifier, McpServer>();

    this.project.graphAssets.forEach((asset, value) => {
      const { connector, metadata } = asset;
      if (!connector) return;
      const url = (connector.configuration as McpConnectorConfiguration)
        .configuration.endpoint;
      if (connector.type.url !== MCP_CONNECTOR_URL) return;
      // We currently override items in the list with what's in the BGL.
      // This is probably fine, but we might want to consider a more nuanced
      // reconciliation of what's stored in server list and what's in BGL.
      const id = this.#createId(url);
      inBgl.set(id, {
        title: metadata?.title || connector.id,
        details: {
          name: "name goes here",
          version: "0.0.1",
          url,
        },
        instanceId: value as McpServerInstanceIdentifier,
        removable: true,
      });
    });

    const stored = await this.#serverList.list();
    if (!ok(stored)) {
      console.warn("Unable to load stored MCP servers", stored.$error);
    } else {
      for (const info of stored) {
        result.set(this.#createId(info.url), {
          title: info.title,
          details: { name: info.title, version: "0.0.1", url: info.url },
          removable: true,
        });
      }
    }

    inBgl.forEach((value, key) => result.set(key, value));

    return result;
  });

  async #addAsset(
    url: string,
    title: string
  ): Promise<Outcome<McpServerInstanceIdentifier>> {
    const id: McpServerInstanceIdentifier = this.#createInstanceId();
    const adding = await this.project.organizer.addGraphAsset({
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
    if (!ok(adding)) return adding;
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
    if (server.instanceId) {
      return err(`MCP Server "${id}" is already registered`);
    }

    const adding = await this.#addAsset(server.details.url, server.title);
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
    if (!server.instanceId) {
      return err(`MCP Server "${id}" is already unregistered`);
    }

    const removing = await this.project.organizer.removeGraphAsset(
      server.instanceId
    );
    if (!ok(removing)) return removing;
  }

  async add(url: string, title: string = url): Promise<Outcome<void>> {
    // Add as new asset
    const adding = await this.#addAsset(url, title);
    if (!ok(adding)) return adding;
    // Add to the server list
    await this.#serverList.add({ url, title });
  }

  #createId(url: string) {
    return `connectors/${url
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}`;
  }

  #createInstanceId(): McpServerInstanceIdentifier {
    return `connectors/${globalThis.crypto.randomUUID()}`;
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
    if (server.instanceId) {
      const removing = await this.project.organizer.removeGraphAsset(
        server.instanceId
      );
      if (!ok(removing)) return removing;
    }
    return this.#serverList.remove(server.details.url);
  }

  async rename(_id: string, _title: string): Promise<Outcome<void>> {
    return err("Method not implemented.");
  }
}

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { Mcp, McpServer, McpServerIdentifier, ProjectInternal } from "./types";
import { signal } from "signal-utils";
import { err, ok } from "@breadboard-ai/utils";
import { SignalMap } from "signal-utils/map";

export { McpImpl };

type McpConnectorConfiguration = {
  url: string;
  configuration: {
    endpoint: string;
  };
};

const MCP_CONNECTOR_URL = "embed://a2/mcp.bgl.json";

class McpImpl implements Mcp {
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

  async register(id: McpServerIdentifier): Promise<Outcome<void>> {
    const server = this.servers.get(id);
    if (!server) {
      return err(`MCP Server "${id}" does not exist`);
    }
    if (server.registered) {
      return err(`MCP Server "${id}" is already registered`);
    }

    const adding = await this.project.organizer.addGraphAsset({
      path: id,
      data: [
        {
          parts: [
            {
              json: {
                url: "embed://a2/mcp.bgl.json",
                configuration: {
                  endpoint: server.details.url,
                },
              },
            },
          ],
        },
      ],
      metadata: {
        type: "connector",
        title: server.title,
      },
    });
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

  async add(
    _url: string,
    _title: string | undefined
  ): Promise<Outcome<McpServer>> {
    return err("Method not implemented.");
  }

  async remove(_id: McpServerIdentifier): Promise<Outcome<void>> {
    return err("Method not implemented.");
  }

  async rename(_id: string, _title: string): Promise<Outcome<void>> {
    return err("Method not implemented.");
  }
}

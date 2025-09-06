/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Implementation,
  CallToolRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { McpCallToolResult, McpClient, McpListToolResult } from "./types.js";
import { err, ok } from "@breadboard-ai/utils";
import { Outcome } from "@breadboard-ai/types";

export { ProxyBackedClient };

type ProxyBackedClientArgs = {
  /**
   * Name of the MCP server (until we have getServerVersion working)
   */
  readonly name: string;
  /**
   * URL of the MCP server
   */
  readonly url: string;
  /**
   * Authorization token for the server.
   */
  readonly token?: string;

  /**
   * Proxy base URL
   */
  readonly proxyUrl: string;
  /**
   * Authorization token for the proxy.
   */
  readonly proxyToken: string;
};

type ProxyListToolResponse = {
  functionDeclarations: {
    name: string;
    description: string;
    parameters: ListToolsResult["tools"][0]["inputSchema"];
  }[];
};

class ProxyBackedClient implements McpClient {
  constructor(public readonly args: ProxyBackedClientArgs) {}

  async connect(): Promise<void> {
    // No-op for proxy-backed client
  }

  getServerVersion(): Implementation {
    return {
      name: this.args.name,
      version: "0.0.1",
    };
  }

  async close(): Promise<void> {
    // No-op for proxy-backed client
  }

  async #call<T = unknown>(path: string, payload = {}): Promise<Outcome<T>> {
    try {
      const url = new URL(path, this.args.proxyUrl);
      let headers = {};
      const token = this.args.token;
      if (token) {
        headers = {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };
      }
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.args.proxyToken}`,
        },
        body: JSON.stringify({
          mcpServerConfig: {
            streamableHttp: {
              url: this.args.url,
              ...headers,
            },
          },
          ...payload,
        }),
      });
      return response.json();
    } catch (e) {
      return err(`Calling MCP proxy failed: ${(e as Error).message}`);
    }
  }

  async callTool(
    params: CallToolRequest["params"]
  ): Promise<McpCallToolResult> {
    const calling = await this.#call<McpCallToolResult["content"]>(
      "/v1beta1/callMcpTool",
      {
        functionCall: {
          id: "id",
          name: params.name,
          args: params.arguments,
        },
      }
    );
    if (!ok(calling)) {
      throw new Error((calling as { $error: string }).$error);
    }
    return { content: calling };
  }

  async listTools(): Promise<McpListToolResult> {
    const calling = await this.#call<ProxyListToolResponse>(
      "/v1beta1/listMcpTools"
    );
    if (!ok(calling)) {
      throw new Error(calling.$error);
    }
    if (!calling.functionDeclarations) {
      throw new Error(`Invalid response: ${JSON.stringify(calling)}`);
    }
    return {
      tools: calling.functionDeclarations.map((declaration) => ({
        ...declaration,
        inputSchema: declaration.parameters,
      })),
    };
  }
}

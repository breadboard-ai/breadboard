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
import { FunctionResponseCapabilityPart, Outcome } from "@breadboard-ai/types";
import type { OpalBackendClient } from "@breadboard-ai/types/opal-backend-client.js";

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

  readonly backendClient: Promise<OpalBackendClient>;
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
      const methodName = path.replace(/^\/?(v1beta1\/)?/, "");

      const bodyObj = {
        mcpServerConfig: {
          streamableHttp: {
            url: this.args.url,
            ...(this.args.token
              ? {
                  headers: {
                    Authorization: `Bearer ${this.args.token}`,
                  },
                }
              : {}),
          },
        },
        ...payload,
      };

      const backendClient = await this.args.backendClient;
      const response = await backendClient.sendHttpRequest(methodName, {
        method: "POST",
        body: bodyObj,
      });
      return response.json();
    } catch (e) {
      return err(`Calling MCP proxy failed: ${(e as Error).message}`);
    }
  }

  async callTool(
    params: CallToolRequest["params"]
  ): Promise<McpCallToolResult> {
    const calling = await this.#call<FunctionResponseCapabilityPart>(
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
    return calling;
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

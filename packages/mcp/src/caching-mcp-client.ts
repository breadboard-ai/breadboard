/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  Implementation,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import {
  McpCallToolResult,
  McpClient,
  McpListToolResult,
  McpServerStore,
} from "./types.js";
import { ok } from "@breadboard-ai/utils";

export { CachingMcpClient };

const CACHING_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day

class CachingMcpClient implements McpClient {
  constructor(
    private readonly url: string,
    private readonly client: McpClient,
    private readonly serverStore: McpServerStore
  ) {}

  connect(transport: Transport): Promise<void> {
    return this.client.connect(transport);
  }
  getServerVersion(): Implementation {
    return this.client.getServerVersion();
  }
  close(): Promise<void> {
    return this.client.close();
  }
  callTool(params: CallToolRequest["params"]): Promise<McpCallToolResult> {
    return this.client.callTool(params);
  }

  async listTools(): Promise<McpListToolResult> {
    const serverInfo = await this.serverStore.get(this.url);
    const noToolInfo = !serverInfo || !serverInfo.tools;
    const expired =
      serverInfo?.toolsRetrievedOn &&
      serverInfo.toolsRetrievedOn.getTime() + CACHING_DURATION_MS < Date.now();
    if (noToolInfo || expired) {
      const listToolsResponse = await this.client.listTools();
      const updatingTools = await this.serverStore.updateTools(
        this.url,
        listToolsResponse.tools
      );
      if (!ok(updatingTools)) {
        console.warn(
          "Failed to update tools in server store",
          updatingTools.$error
        );
      }
      return listToolsResponse;
    }
    return { tools: serverInfo.tools! };
  }
}

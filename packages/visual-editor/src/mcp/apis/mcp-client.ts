/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Outcome } from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";

const CLIENT_NAME = "breadboard-mcp-client";

export class McpClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;

  constructor(
    private readonly fetchWithCreds: typeof globalThis.fetch,
    url: URL,
    clientName: string = CLIENT_NAME
  ) {
    this.client = new Client({ name: clientName, version: '1.0.0' });
    this.transport = new StreamableHTTPClientTransport(url, {
      fetch: (input, init) => this.fetchWithCreds(input.toString(), { ...init, method: 'POST' }),
    });
  }

  async connect() {
    await this.client.connect(this.transport);
  }

  async close() {
    try {
      await this.transport.terminateSession();
    } catch (e) {
      // Ignore errors during termination
    }
    await this.client.close();
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<Outcome<any>> {
    try {
      const result = await this.client.callTool({ name, arguments: args });
      if ("isError" in result && result.isError) {
        const content = result.content;
        const firstItem = Array.isArray(content) ? content[0] : undefined;
        return err((firstItem as any)?.text || "Unknown error");
      }
      const content = "structuredContent" in result
        ? (result.structuredContent || result.content)
        : result;
      const structured_result = {
        parts: [
          {
            functionResponse: {
              name,
              response: { content: JSON.stringify(content) },
            },
          },
          { text: typeof content === 'string' ? content : JSON.stringify(content) },
        ],
      };
      return { structured_result } as any;
    } catch (error) {
      return err((error as Error).message);
    }
  }
}

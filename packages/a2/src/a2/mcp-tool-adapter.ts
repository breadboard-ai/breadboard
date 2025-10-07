/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CallToolResultContent, McpClient } from "@breadboard-ai/mcp";
import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";
import { StreamableReporter } from "./output";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";
import { filterUndefined, ok } from "@breadboard-ai/utils";
import { err, ErrorWithMetadata } from "./utils";
import { DescriberResult } from "./common";
import { ListToolResult } from "./connector-manager";

export { McpToolAdapter };

const NOT_ALLOWED_MARKER = "\nMCP_SERVER_NOT_ALLOWED";

type CallToolAdapterResponse = {
  structured_result: LLMContent;
  isError?: boolean;
  saveOutputs?: boolean;
};

function isNotAllowed(error: ErrorWithMetadata) {
  return error.$error.includes(NOT_ALLOWED_MARKER);
}
class McpToolAdapter {
  #client: Promise<Outcome<McpClient>>;

  constructor(
    private readonly caps: Capabilities,
    moduleArgs: A2ModuleFactoryArgs,
    private readonly url: string
  ) {
    this.#client = moduleArgs.mcpClientManager.createClient(url, {
      name: "Breadboard",
      title: "Breadboard",
      version: "0.0.1",
    });
  }

  async listTools(): Promise<Outcome<ListToolResult[]>> {
    const reporter = new StreamableReporter(this.caps, {
      title: `Asking MCP server to list tools`,
      icon: "robot_server",
    });
    try {
      await reporter.start();
      await reporter.sendUpdate(
        "MCP Server Request",
        { listTools: {} },
        "upload"
      );

      const client = await this.#client;
      if (!ok(client)) {
        return reporter.sendError(client);
      }

      const listingTools = await client.listTools();
      if (!ok(listingTools)) {
        if (isNotAllowed(listingTools)) {
          return reporter.sendError(
            err(`"${this.url} is not an allowed MCP Server`)
          );
        }
        return reporter.sendError(listingTools);
      }
      await reporter.sendUpdate(
        "MCP Server Response",
        listingTools,
        "download"
      );
      // Transform to the ToolManager format.
      const list = listingTools.tools.map((item) => {
        return {
          url: this.url,
          description: { ...item, title: item.name } as DescriberResult,
          passContext: false,
        };
      });
      return list;
    } finally {
      await reporter.close();
    }
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<Outcome<CallToolAdapterResponse>> {
    const reporter = new StreamableReporter(this.caps, {
      title: `Asking MCP server to call a tool`,
      icon: "robot_server",
    });
    try {
      await reporter.start();
      await reporter.sendUpdate(
        "MCP Server Request",
        { callTool: { name, arguments: args } },
        "upload"
      );

      const client = await this.#client;
      if (!ok(client)) {
        return reporter.sendError(client);
      }

      const callingTool = await client.callTool({
        name,
        arguments: args,
      });
      if (!ok(callingTool)) {
        if (isNotAllowed(callingTool)) {
          return reporter.sendError(
            err(`"${this.url} is not an allowed MCP Server`)
          );
        }

        return reporter.sendError(callingTool);
      }
      await reporter.sendUpdate("MCP Server Response", callingTool, "download");
      if ("functionResponse" in callingTool) {
        return {
          structured_result: {
            parts: [
              { functionResponse: { ...callingTool.functionResponse, name } },
            ],
          },
        };
      }
      const { isError, saveOutputs, content } = callingTool;
      const structured_result = mcpToLLmContent(name, content);
      return filterUndefined({ structured_result, isError, saveOutputs });
    } finally {
      await reporter.close();
    }
  }
}

function mcpToLLmContent(
  name: string,
  response: CallToolResultContent
): LLMContent {
  const content: LLMContent = { parts: [] };
  const { parts } = content;
  parts.push({
    functionResponse: {
      name,
      response: { content: JSON.stringify(response) },
    },
  });
  response.forEach((data) => {
    switch (data.type) {
      case "text": {
        parts.push({ text: data.text });
        break;
      }
      case "image":
        parts.push({
          inlineData: { data: data.data, mimeType: data.mimeType },
        });
        break;
      case "resource_link":
        if (data._meta?.storedData) {
          parts.push({
            storedData: { handle: data.uri, mimeType: data.mimeType! },
          });
        } else {
          parts.push({
            fileData: { fileUri: data.uri, mimeType: data.mimeType! },
          });
        }
        break;
    }
  });
  return content;
}

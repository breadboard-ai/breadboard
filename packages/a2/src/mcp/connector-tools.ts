/**
 * @fileoverview The tools export for the connector.
 */

import { LLMContent } from "@breadboard-ai/types";
import type { ListToolResult } from "../a2/connector-manager";
import { createTools } from "../a2/connector-manager";
import { StreamableReporter } from "../a2/output";
import { err, ErrorWithMetadata, ok } from "../a2/utils";
import { McpClient } from "./mcp-client";
import { CallToolResponse } from "./types";
import { filterUndefined } from "@breadboard-ai/utils";

export { invoke as default, describe };

const NOT_ALLOWED_MARKER = "\nMCP_SERVER_NOT_ALLOWED";

type Configuration = {
  endpoint: string;
};

function isNotAllowed(error: ErrorWithMetadata) {
  return error.$error.includes(NOT_ALLOWED_MARKER);
}

const { invoke, describe } = createTools<Configuration>({
  title: "MCP Server",
  list: async (caps, _id, info) => {
    const reporter = new StreamableReporter(caps, {
      title: `Calling MCP Server`,
      icon: "robot_server",
    });
    try {
      await reporter.start();
      await reporter.sendUpdate(
        "MCP Server Request",
        { listTools: {} },
        "upload"
      );

      const client = new McpClient(caps, {
        url: info.configuration.endpoint,
        info: {
          name: "Breadboard",
          title: "Breadboard",
          version: "0.0.1",
        },
      });

      const listingTools = await client.listTools();
      if (!ok(listingTools)) {
        if (isNotAllowed(listingTools)) {
          return reporter.sendError(
            err(`"${info.configuration.endpoint} is not an allowed MCP Server`)
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
      const list = listingTools.map<ListToolResult>((item) => {
        return {
          url: info.url,
          description: { ...item, title: item.name },
          passContext: false,
        };
      });
      return { list };
    } finally {
      await reporter.close();
    }
  },
  invoke: async (caps, _id, info, name, args) => {
    const reporter = new StreamableReporter(caps, {
      title: `Calling MCP Server`,
      icon: "robot_server",
    });
    try {
      await reporter.start();
      await reporter.sendUpdate(
        "MCP Server Request",
        { callTool: { name, arguments: args } },
        "upload"
      );

      const client = new McpClient(caps, {
        url: info.configuration.endpoint,
        info: {
          name: "Breadboard",
          title: "Breadboard",
          version: "0.0.1",
        },
      });

      const callingTool = await client.callTool({
        name,
        arguments: args,
      });
      if (!ok(callingTool)) {
        if (isNotAllowed(callingTool)) {
          return reporter.sendError(
            err(`"${info.configuration.endpoint} is not an allowed MCP Server`)
          );
        }

        return reporter.sendError(callingTool);
      }
      await reporter.sendUpdate("MCP Server Response", callingTool, "download");
      return filterUndefined({
        structured_result: mcpToLLmContent(name, callingTool.content),
        isError: callingTool.isError,
        saveOutputs: callingTool.saveOutputs,
      });
    } finally {
      await reporter.close();
    }
  },
});

function mcpToLLmContent(
  name: string,
  response: CallToolResponse["content"]
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
        if (data.meta?.storedData) {
          parts.push({
            storedData: { handle: data.uri, mimeType: data.mimeType },
          });
        } else {
          parts.push({
            fileData: { fileUri: data.uri, mimeType: data.mimeType },
          });
        }
        break;
    }
  });
  return content;
}

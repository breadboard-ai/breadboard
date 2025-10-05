/**
 * @fileoverview The tools export for the connector.
 */

import { LLMContent } from "@breadboard-ai/types";
import { createTools } from "../a2/connector-manager";
import { StreamableReporter } from "../a2/output";
import { err, ErrorWithMetadata, ok } from "../a2/utils";
import { CallToolResponse } from "./types";
import { filterUndefined } from "@breadboard-ai/utils";
import { DescriberResult } from "../a2/common";

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
  list: async (caps, args, _id, info) => {
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

      const client = await args.mcpClientManager.createClient(
        info.configuration.endpoint,
        {
          name: "Breadboard",
          title: "Breadboard",
          version: "0.0.1",
        }
      );
      if (!ok(client)) {
        return reporter.sendError(client);
      }

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
      const list = listingTools.tools.map((item) => {
        return {
          url: info.url,
          description: { ...item, title: item.name } as DescriberResult,
          passContext: false,
        };
      });
      return { list };
    } finally {
      await reporter.close();
    }
  },
  invoke: async (caps, moduleArgs, _id, info, name, args) => {
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

      const client = await moduleArgs.mcpClientManager.createClient(
        info.configuration.endpoint,
        {
          name: "Breadboard",
          title: "Breadboard",
          version: "0.0.1",
        }
      );
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
            err(`"${info.configuration.endpoint} is not an allowed MCP Server`)
          );
        }

        return reporter.sendError(callingTool);
      }
      await reporter.sendUpdate("MCP Server Response", callingTool, "download");
      return filterUndefined({
        structured_result: mcpToLLmContent(
          name,
          callingTool.content as CallToolResponse["content"]
        ),
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

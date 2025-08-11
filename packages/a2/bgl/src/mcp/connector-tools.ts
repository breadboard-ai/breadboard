/**
 * @fileoverview The tools export for the connector.
 */

import type { ListToolResult } from "../a2/connector-manager";
import { createTools } from "../a2/connector-manager";
import { StreamableReporter } from "../a2/output";
import { ok } from "../a2/utils";
import { McpClient } from "./mcp-client";

export { invoke as default, describe };

type Configuration = {
  endpoint: string;
};

const { invoke, describe } = createTools<Configuration>({
  title: "MCP Server",
  list: async (_id, info) => {
    const reporter = new StreamableReporter({
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

      const client = new McpClient({
        url: info.configuration.endpoint,
        info: {
          name: "Breadboard",
          title: "Breadboard",
          version: "0.0.1",
        },
      });

      const listingTools = await client.listTools();
      if (!ok(listingTools)) {
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
  invoke: async (_id, info, name, args) => {
    const reporter = new StreamableReporter({
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

      const client = new McpClient({
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
        return reporter.sendError(callingTool);
      }
      await reporter.sendUpdate("MCP Server Response", callingTool, "download");
      return { result: JSON.stringify(callingTool) };
    } finally {
      await reporter.close();
    }
  },
});

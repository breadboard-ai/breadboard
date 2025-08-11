/**
 * @fileoverview The tools export for the connector.
 */

import type { ListToolResult } from "../a2/connector-manager";
import { createTools } from "../a2/connector-manager";
import { StreamableReporter } from "../a2/output";
import { rpc } from "../a2/rpc";
import { ok } from "../a2/utils";
import type { CallToolContent, ListToolsTool } from "./types";

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

      const listingTools = await rpc<ListToolsTool[]>({
        path: "/mnt/mcp/call/listTools",
        data: {
          url: info.configuration.endpoint,
          clientName: "Breadboard",
        },
      });
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
      const callingTool = await rpc<CallToolContent[]>({
        path: "/mnt/mcp/call/callTool",
        data: {
          url: info.configuration.endpoint,
          clientName: "Breadboard",
          name,
          arguments: args,
        },
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

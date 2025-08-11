/**
 * @fileoverview Add a description for your module here.
 */

import { createConfigurator } from "../a2/connector-manager";
import { rpc } from "../a2/rpc";
import { llm, ok } from "../a2/utils";
import type { Implementation } from "./types";

export { invoke as default, describe };

const CONNECTOR_TITLE = "MCP Server";

type McpConfiguration = {
  endpoint?: string;
};

const { invoke, describe } = createConfigurator<McpConfiguration>({
  title: CONNECTOR_TITLE,
  initialize: async () => {
    return { title: CONNECTOR_TITLE, configuration: {} };
  },
  preview: async ({ configuration }) => {
    const endpoint = configuration.endpoint;
    if (!endpoint) return [llm``.asContent()];
    const gettingInfo = await rpc<Implementation>({
      path: "/mnt/mcp/call/info",
      data: {
        url: endpoint,
        clientName: "Breadboard",
      },
    });
    if (!ok(gettingInfo)) {
      return [llm`${endpoint}`.asContent()];
    }
    return [
      llm`**${gettingInfo.title || gettingInfo.name}**\nMCP server at ${endpoint}`.asContent(),
    ];
  },
  read: async ({ configuration }) => {
    return {
      schema: {
        type: "object",
        properties: {
          endpoint: {
            type: "string",
            title: "URL",
            description: "The URL of the MCP Server's Streamable HTTP endpoint",
          },
        },
      },
      values: configuration,
    };
  },
});

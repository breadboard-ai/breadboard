/**
 * @fileoverview Add a description for your module here.
 */

import { err, ok, llm } from "./a2/utils";
import { createConfigurator } from "./a2/connector-manager";
import { McpClient } from "./mcp-client";

import read from "@read";
import write from "@write";

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
  preview: async ({ id, configuration }) => {
    const endpoint = configuration.endpoint;
    if (!endpoint) return [llm``.asContent()];
    const client = new McpClient(id, endpoint);
    const info = await client.connect();
    if (!ok(info)) {
      return [llm`${endpoint}`.asContent()];
    }
    return [
      llm`**${info.serverInfo.name}**\nMCP server at ${endpoint}`.asContent(),
    ];
  },
  read: async ({ id, configuration }) => {
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

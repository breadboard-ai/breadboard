/**
 * @fileoverview The tools export for the connector.
 */

import type { ConnectorInfo, ListToolResult } from "../a2/connector-manager";
import { createTools } from "../a2/connector-manager";
import { ok } from "../a2/utils";
import { McpClient } from "./mcp-client";

export { invoke as default, describe };

type Configuration = {
  endpoint: string;
};

async function getClient(
  id: string,
  info: ConnectorInfo<Configuration>
): Promise<Outcome<McpClient>> {
  const url = info.configuration.endpoint;
  const client = new McpClient(id, url);
  const connecting = await client.connect();
  if (!ok(connecting)) return connecting;
  return client;
}

const { invoke, describe } = createTools<Configuration>({
  title: "MCP Server",
  list: async (id, info) => {
    const client = await getClient(id, info);
    if (!ok(client)) return client;
    const listing = await client.listTools();
    if (!ok(listing)) return listing;

    // Transform to the ToolManager format.
    const list = listing.map<ListToolResult>((item) => {
      return {
        url: info.url,
        description: { ...item, title: item.name },
        passContext: false,
      };
    });
    return { list };
  },
  invoke: async (id, info, name, args) => {
    const client = await getClient(id, info);
    if (!ok(client)) return client;
    // const connecting = await client.connect();
    // if (!ok(connecting)) return connecting;
    const invoking = await client.callTool(name, args);
    if (!ok(invoking)) return invoking;
    return { result: JSON.stringify(invoking) };
  },
});

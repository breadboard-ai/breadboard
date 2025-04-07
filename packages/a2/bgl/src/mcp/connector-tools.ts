/**
 * @fileoverview The tools export for the connector.
 */

import { err, ok } from "./a2/utils";
import { McpClient } from "./mcp-client";
import type {
  ListToolResult,
  ListMethodOutput,
  InvokeMethodOutput,
} from "./a2/connector-manager";

export { invoke as default, describe };

type Inputs =
  | {
      method: "list";
      id: string;
      info: {
        url: string;
        configuration: {
          endpoint: string;
        };
      };
    }
  | {
      method: "invoke";
      id: string;
      info: {
        url: string;
        configuration: {
          endpoint: string;
        };
      };
      name: string;
      args: Record<string, unknown>;
    };

type Outputs = ListMethodOutput | InvokeMethodOutput;

async function invoke(inputs: Inputs): Promise<Outcome<Outputs>> {
  const { method, id, info } = inputs;
  const endpoint = info.configuration.endpoint;
  // for now, wrap it to point at MCP proxy
  const url = `http://127.0.0.1:6277/sse?transportType=sse&url=${encodeURIComponent(endpoint)}`;
  const client = new McpClient(id, url);
  const connecting = await client.connect();
  if (!ok(connecting)) return connecting;

  if (method === "list") {
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
  } else if (method === "invoke") {
    const { name, args } = inputs;
    const invoking = await client.callTool(
      name,
      args as Record<string, JsonSerializable>
    );
    if (!ok(invoking)) return invoking;
    return { result: JSON.stringify(invoking) };
  }
  return err(`Unknown method: "${method}""`);
}

async function describe() {
  return {
    title: "MCP Server Tool Export",
    metadata: {
      tags: ["connector-tools"],
    },
    inputSchema: {
      type: "object",
    } satisfies Schema,
    outputSchema: {
      type: "object",
    } satisfies Schema,
  };
}

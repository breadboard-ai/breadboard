/**
 * @fileoverview The tools export for the connector.
 */

import { err, ok } from "./a2/utils";
import type {
  ListToolResult,
  ListMethodOutput,
  InvokeMethodOutput,
  ConnectorInfo,
} from "./a2/connector-manager";
import { createTools } from "./a2/connector-manager";
import { executeTool } from "./a2/step-executor";
import type { Configuration, ToolArgs } from "./types";

export { invoke as default, describe };

const QUERY_TOOL = "query_notebooklm";

const { invoke, describe } = createTools<Configuration, ToolArgs>({
  title: "NotebookLM",
  list: async (id, info) => {
    const list: ListToolResult[] = [
      {
        url: info.url,
        description: {
          title: QUERY_TOOL,
          description:
            "Given a query, replies with a snippet of relevant content from NotebookLM",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "The text query" },
            },
          },
        },
        passContext: false,
      },
    ];
    return { list };
  },
  invoke: async (id, info, name, args) => {
    if (name !== QUERY_TOOL) {
      return err(`Unknown tool "${name}"`);
    }
    const { notebookId } = info.configuration;
    const { query } = args;
    if (!notebookId) {
      return err(`First, select the notebook to query.`);
    }

    const executing = await executeTool("notebooklm_query", {
      project_id: notebookId,
      query,
    });
    if (!ok(executing)) return executing;

    return { result: JSON.stringify(executing) };
  },
});

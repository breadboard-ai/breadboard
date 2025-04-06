/**
 * @fileoverview The tools export for the connector.
 */

export { invoke as default, describe };

async function invoke({ context }: { context: LLMContent[] }) {
  return { context };
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

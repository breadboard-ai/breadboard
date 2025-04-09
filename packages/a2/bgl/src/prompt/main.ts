/**
 * @fileoverview Add a description for your module here.
 */

export { invoke as default, describe };

async function invoke({ context }: { context: LLMContent[] }) {
  return { context };
}

async function describe() {
  return {
    title: "Prompt",
    description: "Saves outputs using a provided connector",
    metadata: {
      icon: "combine-outputs",
      tags: ["quick-access", "core", "experimental"],
      order: 102,
    },
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
        },
      },
    } satisfies Schema,
  };
}

/**
 * @fileoverview Add a description for your module here.
 */

import input from "@input";

export { invoke as default, describe };

async function invoke({ context: _context }: { context: LLMContent[] }) {
  const result = await input({
    schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          title: "Name",
          description: "Name",
        },
        location: {
          type: "object",
          behavior: ["llm-content"],
          title: "Location",
        },
      },
    },
  });
  console.log("RESULT", result);
  return result;
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
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

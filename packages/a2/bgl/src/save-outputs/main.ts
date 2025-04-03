/**
 * @fileoverview Saves outputs using a provided connector.
 */
import { Template } from "./a2/template";
import { ok } from "./a2/utils";

export { invoke as default, describe };

type Inputs = {
  /**
   * Context that will be saved.
   */
  context?: LLMContent[];
  /**
   * The connectors that will be used to save this context.
   */
  connectors?: LLMContent;
  [s: string]: unknown;
};

type Outputs = {
  context?: LLMContent[];
};

async function invoke({
  context,
  connectors,
  ...options
}: Inputs): Promise<Outcome<Outputs>> {
  const template = new Template(connectors);
  const saving = await template.save(context, options);
  if (!ok(saving)) return saving;
  return { context };
}

type DescribeInputs = {
  inputs: Inputs;
};

async function describe({ inputs }: DescribeInputs) {
  const template = new Template(inputs.connectors);
  return {
    title: "Save Outputs",
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
          behavior: ["main-port"],
        },
        connectors: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Connectors",
          description:
            "Specify destination connectors: the outputs will be saved into these connectors",
        },
        ...(await template.schemaProperties()),
      },
      behavior: ["at-wireable"],
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
          behavior: ["main-port"],
        },
      },
    } satisfies Schema,
  };
}

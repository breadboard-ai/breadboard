/**
 * @fileoverview Add a description for your module here.
 */

export { invoke as default, describe };

type Inputs =
  | {
      context?: LLMContent[];
      selector?: "cold";
      heat?: "stove" | "microwave" | "sun";
    }
  | {
      context?: LLMContent[];
      selector?: "hot";
    }
  | {
      context?: LLMContent[];
      selector?: "lgtm";
    };

type DescribeInputs = {
  inputs: Inputs;
};

async function invoke({ context }: { context: LLMContent[] }) {
  return { context };
}

async function describe({ inputs }: DescribeInputs) {
  const selector = inputs.selector || "lgtm";
  let extraSchema: Record<string, Schema> = {};
  switch (inputs.selector) {
    case "hot": {
      extraSchema = {
        cool: {
          type: "boolean",
          title: "Cool it",
          behavior: ["config", "hint-preview"],
          description: "Check to blow on porridge to cool it down",
        },
      };
      break;
    }
    case "lgtm": {
      extraSchema = {
        perfect: {
          type: "object",
          title: "Praise it",
          behavior: ["config", "hint-preview", "llm-content"],
          description: "Enter the words of praise for perfect porridge",
        },
      };
      break;
    }
    case "cold": {
      extraSchema = {
        heat: {
          type: "string",
          title: "Heat it",
          behavior: ["config", "hint-preview", "reactive"],
          description: "Heat the porridge using these methods",
          enum: [
            { title: "Stove", id: "stove", icon: "generative" },
            { title: "Microwave", id: "microwave", icon: "merge-type" },
            { title: "Sun", id: "sun", icon: "code-blocks" },
          ],
        },
      };
      const heat = inputs.heat || "stove";
      switch (heat) {
        case "stove": {
          extraSchema = {
            ...extraSchema,
            temperature: {
              type: "string",
              title: "Heat Level",
              description: "Specify heat level",
              behavior: ["config", "hint-preview"],
              enum: ["Low", "Medium", "High"],
            },
          };
          break;
        }
        case "microwave": {
          extraSchema = {
            ...extraSchema,
            time: {
              type: "string",
              title: "Time",
              behavior: ["config", "hint-preview"],
              description: "Specify time in minutes for microwaving",
            },
          };
          break;
        }
      }
      break;
    }
  }
  return {
    title: "Reactive Step",
    metadata: {
      icon: "generative",
    },
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          title: "Porridge Temperature",
          enum: [
            { title: "Hot", id: "hot", icon: "human" },
            { title: "Just Right", id: "lgtm", icon: "smart-toy" },
            { title: "Cold", id: "cold", icon: "laps" },
          ],
          behavior: ["config", "reactive", "hint-preview"],
        },
        ...extraSchema,
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

/**
 * @fileoverview Add a description for your module here.
 */

import describeGraph from "@describe";
import invokeGraph from "@invoke";

import { ok } from "./a2/utils";
import { type Params } from "./a2/common";

export { invoke as default, describe };

type GenerationModes = (typeof MODES)[number];

type Inputs = {
  context?: LLMContent[];
  "generation-mode"?: GenerationModes["id"];
} & Params;

type DescribeInputs = {
  inputs: Inputs;
};

const MODES = [
  {
    id: "./a2.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c",
    title: "Generate Text",
    icon: "generative-text",
  },
  {
    id: "./a2.bgl.json#module:image-generator",
    title: "Generate Image",
    icon: "generative-image",
  },
  {
    id: "./audio-generator.bgl.json#module:main",
    title: "Generate Audio",
    icon: "generative-audio",
  },
  {
    id: "./video-generator.bgl.json#module:main",
    title: "Generate Video",
    icon: "generative-video",
  },
  {
    id: "./go-over-list.bgl.json#module:main",
    title: "Think and Execute",
    icon: "generative",
  },
] as const;

const DEFAULT_MODE = MODES[0];

async function invoke({ "generation-mode": mode, ...rest }: Inputs) {
  const $board = mode || DEFAULT_MODE.id;
  return await invokeGraph({ $board, ...rest });
}

async function describe({ inputs }: DescribeInputs) {
  const mode = inputs["generation-mode"] || DEFAULT_MODE.id;

  const describing = await describeGraph({ url: mode, inputs });
  let modeSchema: Record<string, Schema> = {};
  if (ok(describing)) {
    modeSchema = describing.inputSchema.properties || modeSchema;
  }

  return {
    title: "Generate",
    description: "Uses Gemini to generate content and call tools",
    metadata: {
      icon: "generative",
      tags: ["quick-access", "generative", "experimental"],
      order: 1,
    },
    inputSchema: {
      type: "object",
      properties: {
        "generation-mode": {
          type: "string",
          title: "Mode",
          enum: MODES as unknown as SchemaEnumValue[],
          behavior: ["config", "hint-preview", "reactive", "hint-controller"],
        },
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
        },
        ...modeSchema,
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

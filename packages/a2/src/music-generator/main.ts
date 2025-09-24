/**
 * @fileoverview Generates music output using supplied context.
 */

import {
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { type DescriberResult } from "../a2/common";
import { ArgumentNameGenerator } from "../a2/introducer";
import { ListExpander } from "../a2/lists";
import {
  executeStep,
  type ContentMap,
  type ExecuteStepRequest,
} from "../a2/step-executor";
import { Template } from "../a2/template";
import { ToolManager } from "../a2/tool-manager";
import {
  defaultLLMContent,
  encodeBase64,
  joinContent,
  ok,
  toLLMContent,
  toText,
  toTextConcat,
} from "../a2/utils";

type AudioGeneratorInputs = {
  context: LLMContent[];
  text: LLMContent;
};

type AudioGeneratorOutputs = {
  context: LLMContent[] | DescriberResult;
};

export { invoke as default, describe };

async function callMusicGen(
  caps: Capabilities,
  prompt: string
): Promise<Outcome<LLMContent>> {
  const executionInputs: ContentMap = {};
  executionInputs["prompt"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: encodeBase64(prompt),
      },
    ],
  };
  const inputParameters: string[] = ["prompt"];
  const body = {
    planStep: {
      stepName: "GenerateMusic",
      modelApi: "generate_music",
      inputParameters: inputParameters,
      systemPrompt: "",
      output: "generated_music",
    },
    execution_inputs: executionInputs,
  } satisfies ExecuteStepRequest;
  const response = await executeStep(caps, body);
  if (!ok(response)) return response;

  return response.chunks.at(0)!;
}

async function invoke(
  { context, text, ...params }: AudioGeneratorInputs,
  caps: Capabilities
): Promise<Outcome<AudioGeneratorOutputs>> {
  context ??= [];
  let instructionText = "";
  if (text) {
    instructionText = toText(text).trim();
  }
  const template = new Template(caps, toLLMContent(instructionText));
  const toolManager = new ToolManager(caps, new ArgumentNameGenerator(caps));
  const substituting = await template.substitute(
    params,
    async ({ path: url, instance }) => toolManager.addTool(url, instance)
  );
  if (!ok(substituting)) {
    return substituting;
  }

  console.log("context");
  console.log(context);
  console.log("instruction");
  console.log(text);
  console.log("substituting");
  console.log(substituting);
  const results = await new ListExpander(substituting, context).map(
    async (itemInstruction, itemContext) => {
      const combinedInstruction = toTextConcat(
        joinContent(toText(itemInstruction), itemContext, false)
      );
      if (!combinedInstruction) {
        return toLLMContent("Please provide the music prompt.");
      }
      console.log("PROMPT: ", combinedInstruction);
      return callMusicGen(caps, combinedInstruction);
    }
  );
  if (!ok(results)) return results;
  return { context: results };
}

type DescribeInputs = {
  inputs: {
    text?: LLMContent;
  };
};

async function describe(
  { inputs: { text } }: DescribeInputs,
  caps: Capabilities
) {
  const template = new Template(caps, text);
  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
          behavior: ["main-port"],
        },
        text: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Text",
          description:
            "Construct the music generation prompt. Use @ to reference previous step outputs.",
          default: defaultLLMContent(),
        },
        ...template.schemas(),
      },
      behavior: ["at-wireable"],
      ...template.requireds(),
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
          behavior: ["hint-audio", "main-port"],
        },
      },
      additionalProperties: false,
    } satisfies Schema,
    title: "Make Music",
    metadata: {
      icon: "generative-audio",
      tags: ["quick-access", "generative"],
      order: 3,
    },
  };
}

/**
 * @fileoverview Generates music output using supplied context.
 */

import {
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { type DescriberResult } from "../a2/common.js";
import { ArgumentNameGenerator } from "../a2/introducer.js";
import {
  executeStep,
  type ContentMap,
  type ExecuteStepRequest,
  type ExecuteStepArgs,
} from "../a2/step-executor.js";
import { Template } from "../a2/template.js";
import { ToolManager } from "../a2/tool-manager.js";
import {
  defaultLLMContent,
  encodeBase64,
  joinContent,
  ok,
  toLLMContent,
  toText,
  toTextConcat,
} from "../a2/utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { createReporter } from "../agent/progress-work-item.js";

type AudioGeneratorInputs = {
  context: LLMContent[];
  text: LLMContent;
};

type AudioGeneratorOutputs = {
  context: LLMContent[] | DescriberResult;
};

export { invoke as default, describe, callMusicGen, makeMusicInstruction };

function makeMusicInstruction() {
  return `Generate music using the prompt below. Use that prompt exactly.\n\nPROMPT:`;
}

async function callMusicGen(
  caps: Capabilities,
  args: ExecuteStepArgs,
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
  const body: ExecuteStepRequest = {
    planStep: {
      stepName: "GenerateMusic",
      modelApi: "generate_music",
      inputParameters: inputParameters,
      systemPrompt: "",
      output: "generated_music",
    },
    execution_inputs: executionInputs,
  };
  const response = await executeStep(caps, args, body);
  if (!ok(response)) return response;

  return response.chunks.at(0)!;
}

async function invoke(
  { context, text, ...params }: AudioGeneratorInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<AudioGeneratorOutputs>> {
  context ??= [];
  let instructionText = "";
  if (text) {
    instructionText = toText(text).trim();
  }
  const template = new Template(
    caps,
    toLLMContent(instructionText),
    moduleArgs.context.currentGraph
  );
  const toolManager = new ToolManager(
    caps,
    moduleArgs,
    new ArgumentNameGenerator(caps, moduleArgs)
  );
  const substituting = await template.substitute(params, async (part) =>
    toolManager.addTool(part)
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
  // Process single item directly (list support removed)
  const itemContext = [...context];
  const combinedInstruction = toTextConcat(
    joinContent(toText(substituting), itemContext, false)
  );
  if (!combinedInstruction) {
    return { context: [toLLMContent("Please provide the music prompt.")] };
  }
  console.log("PROMPT: ", combinedInstruction);
  const reporter = createReporter(moduleArgs, {
    title: `Generating Music`,
    icon: "audio_magic_eraser",
  });
  const executeStepArgs: ExecuteStepArgs = { ...moduleArgs, reporter };
  const result = await callMusicGen(caps, executeStepArgs, combinedInstruction);
  if (!ok(result)) return result;
  return { context: [result] };
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

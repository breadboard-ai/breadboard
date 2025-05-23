/**
 * @fileoverview Generates music output using supplied context.
 */

import gemini, {
  defaultSafetySettings,
  type GeminiOutputs,
  type GeminiInputs,
} from "./a2/gemini";
import {
  err,
  ok,
  llm,
  toLLMContent,
  toLLMContentInline,
  toLLMContentStored,
  toTextConcat,
  joinContent,
  toText,
  defaultLLMContent,
} from "./a2/utils";
import { Template } from "./a2/template";
import { ToolManager } from "./a2/tool-manager";
import { type DescriberResult } from "./a2/common";
import { ArgumentNameGenerator } from "./a2/introducer";
import {
  type ContentMap,
  type ExecuteStepRequest,
  executeStep,
} from "./a2/step-executor";
import { ListExpander } from "./a2/lists";

type AudioGeneratorInputs = {
  context: LLMContent[];
  text: LLMContent;
};

type AudioGeneratorOutputs = {
  context: LLMContent[] | DescriberResult;
};

export { invoke as default, describe };

async function callMusicGen(prompt: string): Promise<LLMContent> {
  const executionInputs: ContentMap = {};
  const encodedPrompt = btoa(unescape(encodeURIComponent(prompt)));
  executionInputs["prompt"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: encodedPrompt,
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
  const response = await executeStep(body);
  if (!ok(response)) {
    return toLLMContent("Music generation failed: " + response.$error);
  }
  if (!response.executionOutputs) {
    return toLLMContent("Music returned no audio");
  }

  let returnVal;
  for (let value of Object.values(response.executionOutputs)) {
    const mimetype = value.chunks[0].mimetype;
    if (mimetype.startsWith("audio")) {
      if (mimetype.endsWith("/storedData")) {
        returnVal = toLLMContentStored(
          mimetype.replace("/storedData", ""),
          value.chunks[0].data
        );
      } else {
        returnVal = toLLMContentInline(mimetype, value.chunks[0].data);
      }
    }
  }
  if (!returnVal) {
    return toLLMContent("Error: No music returned from backend");
  }
  console.log(returnVal);
  return returnVal;
}

async function invoke({
  context,
  text,
  ...params
}: AudioGeneratorInputs): Promise<Outcome<AudioGeneratorOutputs>> {
  context ??= [];
  let instructionText = "";
  if (text) {
    instructionText = toText(text).trim();
  }
  const template = new Template(toLLMContent(instructionText));
  const toolManager = new ToolManager(new ArgumentNameGenerator());
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
      return callMusicGen(combinedInstruction);
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

async function describe({ inputs: { text } }: DescribeInputs) {
  const template = new Template(text);
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

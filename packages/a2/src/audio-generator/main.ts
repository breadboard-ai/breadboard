/**
 * @fileoverview Generates audio (tts) output using supplied context.
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
  type ContentMap,
  type ExecuteStepRequest,
  executeStep,
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
import { A2ModuleFactoryArgs } from "../runnable-module-factory";

type AudioGeneratorInputs = {
  context: LLMContent[];
  text: LLMContent;
  voice: string;
};

type AudioGeneratorOutputs = {
  context: LLMContent[] | DescriberResult;
};

const VoiceMap = {
  "Male (English)": "en-US-male",
  "Female (English)": "en-US-female",
} as const; // Use 'as const' for stricter type inference

// Define a type for the keys of VoiceMap for better type safety
type VoiceOption = keyof typeof VoiceMap;

const VOICES: VoiceOption[] = Object.keys(VoiceMap) as VoiceOption[];

export { invoke as default, describe };

async function callAudioGen(
  caps: Capabilities,
  moduleArgs: A2ModuleFactoryArgs,
  prompt: string,
  voice: string
): Promise<Outcome<LLMContent>> {
  let voiceParam = "en-US-female";
  if (voice in VoiceMap) {
    voiceParam = VoiceMap[voice as VoiceOption];
  }
  const executionInputs: ContentMap = {};
  executionInputs["text_to_speak"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: encodeBase64(prompt),
      },
    ],
  };
  executionInputs["voice_key"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: encodeBase64(voiceParam),
      },
    ],
  };
  const inputParameters: string[] = ["text_to_speak"];
  const body = {
    planStep: {
      stepName: "GenerateAudio",
      modelApi: "tts",
      inputParameters: inputParameters,
      systemPrompt: "",
      output: "generated_speech",
    },
    execution_inputs: executionInputs,
  } satisfies ExecuteStepRequest;
  const response = await executeStep(caps, moduleArgs, body);
  if (!ok(response)) return response;

  return response.chunks.at(0)!;
}

async function invoke(
  { context, text, voice, ...params }: AudioGeneratorInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleFactoryArgs
): Promise<Outcome<AudioGeneratorOutputs>> {
  context ??= [];
  let instructionText = "";
  if (text) {
    instructionText = toText(text).trim();
  }
  const template = new Template(caps, toLLMContent(instructionText));
  const toolManager = new ToolManager(
    caps,
    moduleArgs,
    new ArgumentNameGenerator(caps)
  );
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
        return toLLMContent(
          "Please provide the text to be converted to speech."
        );
      }
      console.log("PROMPT: ", combinedInstruction);
      return callAudioGen(caps, moduleArgs, combinedInstruction, voice);
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
            "Construct the inputs to be spoken with text-to-speech. Use @ to reference previous step outputs.",
          default: defaultLLMContent(),
        },
        voice: {
          type: "string",
          behavior: ["hint-text", "config", "hint-advanced"],
          title: "Voice",
          icon: "voice-selection",
          enum: VOICES,
          description: "The voice you'd like to generate with",
          default: "Female (English)",
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
    title: "Make Speech",
    metadata: {
      icon: "generative-audio",
      tags: ["quick-access", "generative"],
      order: 3,
    },
  };
}

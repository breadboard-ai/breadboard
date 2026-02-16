/**
 * @fileoverview Generates audio (tts) output using supplied context.
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
  type ContentMap,
  type ExecuteStepRequest,
  type ExecuteStepArgs,
  executeStep,
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

export { callAudioGen, VOICES };

type AudioGeneratorInputs = {
  context: LLMContent[];
  text: LLMContent;
  voice: VoiceOption;
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

export { invoke as default, describe, makeSpeechInstruction };

function makeSpeechInstruction(inputs: Record<string, unknown>) {
  const voice = (inputs as AudioGeneratorInputs).voice;
  const voiceHint = voice ? ` Use ${voice} voice.` : ``;
  return `Generate speech from the text below. Use that prompt exactly.${voiceHint}\n\nPROMPT:`;
}

async function callAudioGen(
  caps: Capabilities,
  args: ExecuteStepArgs,
  prompt: string,
  voice: VoiceOption
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
  const body: ExecuteStepRequest = {
    planStep: {
      stepName: "GenerateAudio",
      modelApi: "tts",
      inputParameters: inputParameters,
      systemPrompt: "",
      output: "generated_speech",
    },
    execution_inputs: executionInputs,
  };
  const response = await executeStep(caps, args, body);
  if (!ok(response)) return response;

  return response.chunks.at(0)!;
}

async function invoke(
  { context, text, voice, ...params }: AudioGeneratorInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<AudioGeneratorOutputs>> {
  context ??= [];
  let instructionText = "";
  if (text) {
    instructionText = toText(text).trim();
  }
  const template = new Template(
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
    return {
      context: [
        toLLMContent("Please provide the text to be converted to speech."),
      ],
    };
  }
  console.log("PROMPT: ", combinedInstruction);
  const reporter = createReporter(moduleArgs, {
    title: `Generating Speech`,
    icon: "audio_magic_eraser",
  });
  const executeStepArgs: ExecuteStepArgs = { ...moduleArgs, reporter };
  const result = await callAudioGen(
    caps,
    executeStepArgs,
    combinedInstruction,
    voice
  );
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
  _caps: Capabilities
) {
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

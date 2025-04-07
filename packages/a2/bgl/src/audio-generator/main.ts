/**
 * @fileoverview Generates audio (tts) output using supplied context.
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
  prompt: string,
  voice: string
): Promise<LLMContent> {
  let voiceParam = "en-US-female";
  if (voice in VoiceMap) {
    voiceParam = VoiceMap[voice as VoiceOption];
  }
  const executionInputs: ContentMap = {};
  const encodedPrompt = btoa(unescape(encodeURIComponent(prompt)));
  executionInputs["text_to_speak"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: encodedPrompt,
      },
    ],
  };
  executionInputs["voice_key"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: btoa(voiceParam),
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
    },
    execution_inputs: executionInputs,
  } satisfies ExecuteStepRequest;
  const response = await executeStep(body);
  if (!ok(response)) {
    return toLLMContent("TTS generation failed: " + response.$error);
  }

  let returnVal;
  for (let value of Object.values(response.executionOutputs)) {
    const mimetype = value.chunks[0].mimetype;
    if (mimetype.startsWith("audio")) {
      returnVal = toLLMContentInline(mimetype, value.chunks[0].data);
    }
  }
  if (!returnVal) {
    return toLLMContent("Error: No audio returned from backend");
  }
  return returnVal;
}

async function invoke({
  context,
  text,
  voice,
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
        return toLLMContent(
          "Please provide the text to be converted to speech."
        );
      }
      console.log("PROMPT: ", combinedInstruction);
      return callAudioGen(combinedInstruction, voice);
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
            "Construct the inputs to be spoken with text-to-speech. Use @ to reference previous step outputs.",
          default: defaultLLMContent(),
        },
        voice: {
          type: "string",
          behavior: ["hint-text", "config"],
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

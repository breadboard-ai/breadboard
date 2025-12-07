/**
 * @fileoverview Utilities for generating images.
 */

import {
  Capabilities,
  InlineDataCapabilityPart,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { GeminiPrompt } from "./gemini-prompt.js";
import {
  type ContentMap,
  type ExecuteStepRequest,
  executeStep,
} from "./step-executor.js";
import {
  addUserTurn,
  encodeBase64,
  isStoredData,
  llm,
  ok,
  toInlineData,
  toLLMContent,
} from "./utils.js";
import { driveFileToBlob, toGcsAwareChunk } from "./data-transforms.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export { callGeminiImage, callImageGen, promptExpander };

const STEP_NAME = "AI Image Tool";
const OUTPUT_NAME = "generated_image";
const API_NAME = "ai_image_tool";

async function callGeminiImage(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  modelName: string,
  instruction: string,
  imageContent: LLMContent[],
  disablePromptRewrite: boolean,
  aspectRatio: string = "1:1"
): Promise<Outcome<LLMContent[]>> {
  const imageChunks = [];
  for (const element of imageContent) {
    let inlineChunk: InlineDataCapabilityPart["inlineData"] | null | "";
    if (isStoredData(element)) {
      const blobStoredData = await driveFileToBlob(
        moduleArgs,
        element.parts.at(-1)!
      );
      if (!ok(blobStoredData)) return blobStoredData;
      imageChunks.push(toGcsAwareChunk(blobStoredData));
    } else {
      inlineChunk = toInlineData(element);
      if (
        inlineChunk &&
        inlineChunk != null &&
        typeof inlineChunk != "string"
      ) {
        imageChunks.push({
          mimetype: inlineChunk.mimeType,
          data: inlineChunk.data,
        });
      }
    }
  }
  const input_parameters = ["input_instruction"];
  if (imageChunks.length > 0) {
    input_parameters.push("input_image");
  }
  console.log("Number of input images: " + String(imageChunks.length));
  const executionInputs: ContentMap = {
    input_instruction: {
      chunks: [
        {
          mimetype: "text/plain",
          data: encodeBase64(instruction),
        },
      ],
    },
    aspect_ratio_key: {
      chunks: [
        {
          mimetype: "text/plain",
          data: encodeBase64(aspectRatio),
        },
      ],
    },
  };
  if (imageChunks.length > 0) {
    executionInputs["input_image"] = {
      chunks: imageChunks,
    };
  }
  const body: ExecuteStepRequest = {
    planStep: {
      stepName: STEP_NAME,
      modelApi: API_NAME,
      inputParameters: input_parameters,
      systemPrompt: "",
      options: {
        modelName,
        disablePromptRewrite: disablePromptRewrite,
      },
      output: OUTPUT_NAME,
    },
    execution_inputs: executionInputs,
  };
  const response = await executeStep(caps, moduleArgs, body);
  if (!ok(response)) return response;

  return response.chunks;
}

async function callImageGen(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  imageInstruction: string,
  aspectRatio: string = "1:1"
): Promise<Outcome<LLMContent[]>> {
  const executionInputs: ContentMap = {};
  executionInputs["image_prompt"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: encodeBase64(imageInstruction),
      },
    ],
  };
  executionInputs["aspect_ratio_key"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: encodeBase64(aspectRatio),
      },
    ],
  };
  const inputParameters: string[] = ["image_prompt"];
  const body: ExecuteStepRequest = {
    planStep: {
      stepName: "GenerateImage",
      modelApi: "image_generation",
      inputParameters: inputParameters,
      systemPrompt: "",
      output: OUTPUT_NAME,
    },
    execution_inputs: executionInputs,
  };
  const response = await executeStep(caps, moduleArgs, body);
  if (!ok(response)) return response;

  return response.chunks;
}

function promptExpander(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  contents: LLMContent[] | undefined,
  instruction: LLMContent
): GeminiPrompt {
  const context = contents?.length
    ? "using conversation context and these additional"
    : "with these";
  const promptText = llm`Generate a single text-to-image prompt ${context} instructions:
${instruction}

Typical output format:
"""
Create the following image:

## Setting/background

<Detailed description of everything that is in the background of the image.>

## Foreground/focus

<Detailed description of object and/or shapes that are in the foreground and are the main focal point of the image. Include the composition and layout of the image.>

## Style

<Detailed description of the style, color scheme, vibe, kind of drawing (illustration, photorealistic, etc.)>

You output will be fed directly into the text-to-image model, so it must be a prompt only, no additional chit-chat
"""
`;
  return new GeminiPrompt(caps, moduleArgs, {
    body: {
      contents: addUserTurn(promptText.asContent(), contents),
      systemInstruction: toLLMContent(`
You are a creative writer whose specialty is to write prompts for text-to-image models.

The prompt must describe every object in the image in great detail and describe the style
in terms of color scheme and vibe. Be sure to respect all user provided instructions.
`),
    },
  });
}

/**
 * @fileoverview Utilities for generating images.
 */

import { GeminiPrompt } from "./gemini-prompt";
import {
  type ContentMap,
  type ExecuteStepRequest,
  executeStep,
} from "./step-executor";
import {
  addUserTurn,
  encodeBase64,
  isStoredData,
  llm,
  ok,
  toInlineData,
  toInlineReference,
  toLLMContent,
} from "./utils";

export { callGeminiImage, callImageGen, promptExpander };

const STEP_NAME = "AI Image Tool";
const OUTPUT_NAME = "generated_image";
const API_NAME = "ai_image_tool";

async function callGeminiImage(
  instruction: string,
  imageContent: LLMContent[],
  disablePromptRewrite: boolean,
  aspectRatio: string = "1:1"
): Promise<Outcome<LLMContent[]>> {
  const imageChunks = [];
  for (const element of imageContent) {
    let inlineChunk;
    if (isStoredData(element)) {
      inlineChunk = toInlineReference(element);
    } else {
      inlineChunk = toInlineData(element);
    }
    if (inlineChunk && inlineChunk != null && typeof inlineChunk != "string") {
      imageChunks.push({
        mimetype: inlineChunk.mimeType,
        data: inlineChunk.data,
      });
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
  const body = {
    planStep: {
      stepName: STEP_NAME,
      modelApi: API_NAME,
      inputParameters: input_parameters,
      systemPrompt: "",
      options: {
        disablePromptRewrite: disablePromptRewrite,
      },
      output: OUTPUT_NAME,
    },
    execution_inputs: executionInputs,
  } satisfies ExecuteStepRequest;
  const response = await executeStep(body);
  if (!ok(response)) return response;

  return response.chunks;
}

async function callImageGen(
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
  const body = {
    planStep: {
      stepName: "GenerateImage",
      modelApi: "image_generation",
      inputParameters: inputParameters,
      systemPrompt: "",
      output: OUTPUT_NAME,
    },
    execution_inputs: executionInputs,
  } satisfies ExecuteStepRequest;
  const response = await executeStep(body);
  if (!ok(response)) return response;

  return response.chunks;
}

function promptExpander(
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
  return new GeminiPrompt({
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

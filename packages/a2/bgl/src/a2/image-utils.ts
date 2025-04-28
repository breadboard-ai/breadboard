/**
 * @fileoverview Utilities for generating images.
 */

import {
  err,
  ok,
  isStoredData,
  toLLMContent,
  toLLMContentInline,
  toLLMContentStored,
  toInlineReference,
  toInlineData,
  toText,
  addUserTurn,
  llm,
} from "./utils";
import {
  type ContentMap,
  type ExecuteStepRequest,
  executeStep,
} from "./step-executor";
import { GeminiPrompt } from "./gemini-prompt";

export { callImageGen, callGeminiImage, promptExpander };

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
  const encodedInstruction = btoa(unescape(encodeURIComponent(instruction)));
  const executionInputs: ContentMap = {
    input_instruction: {
      chunks: [
        {
          mimetype: "text/plain",
          data: encodedInstruction,
        },
      ],
    },
    aspect_ratio_key: {
      chunks: [
        {
          mimetype: "text/plain",
          data: btoa(aspectRatio),
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
  // TODO(askerryryan): Remove once functional.
  console.log("request body");
  console.log(body);
  const response = await executeStep(body);
  // TODO(askerryryan): Remove once functional.
  console.log("response");
  console.log(response);
  if (!ok(response)) {
    return err(
      "Image generation failed. " +
        response.$error +
        " Check your prompt to ensure it is a valid and compliant image prompt."
    );
  }

  const outContent =
    response.executionOutputs && response.executionOutputs[OUTPUT_NAME];
  if (!outContent) {
    return err("Error: No image returned from backend");
  }
  return outContent.chunks.map((c) => {
    if (c.mimetype.endsWith("/storedData")) {
      return toLLMContentStored(c.mimetype.replace("/storedData", ""), c.data);
    }
    return toLLMContentInline(c.mimetype, c.data);
  });
}

async function callImageGen(
  imageInstruction: string,
  aspectRatio: string = "1:1"
): Promise<Outcome<LLMContent[]>> {
  const executionInputs: ContentMap = {};
  const encodedInstruction = btoa(
    unescape(encodeURIComponent(imageInstruction))
  );
  executionInputs["image_prompt"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: encodedInstruction,
      },
    ],
  };
  executionInputs["aspect_ratio_key"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: btoa(aspectRatio),
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
  console.log(response);
  if (!ok(response)) {
    return err("Image generation failed. " + response.$error);
  }

  const outContent =
    response.executionOutputs && response.executionOutputs[OUTPUT_NAME];
  if (!outContent) {
    return err("Error: No image returned from backend");
  }
  return outContent.chunks.map((c) => {
    if (c.mimetype.endsWith("/storedData")) {
      return toLLMContentStored(c.mimetype.replace("/storedData", ""), c.data);
    }
    return toLLMContentInline(c.mimetype, c.data);
  });
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

<Detailed description of object and/or shapes that are in the foreground and are the main focal point of the image>

## Style

<Detailed description of the style, color scheme, vibe, kind of drawing (illustration, photorealistic, etc.)>

You output will be fed directly into the text-to-image model, so it must be prompt only, no additional chit-chat
"""
`;
  return new GeminiPrompt({
    body: {
      contents: addUserTurn(promptText.asContent(), contents),
      systemInstruction: toLLMContent(`
You are a creative writer whose specialty is to write prompts for text-to-image models.

The prompt must describe every object in the image in great detail and describe the style
in terms of color scheme and vibe.
`),
    },
  });
}

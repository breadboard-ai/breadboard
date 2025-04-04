/**
 * @fileoverview Generates video output using supplied context.
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
  toTextConcat,
  joinContent,
  toLLMContent,
  toLLMContentInline,
  toText,
  toInlineData,
  extractInlineData,
  extractTextData,
  defaultLLMContent,
} from "./a2/utils";
import { Template } from "./a2/template";
import { ToolManager } from "./a2/tool-manager";
import { type Params } from "./a2/common";
import { type DescriberResult } from "./a2/common";
import { ArgumentNameGenerator } from "./a2/introducer";
import { ListExpander } from "./a2/lists";

import {
  type ContentMap,
  type ExecuteStepRequest,
  executeStep,
} from "./a2/step-executor";

type VideoGeneratorInputs = {
  context: LLMContent[];
  instruction?: LLMContent;
  "p-disable-prompt-rewrite": boolean;
};

type VideoGeneratorOutputs = {
  context: LLMContent[] | DescriberResult;
};

export { invoke as default, describe };

async function callVideoGen(
  prompt: string,
  imageContent: LLMContent | undefined,
  disablePromptRewrite: boolean
): Promise<LLMContent> {
  // TODO(askerryryan): Respect disablePromptRewrite;
  const executionInputs: ContentMap = {};
  const encodedPrompt = btoa(unescape(encodeURIComponent(prompt)));
  executionInputs["text_instruction"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: encodedPrompt,
      },
    ],
  };
  const inputParameters: string[] = ["text_instruction"];
  if (imageContent) {
    console.log("Image found, using i2v");
    const imageChunk = toInlineData(imageContent);
    if (!imageChunk) {
      return toLLMContent("Image content did not have expected format");
    }
    executionInputs["reference_image"] = {
      chunks: [
        {
          mimetype: imageChunk.mimeType,
          data: imageChunk.data,
        },
      ],
    };
    inputParameters.push("reference_image");
  } else {
    console.log("No image found, using t2v");
  }
  const body = {
    planStep: {
      stepName: "GenerateVideo",
      modelApi: "generate_video",
      inputParameters: inputParameters,
      systemPrompt: "",
    },
    execution_inputs: executionInputs,
  } satisfies ExecuteStepRequest;
  // TODO(askerryryan): Remove when stable.
  console.log("REQUEST:");
  console.log(body);
  const response = await executeStep(body);
  console.log("RESPONSE:");
  console.log(response);
  if (!ok(response)) {
    return toLLMContent("Video generation failed: " + response.$error);
  }

  let returnVal;
  for (let value of Object.values(response.executionOutputs)) {
    const mimetype = value.chunks[0].mimetype;
    if (mimetype.startsWith("video")) {
      returnVal = toLLMContentInline(mimetype, value.chunks[0].data);
    }
  }
  if (!returnVal) {
    return toLLMContent("Error: No video returned from backend");
  }
  return returnVal;
}

async function invoke({
  context,
  instruction,
  "p-disable-prompt-rewrite": disablePromptRewrite,
  ...params
}: VideoGeneratorInputs): Promise<Outcome<VideoGeneratorOutputs>> {
  context ??= [];
  let instructionText = "";
  if (instruction) {
    instructionText = toText(instruction).trim();
  }
  // 2) Substitute variables and magic image reference.
  // Note: it is important that images are not subsituted in here as they will
  // not be handled properly. At this point, only text variables should be left.
  const template = new Template(toLLMContent(instructionText));
  const toolManager = new ToolManager(new ArgumentNameGenerator());
  const substituting = await template.substitute(
    params,
    async ({ path: url }) => toolManager.addTool(url)
  );
  if (!ok(substituting)) {
    return substituting;
  }
  console.log("context");
  console.log(context);
  console.log("instruction");
  console.log(instruction);
  console.log("substituting");
  console.log(substituting);

  const results = await new ListExpander(substituting, context).map(
    async (itemInstruction, itemContext) => {
      // 1) Extract any image and text data from context (with history).
      let imageContext = extractInlineData(itemContext);
      const textContext = extractTextData(itemContext);

      // 3) Extract image and text data from (non-history) references.
      const refImages = extractInlineData([itemInstruction]);
      const refText = extractTextData([itemInstruction]);

      // 4) Combine with whatever data was extracted from context.
      // Validate that we did not find any images, given this isn't supported yet.
      imageContext = imageContext.concat(refImages);
      if (imageContext.length > 1) {
        return toLLMContent(
          `Video generation expects either a single text description, or text plus a single image. Got ${imageContext.length} images.`
        );
      }
      const combinedInstruction = toTextConcat(
        joinContent(toTextConcat(refText), textContext, false)
      );
      if (!combinedInstruction) {
        return toLLMContent("A video instruction must be provided.");
      }

      console.log("PROMPT: ", combinedInstruction);

      // 2) Call backend to generate video.
      const content = await callVideoGen(
        combinedInstruction,
        imageContext.at(0),
        disablePromptRewrite
      );
      return content;
    }
  );
  if (!ok(results)) return results;
  return { context: results };
}

type DescribeInputs = {
  inputs: {
    instruction?: LLMContent;
  };
};

async function describe({ inputs: { instruction } }: DescribeInputs) {
  const template = new Template(instruction);
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
        instruction: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Instruction",
          description:
            "Instructions for how to render the video. Use @ to reference upstream steps.",
          default: defaultLLMContent(),
        },
        "p-disable-prompt-rewrite": {
          type: "boolean",
          title: "Disable prompt expansion",
          behavior: ["config", "hint-preview"],
          description:
            "By default, inputs and instructions can be automatically expanded into a higher quality video prompt. Check to disable this re-writing behavior.",
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
          behavior: ["hint-multimodal", "main-port"],
        },
      },
      additionalProperties: false,
    } satisfies Schema,
    title: "Make Video [Beta]",
    metadata: {
      icon: "generative-video",
      tags: ["quick-access", "generative"],
      order: 3,
    },
  };
}

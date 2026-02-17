/**
 * @fileoverview Generates an image using supplied context (generation and editing).
 */

import {
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { type DescriberResult, type Params } from "./common.js";
import { GeminiPrompt } from "./gemini-prompt.js";
import { callGeminiImage } from "./image-utils.js";
import { type ExecuteStepArgs } from "./step-executor.js";
import { ArgumentNameGenerator } from "./introducer.js";
import { Template } from "./template.js";
import { ToolManager } from "./tool-manager.js";
import {
  addUserTurn,
  defaultLLMContent,
  err,
  extractMediaData,
  extractTextData,
  joinContent,
  llm,
  mergeContent,
  ok,
  toLLMContent,
  toText,
  toTextConcat,
} from "./utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { createReporter } from "../agent/progress-work-item.js";

const MAKE_IMAGE_ICON = "generative-image";
const ASPECT_RATIOS = ["1:1", "9:16", "16:9", "4:3", "3:4"];

type ImageGeneratorInputs = {
  context: LLMContent[];
  instruction: LLMContent;
  "p-aspect-ratio": string;
  "p-model-name": string;
} & Params;

type ImageGeneratorOutputs = {
  context: LLMContent[] | DescriberResult;
};

export { invoke as default, describe };

function gatheringRequest(
  moduleArgs: A2ModuleArgs,
  contents: LLMContent[] | undefined,
  instruction: LLMContent,
  toolManager: ToolManager
): GeminiPrompt {
  const promptText = llm`
Analyze the instruction below and rather than following it, determine what information needs to be gathered to 
generate an accurate prompt for a text-to-image model in the next turn:
-- begin instruction --
${instruction}
-- end instruction --

Call the tools to gather the necessary information that could be used to create an accurate prompt.`;
  return new GeminiPrompt(
    moduleArgs,
    {
      body: {
        contents: addUserTurn(promptText.asContent(), contents),
        tools: toolManager.list(),
        systemInstruction: toLLMContent(`
You are a researcher whose specialty is to call tools whose output helps gather the necessary information
to be used to create an accurate prompt for a text-to-image model.
`),
      },
    },
    toolManager
  );
}

const MAX_RETRIES = 5;

async function invoke(
  {
    context: incomingContext,
    instruction,
    "p-aspect-ratio": aspectRatio,
    "p-model-name": modelName,
    ...params
  }: ImageGeneratorInputs,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<ImageGeneratorOutputs>> {
  incomingContext ??= [];
  if (!instruction) {
    instruction = toLLMContent("");
  }
  if (!aspectRatio) {
    aspectRatio = "1:1";
  }
  let imageContext = extractMediaData(incomingContext);
  const textContext = extractTextData(incomingContext);
  // Substitute params in instruction.
  const toolManager = new ToolManager(
    moduleArgs,
    new ArgumentNameGenerator(moduleArgs)
  );
  const substituting = await new Template(
    instruction,
    moduleArgs.context.currentGraph
  ).substitute(params, async (part) => toolManager.addTool(part));
  if (!ok(substituting)) {
    return substituting;
  }

  // Process single item directly (list support removed)
  const context = [...incomingContext];

  // If there are tools in instruction, add an extra step of preparing
  // information via tools.
  if (toolManager.hasTools()) {
    const gatheringInformation = await gatheringRequest(
      moduleArgs,
      context,
      substituting,
      toolManager
    ).invoke();
    if (!ok(gatheringInformation)) return gatheringInformation;
    context.push(...gatheringInformation.all);
  }

  const refImages = extractMediaData([substituting]);
  const refText = substituting
    ? toLLMContent(toTextConcat(extractTextData([substituting])))
    : toLLMContent("");
  imageContext = imageContext.concat(refImages);

  let retryCount = MAX_RETRIES;

  while (retryCount--) {
    // Image editing case.
    if (imageContext.length > 0) {
      console.log("Step has reference image, using Gemini Image API: i2i");
      const instructionText = refText ? toText(refText) : "";
      const combinedInstruction = toTextConcat(
        joinContent(instructionText, textContext, false)
      ).trim();
      if (!combinedInstruction) {
        return err(
          `An image editing instruction must be provided along side the reference image.`
        );
      }
      const finalInstruction =
        combinedInstruction + "\nAspect ratio: " + aspectRatio;
      console.log("PROMPT: " + finalInstruction);
      const reporter = createReporter(moduleArgs, {
        title: `Calling ai_image_tool`,
        icon: "spark",
      });
      const args: ExecuteStepArgs = { ...moduleArgs, reporter };
      const generatedImage = await callGeminiImage(
        args,
        modelName,
        finalInstruction,
        imageContext,
        true,
        aspectRatio
      );
      if (!ok(generatedImage)) return generatedImage;
      return { context: [mergeContent(generatedImage, "model")] };
    } else {
      console.log("Step has text only, using Gemini Image API: t2i");
      const imagePrompt = toLLMContent(toText(addUserTurn(refText, context)));
      const iPrompt = toText(imagePrompt).trim();
      console.log("PROMPT", iPrompt);
      const reporter = createReporter(moduleArgs, {
        title: `Calling ai_image_tool`,
        icon: "spark",
      });
      const args: ExecuteStepArgs = { ...moduleArgs, reporter };
      const generatedImage = await callGeminiImage(
        args,
        modelName,
        iPrompt,
        [],
        true,
        aspectRatio
      );
      if (!ok(generatedImage)) return generatedImage;
      return { context: [mergeContent(generatedImage, "model")] };
    }
  }
  return err(`Failed to generate an image after ${MAX_RETRIES} tries.`);
}

type DescribeInputs = {
  inputs: {
    instruction?: LLMContent;
  };
};

async function describe(
  { inputs: { instruction } }: DescribeInputs,
) {
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
            "Describe how to generate the image (content, style, etc). Use @ to reference params or outputs from other steps.",
          default: defaultLLMContent(),
        },
        "p-aspect-ratio": {
          type: "string",
          behavior: ["hint-text", "config", "hint-advanced"],
          title: "Aspect Ratio",
          enum: ASPECT_RATIOS,
          description: "The aspect ratio of the generated image",
          default: "1:1",
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
          behavior: ["hint-image", "main-port"],
        },
      },
    } satisfies Schema,
    title: "Edit Image",
    metadata: {
      icon: MAKE_IMAGE_ICON,
      tags: ["quick-access", "generative"],
      order: 2,
    },
  };
}

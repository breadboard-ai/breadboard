/**
 * @fileoverview Generates an image using supplied context (generation only).
 */

import {
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { type DescriberResult, type Params } from "./common.js";
import { GeminiPrompt } from "./gemini-prompt.js";
import { callImageGen, promptExpander } from "./image-utils.js";
import { ArgumentNameGenerator } from "./introducer.js";
import { ListExpander } from "./lists.js";
import { Template } from "./template.js";
import { ToolManager } from "./tool-manager.js";
import {
  addUserTurn,
  defaultLLMContent,
  err,
  extractMediaData,
  extractTextData,
  llm,
  mergeContent,
  ok,
  toLLMContent,
  toText,
  toTextConcat,
} from "./utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";

const MAKE_IMAGE_ICON = "generative-image";
const ASPECT_RATIOS = ["1:1", "9:16", "16:9", "4:3", "3:4"];

type ImageGeneratorInputs = {
  context: LLMContent[];
  instruction: LLMContent;
  "p-disable-prompt-rewrite": boolean;
  "p-aspect-ratio": string;
} & Params;

type ImageGeneratorOutputs = {
  context: LLMContent[] | DescriberResult;
};

export { invoke as default, describe, makeImageInstruction };

function makeImageInstruction({ pro }: { pro: boolean }) {
  return (inputs: Record<string, unknown>) => {
    const modelHint = pro ? `pro` : `flash`;
    const aspectRatio = (inputs as ImageGeneratorInputs)["p-aspect-ratio"];
    const aspectRatioHint = aspectRatio
      ? ` Provide image in ${aspectRatio} aspect ratio.`
      : ``;
    return `Generate an image using the prompt below. Use that prompt exactly.${aspectRatioHint}. Use the "${modelHint}" model for image generation.\n\nPROMPT:`;
  };
}

function gatheringRequest(
  caps: Capabilities,
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
    caps,
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
    "p-disable-prompt-rewrite": disablePromptRewrite,
    "p-aspect-ratio": aspectRatio,
    ...params
  }: ImageGeneratorInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<ImageGeneratorOutputs>> {
  incomingContext ??= [];
  if (!instruction) {
    instruction = toLLMContent("");
  }
  if (!aspectRatio || !ASPECT_RATIOS.includes(aspectRatio)) {
    aspectRatio = "1:1";
  }
  let imageContext = extractMediaData(incomingContext);
  // Substitute params in instruction.
  const toolManager = new ToolManager(
    caps,
    moduleArgs,
    new ArgumentNameGenerator(caps, moduleArgs)
  );
  const substituting = await new Template(caps, instruction).substitute(
    params,
    async (part) => toolManager.addTool(part)
  );
  if (!ok(substituting)) {
    return substituting;
  }

  const fanningOut = await new ListExpander(substituting, incomingContext).map(
    async (instruction, context) => {
      // If there are tools in instruction, add an extra step of preparing
      // information via tools.
      if (toolManager.hasTools()) {
        const gatheringInformation = await gatheringRequest(
          caps,
          moduleArgs,
          context,
          instruction,
          toolManager
        ).invoke();
        if (!ok(gatheringInformation)) return gatheringInformation;
        context.push(...gatheringInformation.all);
      }

      const refImages = extractMediaData([instruction]);
      const refText = instruction
        ? toLLMContent(toTextConcat(extractTextData([instruction])))
        : toLLMContent("");
      imageContext = imageContext.concat(refImages);

      let retryCount = MAX_RETRIES;

      while (retryCount--) {
        if (imageContext.length > 0) {
          return err(
            `References images are not supported with Imagen. For image editing or style transfer, try Gemini Image Generation.`
          );
        } else {
          console.log("Step has text only, using generation API");
          let imagePrompt: LLMContent;
          if (disablePromptRewrite) {
            imagePrompt = toLLMContent(toText(addUserTurn(refText, context)));
          } else {
            const generatingPrompt = await promptExpander(
              caps,
              moduleArgs,
              context,
              refText
            ).invoke();
            if (!ok(generatingPrompt)) return generatingPrompt;
            imagePrompt = generatingPrompt.last;
          }
          const iPrompt = toText(imagePrompt).trim();
          console.log("PROMPT", iPrompt);
          const generatedImage = await callImageGen(
            caps,
            moduleArgs,
            iPrompt,
            aspectRatio
          );
          if (!ok(generatedImage)) return generatedImage;
          return mergeContent(generatedImage, "model");
        }
      }
      return err(`Failed to generate an image after ${MAX_RETRIES} tries.`);
    }
  );

  if (!ok(fanningOut)) return fanningOut;
  return { context: fanningOut };
}

type DescribeInputs = {
  inputs: {
    instruction?: LLMContent;
  };
};

async function describe(
  { inputs: { instruction } }: DescribeInputs,
  caps: Capabilities
) {
  const template = new Template(caps, instruction);
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
        "p-disable-prompt-rewrite": {
          type: "boolean",
          title: "Disable prompt expansion",
          behavior: ["config", "hint-advanced"],
          description:
            "By default, inputs and instructions will be automatically expanded into a high quality image prompt. Check to disable this re-writing behavior.",
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
    title: "Make Image",
    metadata: {
      icon: MAKE_IMAGE_ICON,
      tags: ["quick-access", "generative"],
      order: 2,
    },
  };
}

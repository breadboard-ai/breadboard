/**
 * @fileoverview Generates an image using supplied context (generation only).
 */

import { type DescriberResult, type Params } from "./common";
import { GeminiPrompt } from "./gemini-prompt";
import { callImageGen, promptExpander } from "./image-utils";
import { ArgumentNameGenerator } from "./introducer";
import { ListExpander } from "./lists";
import { Template } from "./template";
import { ToolManager } from "./tool-manager";
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
} from "./utils";

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

export { invoke as default, describe };

function gatheringRequest(
  caps: Capabilities,
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
  caps: Capabilities
): Promise<Outcome<ImageGeneratorOutputs>> {
  incomingContext ??= [];
  if (!instruction) {
    instruction = toLLMContent("");
  }
  if (!aspectRatio) {
    aspectRatio = "1:1";
  }
  let imageContext = extractMediaData(incomingContext);
  // Substitute params in instruction.
  const toolManager = new ToolManager(new ArgumentNameGenerator(caps));
  const substituting = await new Template(instruction).substitute(
    params,
    async ({ path: url, instance }) => toolManager.addTool(url, instance)
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
              context,
              refText
            ).invoke();
            if (!ok(generatingPrompt)) return generatingPrompt;
            imagePrompt = generatingPrompt.last;
          }
          const iPrompt = toText(imagePrompt).trim();
          console.log("PROMPT", iPrompt);
          const generatedImage = await callImageGen(iPrompt, aspectRatio);
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

/**
 * @fileoverview Edits an image using the supplied context.
 */

import invokeBoard from "@invoke";
import fetch from "@fetch";
import secrets from "@secrets";

import {
  err,
  ok,
  isEmpty,
  toLLMContent,
  toLLMContentInline,
  toText,
  toTextConcat,
  toInlineData,
  joinContent,
  addUserTurn,
  extractInlineData,
  extractTextData,
  llm,
  defaultLLMContent,
} from "./utils";
import { Template } from "./template";
import { callImageEdit } from "./image-utils";
import { executeStep } from "./step-executor";
import type { ExecuteStepRequest, Content } from "./step-executor";
import { ToolManager } from "./tool-manager";
import { type Params } from "./common";
import { report } from "./output";
import { ArgumentNameGenerator } from "./introducer";
import { ListExpander } from "./lists";

const MAKE_IMAGE_ICON = "generative-image-edit";

type ImageGeneratorInputs = {
  context: LLMContent[];
  instruction: LLMContent;
  "p-disable-prompt-rewrite": boolean;
} & Params;

type ImageGeneratorOutputs = {
  context: LLMContent[];
};

export { invoke as default, describe };

async function gracefulExit(notOk: {
  $error: string;
}): Promise<Outcome<LLMContent>> {
  await report({
    actor: "Make Image",
    category: "Warning",
    name: "Graceful exit",
    details: `I tried a couple of times, but the Image Editing API failed to generate the image you requested with the following error:

### ${notOk.$error}

To keep things moving, I will return a blank result. My apologies!`,
    icon: MAKE_IMAGE_ICON,
  });
  return toLLMContent(" ");
}

const MAX_RETRIES = 5;

/**
 * Handles 4 distinct cases:
 * 1) The editing directive (without explicit reference) is provided as static instruction
 * 2) The editing directive is provided as static instruction w/ interleaved @ reference to the image
 * 3) The editing directive is provided without explicit reference as context
 * 4) The editing directive is provided as context with explicit interleaved @reference to the image.
 * 3 + 4 Currently assume the directive is provided as @ in the instruction, but the image is not.
 * **/
async function invoke({
  context,
  instruction,
  "p-disable-prompt-rewrite": disablePromptRewrite,
  ...params
}: ImageGeneratorInputs): Promise<Outcome<ImageGeneratorOutputs>> {
  context ??= [];
  let instructionText = "";
  if (instruction) {
    instructionText = toText(instruction).trim();
  }
  // 1) Extract any image and text data from context (with history).
  let imageContext = extractInlineData(context);
  const textContext = extractTextData(context);

  // 2) Substitute variables and magic image reference.
  // Note: it is important that images are not subsituted in here as they will
  // not be handled properly. At this point, only text variables should be left.
  const toolManager = new ToolManager(new ArgumentNameGenerator());
  const substituting = await new Template(
    toLLMContent(instructionText)
  ).substitute(params, async ({ path: url, instance }) =>
    toolManager.addTool(url, instance)
  );
  if (!ok(substituting)) {
    return substituting;
  }

  const results = await new ListExpander(substituting, context).map(
    async (instruction, context, isList) => {
      // 3) Extract image and text data from (non-history) references.
      const refImages = extractInlineData([instruction]);
      const refText = extractTextData([instruction]);

      // 4) Combine with whatever data was extracted from context. Validate that
      // we have exactly one image and some textual instruction.
      imageContext = imageContext.concat(refImages);
      if (imageContext.length != 1) {
        return toLLMContent(
          `AI image editing needs exactly one image input, please! Got ${imageContext.length} images.`
        );
      }
      const combinedInstruction = toTextConcat(
        joinContent(toTextConcat(refText), textContext, false)
      );
      if (!combinedInstruction) {
        return toLLMContent("An image editing instruction must be provided.");
      }
      console.log("PROMPT: " + combinedInstruction);

      let retryCount = MAX_RETRIES;
      while (retryCount--) {
        const generatedImage = await callImageEdit(
          combinedInstruction,
          imageContext,
          disablePromptRewrite
        );
        return generatedImage[0];
      }

      return gracefulExit(
        err(`Failed to generate a edited image after ${MAX_RETRIES} tries.`)
      );
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
          title: "Context",
          behavior: ["main-port"],
        },
        instruction: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Instruction",
          description:
            "Describe how to change or edit an image. Use @ to add the image to edit. Example: 'Make the person from @<reference image>' have pink hair'",
          default: defaultLLMContent(),
        },
        "p-disable-prompt-rewrite": {
          type: "boolean",
          title: "Disable prompt expansion",
          behavior: ["config"],
          description:
            "By default, inputs and instructions may be automatically expanded into a higher quality image prompt. Check to disable this re-writing behavior.",
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
    title: "Edit Image [Deprecated, Use Make Image]",
    metadata: {
      icon: MAKE_IMAGE_ICON,
      tags: ["quick-access", "generative", "experimental"],
      order: 2,
    },
  };
}

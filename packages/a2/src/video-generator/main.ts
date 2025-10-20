/**
 * @fileoverview Generates video output using supplied context.
 */

import { type DescriberResult } from "../a2/common";
import { ArgumentNameGenerator } from "../a2/introducer";
import { ListExpander } from "../a2/lists";
import { Template } from "../a2/template";
import { ToolManager } from "../a2/tool-manager";
import {
  defaultLLMContent,
  encodeBase64,
  err,
  ErrorReason,
  ErrorWithMetadata,
  extractMediaData,
  extractTextData,
  isStoredData,
  joinContent,
  ok,
  toLLMContent,
  toText,
  toTextConcat,
} from "../a2/utils";

import {
  executeStep,
  type ContentMap,
  type ExecuteStepRequest,
} from "../a2/step-executor";
import {
  Capabilities,
  InlineDataCapabilityPart,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";
import { getBucketId } from "../a2/get-bucket-id";
import { toBlobStoredData, toGcsAwareChunk } from "../a2/to-blob-stored-data";

type Model = {
  id: string;
  title: string;
  description: string;
  modelName: string;
};

const ASPECT_RATIOS = ["9:16", "16:9"];
const OUTPUT_NAME = "generated_video";
const MODELS: Model[] = [
  {
    id: "veo-3",
    title: "Veo 3",
    description: "State of the art video generation with audio",
    modelName: "veo-3.0-generate-preview",
  },
  {
    id: "veo-2",
    title: "Veo 2",
    description: "Faster video generation, no audio",
    modelName: "veo-2.0-generate-001",
  },
];

const modelMap = new Map(MODELS.map((model) => [model.id, model]));

function getModel(modelId: string | undefined): Model {
  return modelMap.get(modelId || "veo-3") || MODELS[0];
}

type VideoGeneratorInputs = {
  context: LLMContent[];
  instruction?: LLMContent;
  "p-disable-prompt-rewrite": boolean;
  "p-video-aspect-ratio": string;
  "b-model-name": string;
};

type VideoGeneratorOutputs = {
  context: LLMContent[] | DescriberResult;
};

export { invoke as default, describe };

async function callVideoGen(
  caps: Capabilities,
  moduleArgs: A2ModuleFactoryArgs,
  prompt: string,
  imageContent: LLMContent | undefined,
  disablePromptRewrite: boolean,
  aspectRatio: string,
  modelName: string
): Promise<Outcome<LLMContent>> {
  const bucketId = await getBucketId(moduleArgs);
  if (!ok(bucketId)) {
    return err(
      `Unable to call Gemini Image API: Storage bucket is not configured`
    );
  }

  const executionInputs: ContentMap = {};
  executionInputs["text_instruction"] = {
    chunks: [
      {
        mimetype: "text/plain",
        data: encodeBase64(prompt),
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
  const inputParameters: string[] = ["text_instruction"];
  if (imageContent) {
    console.log("Image found, using i2v");
    let imageChunk;
    if (isStoredData(imageContent)) {
      const blobStoredData = await toBlobStoredData(
        moduleArgs.fetchWithCreds,
        imageContent.parts.at(-1)!
      );
      if (!ok(blobStoredData)) return blobStoredData;
      imageChunk = toGcsAwareChunk(bucketId, blobStoredData);
    } else {
      const { inlineData } = imageContent.parts.at(
        -1
      )! as InlineDataCapabilityPart;
      imageChunk = {
        mimetype: inlineData.mimeType,
        data: inlineData.data,
      };
    }
    if (!imageChunk || typeof imageChunk == "string") {
      return err("Image input did not have the expected format");
    }
    executionInputs["reference_image"] = { chunks: [imageChunk] };
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
      output: OUTPUT_NAME,
      options: {
        disablePromptRewrite,
        modelName,
      },
    },
    execution_inputs: executionInputs,
    output_gcs_config: { bucket_name: bucketId },
  } satisfies ExecuteStepRequest;
  const response = await executeStep(caps, moduleArgs, body);
  if (!ok(response)) return response;

  // Only take the first video output. The model can't produce
  // more than one.
  return response.chunks.at(0)!;
}

async function invoke(
  {
    context,
    instruction,
    "p-disable-prompt-rewrite": disablePromptRewrite,
    "p-video-aspect-ratio": aspectRatio,
    "b-model-name": modelId,
    ...params
  }: VideoGeneratorInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleFactoryArgs
): Promise<Outcome<VideoGeneratorOutputs>> {
  const { modelName } = getModel(modelId);
  context ??= [];
  let instructionText = "";
  if (instruction) {
    instructionText = toText(instruction).trim();
  }
  if (!aspectRatio || modelId == "veo-3") {
    // Veo 3 currently crashes on aspect ration 9:16. This is a bug on Vertex.
    aspectRatio = "16:9";
  }
  // 2) Substitute variables and magic image reference.
  // Note: it is important that images are not subsituted in here as they will
  // not be handled properly. At this point, only text variables should be left.
  const template = new Template(caps, toLLMContent(instructionText));
  const toolManager = new ToolManager(
    caps,
    moduleArgs,
    new ArgumentNameGenerator(caps)
  );
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
  console.log(instruction);
  console.log("substituting");
  console.log(substituting);

  const results = await new ListExpander(substituting, context).map(
    async (itemInstruction, itemContext) => {
      // 1) Extract any image and text data from context (with history).
      let imageContext = extractMediaData(itemContext);
      const textContext = extractTextData(itemContext);

      // 3) Extract image and text data from (non-history) references.
      const refImages = extractMediaData([itemInstruction]);
      const refText = extractTextData([itemInstruction]);

      // 4) Combine with whatever data was extracted from context.
      // Validate that we did not find any images, given this isn't supported yet.
      imageContext = imageContext.concat(refImages);
      if (imageContext.length > 1) {
        return err(
          `Video generation expects either a single text description, or text plus a single image. Got ${imageContext.length} images.`,
          {
            kind: "config",
            origin: "client",
          }
        );
      }
      const combinedInstruction = toTextConcat(
        joinContent(toTextConcat(refText), textContext, false)
      );
      if (!combinedInstruction) {
        return err("Please provide the instruction to generate video.", {
          kind: "config",
          origin: "client",
        });
      }

      console.log(`PROMPT(${modelName}): ${combinedInstruction}`);

      // 2) Call backend to generate video.
      const content = await callVideoGen(
        caps,
        moduleArgs,
        combinedInstruction,
        imageContext.at(0),
        disablePromptRewrite,
        aspectRatio,
        modelName
      );
      return content;
    }
  );
  if (!ok(results)) return expandVeoError(results, modelName);
  return { context: results };
}

type DescribeInputs = {
  inputs: {
    instruction?: LLMContent;
  };
};

const SUPPORT_CODES = new Map<number, ErrorReason>([
  [58061214, "child"],
  [17301594, "child"],

  [29310472, "celebrity"],
  [15236754, "celebrity"],

  [64151117, "unsafe"],
  [42237218, "unsafe"],

  [62263041, "dangerous"],

  [57734940, "hate"],
  [22137204, "hate"],

  [74803281, "other"],
  [29578790, "other"],
  [42876398, "other"],

  [39322892, "face"],

  [92201652, "pii"],

  [89371032, "prohibited"],
  [49114662, "prohibited"],
  [72817394, "prohibited"],

  [90789179, "sexual"],
  [63429089, "sexual"],
  [43188360, "sexual"],

  [78610348, "toxic"],

  [61493863, "violence"],
  [56562880, "violence"],

  [32635315, "vulgar"],
]);

function expandVeoError(
  e: ErrorWithMetadata,
  model: string
): ErrorWithMetadata {
  const match = e.$error.match(/Support codes: (\d+(?:, \d+)*)/);
  const reasons = new Set<ErrorReason>();

  if (match && match[1]) {
    const codes = match[1].split(", ").map((code) => parseInt(code.trim(), 10));
    codes.forEach((code) => {
      reasons.add(SUPPORT_CODES.get(code) || "other");
    });
  }

  if (reasons.size > 0) {
    return {
      ...e,
      metadata: {
        origin: "server",
        kind: "safety",
        reasons: Array.from(reasons.values()),
        model,
      },
    };
  }

  return e;
}

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
            "Instructions for how to render the video. Use @ to reference upstream steps.",
          default: defaultLLMContent(),
        },
        "p-disable-prompt-rewrite": {
          type: "boolean",
          title: "Disable prompt expansion",
          behavior: ["config", "hint-preview", "hint-advanced"],
          description:
            "By default, inputs and instructions can be automatically expanded into a higher quality video prompt. Check to disable this re-writing behavior.",
        },
        "p-aspect-ratio": {
          type: "string",
          behavior: ["hint-text", "config", "hint-advanced"],
          title: "Aspect Ratio",
          enum: ASPECT_RATIOS,
          description: "The aspect ratio of the generated video",
          default: "1:1",
        },
        "b-model-name": {
          type: "string",
          enum: MODELS,
          behavior: ["llm-content", "config", "hint-advanced"],
          title: "Model Version",
          description: "The Veo version to use",
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
    title: "Make Video",
    metadata: {
      icon: "generative-video",
      tags: ["quick-access", "generative"],
      order: 3,
    },
  };
}

/**
 * @fileoverview Utility for calling generate_webpage tool.
 */

import { LLMContent, Outcome } from "@breadboard-ai/types";
import type {
  ContentMap,
  ExecuteStepRequest,
  ExecuteStepArgs,
} from "./step-executor.js";
import { executeStep } from "./step-executor.js";
import { executeWebpageStream } from "./generate-webpage-stream.js";
import { encodeBase64, err, mergeContent, ok } from "./utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { createReporter } from "../agent/progress-work-item.js";
import { isInlineData } from "../../data/common.js";

export { callGenWebpage };

const OUTPUT_KEY = "rendered_outputs";

/**
 * Legacy (non-streaming) implementation of GenerateWebpage.
 */
async function callGenWebpageLegacy(
  moduleArgs: A2ModuleArgs,
  instruction: string,
  content: LLMContent[],
  renderMode: string,
  modelName: string
): Promise<Outcome<LLMContent>> {
  const executionInputs: ContentMap = {};
  const inputParameters: string[] = [];
  let i = 0;
  for (const val of content) {
    if (!val.parts) continue;
    for (const part of val.parts) {
      i++;
      if ("text" in part) {
        const key = `text_${i}`;
        inputParameters.push(key);
        executionInputs[key] = {
          chunks: [
            {
              mimetype: "text/plain",
              data: encodeBase64(part.text),
            },
          ],
        };
      } else if ("inlineData" in part) {
        const key = `media_${i}`;
        inputParameters.push(key);
        executionInputs[key] = {
          chunks: [
            {
              mimetype: part.inlineData.mimeType,
              data: part.inlineData.data,
            },
          ],
        };
      } else if ("storedData" in part) {
        const key = `media_${i}`;
        inputParameters.push(key);
        let handle = part.storedData.handle;
        if (handle.startsWith("drive:/")) {
          const driveId = handle.replace(/^drive:\/+/, "");
          handle = `https://drive.google.com/file/d/${driveId}/preview`;
        }
        executionInputs[key] = {
          chunks: [
            {
              mimetype: "url/" + part.storedData.mimeType,
              data: encodeBase64(handle),
            },
          ],
        };
      } else {
        console.error("Skipping unexpected content part");
      }
    }
  }
  const body = {
    planStep: {
      stepName: "GenerateWebpage",
      modelApi: "generate_webpage",
      inputParameters: inputParameters,
      systemPrompt: "",
      stepIntent: "",
      output: OUTPUT_KEY,
      options: {
        disablePromptRewrite: true,
        renderMode: renderMode,
        modelName: modelName,
        systemInstruction: instruction,
      },
    },
    execution_inputs: executionInputs,
  } satisfies ExecuteStepRequest;
  // Add the contents
  // TODO(askerryryan): Remove once functional.
  console.log("request body");
  console.log(body);
  const reporter = createReporter(moduleArgs, {
    title: `Calling generate_webpage`,
    icon: "spark",
  });
  const args: ExecuteStepArgs = { ...moduleArgs, reporter };
  const response = await executeStep(args, body, {
    expectedDurationInSec: 70,
  });
  if (!ok(response)) {
    let errorMessage;
    if (response.$error.includes("The service is currently unavailable")) {
      errorMessage =
        "Request timed out. The model may be experiencing heavy load";
    } else {
      errorMessage = response.$error;
    }
    return err("Webpage generation failed: " + errorMessage);
  }

  return mergeContent(response.chunks, "model");
}

/**
 * Main entry point for generating webpage HTML.
 * Uses streaming API when streamGenWebpage flag is enabled.
 */
async function callGenWebpage(
  moduleArgs: A2ModuleArgs,
  instruction: string,
  content: LLMContent[],
  renderMode: string,
  modelName: string
): Promise<Outcome<LLMContent>> {
  // If the content already contains HTML inlineData, pass it through
  // without invoking webpage generation.
  for (const item of content) {
    for (const part of item.parts) {
      if (isInlineData(part) && part.inlineData.mimeType === "text/html") {
        return { role: "model", parts: [part] };
      }
    }
  }

  const flags = await moduleArgs.context.flags?.flags();
  const useStreaming = flags?.streamGenWebpage ?? false;

  if (useStreaming) {
    console.log("[html-generator] Using streaming API for GenerateWebpage");
    return executeWebpageStream(moduleArgs, instruction, content, modelName);
  } else {
    console.log(
      "[html-generator] Using legacy executeStep for GenerateWebpage"
    );
    return callGenWebpageLegacy(
      moduleArgs,
      instruction,
      content,
      renderMode,
      modelName
    );
  }
}

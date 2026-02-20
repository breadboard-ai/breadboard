/**
 * @fileoverview Utility for calling generate_webpage tool.
 */

import { LLMContent, Outcome } from "@breadboard-ai/types";
import { executeWebpageStream } from "./generate-webpage-stream.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { isInlineData } from "../../data/common.js";

export { callGenWebpage };

/**
 * Main entry point for generating webpage HTML.
 * Always uses the streaming API.
 */
async function callGenWebpage(
  moduleArgs: A2ModuleArgs,
  instruction: string,
  content: LLMContent[],
  _renderMode: string,
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

  return executeWebpageStream(moduleArgs, instruction, content, modelName);
}

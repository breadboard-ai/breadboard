/**
 * @fileoverview Default system instruction for the various prompts.
 */

import { LLMContent } from "@breadboard-ai/types";
import { llm } from "../a2/utils";

export { defaultSystemInstruction };

function defaultSystemInstruction(): LLMContent {
  return llm`You are working as part of an AI system, so no chit-chat and no explaining what you're doing and why.
DO NOT start with "Okay", or "Alright" or any preambles. Just the output, please.`.asContent();
}

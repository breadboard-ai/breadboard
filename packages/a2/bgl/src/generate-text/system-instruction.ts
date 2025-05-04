/**
 * @fileoverview Helps create a system instruction.
 */

import { llm } from "./a2/utils";
import { listPrompt } from "./a2/lists";

export { createSystemInstruction, defaultSystemInstruction };

function defaultSystemInstruction(): LLMContent {
  return llm`You are working as part of an AI system, so no chit-chat and no explaining what you're doing and why.
DO NOT start with "Okay", or "Alright" or any preambles. Just the output, please.`.asContent();
}

function createSystemInstruction(
  existing: LLMContent | undefined,
  makeList: boolean
) {
  if (existing) {
    existing = defaultSystemInstruction();
  }
  const builtIn = llm`

Today is ${new Date().toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}
    
${existing}`.asContent();
  if (!makeList) return builtIn;
  return listPrompt(builtIn);
}

/**
 * @fileoverview Helps create a system instruction.
 */

import { LLMContent } from "@breadboard-ai/types";
import { llm } from "../a2/utils.js";

export { createSystemInstruction };

function defaultSystemInstruction(): LLMContent {
  return llm`IMPORTANT NOTE: Start directly with the output, do not output any delimiters.
You are working as part of an AI system, so no chit-chat and no explainining what you're doing and why.
DO NOT start with "Okay", or "Alright" or any preambles.
Just the output, please.
Take a Deep Breath, read the instructions again, read the inputs again.
Each instruction is crucial and must be executed with utmost care and attention to detail.`.asContent();
}

function createSystemInstruction(existing: LLMContent | undefined) {
  if (existing) {
    existing = defaultSystemInstruction();
  }
  return llm`

Today is ${new Date().toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}
    
${existing}`.asContent();
}

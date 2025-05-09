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
  makeList: boolean,
  chatEnabled: boolean
) {
  let userSystemInstruction = existing;
  if (!userSystemInstruction) {
    userSystemInstruction = defaultSystemInstruction();
  }

  const dateStr = new Date().toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  let systemInstructionContent: LLMContent;

  if (!chatEnabled) {
    const noChatAddendum = `
You cannot chat with the user.
You cannot ask the user questions.
You must provide the complete response based on the information and tools you have.
`;
    systemInstructionContent = llm`Today is ${dateStr}
    
${userSystemInstruction}
${noChatAddendum}`.asContent();
  } else {
    systemInstructionContent = llm`Today is ${dateStr}
    
${userSystemInstruction}`.asContent();
  }

  if (!makeList) return systemInstructionContent;
  return listPrompt(systemInstructionContent);
}

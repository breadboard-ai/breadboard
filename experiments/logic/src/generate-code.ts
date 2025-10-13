/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadDeveloper } from "./prompts/developer";
import { loadQA } from "./prompts/qa";
import { Case } from "./types";
import type { GoogleGenAI } from "@google/genai";
import { write } from "./file-ops";
import { cleanupCode } from "./common";

export { generateCode };

async function generateCode(gemini: GoogleGenAI, c: Case) {
  console.log(`  🤖 Generating code for "${c.name}"`);
  const [program, test] = await Promise.all([
    gemini.models.generateContent(await loadDeveloper(c)),
    gemini.models.generateContent(await loadQA(c)),
  ]);

  const draftCode = cleanupCode(program.text!);
  const testCode = cleanupCode(test.text!);

  try {
    await write(c, "draft", draftCode);
    await write(c, "test", testCode);
  } catch {
    console.error(`  ❌ failed to save to "${c.name}", exiting`);
    process.exit(1);
  }
  console.log(`  🤖 Finished generating code for "${c.name}"`);
}

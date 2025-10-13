/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { GoogleGenAI } from "@google/genai";
import { Case } from "./types";
import { loadFixer } from "./prompts/fixer";
import { read, write } from "./file-ops";
import { cleanupCode } from "./common";

export { fixCode };

async function fixCode(gemini: GoogleGenAI, c: Case) {
  console.log(`  🔨 Fixing code for "${c.name}"`);

  const draft = await read(c, "draft");
  const test = await read(c, "test");
  const errors = await read(c, "errors");

  const result = await gemini.models.generateContent(
    await loadFixer(c, draft, test, errors)
  );

  const newDraftCode = cleanupCode(result.text!);

  await write(c, "draft", newDraftCode);

  console.log(`  🔨 Finished fixing code for "${c.name}"`);
}

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GoogleGenAI } from "@google/genai";
import { Case } from "./types";
import { exists } from "./file-ops";
import { fixCode } from "./fix-code";
import { runTest } from "./run-test";
import { generateCode } from "./generate-code";

export { build };

const MAX_ITERATIONS = 5;

export type Status = {
  done: boolean;
};

async function build(gemini: GoogleGenAI, c: Case) {
  let count = MAX_ITERATIONS;
  while (count--) {
    const status = await runIteration(gemini, c);
    if (status.done) return;
  }
}

async function runIteration(gemini: GoogleGenAI, c: Case): Promise<Status> {
  const { name } = c;
  if (await exists(c, "final")) {
    console.log(`Done building "${name}"`);
    return { done: true };
  }

  if (await exists(c, "errors")) {
    console.log(`Fixing errors in "${name}"`);
    await fixCode(gemini, c);
    console.log(`Checking if fix worked in "${name}"`);
    await runTest(c);
    return { done: false };
  }

  if (await exists(c, "draft")) {
    console.log(`Running tests for "${name}"`);
    await runTest(c);
    return { done: false };
  }

  console.log(`Generating code and test for "${name}"`);
  await generateCode(gemini, c);
  return { done: false };
}

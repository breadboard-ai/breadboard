/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { loadDeveloper } from "./prompts/developer";
import { loadQA } from "./prompts/qa";
import { evalSet } from "./eval-set";
import { Case } from "./types";

config({ quiet: true });

const OUT_DIR = join(import.meta.dirname, "../out");

const { GEMINI_API_KEY } = process.env;
if (!GEMINI_API_KEY) {
  console.error(
    `  🔑 Please set GEMINI_KEY environment variable to run this app`
  );
  process.exit(1);
} else {
  console.log(`  🔑 GEMINI_KEY Acquired`);
}

const gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

await Promise.all(evalSet.map((c) => generateOne(c)));

async function generateOne(c: Case) {
  console.log(`  🤖 Generating code for "${c.name}"`);
  const [program, test] = await Promise.all([
    gemini.models.generateContent(await loadDeveloper(c)),
    gemini.models.generateContent(await loadQA(c)),
  ]);

  const programFilename = join(OUT_DIR, `${c.name}.js`);
  const testFilename = join(OUT_DIR, `${c.name}.test.js`);

  const programCode = cleanupCode(program.text!);
  const testCode = cleanupCode(test.text!);

  try {
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(programFilename, cleanupCode(programCode), "utf-8");
    await writeFile(testFilename, cleanupCode(testCode), "utf-8");
  } catch {
    console.error(`  ❌ failed to save to "${c.name}", exiting`);
    process.exit(1);
  }
  console.log(`  🤖 Finished generating code for "${c.name}"`);
}

function cleanupCode(s: string) {
  // Mechanically fix a common problem with
  // Gemini adding extra spaces in optional
  // property accessors.
  s = s.replaceAll(/\?\s*\./g, "?.").replaceAll(/\?\s*\?/g, "??");

  const content = s?.trim();
  if (!content) {
    return "// No file generated";
  }
  const lines = content.split("\n");
  const firstLine = lines[0]?.trim();
  const lastLine = lines.at(-1)?.trim();

  const hasOpeningFence = firstLine?.startsWith("```");
  const hasClosingFence = lines.length > 1 && lastLine === "```";

  if (hasOpeningFence && hasClosingFence) {
    return lines.slice(1, -1).join("\n");
  }

  return s;
}

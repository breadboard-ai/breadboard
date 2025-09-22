/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { createPrompt } from "./screenify-prompt";

config({ quiet: true });

const intent = `Make an "AI slop or not" game, where the user picks from two generated images based on the same topic, and the losing image is replaced with a new image, for 10 rounds. After 10 rounds, the image that lasted the longest is returned along with the "Winner" text.`;
const APP_NAME = "ai-slop-or-not";

const SCROLLING_WINDOW_SIZE = 6;
const TERMINAL_WIDTH = process.stdout.columns;
const ANSI_GREEN = "\x1B[32m";
const ANSI_RESET = "\x1B[0m";
const ANSI_CLEAR_LINE = "\x1B[2K";
const ANSI_MOVE_UP = `\x1B[${SCROLLING_WINDOW_SIZE + 1}A`;

const SRC_DIR = join(import.meta.dirname, "../src");
const APP_DIR = join(SRC_DIR, "apps");

async function loadTypes(): Promise<string> {
  const typesPath = join(SRC_DIR, `types.ts`);
  try {
    const text = await readFile(typesPath, "utf-8");
    console.log(`  🔩 Types Loaded`);
    return text;
  } catch (e) {
    console.error(`  🔩 Unable to Load Types: ${(e as Error).message}`);
    process.exit(1);
  }
}

async function loadExample(): Promise<string> {
  const typesPath = join(APP_DIR, `adventure-game.ts`);
  try {
    const text = await readFile(typesPath, "utf-8");
    console.log(`  🧩 Example Loaded`);
    return text;
  } catch (e) {
    console.error(`  🧩 Unable to Load Example: ${(e as Error).message}`);
    process.exit(1);
  }
}

const GEMINI_KEY = process.env.VITE_GEMINI_KEY;
if (!GEMINI_KEY) {
  console.error(
    `  🔑 Please set GEMINI_KEY environment variable to run this app`
  );
  process.exit(1);
} else {
  console.log(`  🔑 GEMINI_KEY Acquired`);
}

const types = await loadTypes();
const example = await loadExample();

console.log("  🤖 Generating Code");
const gemini = new GoogleGenAI({ apiKey: GEMINI_KEY });

console.log("  🧠 Thinking");
for (let i = 1; i <= SCROLLING_WINDOW_SIZE; i++) {
  process.stdout.write(
    `${ANSI_GREEN}${i.toString().padStart(3, " ")}${ANSI_RESET}\n`
  );
}
const stream = await gemini.models.generateContentStream({
  model: "gemini-2.5-pro",
  contents: {
    text: createPrompt(intent, types, example),
  },
  config: { thinkingConfig: { includeThoughts: true, thinkingBudget: -1 } },
});
const result: string[] = [];
let currentThought: string = "";
for await (const chunk of stream) {
  const parts = chunk?.candidates?.at(0)?.content?.parts;
  if (!parts) continue;
  for (const part of parts) {
    if (!part.text) {
      continue;
    } else if (part.thought) {
      currentThought = getTitleFromThought(part.text) ?? currentThought;
    } else {
      appendLines(part.text, result);
    }
  }
  const displayLines = result.slice(-SCROLLING_WINDOW_SIZE);

  while (displayLines.length < SCROLLING_WINDOW_SIZE) {
    displayLines.unshift("");
  }

  process.stdout.write(
    `${ANSI_MOVE_UP}${ANSI_CLEAR_LINE}  🧠 ${currentThought}\n`
  );

  let startLine = result.length <= 6 ? 1 : result.length - 6;
  for (const line of displayLines) {
    const lineNumber = startLine.toString().padStart(3, " ");
    process.stdout.write(
      `${ANSI_CLEAR_LINE}${ANSI_GREEN}${lineNumber} ${line.substring(0, TERMINAL_WIDTH - 4)}${ANSI_RESET}\n`
    );
    startLine++;
  }
}

process.stdout.write(`${ANSI_MOVE_UP}${ANSI_CLEAR_LINE}`);

const destinationFileName = join(APP_DIR, `${APP_NAME}.ts`);

console.log(`  💾 Saving Output to "src/apps/${APP_NAME}.ts"`);

let code = result.join("\n");
if (code.endsWith("```")) {
  code = code.slice(0, -3);
}

// Mechanically fix a common problem with
// Gemini adding extra spaces in optional
// property accessors.
code = code.replaceAll(/\?\s*\.\s*\[/g, "?.[");

try {
  await writeFile(destinationFileName, code, "utf-8");
} catch {
  console.error(`  ❌ failed to save to "${destinationFileName}"`);
  process.exit(1);
}

process.stdout.write(`${ANSI_CLEAR_LINE}`);

console.log(`  ✅ Success`);

function appendLines(chunk: string, lines: string[]) {
  const newLines = chunk.split("\n");
  lines[lines.length - 1] += newLines[0];
  if (newLines.length > 0) {
    lines.push(...newLines.slice(1));
  }
}

function getTitleFromThought(thought: string): string | null {
  const match = thought.match(/\*\*(.*?)\*\*/);
  return match ? match[1] : null;
}

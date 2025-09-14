/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { join } from "path";
import { Screen } from "./types";
import { mkdir, readFile, writeFile } from "fs/promises";
import { logicPrompt } from "./logic-prompt";
import { GoogleGenAI } from "@google/genai";

type Prompt = {
  text: string;
};

type Oops = {
  error: string;
};

type AppImport = {
  spec: string;
  screens: Screen[];
};

config({ quiet: true });

const SCROLLING_WINDOW_SIZE = 6;
const TERMINAL_WIDTH = process.stdout.columns;
const ANSI_GREEN = "\x1B[32m";
const ANSI_RESET = "\x1B[0m";
const ANSI_CLEAR_LINE = "\x1B[2K";
const ANSI_MOVE_UP = `\x1B[${SCROLLING_WINDOW_SIZE + 1}A`;

const SRC_DIR = join(import.meta.dirname, "../src");
const APP_DIR = join(SRC_DIR, "apps");
const OUT_DIR = join(import.meta.dirname, "../out");

async function loadMainPrompt(): Promise<Prompt | Oops> {
  const typesPath = join(SRC_DIR, `types.ts`);
  try {
    const types = await readFile(typesPath, "utf-8");
    return {
      text: `
${logicPrompt}

\`\`\`typescript
${types}
\`\`\

`,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function loadAppPrompt(appName: string): Promise<Prompt | Oops> {
  const path = join(APP_DIR, `${appName}.ts`);
  try {
    const { spec, screens } = (await import(path)) as AppImport;
    return {
      text: `
${spec}

The following screens are defined for this program

\`\`\`json
${JSON.stringify(screens, null, 2)}
\`\`\`
`,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const GEMINI_KEY = process.env.GEMINI_KEY;
if (!GEMINI_KEY) {
  console.error(
    `  🔑 Please set GEMINI_KEY environment variable to run this app`
  );
  process.exit(1);
} else {
  console.log(`  🔑 GEMINI_KEY Acquired`);
}

const APP_NAME = process.argv[2];
if (!APP_NAME) {
  console.warn(`  ❓ Usage: npm run generate <name-of-app>`);
  process.exit(1);
} else {
  console.log(`  📱 App: ${APP_NAME}`);
}

const mainPrompt = await loadMainPrompt();
if ("error" in mainPrompt) {
  console.error(`  💾 Unable to Load Main Prompt: ${mainPrompt.error}`);
  process.exit(1);
} else {
  console.log(`  💬 Main Prompt Loaded`);
}

const appPrompt = await loadAppPrompt(APP_NAME);
if ("error" in appPrompt) {
  console.error(`  💾 Unable to Load App Prompt: ${appPrompt.error}`);
  process.exit(1);
} else {
  console.log(`  💬 App Prompt Loaded`);
}

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
    text: `${appPrompt.text}\n\n${mainPrompt.text}`,
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

const destinationFileName = join(OUT_DIR, `${APP_NAME}.js`);

console.log(`  💾 Saving Output to "out/${APP_NAME}.js"`);

let code = result.join("\n");
if (code.endsWith("```")) {
  code = code.slice(0, -3);
}

try {
  await mkdir(OUT_DIR, { recursive: true });
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

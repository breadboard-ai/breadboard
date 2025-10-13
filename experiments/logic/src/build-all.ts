/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
import { cases } from "./cases";
import { build } from "./build";

config({ quiet: true });

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

await Promise.all(cases.map((c) => build(gemini, c)));

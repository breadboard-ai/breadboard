/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

const GEMINI_KEY = "GEMINI_KEY";

export { generate };

async function generate(prompt: string): Promise<string> {
  const apiKey = localStorage.getItem(GEMINI_KEY);
  if (!apiKey) {
    throw new Error("Add `GEMINI_KEY` to your Local Storage");
  }
  const gemini = new GoogleGenAI({ apiKey });
  const result = await gemini.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });
  if (!result.text) {
    console.error("Expected text, got", result);
    throw new Error("Gemini failed to generate output");
  }
  return result.text;
}

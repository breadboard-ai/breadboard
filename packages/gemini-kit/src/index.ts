/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { kit } from "@breadboard-ai/build";
import text from "./boards/gemini-generator.js";
import nano from "./boards/nano-generator.js";

const geminiKit = await kit({
  title: "Gemini Kit",
  description: "Nodes for calling Google Gemini APIs",
  version: "0.1.0",
  url: "npm:@google-labs/gemini-kit",
  components: { text, nano },
});

export default geminiKit;
export const gemini = await geminiKit.legacy();
export { text as geminiText };

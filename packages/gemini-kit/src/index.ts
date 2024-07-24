/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { kit } from "@breadboard-ai/build";
import { geminiNano } from "./components/nano.js";
import { geminiText } from "./components/text.js";

export { geminiNano, geminiText };

export const geminiKit = kit({
  title: "Gemini Kit",
  url: "npm:@google-labs/gemini-kit",
  version: "0.0.1",
  description:
    "Components for calling Google Gemini Large Language Models (LLMs)",
  components: [geminiText, geminiNano],
});

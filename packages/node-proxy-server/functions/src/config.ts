/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { defineConfig, hasOrigin } from "@google-labs/breadboard/remote";
import Starter from "@google-labs/llm-starter";
import PaLMKit from "@google-labs/palm-kit";

const board = new Board();
board.addKit(Starter);
board.addKit(PaLMKit);

export default defineConfig({
  board,
  proxy: [
    "fetch",
    "palm-generateText",
    "palm-embedText",
    "promptTemplate",
    {
      node: "secrets",
      tunnel: {
        PALM_KEY: ["palm-generateText", "palm-embedText"],
        GEMINI_KEY: {
          to: "fetch",
          when: {
            url: hasOrigin("https://generativelanguage.googleapis.com"),
          },
        },
        GOOGLE_CSE_ID: {
          to: "fetch",
          when: {
            url: hasOrigin("https://www.googleapis.com"),
          },
        },
        API_KEY: {
          to: "fetch",
          when: {
            url: hasOrigin("https://www.googleapis.com"),
          },
        },
        OPENAI_API_KEY: {
          to: "fetch",
          when: {
            url: hasOrigin("https://api.openai.com"),
          },
        },
      },
    },
  ],
});

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asRuntimeKit } from "@google-labs/breadboard";
import { defineConfig, hasOrigin } from "@google-labs/breadboard/remote";
import TemplateKit from "@google-labs/template-kit";
import PaLMKit from "@google-labs/palm-kit";
import Core from "@google-labs/core-kit";

export default defineConfig({
  kits: [asRuntimeKit(TemplateKit), asRuntimeKit(PaLMKit), asRuntimeKit(Core)],
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

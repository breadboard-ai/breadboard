/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModuleLanguage } from "@breadboard-ai/types";

export function defaultModuleContent(language: ModuleLanguage = "javascript") {
  return `/**
 * @fileoverview Add a description for your module here.
 */

export { invoke as default, describe };

async function invoke({context}${language === "typescript" ? ": {context: unknown}" : ""}) {
  return { context }
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
        },
      },
    },
  };
}`;
}

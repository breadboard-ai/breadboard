/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppScreenOutput, LLMContent } from "@breadboard-ai/types";
import * as A2UI from "../../../../a2ui/index.js";
import { isLLMContent, isLLMContentArray } from "../../../../data/common.js";
import { llmContentToA2UIComponents } from "../../../../a2/agent/llm-content-to-a2ui.js";

type AppScreenToA2UIOptions = {
  /**
   * If true, text content will be rendered as h1.
   * Useful for input prompts.
   */
  textAsH1?: boolean;
};

export function appScreenToA2UIProcessor(
  appScreenOutput: AppScreenOutput,
  options: AppScreenToA2UIOptions = {}
): A2UI.v0_8.Types.ModelProcessor | null {
  const { textAsH1 = false } = options;

  if (!appScreenOutput.output) {
    return null;
  }

  const topLevelIds = [];
  const components = [];
  for (const [, outputData] of Object.entries(appScreenOutput.output)) {
    let toAppend = outputData;
    if (typeof outputData === "string") {
      toAppend = {
        role: "model",
        parts: [{ text: outputData }],
      } satisfies LLMContent;
    }
    if (isLLMContent(toAppend)) {
      const newComponents = llmContentToA2UIComponents(toAppend, {
        wrapMediaInCard: true,
        textAsH1,
      });
      topLevelIds.push(...newComponents.ids);
      components.push(...newComponents.parts);
    } else if (isLLMContentArray(toAppend)) {
      for (const llmContent of toAppend) {
        const newComponents = llmContentToA2UIComponents(llmContent, {
          wrapMediaInCard: true,
          textAsH1,
        });
        topLevelIds.push(...newComponents.ids);
        components.push(...newComponents.parts);
      }
    }
  }

  const messages = [
    {
      beginRendering: {
        root: "root",
        surfaceId: "@default",
      },
    },
    {
      surfaceUpdate: {
        surfaceId: "@default",
        components: [
          {
            id: "root",
            weight: 1,
            component: {
              Column: {
                children: { explicitList: topLevelIds },
              },
            },
          },
          ...components,
        ],
      },
    },
  ];

  const processor = A2UI.v0_8.Data.createSignalA2UIModelProcessor();
  processor.clearSurfaces();
  processor.processMessages(messages);

  return processor;
}

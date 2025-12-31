/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeConfiguration } from "@breadboard-ai/types/graph-descriptor.js";
import { LLMContent } from "@breadboard-ai/types/llm-content.js";
import { isLLMContent, isLLMContentArray } from "../data/common.js";
import { Template, TemplatePart } from "@breadboard-ai/utils/template.js";

export { scanConfiguration };

/**
 * Performs an action based on the supplied template part
 */
export type TemplatePartScanner = (part: TemplatePart) => void;

function scanConfiguration(
  config: NodeConfiguration,
  scanner: TemplatePartScanner
): void {
  for (const [, portValue] of Object.entries(config)) {
    let contents: LLMContent[] | null = null;
    if (isLLMContent(portValue)) {
      contents = [portValue];
    } else if (isLLMContentArray(portValue)) {
      contents = portValue;
    }
    if (!contents) continue;
    for (const content of contents) {
      for (const part of content.parts) {
        if ("text" in part) {
          const template = new Template(part.text);
          if (template.hasPlaceholders) {
            template.transform((part) => {
              scanner(part);
              return part;
            });
          }
        }
      }
    }
  }
}
